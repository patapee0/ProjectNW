import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kku_dating_flutter/data/interest_options.dart';
import 'package:kku_dating_flutter/data/matching.dart';
import 'package:kku_dating_flutter/widgets/interest_multi_select.dart';

void main() {
  test('interest options are grouped and contain no duplicates', () {
    expect(interestCategories.length, greaterThanOrEqualTo(4));
    expect(allInterestOptions.toSet(), hasLength(allInterestOptions.length));
    expect(allInterestOptions, contains('ญี่ปุ่น'));
    expect(allInterestOptions, contains('อาหารไทย'));
    expect(allInterestOptions, contains('แบดมินตัน'));
  });

  test('orders exact common interests before related-category interests and other profiles', () {
    final mine = {
      'faculty': 'คณะเทคโนโลยี',
      'interests': ['กาแฟ', 'ถ่ายรูป'],
      'preferredInterests': ['ฟุตบอล'],
    };
    final exact = {
      'faculty': 'คณะอื่น',
      'interests': ['ถ่ายรูป'],
    };
    final related = {
      'faculty': 'คณะอื่น',
      'interests': ['อาหารไทย'],
    };
    final unrelated = {
      'faculty': 'คณะเทคโนโลยี',
      'interests': ['ฟุตบอล'],
    };

    expect(
      interestMatchScore(mine, exact),
      greaterThan(interestMatchScore(mine, related)),
    );
    expect(
      interestMatchScore(mine, related),
      greaterThan(interestMatchScore(mine, unrelated)),
    );
  });

  test('a chosen preference boosts relevant profiles without removing unrelated profiles', () {
    final mine = {
      'interests': ['กาแฟ'],
      'preferredInterests': ['แบดมินตัน'],
    };
    final relevant = {
      'interests': ['แบดมินตัน'],
    };
    final unrelated = {
      'interests': ['อนิเมะ'],
    };

    expect(
      interestMatchScore(mine, relevant),
      greaterThan(interestMatchScore(mine, unrelated)),
    );
    expect(interestMatchScore(mine, unrelated), greaterThanOrEqualTo(0));
  });

  testWidgets(
    'interest selector is grouped and allows choosing multiple options',
    (tester) async {
      Set<String> selected = {};
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StatefulBuilder(
              builder: (context, setState) => InterestMultiSelect(
                label: 'ความสนใจของคุณ',
                values: selected,
                onChanged: (values) => setState(() => selected = values),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('เลือกได้หลายข้อ'));
      await tester.pumpAndSettle();
      expect(find.text('ประเทศและสถานที่'), findsOneWidget);
      await tester.tap(find.byType(CheckboxListTile).first);
      await tester.pumpAndSettle();
      await tester.tap(find.byType(CheckboxListTile).at(1));
      await tester.pumpAndSettle();
      await tester.tap(find.text('ยืนยัน'));
      await tester.pumpAndSettle();

      expect(selected, contains('ท่องเที่ยวในประเทศไทย'));
      expect(selected, contains('ท่องเที่ยวต่างประเทศ'));
    },
  );
}
