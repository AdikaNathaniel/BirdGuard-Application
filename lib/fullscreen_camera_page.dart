import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'widgets/mjpeg_view.dart';

/// Full-screen view of the live camera feed. Opens its own independent
/// connection to the MJPEG stream (the server supports multiple
/// simultaneous viewers), locked to landscape since the feed itself is
/// landscape-oriented, so it fills the screen edge-to-edge.
class FullscreenCameraPage extends StatefulWidget {
  final String cameraUrl;

  const FullscreenCameraPage({super.key, required this.cameraUrl});

  @override
  State<FullscreenCameraPage> createState() => _FullscreenCameraPageState();
}

class _FullscreenCameraPageState extends State<FullscreenCameraPage> {
  @override
  void initState() {
    super.initState();
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
  }

  @override
  void dispose() {
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    SystemChrome.setPreferredOrientations(DeviceOrientation.values);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Stack(
          children: [
            Center(
              child: MjpegView(
                url: widget.cameraUrl,
                fit: BoxFit.contain,
                loadingBuilder: (context) => const CircularProgressIndicator(
                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                ),
                errorBuilder: (context, error) => const Center(
                  child: Text(
                    'Camera feed unavailable',
                    style: TextStyle(color: Colors.white70),
                  ),
                ),
              ),
            ),
            Positioned(
              top: 8,
              left: 8,
              child: IconButton(
                icon: const Icon(Icons.close, color: Colors.white, size: 30),
                tooltip: 'Exit full screen',
                onPressed: () => Navigator.of(context).pop(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
