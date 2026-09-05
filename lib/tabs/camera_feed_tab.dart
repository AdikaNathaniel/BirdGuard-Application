import 'package:flutter/material.dart';

import '../fullscreen_camera_page.dart';
import '../widgets/mjpeg_view.dart';

/// URL of the Pi's existing MJPEG camera stream (from `pi_person_detector_cpu.py`).
/// This is loaded directly by the Flutter app — it does NOT go through the
/// NestJS backend. CONFIGURE ME: update the host if the Pi's LAN IP changes.
const String cameraFeedUrl = 'http://192.168.43.233:8080/';

class CameraFeedTab extends StatefulWidget {
  const CameraFeedTab({super.key});

  @override
  State<CameraFeedTab> createState() => _CameraFeedTabState();
}

class _CameraFeedTabState extends State<CameraFeedTab> {
  // Bumping this forces the Mjpeg widget to reconnect the stream (used by
  // the "retry" action on the error state).
  int _feedReloadKey = 0;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Live Camera Feed',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            Expanded(child: _buildCameraFeed()),
          ],
        ),
      ),
    );
  }

  Widget _buildCameraFeed() {
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: Container(
        decoration: BoxDecoration(
          border: Border.all(color: Colors.grey.shade300, width: 1.5),
          borderRadius: BorderRadius.circular(16),
        ),
        width: double.infinity,
        child: Stack(
          fit: StackFit.expand,
          children: [
            MjpegView(
              key: ValueKey(_feedReloadKey),
              url: cameraFeedUrl,
              fit: BoxFit.cover,
              loadingBuilder: (context) => const Center(
                child: CircularProgressIndicator(
                  valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF1976D2)),
                ),
              ),
              errorBuilder: (context, error) {
                return Container(
                  color: Colors.grey.shade100,
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.videocam_off_outlined, size: 40, color: Colors.grey.shade500),
                        const SizedBox(height: 8),
                        Text(
                          'Camera feed unavailable',
                          style: TextStyle(color: Colors.grey.shade700),
                        ),
                        const SizedBox(height: 8),
                        IconButton(
                          icon: const Icon(Icons.refresh, color: Color(0xFF1976D2)),
                          tooltip: 'Retry',
                          onPressed: () {
                            setState(() => _feedReloadKey++);
                          },
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
            Positioned(
              bottom: 8,
              right: 8,
              child: Material(
                color: Colors.black.withValues(alpha: 0.45),
                shape: const CircleBorder(),
                child: IconButton(
                  icon: const Icon(Icons.fullscreen, color: Colors.white),
                  tooltip: 'Full screen',
                  onPressed: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const FullscreenCameraPage(cameraUrl: cameraFeedUrl),
                      ),
                    );
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
