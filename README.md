# BirdGuard Mobile

Flutter frontend for the BirdGuard automated laser bird deterrent. Lets a
logged-in user view the Raspberry Pi's live camera feed and start/stop the
person detector, backed by the BirdGuard NestJS microservices API
(`birdguard-backend/`) which performs the actual SSH calls to the Pi.

## Setup

1. Install the Flutter SDK (stable channel) if you haven't already:
   https://docs.flutter.dev/get-started/install

2. Fetch dependencies:

   ```
   cd birdguard-mobile
   flutter pub get
   ```

3. **Point the app at the right hosts** — there are two separate URLs to
   configure, both in the app's source (no `.env` file, keep it simple):

   - **api-gateway URL** — `lib/services/api_client.dart`, constant
     `apiBaseUrl`. This should point at wherever the NestJS `api-gateway`
     service is actually running (its default port is `3000`). Example:

     ```dart
     const String apiBaseUrl = 'http://192.168.43.233:3000';
     ```

     If you're running the backend on your dev machine instead of the Pi,
     use your machine's LAN IP (not `localhost` — the phone/emulator needs a
     reachable address, and `localhost` on the phone means the phone
     itself). For the Android emulator specifically, `10.0.2.2` maps to the
     host machine's `localhost`.

   - **Camera feed URL** — `lib/dashboard_page.dart`, constant
     `cameraFeedUrl`. This points directly at the Pi's existing MJPEG stream
     from `pi-nano-laser/pi_person_detector.py` (default port `8080`) and is
     loaded straight by the app — it does **not** go through the backend.

     ```dart
     const String cameraFeedUrl = 'http://192.168.43.233:8080/';
     ```

   Both currently default to the Pi's known LAN IP
   (`192.168.43.233` — see project notes on the Pi's network setup). Update
   both if the Pi's IP changes or you're pointing at a different
   environment.

4. Run the app on a connected device or emulator:

   ```
   flutter run
   ```

## Notes

- The app expects the backend's API contract as-is:
  - `POST /auth/register` — `{ email, username, password, userType, fullName?, phone? }`
  - `POST /auth/login` — `{ email, password }` -> `{ accessToken }`
  - `POST /device/detector/start` (Bearer token) -> `{ success, output }`
  - `POST /device/detector/stop` (Bearer token) -> `{ success, output }`
  - `GET /device/detector/status` (Bearer token) -> `{ running, pid? }`
- The JWT returned on login is persisted locally via `flutter_secure_storage`
  so the user stays logged in across app restarts (until they tap Logout).
- No raw shell access is ever exposed in the app — the Start/Stop buttons
  only ever call the two fixed, whitelisted backend endpoints above.
- The phone and the Pi (and the backend, if run separately) need to be on
  the same LAN for the default configuration to work. Remote/off-LAN access
  is out of scope for this first pass.
