import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

class ProfilePhotoPicker extends StatefulWidget {
  const ProfilePhotoPicker({super.key, required this.imageUrl, required this.onSelected});

  final String? imageUrl;
  final ValueChanged<XFile?> onSelected;

  @override
  State<ProfilePhotoPicker> createState() => _ProfilePhotoPickerState();
}

class _ProfilePhotoPickerState extends State<ProfilePhotoPicker> {
  final _picker = ImagePicker();
  XFile? _selected;
  Future<Uint8List>? _preview;

  Future<void> _chooseImage() async {
    try {
      final file = await _picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 85,
        maxWidth: 1600,
      );
      if (!mounted || file == null) return;
      setState(() {
        _selected = file;
        _preview = file.readAsBytes();
      });
      widget.onSelected(file);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('เลือกรูปไม่สำเร็จ: $error')),
      );
    }
  }

  Widget _avatar() {
    if (_preview != null) {
      return FutureBuilder<Uint8List>(
        future: _preview,
        builder: (context, snapshot) => CircleAvatar(
          radius: 52,
          backgroundColor: const Color(0xFFF1E6E1),
          backgroundImage: snapshot.hasData ? MemoryImage(snapshot.data!) : null,
          child: snapshot.hasData ? null : const Icon(Icons.person, size: 48),
        ),
      );
    }
    final url = widget.imageUrl;
    if (url != null && url.isNotEmpty) {
      return ClipOval(
        child: SizedBox(
          width: 104,
          height: 104,
          child: Image.network(
            url,
            fit: BoxFit.cover,
            errorBuilder: (context, error, stackTrace) => const ColoredBox(
              color: Color(0xFFF1E6E1),
              child: Icon(Icons.person, size: 48),
            ),
          ),
        ),
      );
    }
    return const CircleAvatar(
      radius: 52,
      backgroundColor: Color(0xFFF1E6E1),
      child: Icon(Icons.person, size: 48),
    );
  }

  @override
  Widget build(BuildContext context) => Column(
        children: [
          _avatar(),
          const SizedBox(height: 8),
          OutlinedButton.icon(
          onPressed: _chooseImage,
            icon: const Icon(Icons.add_a_photo_outlined),
            label: Text(_selected == null ? 'เลือกรูปโปรไฟล์' : 'เปลี่ยนรูป'),
          ),
          const Text('JPG, PNG หรือ WEBP · ไม่เกิน 8 MB'),
        ],
      );
}
