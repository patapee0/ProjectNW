import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

/// Firebase configuration is supplied at build time; no private service account
/// credentials belong in a client application.
class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    const apiKey = String.fromEnvironment(
      'FIREBASE_API_KEY',
      defaultValue: 'AIzaSyAFMqnVRKD7OwdyIGWsKwmLyTqNmnc2YHY',
    );
    const androidAppId = String.fromEnvironment(
      'FIREBASE_ANDROID_APP_ID',
      defaultValue: '1:994412669909:android:84531df931d99321daeb5c',
    );
    const iosAppId = String.fromEnvironment('FIREBASE_IOS_APP_ID');
    const webAppId = String.fromEnvironment(
      'FIREBASE_WEB_APP_ID',
      defaultValue: '1:994412669909:web:dd12b46dc19a63eddaeb5c',
    );
    const senderId = String.fromEnvironment('FIREBASE_MESSAGING_SENDER_ID', defaultValue: '994412669909');
    const projectId = String.fromEnvironment('FIREBASE_PROJECT_ID', defaultValue: 'projectnetwork-c403e');
    const authDomain = String.fromEnvironment(
      'FIREBASE_AUTH_DOMAIN',
      defaultValue: 'projectnetwork-c403e.firebaseapp.com',
    );
    const storageBucket = String.fromEnvironment(
      'FIREBASE_STORAGE_BUCKET',
      defaultValue: 'projectnetwork-c403e.firebasestorage.app',
    );
    const iosBundleId = String.fromEnvironment('FIREBASE_IOS_BUNDLE_ID', defaultValue: 'com.kkudating.app');

    final appId = switch (defaultTargetPlatform) {
      TargetPlatform.iOS => iosAppId,
      TargetPlatform.android => androidAppId,
      TargetPlatform.macOS || TargetPlatform.windows || TargetPlatform.linux || TargetPlatform.fuchsia => webAppId,
    };
    if ([apiKey, appId, senderId, projectId].any((value) => value.isEmpty)) {
      throw StateError('Firebase is not configured. Add the platform-specific FIREBASE_* build values shown in the project README.');
    }

    return FirebaseOptions(
      apiKey: apiKey,
      appId: appId,
      messagingSenderId: senderId,
      projectId: projectId,
      authDomain: kIsWeb ? (authDomain.isEmpty ? '$projectId.firebaseapp.com' : authDomain) : null,
      storageBucket: storageBucket.isEmpty ? '$projectId.firebasestorage.app' : storageBucket,
      iosBundleId: defaultTargetPlatform == TargetPlatform.iOS ? iosBundleId : null,
    );
  }
}
