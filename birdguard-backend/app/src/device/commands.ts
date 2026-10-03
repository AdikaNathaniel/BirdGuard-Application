/**
 * Fixed, whitelisted SSH command registry.
 *
 * This is a hard security boundary: DeviceService only ever looks up a command
 * by one of these known keys. No client-supplied *string* is ever interpolated
 * into a shell command. Do not add any code path that builds a command from
 * raw request input - to expose a new device action, add a new named entry here
 * and a matching controller route / service method, following the existing
 * pattern (see device.controller.ts and device.service.ts).
 *
 * The exceptions are buildServoSweepCommand() and buildSetServoAngleCommand()
 * below, which accept numeric parameters (angle, seconds). This does not
 * weaken the boundary above: every parameter is strictly validated as a
 * finite number within a fixed range before being formatted into the
 * command, so the resulting string can never contain shell metacharacters -
 * it's still never a raw, attacker-controlled string reaching the shell.
 */
export const COMMANDS = {
  // `< /dev/null` fully detaches stdin from the SSH session -- without it,
  // the backgrounded (nohup ... &) long-running process can keep the SSH
  // exec channel open indefinitely, since the channel doesn't consider
  // itself "done" until stdin closes too.
  // After backgrounding, wait briefly and confirm the process is actually
  // still alive before reporting success - camera-open failures (e.g. the
  // device still held by a just-killed previous run) happen a moment after
  // launch, not at launch, so echoing $! alone can report a false success.
  // `python -u` disables stdout buffering: without it, output redirected to
  // a file (rather than an interactive terminal) is block-buffered, so the
  // script's print()s sit in memory and never reach detector.log until the
  // buffer fills or the process exits - the process runs fine, the log just
  // looks frozen.
  // Reverted from the pan/tilt-tracking variant (pi_person_detector_cpu_offset.py)
  // back to this one on 2026-08-31 -- that variant's servo turned out to
  // keep spinning even after being commanded back to center (evidence
  // points to a continuous-rotation servo, which needs a different control
  // scheme than angle-hold). Revisit once the servo type is confirmed and
  // the tracking logic is redesigned to match.
  START_DETECTOR:
    'cd ~/BirdGuard/pi-nano-laser && source /home/pi/birdguard-env/bin/activate && ' +
    'nohup python -u pi_person_detector_cpu.py > /home/pi/detector.log 2>&1 < /dev/null & ' +
    'PID=$!; sleep 2; ' +
    'if kill -0 $PID 2>/dev/null; then echo "STARTED $PID"; else echo "FAILED"; tail -n 20 /home/pi/detector.log; fi',
  // SIGTERM alone returns immediately, before the process has actually
  // exited (it can be blocked in a camera read and only notices the signal
  // once it returns to the interpreter). Poll for real death, escalating to
  // SIGKILL, so status checks made right after this command see the true
  // state instead of a stale "still running".
  // The `[p]i_..._cpu.py` pattern (instead of a plain `pi_..._cpu.py`) is the
  // standard "self-match" guard for pgrep/pkill -f: OpenSSH runs this whole
  // command as `sh -c "<this string>"`, so the wrapping shell's own argv
  // contains the literal pattern text too. A plain pgrep/pkill -f pattern
  // therefore matches (and pkill would kill) that wrapping shell itself -
  // pgrep would report a fake, ever-changing "PID" on every call, and pkill
  // would terminate its own parent shell before the command chain's later
  // lines (including the final STOPPED/STILL_RUNNING echo) ever ran. The
  // bracket splits "pi" across a character class so it can never appear as
  // a literal substring in the invoking shell's own command line, while
  // still matching it as a regex against the real target process's argv.
  STOP_DETECTOR:
    'pkill -f [p]i_person_detector_cpu.py || true; ' +
    'for i in $(seq 1 10); do pgrep -f [p]i_person_detector_cpu.py >/dev/null 2>&1 || break; sleep 0.5; done; ' +
    'pkill -9 -f [p]i_person_detector_cpu.py || true; sleep 0.3; ' +
    // A SIGKILL skips the detector's own finally-block cleanup, so force the
    // laser PWM pin and relay low here too -- otherwise a laser that was on
    // at kill time stays on after the app reports "stopped".
    'pinctrl set 12 op dl >/dev/null 2>&1; pinctrl set 17 op dl >/dev/null 2>&1; ' +
    'pgrep -f [p]i_person_detector_cpu.py >/dev/null 2>&1 && echo STILL_RUNNING || echo STOPPED',
  DETECTOR_STATUS: 'pgrep -f [p]i_person_detector_cpu.py || true',
  // Same wait-for-real-death pattern as STOP_DETECTOR above, and the same
  // self-match guard.
  STOP_SERVO_SWEEP:
    'pkill -f [p]i_servo_calibrate.py || true; ' +
    'for i in $(seq 1 10); do pgrep -f [p]i_servo_calibrate.py >/dev/null 2>&1 || break; sleep 0.5; done; ' +
    'pkill -9 -f [p]i_servo_calibrate.py || true; sleep 0.3; ' +
    'pgrep -f [p]i_servo_calibrate.py >/dev/null 2>&1 && echo STILL_RUNNING || echo STOPPED',
  SERVO_SWEEP_STATUS: 'pgrep -f [p]i_servo_calibrate.py || true',
  // Laser = relay (GPIO17, switches the laser PSU's positive line) + PWM
  // signal (GPIO12, jumpered onto PCA9685 ch 12's PWM pin). Same order as
  // agromech_birdguard/laser_tracker/src/hardware/laser.py: on powers the
  // relay first and lets the supply settle before the PWM pin goes high;
  // off drops the PWM pin first, then the relay. GPIO12 alone does nothing
  // with the relay open, so both pins always move together.
  // `2>&1 && echo ... || echo ...` so a real pinctrl failure (e.g.
  // permission denied) is distinguishable from success rather than both
  // looking identical to DeviceService. LASER_OFF tries both pins even if
  // the first fails, so a half-failure never leaves the relay powered.
  LASER_ON:
    '(pinctrl set 17 op dh 2>&1 && sleep 0.1 && pinctrl set 12 op dh 2>&1 ' +
    '&& echo LASER_OK || echo LASER_FAILED)',
  LASER_OFF:
    '(pinctrl set 12 op dl 2>&1; A=$?; pinctrl set 17 op dl 2>&1; B=$?; ' +
    '[ $A -eq 0 ] && [ $B -eq 0 ] && echo LASER_OK || echo LASER_FAILED)',
} as const;

