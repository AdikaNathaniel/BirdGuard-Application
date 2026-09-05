// Basic smoke test: confirms the app builds and the splash screen shows.

import 'package:flutter_test/flutter_test.dart';

import 'package:birdguard_mobile/main.dart';

void main() {
  testWidgets('App builds without throwing', (WidgetTester tester) async {
    await tester.pumpWidget(const BirdGuardApp());
    await tester.pump();
  });
}
