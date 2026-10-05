/// Current faculty/college list published by KKU Admissions.
/// Includes colleges and the Nong Khai campus unit as shown by the university.
const kkuFaculties = <String>[
  'คณะเกษตรศาสตร์',
  'คณะเทคโนโลยี',
  'คณะวิศวกรรมศาสตร์',
  'คณะวิทยาศาสตร์',
  'คณะสถาปัตยกรรมศาสตร์',
  'วิทยาลัยการคอมพิวเตอร์',
  'คณะพยาบาลศาสตร์',
  'คณะแพทยศาสตร์',
  'คณะเทคนิคการแพทย์',
  'คณะสาธารณสุขศาสตร์',
  'คณะทันตแพทยศาสตร์',
  'คณะเภสัชศาสตร์',
  'คณะสัตวแพทยศาสตร์',
  'คณะศึกษาศาสตร์',
  'คณะมนุษยศาสตร์และสังคมศาสตร์',
  'คณะบริหารธุรกิจและการบัญชี',
  'คณะศิลปกรรมศาสตร์',
  'คณะเศรษฐศาสตร์',
  'คณะนิติศาสตร์',
  'วิทยาลัยการปกครองท้องถิ่น',
  'วิทยาลัยนานาชาติ',
  'คณะสหวิทยาการ (วิทยาเขตหนองคาย)',
];

/// Converts common legacy abbreviations and canonical names into one value.
String? normalizeKkuFaculty(Object? value) {
  if (value == null) return null;
  final raw = value.toString().trim();
  if (raw.isEmpty) return null;
  for (final faculty in kkuFaculties) {
    if (faculty.toLowerCase() == raw.toLowerCase()) return faculty;
  }

  final key = raw.toLowerCase().replaceAll(RegExp(r'[\s._-]+'), '');
  return switch (key) {
    'cp' ||
    'collegeofcomputing' ||
    'วิทยาลัยคอมพิวเตอร์' => 'วิทยาลัยการคอมพิวเตอร์',
    'huso' ||
    'humanities' ||
    'humanitiesandsocialsciences' ||
    'คณะมนุษยศาสตร์' => 'คณะมนุษยศาสตร์และสังคมศาสตร์',
    'inter' || 'internationalcollege' => 'วิทยาลัยนานาชาติ',
    'cola' ||
    'collegeoflocalaadministration' ||
    'collegeoflocaladministration' => 'วิทยาลัยการปกครองท้องถิ่น',
    _ => null,
  };
}
