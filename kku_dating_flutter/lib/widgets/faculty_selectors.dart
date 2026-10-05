import 'package:flutter/material.dart';

import '../data/kku_faculties.dart';

class KkuFacultyDropdown extends StatelessWidget {
  const KkuFacultyDropdown({
    super.key,
    required this.value,
    required this.onChanged,
  });

  final String? value;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) => DropdownButtonFormField<String>(
    initialValue: value,
    isExpanded: true,
    decoration: const InputDecoration(labelText: 'คณะ/วิทยาลัย'),
    hint: const Text('เลือกคณะ/วิทยาลัยของคุณ'),
    items: kkuFaculties
        .map(
          (faculty) => DropdownMenuItem(value: faculty, child: Text(faculty)),
        )
        .toList(),
    onChanged: onChanged,
    validator: (selected) => selected == null ? 'กรุณาเลือกคณะ/วิทยาลัย' : null,
  );
}

class KkuFacultyMultiSelect extends StatelessWidget {
  const KkuFacultyMultiSelect({
    super.key,
    required this.values,
    required this.onChanged,
    this.maxSelections = 10,
  });

  final Set<String> values;
  final ValueChanged<Set<String>> onChanged;
  final int maxSelections;

  Future<void> _select(BuildContext context) async {
    final selected = Set<String>.from(values);
    final result = await showDialog<Set<String>>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('เลือกคณะ/วิทยาลัยที่สนใจ'),
          content: SizedBox(
            width: 440,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'เลือกได้สูงสุด $maxSelections แห่ง · ${selected.length}/$maxSelections',
                  ),
                ),
                const SizedBox(height: 8),
                Flexible(
                  child: ListView(
                    shrinkWrap: true,
                    children: kkuFaculties.map((faculty) {
                      final checked = selected.contains(faculty);
                      final canAdd = selected.length < maxSelections;
                      return CheckboxListTile(
                        value: checked,
                        dense: true,
                        title: Text(faculty),
                        controlAffinity: ListTileControlAffinity.leading,
                        onChanged: !checked && !canAdd
                            ? null
                            : (value) => setDialogState(() {
                                if (value == true) {
                                  selected.add(faculty);
                                } else {
                                  selected.remove(faculty);
                                }
                              }),
                      );
                    }).toList(),
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

  @override
  Widget build(BuildContext context) => InkWell(
    borderRadius: BorderRadius.circular(4),
    onTap: () => _select(context),
    child: InputDecorator(
      decoration: const InputDecoration(
        labelText: 'คณะที่สนใจ',
        helperText: 'ไม่เลือก = เปิดรับทุกคณะ/วิทยาลัย',
        suffixIcon: Icon(Icons.arrow_drop_down),
      ),
      // The field always has child content (placeholder or chips), so keep
      // the label floated instead of painting it over the empty placeholder.
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
                    (faculty) => Chip(
                      label: Text(faculty),
                      visualDensity: VisualDensity.compact,
                    ),
                  )
                  .toList(),
            ),
    ),
  );
}
