import 'package:flutter_test/flutter_test.dart';
import 'package:kku_dating_flutter/data/kku_faculties.dart';

void main() {
  test(
    'contains current KKU faculty, college, and Nong Khai campus choices',
    () {
      expect(kkuFaculties, hasLength(22));
      expect(kkuFaculties, contains('วิทยาลัยการคอมพิวเตอร์'));
      expect(kkuFaculties, contains('คณะสหวิทยาการ (วิทยาเขตหนองคาย)'));
      expect(kkuFaculties.toSet(), hasLength(22));
    },
  );

  test('normalizes legacy abbreviations used by existing profiles', () {
    expect(normalizeKkuFaculty('CP'), 'วิทยาลัยการคอมพิวเตอร์');
    expect(normalizeKkuFaculty('Huso'), 'คณะมนุษยศาสตร์และสังคมศาสตร์');
    expect(normalizeKkuFaculty('คณะเทคโนโลยี'), 'คณะเทคโนโลยี');
    expect(normalizeKkuFaculty('unknown'), isNull);
  });
}
