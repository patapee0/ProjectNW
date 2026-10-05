import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kku_dating_flutter/widgets/faculty_selectors.dart';

void main() {
  testWidgets(
    'empty preference selector shows label and placeholder separately',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Padding(
              padding: const EdgeInsets.all(24),
              child: KkuFacultyMultiSelect(values: const {}, onChanged: (_) {}),
            ),
          ),
        ),
      );

      final label = tester.getTopLeft(find.text('คณะที่สนใจ'));
      final placeholder = tester.getTopLeft(find.text('เลือกได้หลายข้อ'));
      expect(label.dy, lessThan(placeholder.dy));
      expect(find.text('ไม่เลือก = เปิดรับทุกคณะ/วิทยาลัย'), findsOneWidget);
    },
  );
}
