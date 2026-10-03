# birdguard-backend

NestJS backend for BirdGuard. Lets the mobile app and web dashboard register/log in users and
remotely control the Raspberry Pi's person detector, pan/tilt servos and laser over SSH, without ever
exposing Pi credentials or a raw shell to the client.

## Architecture

```
                    HTTP (REST)
Flutter app  ┐
             ├──────────────►  app  (single NestJS process, port 3000)
Web dashboard┘                 ├── AuthModule       (MongoDB, JWT issuance)
                                ├── DeviceModule     (SSH to the Pi -- fixed command whitelist)
                                └── DetectionsModule (MongoDB, read-only)
```

Everything runs as **one Node process** (`app/`) inside one container, alongside a Tailscale
sidecar that gives it a private route to the Pi. This used to be four separate NestJS
microservices (api-gateway + auth-service + device-service + detection-service) talking over
internal TCP -- that split was removed on 2026-09-05 after it OOM-killed the small Fly machine
this runs on: four separate Node processes each carry their own baseline V8/runtime memory
overhead regardless of how little work they're doing, and that overhead (not CPU work) was what
exceeded the machine's 256MB. The machine only ever had 1 shared vCPU anyway, so those four
processes were never running in true parallel across cores -- merging them into one process costs
no real concurrency, only removes the duplicated per-process overhead. The module boundaries
(auth / device / detections) are unchanged in code; only the process/transport layer was removed,
so each module's controller now calls its service directly via normal dependency injection
instead of an internal TCP `ClientProxy` hop.

The Pi's SSH credentials and the Mongo connection string live only in this process's environment
variables (Fly secrets in production) -- never sent to or stored in either client app.

## Running locally

```bash
cd birdguard-backend/app
npm install
npm run start:dev
```

Needs a `.env` (or exported env vars) with at least:
- `MONGODB_URI` -- shared by AuthModule (users) and DetectionsModule (detections)
- `JWT_SECRET`, `JWT_EXPIRES_IN` (defaults to `7d`)
- `PI_HOST` (defaults to `192.168.43.233`), `PI_USERNAME` (defaults to `pi`), and either
  `PI_PRIVATE_KEY_PATH` or `PI_PASSWORD`

## REST API surface (port 3000)

### `POST /auth/register`
Public. Creates a user.

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","username":"birdwatcher","password":"hunter22","userType":"CUSTOMER"}'
```
`201` with the created user (no password hash), or `409` if the email/username is taken.

### `POST /auth/login`
Public. Returns a JWT.

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"hunter22"}'
```
`200` with `{ "accessToken": "<jwt>" }`, or `401` on bad credentials.

### `POST /device/detector/start` / `POST /device/detector/stop` / `GET /device/detector/status`
Require `Authorization: Bearer <accessToken>`. SSHes into the Pi to start/stop/check the person
detector. Returns `{ "success": true, "output": "..." }`, `{ "success": true, "running": bool,
"pid"?: "..." }`, or `{ "success": false, "error": "..." }` (e.g. Pi unreachable).

### `POST /device/servo/start` / `POST /device/servo/stop` / `GET /device/servo/status`
Require JWT. Starts/stops/checks the pan servo's field-of-view sweep -- a two-step sequence
(`{ angle1, seconds1, angle2, seconds2, channel? }`) the servo cycles between. No longer used by
either client app (replaced by the manual pan/tilt routes below).

### `GET /device/position` / `POST /device/pan/{left,right}` / `POST /device/tilt/{up,down,recenter}`
Require JWT. Manual pan/tilt control for the Settings page in both client apps, using the same setup
as `agromech_birdguard/laser_tracker/tests/test_03b_servo.py`: pan on PCA9685 channel 2 (0-180°),
tilt on channel 3 (40-140°), both homed at 90°. Each move steps one servo 5° (clamped to its range)
and returns `{ success, pan, tilt }`. The backend remembers the last angles it commanded, since the
servos can't report their position; after a backend restart these reset to 90/90.

### `POST /device/laser/on` / `POST /device/laser/off`
Require JWT. On powers the relay (GPIO17), waits 0.1s, then drives the laser PWM pin (GPIO12) high;
off drops GPIO12 then GPIO17 -- the same order as `agromech_birdguard`'s `test_04_laser.py`.

### `GET /detections?limit=&before=`
Require JWT. Read-only page of detection events (the Pi writes these directly to MongoDB).
`before` (an ISO timestamp) pages further back in history.

## Security model

- The Pi's SSH credentials live only in this process's environment variables -- never sent to or
  stored in either client app.
- `DeviceService` exposes a fixed, hardcoded whitelist of commands
  (`app/src/device/commands.ts`) -- no endpoint anywhere in this backend accepts a free-text or
  arbitrary shell command from a client. The parameterized exceptions (the servo sweep's
  angle/seconds values and the pan/tilt target angle) are strictly validated as bounded numbers before being formatted into the
  command string, so they can never smuggle shell syntax.
- `/device/*` and `/detections` routes require a valid JWT, issued only by `AuthService` after a
  successful login.

## Adding a new whitelisted device action

Add a new named entry to `COMMANDS` in `app/src/device/commands.ts`, a matching method on
`DeviceService`, and a matching route on `DeviceController` -- follow the existing
start/stop/status pattern. Never add a code path that builds a command from a raw, unvalidated
client string.
