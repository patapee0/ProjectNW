import 'interest_options.dart';

/// Larger values indicate a stronger recommendation. Any exact shared
/// interest ranks ahead of category-only similarity; both rank ahead of a
/// profile with no related interest. Interests never make a candidate ineligible.
int interestMatchScore(
  Map<String, dynamic> mine,
  Map<String, dynamic> candidate,
) {
  final mineInterests = _interestSet(mine['interests']);
  final theirInterests = _interestSet(candidate['interests']);
  final exactShared = mineInterests.intersection(theirInterests).length;

  final mineCategories = mineInterests
      .map(interestCategoryFor)
      .whereType<String>()
      .toSet();
  final theirCategories = theirInterests
      .map(interestCategoryFor)
      .whereType<String>()
      .toSet();
  final relatedCategories = mineCategories.intersection(theirCategories).length;

  final wantedByMe = _interestSet(mine['preferredInterests']);
  final wantedByThem = _interestSet(candidate['preferredInterests']);
  final preferenceFit =
      wantedByMe.intersection(theirInterests).length +
      wantedByThem.intersection(mineInterests).length;
  final mutualInterestCategories =
      wantedByMe
          .map(interestCategoryFor)
          .whereType<String>()
          .toSet()
          .intersection(theirCategories)
          .length +
      wantedByThem
          .map(interestCategoryFor)
          .whereType<String>()
          .toSet()
          .intersection(mineCategories)
          .length;
  final sameFaculty = mine['faculty'] == candidate['faculty'] ? 2 : 0;

  // Limits in Firestore keep interest lists to 12, so the lower-order score
  // cannot outweigh one exact shared interest or one related category.
  return exactShared * 10000 +
      relatedCategories * 1000 +
      mutualInterestCategories * 100 +
      preferenceFit * 10 +
      sameFaculty;
}

Set<String> _interestSet(Object? value) => (value as List? ?? const [])
    .map(normalizeInterest)
    .where((e) => e.isNotEmpty)
    .toSet();
