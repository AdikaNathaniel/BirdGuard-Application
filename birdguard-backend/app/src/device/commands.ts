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
 * The one exception is buildServoSweepCommand() below, which accepts numeric
 * parameters (angle, seconds) from the app's Settings page. This does not
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
  // Fixed, one-shot tilt commands for the separate tilt servo on PCA9685
  // channel 8 (see tilt-test/pi_tilt_test.py, the standalone script these
  // angles were found and confirmed with). Unlike the pan sweep above,
  // this isn't a long-running background process -- the python one-liner
  // sets the angle and exits immediately, so there's no PID/status to
  // track, just two fire-and-forget actions. 140 and 110 are inverted
  // relative to raw angle for how this servo is mounted: 140 physically
  // tilts it down, 110 physically tilts it back up (see the comments in
  // pi_tilt_test.py for how that was determined).
  // `&& echo TILT_OK || echo TILT_FAILED` (rather than trusting the SSH
  // exec to just not throw) means a real failure inside the python
  // process itself -- e.g. the PCA9685 not responding on the I2C bus, or
  // the venv/import failing -- is distinguishable from a genuine success,
  // instead of both looking identical to DeviceService. It can't detect
  // a channel with nothing physically wired to it, though: the PCA9685
  // happily outputs a PWM signal on any channel 0-15 whether or not
  // anything is listening, so that failure mode still needs a physical
  // check, not a software one.
  // `2>&1` before the OK/FAILED check means a python traceback (e.g. the
  // PCA9685 not responding on the I2C bus) is captured alongside the
  // marker, not silently discarded -- so a real failure is both
  // detectable AND debuggable from the response, not just a bare
  // "FAILED".
  TILT_DOWN:
    'source /home/pi/birdguard-env/bin/activate && ' +
    '(python3 -c "from adafruit_servokit import ServoKit; kit = ServoKit(channels=16); kit.servo[8].angle = 140" 2>&1 ' +
    '&& echo TILT_OK || echo TILT_FAILED)',
  TILT_RECENTER:
    'source /home/pi/birdguard-env/bin/activate && ' +
    '(python3 -c "from adafruit_servokit import ServoKit; kit = ServoKit(channels=16); kit.servo[8].angle = 110" 2>&1 ' +
    '&& echo TILT_OK || echo TILT_FAILED)',
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
