import 'package:flutter_test/flutter_test.dart';
import 'package:kku_dating_flutter/main.dart';
import 'package:kku_dating_flutter/services/firebase_service.dart';

void main() {
  group('KKU email validation', () {
    test('accepts only the KKU Mail domain and normalizes case and spaces', () {
      expect(FirebaseService.isKkuEmail('student@kkumail.com'), isTrue);
      expect(FirebaseService.isKkuEmail('  STUDENT@KKUMAIL.COM  '), isTrue);
      expect(FirebaseService.isKkuEmail('student@gmail.com'), isFalse);
      expect(FirebaseService.isKkuEmail('student@kkumail.com.example.org'), isFalse);
      expect(FirebaseService.isKkuEmail(''), isFalse);
    });
  });

  testWidgets('explains Firebase setup when app configuration is missing', (tester) async {
    await tester.pumpWidget(const KkuDatingApp(firebaseError: 'Firebase is not configured'));
    expect(find.text('ตั้งค่า Firebase ก่อนเริ่มใช้งาน'), findsOneWidget);
    expect(find.text('Firebase is not configured'), findsOneWidget);
  });
}