export type CommandKey = keyof typeof COMMANDS;

const SERVO_ANGLE_MIN = 0;
const SERVO_ANGLE_MAX = 180;
const SERVO_SECONDS_MIN = 0.05;
const SERVO_SECONDS_MAX = 5;
const SERVO_CHANNEL_MIN = 0;
const SERVO_CHANNEL_MAX = 15;

function validateServoAngle(angle: number, label: string): void {
  if (!Number.isFinite(angle) || angle < SERVO_ANGLE_MIN || angle > SERVO_ANGLE_MAX) {
    throw new Error(`${label} must be a number between ${SERVO_ANGLE_MIN} and ${SERVO_ANGLE_MAX}`);
  }
}

function validateServoSeconds(seconds: number, label: string): void {
  if (!Number.isFinite(seconds) || seconds < SERVO_SECONDS_MIN || seconds > SERVO_SECONDS_MAX) {
    throw new Error(`${label} must be a number between ${SERVO_SECONDS_MIN} and ${SERVO_SECONDS_MAX}`);
  }
}

/**
 * Builds the SSH command that starts a recurring two-step sweep via
 * pi_servo_calibrate.py's non-interactive CLI mode - the app's Settings
 * page equivalent of typing `recur` then entering exactly two
 * `p<angle>,<seconds>` steps at the interactive prompt. See the security
 * note at the top of this file - every parameter is strictly validated
 * as a bounded number here before ever touching the command string, so
 * this can't become a shell-injection vector no matter what the caller
 * passes in.
 */
