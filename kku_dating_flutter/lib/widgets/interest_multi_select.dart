import 'package:flutter/material.dart';

import '../data/interest_options.dart';

class InterestMultiSelect extends StatelessWidget {
  const InterestMultiSelect({
    super.key,
    required this.values,
    required this.onChanged,
    required this.label,
    this.helperText,
    this.maxSelections = 12,
  });

  final Set<String> values;
  final ValueChanged<Set<String>> onChanged;
  final String label;
  final String? helperText;
  final int maxSelections;

  Future<void> _select(BuildContext context) async {
    final selected = Set<String>.from(values);
    final legacy = selected.difference(allInterestOptions.toSet());
    final result = await showDialog<Set<String>>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(label),
          content: SizedBox(
            width: 460,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'เลือกได้สูงสุด $maxSelections ข้อ · ${selected.length}/$maxSelections',
                  ),
                ),
                const SizedBox(height: 8),
                ConstrainedBox(
                  constraints: BoxConstraints(
                    maxHeight: MediaQuery.sizeOf(context).height * 0.58,
                  ),
                  child: ListView(
                    shrinkWrap: true,
                    children: [
                      for (final category in interestCategories) ...[
                        Padding(
                          padding: const EdgeInsets.fromLTRB(12, 14, 8, 4),
                          child: Text(
                            category.title,
                            style: Theme.of(context).textTheme.titleSmall
                                ?.copyWith(fontWeight: FontWeight.bold),
                          ),
                        ),
                        for (final option in category.options)
                          _optionTile(option, selected, setDialogState),
                      ],
                      if (legacy.isNotEmpty) ...[
                        const Divider(),
                        const Padding(
                          padding: EdgeInsets.fromLTRB(12, 8, 8, 4),
                          child: Text(
                            'ข้อมูลเดิมในโปรไฟล์',
                            style: TextStyle(fontWeight: FontWeight.bold),
                          ),
                        ),
                        for (final option in legacy)
                          _optionTile(option, selected, setDialogState),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('ยกเลิก'),
            ),
            TextButton(
              onPressed: () => setDialogState(selected.clear),
              child: const Text('ล้าง'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, selected),
              child: const Text('ยืนยัน'),
            ),
          ],
        ),
      ),
    );
    if (result != null) onChanged(result);
  }

  Widget _optionTile(
    String option,
    Set<String> selected,
    StateSetter setDialogState,
  ) {
    final checked = selected.contains(option);
    final canAdd = selected.length < maxSelections;
    return CheckboxListTile(
      value: checked,
      dense: true,
      title: Text(option),
      controlAffinity: ListTileControlAffinity.leading,
      onChanged: !checked && !canAdd
          ? null
          : (value) => setDialogState(() {
              if (value == true) {
                selected.add(option);
              } else {
                selected.remove(option);
              }
            }),
    );
  }

  @override
  Widget build(BuildContext context) => InkWell(
    borderRadius: BorderRadius.circular(4),
    onTap: () => _select(context),
    child: InputDecorator(
      decoration: InputDecoration(
        labelText: label,
        helperText: helperText,
        suffixIcon: const Icon(Icons.arrow_drop_down),
      ),
      isEmpty: false,
      child: values.isEmpty
          ? const Text(
              'เลือกได้หลายข้อ',
              style: TextStyle(color: Colors.black54),
            )
          : Wrap(
              spacing: 6,
              runSpacing: 2,
              children: values
                  .map(
                    (value) => Chip(
                      label: Text(value),
                      visualDensity: VisualDensity.compact,
                    ),
                  )
                  .toList(),
            ),
    ),
  );
}
