import 'package:flutter/material.dart';

import 'splash_screen.dart';

void main() {
  runApp(const BirdGuardApp());
}

class BirdGuardApp extends StatelessWidget {
  const BirdGuardApp({super.key});

  @override
  Widget build(BuildContext context) {
    // Single accent color driving the whole app's theme -- white
    // backgrounds throughout, this blue for buttons/links/focus states,
    // set centrally here so every screen stays visually consistent
    // without repeating color values at each widget.
    const Color accentBlue = Color(0xFF1976D2);

    return MaterialApp(
      title: 'BirdGuard',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        primarySwatch: Colors.blue,
        primaryColor: accentBlue,
        scaffoldBackgroundColor: Colors.white,
        colorScheme: ColorScheme.fromSeed(
          seedColor: accentBlue,
          primary: accentBlue,
          brightness: Brightness.light,
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: accentBlue,
          iconTheme: IconThemeData(color: accentBlue),
          titleTextStyle: TextStyle(
            color: accentBlue,
            fontSize: 20,
            fontWeight: FontWeight.bold,
          ),
          elevation: 0.5,
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: accentBlue,
            foregroundColor: Colors.white,
            disabledBackgroundColor: Colors.blueGrey.shade100,
            padding: const EdgeInsets.symmetric(vertical: 16),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(18),
            ),
            textStyle: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        textButtonTheme: TextButtonThemeData(
          style: TextButton.styleFrom(
            foregroundColor: accentBlue,
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(18),
            borderSide: BorderSide(color: Colors.grey.shade300),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(18),
            borderSide: BorderSide(color: Colors.grey.shade300),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(18),
            borderSide: const BorderSide(color: accentBlue, width: 2),
          ),
          errorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(18),
            borderSide: const BorderSide(color: Colors.redAccent),
          ),
          focusedErrorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(18),
            borderSide: const BorderSide(color: Colors.redAccent, width: 2),
          ),
          prefixIconColor: accentBlue,
          suffixIconColor: Colors.grey,
        ),
      ),
      home: const SplashScreen(),
    );
  }
}
