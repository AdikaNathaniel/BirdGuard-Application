import 'package:flutter/material.dart';

import 'tabs/camera_feed_tab.dart';
import 'tabs/detector_tab.dart';
import 'tabs/logs_tab.dart';
import 'tabs/profile_tab.dart';

/// Post-login home: a bottom-nav shell with four tabs. Each tab is kept
/// alive via IndexedStack (rather than rebuilt on every switch) so the
/// camera feed's connection and the logs list's scroll position persist
/// while navigating between tabs.
class MainNavigationPage extends StatefulWidget {
  const MainNavigationPage({super.key});

  @override
  State<MainNavigationPage> createState() => _MainNavigationPageState();
}

class _MainNavigationPageState extends State<MainNavigationPage> {
  int _currentIndex = 0;

  static const _tabs = [
    CameraFeedTab(),
    DetectorTab(),
    LogsTab(),
    ProfileTab(),
  ];

  static const _titles = ['Camera Feed', 'Detector', 'Logs', 'Profile'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Text(_titles[_currentIndex]),
      ),
      body: IndexedStack(
        index: _currentIndex,
        children: _tabs,
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) => setState(() => _currentIndex = index),
        backgroundColor: Colors.white,
        indicatorColor: const Color(0xFF1976D2).withValues(alpha: 0.12),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.videocam_outlined),
            selectedIcon: Icon(Icons.videocam, color: Color(0xFF1976D2)),
            label: 'Camera',
          ),
          NavigationDestination(
            icon: Icon(Icons.sensors_outlined),
            selectedIcon: Icon(Icons.sensors, color: Color(0xFF1976D2)),
            label: 'Detector',
          ),
          NavigationDestination(
            icon: Icon(Icons.history_outlined),
            selectedIcon: Icon(Icons.history, color: Color(0xFF1976D2)),
            label: 'Logs',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person, color: Color(0xFF1976D2)),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}
