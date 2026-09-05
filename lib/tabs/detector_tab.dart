import 'dart:async';

import 'package:flutter/material.dart';

import '../services/api_client.dart';

class DetectorTab extends StatefulWidget {
  const DetectorTab({super.key});

  @override
  State<DetectorTab> createState() => _DetectorTabState();
}

class _DetectorTabState extends State<DetectorTab> {
  Timer? _statusTimer;

  bool? _isRunning; // null = unknown/loading
  String? _pid;
  bool _statusError = false;

  bool _startInFlight = false;
  bool _stopInFlight = false;

  @override
  void initState() {
    super.initState();
    _refreshStatus();
    _statusTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      // Skip while a start/stop is in flight - that action already waits
      // for the Pi to reach the real end state and refreshes itself when
      // it completes, so polling concurrently only risks a racy overwrite.
      if (_startInFlight || _stopInFlight) return;
      _refreshStatus();
    });
  }

  @override
  void dispose() {
    _statusTimer?.cancel();
    super.dispose();
  }

  Future<void> _refreshStatus() async {
    try {
      final result = await ApiClient.instance.getDetectorStatus();
      if (!mounted) return;
      setState(() {
        _isRunning = result['running'] == true;
        _pid = result['pid']?.toString();
        _statusError = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _statusError = true;
      });
    }
  }

  Future<void> _startDetector() async {
    setState(() => _startInFlight = true);
    try {
      final result = await ApiClient.instance.startDetector();
      if (!mounted) return;
      final success = result['success'] != false;
      _showSnackBar(
        success ? 'Detector started' : 'Failed to start detector',
        isError: !success,
      );
      if (success) {
        // The backend already verifies the real outcome before reporting
        // success, so trust it directly instead of spending a second SSH
        // round trip just to re-confirm what this response already told us.
        final output = result['output']?.toString() ?? '';
        final pid = RegExp(r'STARTED\s+(\d+)').firstMatch(output)?.group(1);
        setState(() {
          _isRunning = true;
          _pid = pid;
          _statusError = false;
        });
      } else {
        unawaited(_refreshStatus());
      }
    } on ApiException catch (e) {
      _showSnackBar('Failed to start detector: ${e.message}', isError: true);
      unawaited(_refreshStatus());
    } catch (_) {
      _showSnackBar('Failed to start detector: connection error', isError: true);
      unawaited(_refreshStatus());
    } finally {
      if (mounted) setState(() => _startInFlight = false);
    }
  }

  Future<void> _stopDetector() async {
    setState(() => _stopInFlight = true);
    try {
      final result = await ApiClient.instance.stopDetector();
      if (!mounted) return;
      final success = result['success'] != false;
      _showSnackBar(
        success ? 'Detector stopped' : 'Failed to stop detector',
        isError: !success,
      );
      if (success) {
        setState(() {
          _isRunning = false;
          _pid = null;
          _statusError = false;
        });
      } else {
        unawaited(_refreshStatus());
      }
    } on ApiException catch (e) {
      _showSnackBar('Failed to stop detector: ${e.message}', isError: true);
      unawaited(_refreshStatus());
    } catch (_) {
      _showSnackBar('Failed to stop detector: connection error', isError: true);
      unawaited(_refreshStatus());
    } finally {
      if (mounted) setState(() => _stopInFlight = false);
    }
  }

  void _showSnackBar(String message, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? Colors.redAccent : Colors.green,
      ),
    );
  }

  Widget _buildStatusCard() {
    final bool running = _isRunning == true;
    final bool unknown = _isRunning == null || _statusError;

    final Color dotColor = unknown ? Colors.grey : (running ? Colors.green : Colors.grey);

    String label;
    if (_startInFlight) {
      label = 'Detector: Starting…';
    } else if (_stopInFlight) {
      label = 'Detector: Stopping…';
    } else if (_statusError && _isRunning == null) {
      label = 'Detector: Unknown (status unavailable)';
    } else if (unknown) {
      label = 'Detector: Checking…';
    } else {
      label = running ? 'Detector: Running' : 'Detector: Stopped';
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.shade300, width: 1.5),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Container(
            width: 14,
            height: 14,
            decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              label,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
            ),
          ),
          if (_pid != null && running)
            Text(
              'PID $_pid',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final bool running = _isRunning == true;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Person Detector',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            _buildStatusCard(),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: SizedBox(
                    height: 50,
                    child: ElevatedButton.icon(
                      onPressed: (_startInFlight || running) ? null : _startDetector,
                      icon: _startInFlight
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                              ),
                            )
                          : const Icon(Icons.play_arrow),
                      label: const Text('Start Detector'),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: SizedBox(
                    height: 50,
                    child: ElevatedButton.icon(
                      onPressed: (_stopInFlight || !running) ? null : _stopDetector,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.redAccent,
                        disabledBackgroundColor: Colors.blueGrey.shade100,
                      ),
                      icon: _stopInFlight
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                              ),
                            )
                          : const Icon(Icons.stop),
                      label: const Text('Stop Detector'),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
