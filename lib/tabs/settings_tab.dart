import 'package:flutter/material.dart';

import '../services/api_client.dart';

/// Manual pan/tilt and laser control -- the app version of
/// agromech_birdguard's test_03b_servo.py (arrow keys move the servos,
/// space recenters) and test_04_laser.py (o/f switch the laser). Each
/// button press is one fixed backend move; the backend remembers the
/// current angles and returns them after every move.
class SettingsTab extends StatefulWidget {
  const SettingsTab({super.key});

  @override
  State<SettingsTab> createState() => _SettingsTabState();
}

class _SettingsTabState extends State<SettingsTab> {
  int? _pan;
  int? _tilt;

  // The backend route of the servo move currently waiting on the Pi
  // (e.g. 'pan/left'), or null. Only one move runs at a time -- each one
  // starts from the previous one's result -- so every servo button is
  // disabled while one is in flight, and the pressed one shows a spinner.
  String? _moveInFlight;

  bool _laserOnInFlight = false;
  bool _laserOffInFlight = false;

  @override
  void initState() {
    super.initState();
    _loadPosition();
  }

  Future<void> _loadPosition() async {
    try {
      final result = await ApiClient.instance.getServoPosition();
      if (!mounted) return;
      _applyPosition(result);
    } catch (_) {
      // Angles just stay shown as unknown until the first move succeeds.
    }
  }

  void _applyPosition(Map<String, dynamic> result) {
    setState(() {
      _pan = (result['pan'] as num?)?.round() ?? _pan;
      _tilt = (result['tilt'] as num?)?.round() ?? _tilt;
    });
  }

  Future<void> _move(String move, String failureLabel) async {
    setState(() => _moveInFlight = move);
    try {
      final result = await ApiClient.instance.moveServo(move);
      if (!mounted) return;
      _applyPosition(result);
      if (result['success'] == false) {
        _showSnackBar('Failed to $failureLabel: ${result['error'] ?? 'unknown error'}', isError: true);
      }
    } on ApiException catch (e) {
      _showSnackBar('Failed to $failureLabel: ${e.message}', isError: true);
    } catch (_) {
      _showSnackBar('Failed to $failureLabel: connection error', isError: true);
    } finally {
      if (mounted) setState(() => _moveInFlight = null);
    }
  }

  Future<void> _laserOn() async {
    setState(() => _laserOnInFlight = true);
    try {
      final result = await ApiClient.instance.laserOn();
      if (!mounted) return;
      final success = result['success'] != false;
      _showSnackBar(
        success ? 'Laser on' : 'Failed to turn laser on',
        isError: !success,
      );
    } on ApiException catch (e) {
      _showSnackBar('Failed to turn laser on: ${e.message}', isError: true);
    } catch (_) {
      _showSnackBar('Failed to turn laser on: connection error', isError: true);
    } finally {
      if (mounted) setState(() => _laserOnInFlight = false);
    }
  }

  Future<void> _laserOff() async {
    setState(() => _laserOffInFlight = true);
    try {
      final result = await ApiClient.instance.laserOff();
      if (!mounted) return;
      final success = result['success'] != false;
      _showSnackBar(
        success ? 'Laser off' : 'Failed to turn laser off',
        isError: !success,
      );
    } on ApiException catch (e) {
      _showSnackBar('Failed to turn laser off: ${e.message}', isError: true);
    } catch (_) {
      _showSnackBar('Failed to turn laser off: connection error', isError: true);
    } finally {
      if (mounted) setState(() => _laserOffInFlight = false);
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

  Widget _spinner() {
    return const SizedBox(
      width: 18,
      height: 18,
      child: CircularProgressIndicator(
        strokeWidth: 2,
        valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
      ),
    );
  }

  Widget _buildSectionHeader(String title, int? angle, String range) {
    return Row(
      children: [
        Text(
          title,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
        const Spacer(),
        Text(
          angle == null ? '—  ($range)' : '$angle°  ($range)',
          style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
        ),
      ],
    );
  }

  Widget _buildMoveButton({
    required String move,
    required String label,
    required IconData icon,
    required String failureLabel,
  }) {
    final bool inFlight = _moveInFlight == move;
    return SizedBox(
      height: 50,
      child: ElevatedButton.icon(
        onPressed: _moveInFlight != null ? null : () => _move(move, failureLabel),
        icon: inFlight ? _spinner() : Icon(icon),
        label: Text(label),
      ),
    );
  }

  Widget _buildPanSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildSectionHeader('Pan', _pan, '0-180°'),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: _buildMoveButton(
                move: 'pan/left',
                label: 'Left',
                icon: Icons.arrow_back,
                failureLabel: 'pan left',
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildMoveButton(
                move: 'pan/right',
                label: 'Right',
                icon: Icons.arrow_forward,
                failureLabel: 'pan right',
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildTiltSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildSectionHeader('Tilt', _tilt, '40-140°'),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: _buildMoveButton(
                move: 'tilt/up',
                label: 'Up',
                icon: Icons.arrow_upward,
                failureLabel: 'tilt up',
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildMoveButton(
                move: 'tilt/down',
                label: 'Down',
                icon: Icons.arrow_downward,
                failureLabel: 'tilt down',
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        _buildMoveButton(
          move: 'tilt/recenter',
          label: 'Recenter',
          icon: Icons.vertical_align_center,
          failureLabel: 'recenter',
        ),
      ],
    );
  }

  Widget _buildLaserSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Laser',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: SizedBox(
                height: 50,
                child: ElevatedButton.icon(
                  onPressed: _laserOnInFlight ? null : _laserOn,
                  icon: _laserOnInFlight ? _spinner() : const Icon(Icons.flash_on),
                  label: const Text('On'),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: SizedBox(
                height: 50,
                child: ElevatedButton.icon(
                  onPressed: _laserOffInFlight ? null : _laserOff,
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
                  icon: _laserOffInFlight ? _spinner() : const Icon(Icons.flash_off),
                  label: const Text('Off'),
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
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Stop the detector before moving the servos by hand — it moves '
              'them itself while tracking.',
              style: TextStyle(fontSize: 12.5, color: Colors.grey.shade600),
            ),
            const SizedBox(height: 20),
            _buildPanSection(),
            const SizedBox(height: 32),
            const Divider(),
            const SizedBox(height: 16),
            _buildTiltSection(),
            const SizedBox(height: 32),
            const Divider(),
            const SizedBox(height: 16),
            _buildLaserSection(),
          ],
        ),
      ),
    );
  }
}
