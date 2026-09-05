import 'dart:async';

import 'package:flutter/material.dart';

import 'services/api_client.dart';

/// Lets the user configure and control the pan servo's field-of-view sweep:
/// a two-step sequence (angle + hold duration for each step) that the
/// servo cycles between repeatedly -- the app equivalent of typing `recur`
/// on the Pi and entering two `p<angle>,<seconds>` steps at the prompt.
/// Talks to the same start/stop/status pattern already proven by the
/// Detector tab, just against the `/device/servo/*` routes.
class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  final _formKey = GlobalKey<FormState>();
  final _angle1Controller = TextEditingController(text: '90');
  final _seconds1Controller = TextEditingController(text: '0.70');
  final _angle2Controller = TextEditingController(text: '140');
  final _seconds2Controller = TextEditingController(text: '0.90');

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
      // Same reasoning as DetectorTab: skip while a start/stop is already
      // in flight, since that action refreshes status itself on completion.
      if (_startInFlight || _stopInFlight) return;
      _refreshStatus();
    });
  }

  @override
  void dispose() {
    _statusTimer?.cancel();
    _angle1Controller.dispose();
    _seconds1Controller.dispose();
    _angle2Controller.dispose();
    _seconds2Controller.dispose();
    super.dispose();
  }

  Future<void> _refreshStatus() async {
    try {
      final result = await ApiClient.instance.getServoSweepStatus();
      if (!mounted) return;
      setState(() {
        _isRunning = result['running'] == true;
        _pid = result['pid']?.toString();
        _statusError = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _statusError = true);
    }
  }

  String? _validateAngle(String? value) {
    final parsed = double.tryParse(value ?? '');
    if (parsed == null) return 'Enter a number';
    if (parsed < 0 || parsed > 180) return 'Must be between 0 and 180';
    return null;
  }

  String? _validateSeconds(String? value) {
    final parsed = double.tryParse(value ?? '');
    if (parsed == null) return 'Enter a number';
    if (parsed < 0.05 || parsed > 5) return 'Must be between 0.05 and 5';
    return null;
  }

  Future<void> _startSweep() async {
    if (!_formKey.currentState!.validate()) return;

    final angle1 = double.parse(_angle1Controller.text);
    final seconds1 = double.parse(_seconds1Controller.text);
    final angle2 = double.parse(_angle2Controller.text);
    final seconds2 = double.parse(_seconds2Controller.text);

    setState(() => _startInFlight = true);
    try {
      final result = await ApiClient.instance.startServoSweep(
        angle1: angle1,
        seconds1: seconds1,
        angle2: angle2,
        seconds2: seconds2,
      );
      if (!mounted) return;
      final success = result['success'] != false;
      _showSnackBar(
        success ? 'Sweep started' : 'Failed to start sweep',
        isError: !success,
      );
      if (success) {
        // Backend already verifies the process is actually alive before
        // reporting success -- trust it directly rather than spending a
        // second SSH round trip just to re-confirm what this already told us.
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
      _showSnackBar('Failed to start sweep: ${e.message}', isError: true);
      unawaited(_refreshStatus());
    } catch (_) {
      _showSnackBar('Failed to start sweep: connection error', isError: true);
      unawaited(_refreshStatus());
    } finally {
      if (mounted) setState(() => _startInFlight = false);
    }
  }

  Future<void> _stopSweep() async {
    setState(() => _stopInFlight = true);
    try {
      final result = await ApiClient.instance.stopServoSweep();
      if (!mounted) return;
      final success = result['success'] != false;
      _showSnackBar(
        success ? 'Sweep stopped' : 'Failed to stop sweep',
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
      _showSnackBar('Failed to stop sweep: ${e.message}', isError: true);
      unawaited(_refreshStatus());
    } catch (_) {
      _showSnackBar('Failed to stop sweep: connection error', isError: true);
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
      label = 'Sweep: Starting…';
    } else if (_stopInFlight) {
      label = 'Sweep: Stopping…';
    } else if (_statusError && _isRunning == null) {
      label = 'Sweep: Unknown (status unavailable)';
    } else if (unknown) {
      label = 'Sweep: Checking…';
    } else {
      label = running ? 'Sweep: Running' : 'Sweep: Stopped';
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

  Widget _buildStep({
    required String title,
    required TextEditingController angleController,
    required TextEditingController secondsController,
    required String angleHint,
    required String secondsHint,
    required bool enabled,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.grey.shade700),
        ),
        const SizedBox(height: 8),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: TextFormField(
                controller: angleController,
                enabled: enabled,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                autovalidateMode: AutovalidateMode.onUserInteraction,
                validator: _validateAngle,
                decoration: InputDecoration(
                  labelText: 'Angle (0-180)',
                  hintText: angleHint,
                  prefixIcon: const Icon(Icons.rotate_right_outlined),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: TextFormField(
                controller: secondsController,
                enabled: enabled,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                autovalidateMode: AutovalidateMode.onUserInteraction,
                validator: _validateSeconds,
                decoration: InputDecoration(
                  labelText: 'Hold (sec)',
                  hintText: secondsHint,
                  prefixIcon: const Icon(Icons.timer_outlined),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final bool running = _isRunning == true;
    // Editing a sweep already in progress would be ambiguous (which value
    // does the app apply, and when?) -- so the fields are locked while a
    // sweep is running; stop it first to change them.
    final bool fieldsEnabled = !running && !_startInFlight && !_stopInFlight;

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Field of View Sweep',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                Text(
                  'The pan servo cycles between two steps -- moving to Step 1\'s '
                  'angle and holding it, then Step 2\'s angle and holding it, '
                  'repeating for as long as the sweep runs. For example: Step 1 '
                  'at 90° for 0.70s, then Step 2 at 140° for 0.90s.',
                  style: TextStyle(fontSize: 12.5, color: Colors.grey.shade600),
                ),
                const SizedBox(height: 20),
                _buildStep(
                  title: 'Step 1',
                  angleController: _angle1Controller,
                  secondsController: _seconds1Controller,
                  angleHint: 'e.g. 90',
                  secondsHint: 'e.g. 0.70',
                  enabled: fieldsEnabled,
                ),
                const SizedBox(height: 20),
                _buildStep(
                  title: 'Step 2',
                  angleController: _angle2Controller,
                  secondsController: _seconds2Controller,
                  angleHint: 'e.g. 140',
                  secondsHint: 'e.g. 0.90',
                  enabled: fieldsEnabled,
                ),
                const SizedBox(height: 24),
                _buildStatusCard(),
                const SizedBox(height: 24),
                Row(
                  children: [
                    Expanded(
                      child: SizedBox(
                        height: 50,
                        child: ElevatedButton.icon(
                          onPressed: (_startInFlight || running) ? null : _startSweep,
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
                          label: const Text('Start Sweep'),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: SizedBox(
                        height: 50,
                        child: ElevatedButton.icon(
                          onPressed: (_stopInFlight || !running) ? null : _stopSweep,
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
                          label: const Text('Stop Sweep'),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
