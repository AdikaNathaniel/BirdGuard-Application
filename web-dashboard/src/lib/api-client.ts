/**
 * Thin fetch wrapper around the BirdGuard NestJS api-gateway, deployed on
 * Fly.io. Mirrors `birdguard-mobile/lib/services/api_client.dart` route for
 * route, so the web dashboard and the Flutter app stay talking to exactly
 * the same backend contract.
 */

export const API_BASE_URL = "https://birdguard-backend.fly.dev";

const TOKEN_KEY = "birdguard_access_token";

/** Thrown when the api-gateway returns a non-2xx response. */
export class ApiException extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = "ApiException";
  }
}

// localStorage is the web equivalent of the app's flutter_secure_storage --
// not as hardened (no OS keystore), but this is a single-operator dashboard
// talking to a JWT-guarded API, not a place holding raw device credentials.
export const tokenStorage = {
  save(token: string) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TOKEN_KEY, token);
  },
  read(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(TOKEN_KEY);
  },
  clear() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(TOKEN_KEY);
  },
};

/**
 * Decodes the stored JWT's payload (email/username/userType/sub) for
 * display purposes only -- this does NOT verify the signature, since the
 * backend is the one actually enforcing auth on every request.
 */
export function readClaims(): Record<string, unknown> | null {
  const token = tokenStorage.read();
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const decoded = decodeURIComponent(
      atob(padded)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join(""),
    );
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function headers(auth: boolean): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = tokenStorage.read();
    if (token) h["Authorization"] = `Bearer ${token}`;
  }
  return h;
}

async function handle(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  let decoded: unknown = null;
  if (text) {
    try {
      decoded = JSON.parse(text);
    } catch {
      decoded = text;
    }
  }

  if (response.ok) {
    return decoded && typeof decoded === "object"
      ? (decoded as Record<string, unknown>)
      : {};
  }

  let message = `Request failed (${response.status})`;
  if (decoded && typeof decoded === "object") {
    const m = (decoded as Record<string, unknown>)["message"];
    if (typeof m === "string") message = m;
    else if (Array.isArray(m) && m.length > 0) message = m.join(", ");
  } else if (typeof decoded === "string" && decoded.length > 0) {
    message = decoded;
  }
  throw new ApiException(response.status, message);
}

export const apiClient = {
  /** POST /auth/register */
  async register(input: {
    email: string;
    username: string;
    password: string;
    userType: string;
    fullName?: string;
    phone?: string;
  }) {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: "POST",
      headers: headers(false),
      body: JSON.stringify(input),
    });
    return handle(response);
  },

  /** POST /auth/login -- persists the returned JWT on success. */
  async login(input: { email: string; password: string }) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: headers(false),
      body: JSON.stringify(input),
    });
    const data = await handle(response);
    const token = data["accessToken"];
    if (typeof token !== "string" || token.length === 0) {
      throw new ApiException(response.status, "No access token returned by server");
    }
    tokenStorage.save(token);
    return token;
  },

  /** POST /device/detector/start */
  async startDetector() {
    const response = await fetch(`${API_BASE_URL}/device/detector/start`, {
      method: "POST",
      headers: headers(true),
    });
    return handle(response);
  },

  /** POST /device/detector/stop */
  async stopDetector() {
    const response = await fetch(`${API_BASE_URL}/device/detector/stop`, {
      method: "POST",
      headers: headers(true),
    });
    return handle(response);
  },

  /** GET /device/detector/status */
  async getDetectorStatus() {
    const response = await fetch(`${API_BASE_URL}/device/detector/status`, {
      headers: headers(true),
    });
    return handle(response);
  },

  /**
   * POST /device/servo/start -- starts the field-of-view sweep: the servo
   * cycles between step 1 (angle1 held for seconds1) and step 2 (angle2
   * held for seconds2), repeating until stopped.
   */
  async startServoSweep(input: {
    angle1: number;
    seconds1: number;
    angle2: number;
    seconds2: number;
    channel?: number;
  }) {
    const response = await fetch(`${API_BASE_URL}/device/servo/start`, {
      method: "POST",
      headers: headers(true),
      body: JSON.stringify(input),
    });
    return handle(response);
  },

  /** POST /device/servo/stop */
  async stopServoSweep() {
    const response = await fetch(`${API_BASE_URL}/device/servo/stop`, {
      method: "POST",
      headers: headers(true),
    });
    return handle(response);
  },

  /** GET /device/servo/status */
  async getServoSweepStatus() {
    const response = await fetch(`${API_BASE_URL}/device/servo/status`, {
      headers: headers(true),
    });
    return handle(response);
  },

  /**
   * POST /device/tilt/down -- moves the separate tilt servo straight to
   * its fixed "down" angle. No parameters and no running process -- this
   * either succeeds or fails immediately, unlike the pan sweep's
   * start/stop/status trio.
   */
  async tiltDown() {
    const response = await fetch(`${API_BASE_URL}/device/tilt/down`, {
      method: "POST",
      headers: headers(true),
    });
    return handle(response);
  },

  /** POST /device/tilt/recenter -- moves the tilt servo back to its fixed "recentered" angle. */
  async tiltRecenter() {
    const response = await fetch(`${API_BASE_URL}/device/tilt/recenter`, {
      method: "POST",
      headers: headers(true),
    });
    return handle(response);
  },

  /** POST /device/laser/on -- drives GPIO12 high, turning the laser on. */
  async laserOn() {
    const response = await fetch(`${API_BASE_URL}/device/laser/on`, {
      method: "POST",
      headers: headers(true),
    });
    return handle(response);
  },

  /** POST /device/laser/off -- drives GPIO12 low, turning the laser off. */
  async laserOff() {
    const response = await fetch(`${API_BASE_URL}/device/laser/off`, {
      method: "POST",
      headers: headers(true),
    });
    return handle(response);
  },

  /**
   * GET /detections -- `before` (ISO date string) fetches detections older
   * than that timestamp, for paginating further back in history.
   */
  async getDetections(input: { limit?: number; before?: string } = {}) {
    const params = new URLSearchParams();
    params.set("limit", String(input.limit ?? 30));
    if (input.before) params.set("before", input.before);
    const response = await fetch(`${API_BASE_URL}/detections?${params.toString()}`, {
      headers: headers(true),
    });
    return handle(response);
  },
};
