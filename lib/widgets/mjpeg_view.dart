import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

/// A minimal MJPEG stream viewer.
///
/// Reads a `multipart/x-mixed-replace` stream (like the one BirdGuard's
/// Python detector script serves on port 8080) and renders each JPEG
/// frame as it arrives. Frames are located by scanning for JPEG SOI/EOI
/// markers (0xFFD8 ... 0xFFD9) rather than parsing multipart boundaries,
/// so it doesn't depend on a Content-Length header per frame.
///
/// This exists because Flutter's built-in Image.network only supports a
/// single complete static image -- it can't handle a stream that never
/// closes and keeps sending new frames, which is what an MJPEG feed is.
class MjpegView extends StatefulWidget {
  final String url;
  final BoxFit fit;
  final WidgetBuilder loadingBuilder;
  final Widget Function(BuildContext context, Object error) errorBuilder;

  const MjpegView({
    super.key,
    required this.url,
    this.fit = BoxFit.cover,
    required this.loadingBuilder,
    required this.errorBuilder,
  });

  @override
  State<MjpegView> createState() => _MjpegViewState();
}

class _MjpegViewState extends State<MjpegView> {
  Uint8List? _frame;
  Object? _error;
  http.Client? _client;
  StreamSubscription<List<int>>? _subscription;

  @override
  void initState() {
    super.initState();
    _connect();
  }

  @override
  void dispose() {
    _subscription?.cancel();
    _client?.close();
    super.dispose();
  }

  Future<void> _connect() async {
    final client = http.Client();
    _client = client;
    final buffer = <int>[];

    try {
      final request = http.Request('GET', Uri.parse(widget.url));
      final response = await client.send(request);

      if (response.statusCode != 200) {
        throw Exception('HTTP ${response.statusCode}');
      }

      _subscription = response.stream.listen(
        (chunk) {
          buffer.addAll(chunk);
          _extractFrames(buffer);
        },
        onError: (Object e) {
          if (!mounted) return;
          setState(() => _error = e);
        },
        onDone: () {
          if (!mounted) return;
          if (_frame == null) {
            setState(() => _error = Exception('Stream closed'));
          }
        },
        cancelOnError: true,
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e);
    }
  }

  void _extractFrames(List<int> buffer) {
    while (true) {
      final start = _indexOfBytes(buffer, const [0xFF, 0xD8]);
      if (start == -1) {
        // No frame start yet -- keep the last byte in case it's the first
        // half of a marker split across chunks, drop the rest.
        if (buffer.length > 1) {
          buffer.removeRange(0, buffer.length - 1);
        }
        return;
      }
      final end = _indexOfBytes(buffer, const [0xFF, 0xD9], start + 2);
      if (end == -1) {
        // Frame started but not finished -- discard anything before it
        // and wait for more data.
        if (start > 0) buffer.removeRange(0, start);
        return;
      }

      final frameEnd = end + 2;
      final frame = Uint8List.fromList(buffer.sublist(start, frameEnd));
      buffer.removeRange(0, frameEnd);

      if (mounted) {
        setState(() {
          _frame = frame;
          _error = null;
        });
      }
    }
  }

  int _indexOfBytes(List<int> haystack, List<int> needle, [int start = 0]) {
    for (int i = start; i <= haystack.length - needle.length; i++) {
      var match = true;
      for (var j = 0; j < needle.length; j++) {
        if (haystack[i + j] != needle[j]) {
          match = false;
          break;
        }
      }
      if (match) return i;
    }
    return -1;
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return widget.errorBuilder(context, _error!);
    }
    if (_frame == null) {
      return widget.loadingBuilder(context);
    }
    return Image.memory(_frame!, fit: widget.fit, gaplessPlayback: true);
  }
}
