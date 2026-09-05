import 'dart:async';

import 'package:flutter/material.dart';

import '../services/api_client.dart';

class LogsTab extends StatefulWidget {
  const LogsTab({super.key});

  @override
  State<LogsTab> createState() => _LogsTabState();
}

class _LogsTabState extends State<LogsTab> {
  final ScrollController _scrollController = ScrollController();

  final List<Map<String, dynamic>> _detections = [];
  bool _isLoading = false;
  bool _isLoadingMore = false;
  bool _hasError = false;
  bool _hasMore = true;

  Timer? _pollTimer;

  static const int _pageSize = 30;

  @override
  void initState() {
    super.initState();
    _loadFirstPage();
    _scrollController.addListener(_onScroll);
    // The Pi writes detections straight to MongoDB as they happen - without
    // this, the list only ever changes on a manual pull-to-refresh, so a new
    // detection never appears while the tab is just sitting open.
    _pollTimer = Timer.periodic(const Duration(seconds: 8), (_) => _pollForNew());
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  /// Fetches the latest page and prepends only entries newer than what's
  /// already shown, so a background poll never disturbs scroll position or
  /// re-triggers loading state the way a full `_loadFirstPage()` would.
  Future<void> _pollForNew() async {
    if (_isLoading || _isLoadingMore || _detections.isEmpty) return;
    try {
      final result = await ApiClient.instance.getDetections(limit: _pageSize);
      final list = (result['detections'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      if (!mounted || list.isEmpty) return;

      final latestKnown = _detections.first['detectedAt'] as String?;
      final newest = <Map<String, dynamic>>[];
      for (final d in list) {
        final ts = d['detectedAt'] as String?;
        if (latestKnown != null && ts != null && ts.compareTo(latestKnown) <= 0) {
          break; // sorted newest-first, so anything from here on is already shown
        }
        newest.add(d);
      }
      if (newest.isNotEmpty) {
        setState(() => _detections.insertAll(0, newest));
      }
    } catch (_) {
      // Silent - a background poll failing isn't worth surfacing; the next
      // tick (or a manual pull-to-refresh) will catch up.
    }
  }

  void _onScroll() {
    if (!_hasMore || _isLoadingMore || _isLoading) return;
    if (_scrollController.position.pixels >
        _scrollController.position.maxScrollExtent - 200) {
      _loadMore();
    }
  }

  Future<void> _loadFirstPage() async {
    setState(() {
      _isLoading = true;
      _hasError = false;
    });
    try {
      final result = await ApiClient.instance.getDetections(limit: _pageSize);
      final list = (result['detections'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      if (!mounted) return;
      setState(() {
        _detections
          ..clear()
          ..addAll(list);
        _hasMore = list.length == _pageSize;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _hasError = true);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _loadMore() async {
    if (_detections.isEmpty) return;
    setState(() => _isLoadingMore = true);
    try {
      final oldestTimestamp = _detections.last['detectedAt'] as String?;
      final result = await ApiClient.instance.getDetections(
        limit: _pageSize,
        before: oldestTimestamp,
      );
      final list = (result['detections'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      if (!mounted) return;
      setState(() {
        _detections.addAll(list);
        _hasMore = list.length == _pageSize;
      });
    } catch (_) {
      // Silently ignore load-more failures -- the user can retry by
      // scrolling again, no need for a disruptive error state here.
    } finally {
      if (mounted) setState(() => _isLoadingMore = false);
    }
  }

  String _formatTimestamp(String? iso) {
    if (iso == null) return 'Unknown time';
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return iso;

    final now = DateTime.now();
    final diff = now.difference(dt);

    if (diff.inSeconds < 60) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';

    String two(int n) => n.toString().padLeft(2, '0');
    return '${dt.year}-${two(dt.month)}-${two(dt.day)} ${two(dt.hour)}:${two(dt.minute)}';
  }

  Widget _buildDetectionTile(Map<String, dynamic> detection) {
    final label = (detection['label'] as String?) ?? 'unknown';
    final confidence = (detection['confidence'] as num?)?.toDouble() ?? 0.0;
    final timestamp = detection['detectedAt'] as String?;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.shade300, width: 1.5),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: const Color(0xFF1976D2).withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.person, color: Color(0xFF1976D2)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${label[0].toUpperCase()}${label.substring(1)} detected',
                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                ),
                const SizedBox(height: 2),
                Text(
                  _formatTimestamp(timestamp),
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 12.5),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.green.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              '${(confidence * 100).toStringAsFixed(0)}%',
              style: const TextStyle(
                color: Colors.green,
                fontWeight: FontWeight.w600,
                fontSize: 12.5,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading && _detections.isEmpty) {
      return const Center(
        child: CircularProgressIndicator(
          valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF1976D2)),
        ),
      );
    }

    if (_hasError && _detections.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 40, color: Colors.grey.shade500),
            const SizedBox(height: 8),
            Text('Could not load logs', style: TextStyle(color: Colors.grey.shade700)),
            const SizedBox(height: 8),
            TextButton(onPressed: _loadFirstPage, child: const Text('Retry')),
          ],
        ),
      );
    }

    if (_detections.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.history, size: 40, color: Colors.grey.shade400),
            const SizedBox(height: 8),
            Text('No detections yet', style: TextStyle(color: Colors.grey.shade600)),
          ],
        ),
      );
    }

    return RefreshIndicator(
      color: const Color(0xFF1976D2),
      onRefresh: _loadFirstPage,
      child: ListView.builder(
        controller: _scrollController,
        padding: const EdgeInsets.only(top: 4, bottom: 20),
        itemCount: _detections.length + (_hasMore ? 1 : 0),
        itemBuilder: (context, index) {
          if (index >= _detections.length) {
            return const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Center(
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF1976D2)),
                  ),
                ),
              ),
            );
          }
          return _buildDetectionTile(_detections[index]);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Detection Logs',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            Expanded(child: _buildBody()),
          ],
        ),
      ),
    );
  }
}
