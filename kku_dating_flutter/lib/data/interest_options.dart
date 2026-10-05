class InterestCategory {
  const InterestCategory(this.title, this.options);

  final String title;
  final List<String> options;
}

/// A compact set of common conversation starters, grouped for easier picking.
const interestCategories = <InterestCategory>[
  InterestCategory('ประเทศและสถานที่', [
    'ท่องเที่ยวในประเทศไทย',
    'ท่องเที่ยวต่างประเทศ',
    'ญี่ปุ่น',
    'เกาหลีใต้',
    'ไต้หวัน',
    'ยุโรป',
    'ทะเล',
    'ภูเขา',
    'คาเฟ่',
  ]),
  InterestCategory('อาหารและเครื่องดื่ม', [
    'อาหารไทย',
    'อาหารญี่ปุ่น',
    'อาหารเกาหลี',
    'อาหารอีสาน',
    'อาหารบุฟเฟต์',
    'กาแฟ',
    'ชานม',
    'ของหวาน',
    'ทำอาหาร',
  ]),
  InterestCategory('กีฬาและกิจกรรม', [
    'ฟุตบอล',
    'แบดมินตัน',
    'วอลเลย์บอล',
    'บาสเกตบอล',
    'วิ่ง',
    'ฟิตเนส',
    'ว่ายน้ำ',
    'ปั่นจักรยาน',
    'โยคะ',
    'อีสปอร์ต',
  ]),
  InterestCategory('เพลงและความบันเทิง', [
    'ฟังเพลง',
    'K-pop',
    'T-pop',
    'คอนเสิร์ต',
    'ซีรีส์',
    'ภาพยนตร์',
    'อนิเมะ',
    'อ่านหนังสือ',
  ]),
  InterestCategory('งานอดิเรกและไลฟ์สไตล์', [
    'ถ่ายรูป',
    'วาดรูป',
    'เล่นดนตรี',
    'เต้น',
    'เล่นเกม',
    'ปลูกต้นไม้',
    'ช้อปปิ้ง',
    'งานอาสา',
    'สัตว์เลี้ยง',
    'เรียน/อ่านหนังสือด้วยกัน',
    'เดินเล่นและออกกำลังกายกลางแจ้ง',
  ]),
];

final List<String> allInterestOptions = List.unmodifiable(
  interestCategories.expand((category) => category.options),
);

String normalizeInterest(Object? value) => (value ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .replaceAll(RegExp(r'\s+'), ' ');

String? interestCategoryFor(Object? interest) {
  final key = normalizeInterest(interest);
  if (key.isEmpty) return null;
  for (final category in interestCategories) {
    if (category.options.any((option) => normalizeInterest(option) == key)) {
      return category.title;
    }
  }
  return null;
}
