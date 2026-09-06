import 'dart:convert';

import 'package:http/http.dart' as http;

import 'auth_storage.dart';

/// Base URL of the BirdGuard NestJS api-gateway, deployed on Fly.io.
const String apiBaseUrl = 'https://birdguard-backend.fly.dev';

/// Thrown when the api-gateway returns a non-2xx response.
class ApiException implements Exception {
  final int statusCode;
  final String message;

  ApiException(this.statusCode, this.message);

  @override
  String toString() => 'ApiException($statusCode): $message';
}

/// Thin wrapper around [http.Client] that talks to the api-gateway,
/// attaching the stored JWT as a Bearer token on routes that require it.
class ApiClient {
  ApiClient._internal();
  static final ApiClient instance = ApiClient._internal();

  final http.Client _client = http.Client();

  Uri _uri(String path) => Uri.parse('$apiBaseUrl$path');

  Future<Map<String, String>> _headers({bool auth = false}) async {
    final headers = {'Content-Type': 'application/json'};
    if (auth) {
      final token = await AuthStorage.instance.readToken();
      if (token != null && token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }
    }
    return headers;
  }

  dynamic _decode(http.Response response) {
    if (response.body.isEmpty) return null;
    try {
      return jsonDecode(response.body);
    } on FormatException {
      return response.body;
    }
  }

  Map<String, dynamic> _handle(http.Response response) {
    final decoded = _decode(response);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (decoded is Map<String, dynamic>) return decoded;
      return <String, dynamic>{};
    }
    String message = 'Request failed (${response.statusCode})';
    if (decoded is Map<String, dynamic>) {
      final m = decoded['message'];
      if (m is String) {
        message = m;
      } else if (m is List && m.isNotEmpty) {
        message = m.join(', ');
      }
    } else if (decoded is String && decoded.isNotEmpty) {
      message = decoded;
    }
    throw ApiException(response.statusCode, message);
  }

  /// POST /auth/register
  /// body: { email, username, password, userType, fullName?, phone? }
  Future<Map<String, dynamic>> register({
    required String email,
    required String username,
    required String password,
    required String userType,
    String? fullName,
    String? phone,
  }) async {
    final response = await _client.post(
      _uri('/auth/register'),
      headers: await _headers(),
      body: jsonEncode({
        'email': email,
        'username': username,
        'password': password,
        'userType': userType,
        if (fullName != null && fullName.isNotEmpty) 'fullName': fullName,
        if (phone != null && phone.isNotEmpty) 'phone': phone,
      }),
    );
    return _handle(response);
  }

  /// POST /auth/login
  /// body: { email, password } -> { accessToken }
  /// On success, persists the returned JWT via [AuthStorage].
  Future<String> login({
    required String email,
    required String password,
  }) async {
    final response = await _client.post(
      _uri('/auth/login'),
      headers: await _headers(),
      body: jsonEncode({
        'email': email,
        'password': password,
      }),
    );
    final data = _handle(response);
    final token = data['accessToken'] as String?;
    if (token == null || token.isEmpty) {
      throw ApiException(response.statusCode, 'No access token returned by server');
    }
    await AuthStorage.instance.saveToken(token);
    return token;
  }

  /// POST /device/detector/start (Bearer token) -> { success, output }
  Future<Map<String, dynamic>> startDetector() async {
    final response = await _client.post(
      _uri('/device/detector/start'),
      headers: await _headers(auth: true),
    );
    return _handle(response);
  }

  /// POST /device/detector/stop (Bearer token) -> { success, output }
  Future<Map<String, dynamic>> stopDetector() async {
    final response = await _client.post(
      _uri('/device/detector/stop'),
      headers: await _headers(auth: true),
    );
    return _handle(response);
  }

  /// GET /device/detector/status (Bearer token) -> { running, pid? }
  Future<Map<String, dynamic>> getDetectorStatus() async {
    final response = await _client.get(
      _uri('/device/detector/status'),
      headers: await _headers(auth: true),
    );
    return _handle(response);
  }

  /// POST /device/servo/start (Bearer token)
  /// body: { angle1, seconds1, angle2, seconds2, channel? } -> { success, output }
  /// Starts the field-of-view sweep: the servo cycles between step 1
  /// ([angle1] held for [seconds1]) and step 2 ([angle2] held for
  /// [seconds2]), repeating until stopped. [channel] defaults to 0 (pan)
  /// server-side if omitted.
  Future<Map<String, dynamic>> startServoSweep({
    required double angle1,
    required double seconds1,
    required double angle2,
    required double seconds2,
    int? channel,
  }) async {
    final response = await _client.post(
      _uri('/device/servo/start'),
      headers: await _headers(auth: true),
      body: jsonEncode({
        'angle1': angle1,
        'seconds1': seconds1,
        'angle2': angle2,
        'seconds2': seconds2,
        if (channel != null) 'channel': channel,
      }),
    );
    return _handle(response);
  }

  /// POST /device/servo/stop (Bearer token) -> { success, output }
  Future<Map<String, dynamic>> stopServoSweep() async {
    final response = await _client.post(
      _uri('/device/servo/stop'),
      headers: await _headers(auth: true),
    );
    return _handle(response);
  }

  /// GET /device/servo/status (Bearer token) -> { running, pid? }
  Future<Map<String, dynamic>> getServoSweepStatus() async {
    final response = await _client.get(
      _uri('/device/servo/status'),
      headers: await _headers(auth: true),
    );
    return _handle(response);
  }

  /// POST /device/tilt/down (Bearer token) -> { success, output }
  /// Moves the separate tilt servo straight to its fixed "down" angle.
  /// No parameters and no running process -- this either succeeds or
  /// fails immediately, unlike the pan sweep's start/stop/status trio.
  Future<Map<String, dynamic>> tiltDown() async {
    final response = await _client.post(
      _uri('/device/tilt/down'),
      headers: await _headers(auth: true),
    );
    return _handle(response);
  }

  /// POST /device/tilt/recenter (Bearer token) -> { success, output }
  /// Moves the tilt servo back to its fixed "recentered" angle.
  Future<Map<String, dynamic>> tiltRecenter() async {
    final response = await _client.post(
      _uri('/device/tilt/recenter'),
      headers: await _headers(auth: true),
    );
    return _handle(response);
  }

  /// POST /device/laser/on (Bearer token) -> { success, output }
  /// Drives GPIO12 high, turning the laser on.
  Future<Map<String, dynamic>> laserOn() async {
    final response = await _client.post(
      _uri('/device/laser/on'),
      headers: await _headers(auth: true),
    );
    return _handle(response);
  }

  /// POST /device/laser/off (Bearer token) -> { success, output }
  /// Drives GPIO12 low, turning the laser off.
  Future<Map<String, dynamic>> laserOff() async {
    final response = await _client.post(
      _uri('/device/laser/off'),
      headers: await _headers(auth: true),
    );
    return _handle(response);
  }

  /// GET /detections (Bearer token) -> { success, detections: [...] }
  /// [before] (ISO date string) fetches detections older than that
  /// timestamp, for paginating further back in history.
  Future<Map<String, dynamic>> getDetections({int limit = 30, String? before}) async {
    final queryParams = {
      'limit': '$limit',
      if (before != null) 'before': before,
    };
    final response = await _client.get(
      _uri('/detections').replace(queryParameters: queryParams),
      headers: await _headers(auth: true),
    );
    return _handle(response);
  }
}
