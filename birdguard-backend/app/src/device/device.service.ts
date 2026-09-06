import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodeSSH } from 'node-ssh';
import { buildServoSweepCommand, COMMANDS, CommandKey } from './commands';

export interface CommandResult {
  success: boolean;
  output?: string;
  error?: string;
}

export interface DetectorStatusResult {
  success: boolean;
  running?: boolean;
  pid?: string;
  error?: string;
}

@Injectable()
export class DeviceService {
  private readonly logger = new Logger(DeviceService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Connects to the Pi fresh, runs one fixed command from the COMMANDS
   * registry, and disconnects. Never accepts a raw command string from a
   * caller - only a key of COMMANDS.
   */
  private async runCommand(key: CommandKey): Promise<CommandResult> {
    return this.execOnPi(COMMANDS[key], key);
  }

  /**
   * Shared SSH connect/exec/disconnect logic behind both runCommand() (the
   * static registry) and the servo-sweep methods below (a validated,
   * dynamically-built command - see the security note in commands.ts).
   * Not exposed outside this class: nothing else can reach the Pi except
   * through the methods already defined on this service.
   */
  private async execOnPi(command: string, label: string): Promise<CommandResult> {
    const ssh = new NodeSSH();
    const execTimeoutMs = Number(this.configService.get('PI_SSH_EXEC_TIMEOUT_MS') ?? 15000);

    try {
      await ssh.connect(this.buildConnectionConfig());

      const result = await Promise.race([
        ssh.execCommand(command),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Command timed out after ${execTimeoutMs}ms`)), execTimeoutMs),
        ),
      ]);

      if (result.code !== 0 && result.code !== null) {
        this.logger.warn(`Command ${label} exited with code ${result.code}: ${result.stderr}`);
      }

      return {
        success: true,
        output: (result.stdout || result.stderr || '').trim(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown SSH error';
      this.logger.error(`Failed to run command ${label}: ${message}`);
      return { success: false, error: message };
    } finally {
      ssh.dispose();
    }
  }

  private buildConnectionConfig() {
    const host = this.configService.get<string>('PI_HOST') ?? '192.168.43.233';
    const username = this.configService.get<string>('PI_USERNAME') ?? 'pi';
    const privateKeyPath = this.configService.get<string>('PI_PRIVATE_KEY_PATH');
    const password = this.configService.get<string>('PI_PASSWORD');
    const readyTimeout = Number(this.configService.get('PI_SSH_TIMEOUT_MS') ?? 10000);

    if (privateKeyPath) {
      return { host, username, privateKeyPath, readyTimeout };
    }

    return { host, username, password, readyTimeout };
  }

  async startDetector(): Promise<CommandResult> {
    const result = await this.runCommand('START_DETECTOR');
    if (result.success) {
      const output = result.output ?? '';
      if (output.startsWith('STARTED')) {
        return { success: true, output };
      }
      // Process was launched but had already exited by the time we checked -
      // surface the log tail so the failure is actionable instead of a bare
      // false "started".
      return { success: false, error: output || 'Detector process exited immediately after launch' };
    }

    // The exec itself can time out client-side (e.g. under elevated
    // Tailscale/DERP latency) after the `nohup ... &` process was already
    // launched on the Pi - nohup fully detaches it from the SSH channel, so
    // losing the channel doesn't kill it. Don't report a false failure for
    // something that may have actually succeeded: verify with an
    // independent, fast status check before giving up.
    const status = await this.getDetectorStatus();
    if (status.success && status.running) {
      return { success: true, output: `STARTED ${status.pid ?? ''}`.trim() };
    }
    return result;
  }

  async stopDetector(): Promise<CommandResult> {
    const result = await this.runCommand('STOP_DETECTOR');
    if (result.success) {
      const output = result.output ?? '';
      if (output.includes('STILL_RUNNING')) {
        return { success: false, error: 'Detector did not stop within the timeout' };
      }
      return { success: true, output };
    }

    // Same reasoning as startDetector: an exec timeout partway through the
    // stop sequence doesn't necessarily mean the pkill never landed - verify
    // before reporting a false failure.
    const status = await this.getDetectorStatus();
    if (status.success && !status.running) {
      return { success: true, output: 'STOPPED' };
    }
    return result;
  }

  async getDetectorStatus(): Promise<DetectorStatusResult> {
    const result = await this.runCommand('DETECTOR_STATUS');

    if (!result.success) {
      return { success: false, error: result.error };
    }

    const pid = (result.output ?? '').split('\n')[0]?.trim();
    const running = Boolean(pid);

    return running ? { success: true, running: true, pid } : { success: true, running: false };
  }

  /**
   * Starts the field-of-view sweep (pi_servo_calibrate.py's two-step
   * recurring sequence) cycling between (angle1, seconds1) and
   * (angle2, seconds2) - the Settings page's "start" action. Defaults to
   * channel 0 (pan), matching the "field of view" framing: a horizontal
   * sweep, not tilt.
   */
  async startServoSweep(
    angle1: number,
    seconds1: number,
    angle2: number,
    seconds2: number,
    channel = 0,
  ): Promise<CommandResult> {
    let command: string;
    try {
      command = buildServoSweepCommand(channel, angle1, seconds1, angle2, seconds2);
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Invalid sweep parameters' };
    }

    const result = await this.execOnPi(command, 'START_SERVO_SWEEP');
    if (result.success) {
      const output = result.output ?? '';
      if (output.startsWith('STARTED')) {
        return { success: true, output };
      }
      return { success: false, error: output || 'Servo sweep process exited immediately after launch' };
    }

    // Same reasoning as startDetector(): an exec timeout doesn't
    // necessarily mean the nohup'd process never launched - verify with
    // an independent status check before reporting a false failure.
    const status = await this.getServoSweepStatus();
    if (status.success && status.running) {
      return { success: true, output: `STARTED ${status.pid ?? ''}`.trim() };
    }
    return result;
  }

  async stopServoSweep(): Promise<CommandResult> {
    const result = await this.runCommand('STOP_SERVO_SWEEP');
    if (result.success) {
      const output = result.output ?? '';
      if (output.includes('STILL_RUNNING')) {
        return { success: false, error: 'Servo sweep did not stop within the timeout' };
      }
      return { success: true, output };
    }

    const status = await this.getServoSweepStatus();
    if (status.success && !status.running) {
      return { success: true, output: 'STOPPED' };
    }
    return result;
  }

  async getServoSweepStatus(): Promise<DetectorStatusResult> {
    const result = await this.runCommand('SERVO_SWEEP_STATUS');

    if (!result.success) {
      return { success: false, error: result.error };
    }

    const pid = (result.output ?? '').split('\n')[0]?.trim();
    const running = Boolean(pid);

    return running ? { success: true, running: true, pid } : { success: true, running: false };
  }

  /**
   * Moves the separate tilt servo (PCA9685 channel 8) straight to its
   * fixed "down" angle. Unlike the detector/sweep commands above, this
   * has no running process to track, but it still needs its own success
   * check: the SSH exec not throwing only proves the connection worked,
   * not that the python command inside it actually succeeded (a PCA9685
   * I2C failure, for instance, would otherwise be reported as a false
   * success). checkTiltResult() below verifies the TILT_OK marker
   * commands.ts prints on the Pi's shell-level success/failure.
   */
  async tiltDown(): Promise<CommandResult> {
    return this.checkTiltResult(await this.runCommand('TILT_DOWN'));
  }

  /** Moves the tilt servo back to its fixed "recentered" angle. */
  async tiltRecenter(): Promise<CommandResult> {
    return this.checkTiltResult(await this.runCommand('TILT_RECENTER'));
  }

  /**
   * Note: this still can't detect a channel with nothing physically
   * wired to it -- the PCA9685 happily outputs a PWM signal on any
   * channel 0-15 whether or not a servo is actually listening, so that
   * failure mode looks identical to a real success from software alone.
   */
  private checkTiltResult(result: CommandResult): CommandResult {
    if (!result.success) return result;

    const output = result.output ?? '';
    if (output.includes('TILT_OK')) {
      return { success: true, output };
    }
    return { success: false, error: output || 'Tilt command did not report success' };
  }
}