export function buildServoSweepCommand(
  channel: number,
  angle1: number,
  seconds1: number,
  angle2: number,
  seconds2: number,
): string {
  if (!Number.isInteger(channel) || channel < SERVO_CHANNEL_MIN || channel > SERVO_CHANNEL_MAX) {
    throw new Error(`channel must be an integer between ${SERVO_CHANNEL_MIN} and ${SERVO_CHANNEL_MAX}`);
  }
  validateServoAngle(angle1, 'angle1');
  validateServoSeconds(seconds1, 'seconds1');
  validateServoAngle(angle2, 'angle2');
  validateServoSeconds(seconds2, 'seconds2');

  // .toFixed() on an already-validated finite number always produces a
  // plain decimal digit string - no quoting/escaping needed, and no way
  // for it to smuggle shell syntax.
  const safeChannel = channel.toFixed(0);
  const safeAngle1 = angle1.toFixed(2);
  const safeSeconds1 = seconds1.toFixed(2);
  const safeAngle2 = angle2.toFixed(2);
  const safeSeconds2 = seconds2.toFixed(2);

  return (
    'cd ~/BirdGuard/pi-driver-motor && source /home/pi/birdguard-env/bin/activate && ' +
    `nohup python -u pi_servo_calibrate.py --channel ${safeChannel} ` +
    `--angle1 ${safeAngle1} --seconds1 ${safeSeconds1} ` +
    `--angle2 ${safeAngle2} --seconds2 ${safeSeconds2} ` +
    '> /home/pi/servo_sweep.log 2>&1 < /dev/null & ' +
    'PID=$!; sleep 1; ' +
    'if kill -0 $PID 2>/dev/null; then echo "STARTED $PID"; else echo "FAILED"; tail -n 20 /home/pi/servo_sweep.log; fi'
  );
}

// Manual pan/tilt control (Settings page) -- same hardware setup as
// agromech_birdguard/laser_tracker/tests/test_03b_servo.py and
// config/settings.py: pan on PCA9685 ch 2 (0-180), tilt on ch 3 (40-140,
// keeps the laser on the backdrop), both homed at 90, 500-2500us pulses.
// LEFT/DOWN decrease the angle, RIGHT/UP increase it, matching the test's
// arrow-key mapping.
export const SERVO_AXES = {
  pan: { channel: 2, min: 0, max: 180, home: 90 },
  tilt: { channel: 3, min: 40, max: 140, home: 90 },
} as const;

export type ServoAxis = keyof typeof SERVO_AXES;

// Degrees per button press. test_03b uses 2 per keypress, but each press
// here is a full SSH round trip (~1-2s), so a bigger step keeps it usable.
export const SERVO_STEP_DEG = 5;

const SERVO_PULSE_MIN_US = 500;
const SERVO_PULSE_MAX_US = 2500;

/**
 * Builds the one-shot SSH command that moves one pan/tilt servo to `angle`.
 * Same security reasoning as buildServoSweepCommand(): `axis` only ever
 * selects a fixed entry from SERVO_AXES, and `angle` is validated as a
 * finite number inside that axis's range before being formatted, so the
 * command can't carry shell syntax.
 */
export function buildSetServoAngleCommand(axis: ServoAxis, angle: number): string {
  const config = SERVO_AXES[axis];
  if (!config) {
    throw new Error(`Unknown servo axis: ${String(axis)}`);
  }
  if (!Number.isFinite(angle) || angle < config.min || angle > config.max) {
    throw new Error(`${axis} angle must be a number between ${config.min} and ${config.max}`);
  }

  const safeAngle = angle.toFixed(2);

  return (
    'source /home/pi/birdguard-env/bin/activate && ' +
    '(python3 -c "from adafruit_servokit import ServoKit; kit = ServoKit(channels=16, address=0x40); ' +
    `s = kit.servo[${config.channel}]; s.set_pulse_width_range(${SERVO_PULSE_MIN_US}, ${SERVO_PULSE_MAX_US}); ` +
    `s.angle = ${safeAngle}" 2>&1 ` +
    '&& echo SERVO_OK || echo SERVO_FAILED)'
  );
}
