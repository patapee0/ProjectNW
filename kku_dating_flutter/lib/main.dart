import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart' show Firebase;
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import 'firebase_options.dart';
import 'screens/voice_call_page.dart';
import 'services/firebase_service.dart';
import 'data/kku_faculties.dart';
import 'data/matching.dart';
import 'widgets/faculty_selectors.dart';
import 'widgets/interest_multi_select.dart';
import 'widgets/profile_photo_picker.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  String? firebaseError;
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
    await FirebaseFirestore.instance.enableNetwork();
  } catch (error) {
    firebaseError = error.toString();
  }
  runApp(KkuDatingApp(firebaseError: firebaseError));
}

class KkuDatingApp extends StatelessWidget {
  const KkuDatingApp({super.key, this.firebaseError});
  final String? firebaseError;

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'KKU Dating',
    debugShowCheckedModeBanner: false,
    theme: ThemeData(
      colorScheme: ColorScheme.fromSeed(
        seedColor: const Color(0xFFA34A3A),
        brightness: Brightness.light,
      ),
      scaffoldBackgroundColor: const Color(0xFFF4E4E0),
      appBarTheme: const AppBarTheme(
        backgroundColor: Color(0xFFA34A3A),
        foregroundColor: Colors.white,
      ),
      tabBarTheme: const TabBarThemeData(
        labelColor: Colors.white,
        unselectedLabelColor: Color(0xFFFFE9E4),
        indicatorColor: Colors.white,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: const Color(0xFFA34A3A),
        indicatorColor: const Color(0xFFC77B6D),
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(
            color: states.contains(WidgetState.selected)
                ? Colors.white
                : const Color(0xFFFFE9E4),
          ),
        ),
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => TextStyle(
            color: states.contains(WidgetState.selected)
                ? Colors.white
                : const Color(0xFFFFE9E4),
          ),
        ),
      ),
      useMaterial3: true,
      inputDecorationTheme: const InputDecorationTheme(
        border: OutlineInputBorder(),
      ),
    ),
    home: firebaseError == null
        ? const AuthGate()
        : SetupRequiredPage(error: firebaseError!),
  );
}

class SetupRequiredPage extends StatelessWidget {
  const SetupRequiredPage({super.key, required this.error});
  final String error;
  @override
  Widget build(BuildContext context) => Scaffold(
    body: Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 440),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.favorite, size: 64, color: Color(0xFF8B0000)),
              const SizedBox(height: 18),
              Text(
                'ตั้งค่า Firebase ก่อนเริ่มใช้งาน',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 12),
              const Text(
                'ตรวจสอบค่ากำหนด Firebase ตอน build และเปิด Email/Password กับ Firestore ใน Firebase Console รวมถึงตั้งค่า Cloudinary สำหรับอัปโหลดรูป',
              ),
              const SizedBox(height: 12),
              Text(
                error,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});
  @override
  Widget build(BuildContext context) => StreamBuilder<User?>(
    stream: FirebaseService().authChanges,
    builder: (context, snapshot) {
      if (snapshot.hasError)
        return _ErrorPage(
          message: 'ตรวจสอบสถานะบัญชีไม่ได้: ${snapshot.error}',
        );
      if (snapshot.connectionState == ConnectionState.waiting)
        return const Scaffold(body: Center(child: CircularProgressIndicator()));
      final user = snapshot.data;
      if (user == null) return const SignInPage();
      if (!FirebaseService.isKkuEmail(user.email ?? ''))
        return const RestrictedAccountPage();
      if (!user.emailVerified) return VerificationPage(user: user);
      return ProfileGate(user: user);
    },
  );
}

class ProfileGate extends StatelessWidget {
  const ProfileGate({super.key, required this.user});
  final User user;
  @override
  Widget build(BuildContext context) =>
      StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
        stream: FirebaseService().watchMyProfile(),
        builder: (context, snapshot) {
          if (snapshot.hasError)
            return _ErrorPage(
              message: 'ไม่สามารถโหลดโปรไฟล์ได้: ${snapshot.error}',
            );
          if (!snapshot.hasData)
            return const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            );
          if (!snapshot.data!.exists) return const ProfileSetupPage();
          return const HomePage();
        },
      );
}

class RestrictedAccountPage extends StatelessWidget {
  const RestrictedAccountPage({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
    body: Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.school_outlined,
              size: 64,
              color: Color(0xFF8B0000),
            ),
            const SizedBox(height: 16),
            const Text('ใช้ได้เฉพาะบัญชี KKU Mail (@kkumail.com)'),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: () => FirebaseService().signOut(),
              child: const Text('ออกจากระบบ'),
            ),
          ],
        ),
      ),
    ),
  );
}

class SignInPage extends StatefulWidget {
  const SignInPage({super.key});
  @override
  State<SignInPage> createState() => _SignInPageState();
}

class _SignInPageState extends State<SignInPage> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _register = false;
  bool _busy = false;
  String? _error;

  Future<void> _resetPassword() async {
    final email = _email.text.trim();
    if (email.isEmpty || !FirebaseService.isKkuEmail(email)) {
      setState(() => _error = 'กรอกอีเมล @kkumail.com ก่อนขอรีเซ็ตรหัสผ่าน');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await FirebaseService().sendPasswordResetEmail(email);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'ส่งลิงก์ตั้งรหัสผ่านใหม่แล้ว กรุณาตรวจกล่องจดหมายและโฟลเดอร์สแปม',
            ),
          ),
        );
      }
    } on FirebaseAuthException catch (error) {
      if (mounted) setState(() => _error = _authMessage(error));
    } catch (error) {
      if (mounted)
        setState(() => _error = 'ส่งลิงก์รีเซ็ตรหัสผ่านไม่สำเร็จ: $error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _submit() async {
    final email = _email.text.trim();
    if (email.isEmpty || _password.text.isEmpty) {
      setState(() => _error = 'กรอกอีเมลและรหัสผ่านให้ครบ');
      return;
    }
    if (!FirebaseService.isKkuEmail(email)) {
      setState(() => _error = 'ใช้ได้เฉพาะอีเมล @kkumail.com');
      return;
    }
    if (_register && _password.text.length < 6) {
      setState(() => _error = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final service = FirebaseService();
      if (_register) {
        await service.signUp(_email.text, _password.text);
      } else {
        await service.signIn(_email.text, _password.text);
      }
    } on FirebaseAuthException catch (error) {
      setState(() => _error = _authMessage(error));
    } catch (error, stackTrace) {
      debugPrint(
        'KKU Dating auth form failed (${error.runtimeType}): $error\n$stackTrace',
      );
      final details = error.toString().trim();
      setState(
        () => _error = details == 'Error'
            ? (_register
                  ? 'สมัครไม่สำเร็จ: เว็บได้รับข้อผิดพลาดจาก Firebase โดยไม่มีรายละเอียด ลองกด “มีบัญชีแล้ว? เข้าสู่ระบบ” ก่อน เผื่อบัญชีถูกสร้างไปแล้ว'
                  : 'เข้าสู่ระบบไม่สำเร็จ: เว็บได้รับข้อผิดพลาดจาก Firebase โดยไม่มีรายละเอียด กรุณาลองใหม่ในหน้าต่างไม่ระบุตัวตน แล้วแจ้งผู้ดูแล')
            : '$details (${error.runtimeType})',
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(Icons.favorite, size: 76, color: Color(0xFF8B0000)),
              const SizedBox(height: 14),
              Text(
                'KKU Dating',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineMedium
                    ?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                _register
                    ? 'สร้างบัญชีด้วยอีเมล @kkumail.com'
                    : 'เข้าสู่ระบบด้วยบัญชี KKU',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 28),
              TextField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                decoration: const InputDecoration(
                  labelText: 'อีเมล KKU',
                  prefixIcon: Icon(Icons.email_outlined),
                ),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _password,
                obscureText: true,
                autofillHints: const [AutofillHints.password],
                decoration: const InputDecoration(
                  labelText: 'รหัสผ่าน',
                  prefixIcon: Icon(Icons.lock_outline),
                ),
              ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Text(
                    _error!,
                    style: const TextStyle(color: Colors.red),
                  ),
                ),
              const SizedBox(height: 18),
              FilledButton(
                onPressed: _busy ? null : _submit,
                child: _busy
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(
                        _register ? 'สมัครและส่งอีเมลยืนยัน' : 'เข้าสู่ระบบ',
                      ),
              ),
              if (!_register)
                TextButton(
                  onPressed: _busy ? null : _resetPassword,
                  child: const Text('ลืมรหัสผ่าน? ส่งลิงก์ตั้งรหัสใหม่'),
                ),
              TextButton(
                onPressed: _busy
                    ? null
                    : () => setState(() {
                        _register = !_register;
                        _error = null;
                      }),
                child: Text(
                  _register
                      ? 'มีบัญชีแล้ว? เข้าสู่ระบบ'
                      : 'ยังไม่มีบัญชี? สมัครสมาชิก',
                ),
              ),
              const Text(
                'การสมัครจะส่งลิงก์ยืนยันไปยังอีเมลของคุณ',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.black54),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class VerificationPage extends StatefulWidget {
  const VerificationPage({super.key, required this.user});
  final User user;
  @override
  State<VerificationPage> createState() => _VerificationPageState();
}

class _VerificationPageState extends State<VerificationPage> {
  bool _busy = false;
  String? _message;
  Future<void> _check() async {
    setState(() => _busy = true);
    try {
      await FirebaseService().reloadUser();
      if (mounted) {
        setState(
          () => _message = FirebaseService().currentUser?.emailVerified == true
              ? 'ยืนยันแล้ว กำลังเปิดแอป…'
              : 'ยังไม่พบการยืนยัน ลองเปิดลิงก์ในอีเมลแล้วตรวจอีกครั้ง',
        );
      }
    } catch (error) {
      if (mounted) setState(() => _message = 'ตรวจสอบอีเมลไม่สำเร็จ: $error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.mark_email_read_outlined,
              size: 64,
              color: Color(0xFF8B0000),
            ),
            const SizedBox(height: 16),
            const Text(
              'ยืนยันอีเมล KKU ของคุณ',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(widget.user.email ?? ''),
            const SizedBox(height: 16),
            const Text(
              'กดลิงก์ยืนยันที่ส่งไปทางอีเมล จากนั้นกลับมาตรวจสอบสถานะ',
            ),
            if (_message != null)
              Padding(
                padding: const EdgeInsets.all(8),
                child: Text(_message!, textAlign: TextAlign.center),
              ),
            FilledButton(
              onPressed: _busy ? null : _check,
              child: Text(_busy ? 'กำลังตรวจสอบ…' : 'ตรวจสอบอีเมล'),
            ),
            TextButton(
              onPressed: () => FirebaseService().sendVerificationEmail(),
              child: const Text('ส่งอีเมลยืนยันอีกครั้ง'),
            ),
            TextButton(
              onPressed: () => FirebaseService().signOut(),
              child: const Text('ออกจากระบบ'),
            ),
          ],
        ),
      ),
    ),
  );
}

class ProfileSetupPage extends StatefulWidget {
  const ProfileSetupPage({super.key});
  @override
  State<ProfileSetupPage> createState() => _ProfileSetupPageState();
}

class _ProfileSetupPageState extends State<ProfileSetupPage> {
  final _name = TextEditingController();
  final _age = TextEditingController();
  String? _faculty;
  final _bio = TextEditingController();
  final Set<String> _interests = {};
  final Set<String> _preferredInterests = {};
  final _preferredAgeMin = TextEditingController(text: '18');
  final _preferredAgeMax = TextEditingController(text: '99');
  final Set<String> _preferredFaculties = {};
  final _instagramUrl = TextEditingController();
  final _facebookUrl = TextEditingController();
  XFile? _pickedImage;
  bool _busy = false;
  String? _error;
  Future<void> _save() async {
    final age = int.tryParse(_age.text);
    final minAge = int.tryParse(_preferredAgeMin.text);
    final maxAge = int.tryParse(_preferredAgeMax.text);
    if (_name.text.trim().isEmpty ||
        _faculty == null ||
        age == null ||
        age < 18 ||
        age > 99 ||
        minAge == null ||
        maxAge == null ||
        minAge < 18 ||
        maxAge > 99 ||
        minAge > maxAge) {
      setState(
        () => _error =
            'กรอกชื่อ คณะ อายุ และช่วงอายุที่สนใจให้ถูกต้อง (18–99 ปี)',
      );
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final service = FirebaseService();
      final uploadedPhoto = _pickedImage == null
          ? null
          : await service.uploadProfileImage(
              service.currentUser!.uid,
              _pickedImage!,
            );
      await service.saveUserProfile(service.currentUser!.uid, {
        'name': _name.text.trim(),
        'age': age,
        'faculty': _faculty,
        'bio': _bio.text.trim(),
        'photoUrl': uploadedPhoto?.url ?? '',
        if (uploadedPhoto != null) 'photoPublicId': uploadedPhoto.publicId,
        'interests': _interests.take(12).toList(),
        'preferredAgeMin': int.parse(_preferredAgeMin.text),
        'preferredAgeMax': int.parse(_preferredAgeMax.text),
        'preferredFaculties': _preferredFaculties.take(10).toList(),
        'preferredInterests': _preferredInterests.take(12).toList(),
        'isDiscoverable': true,
      });
      await service.savePrivateContactLinks(service.currentUser!.uid, {
        'instagramUrl': _instagramUrl.text,
        'facebookUrl': _facebookUrl.text,
      });
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _age.dispose();
    _bio.dispose();
    _preferredAgeMin.dispose();
    _preferredAgeMax.dispose();
    _instagramUrl.dispose();
    _facebookUrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('สร้างโปรไฟล์')),
    body: ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const Text(
          'เล่าเกี่ยวกับตัวคุณ',
          style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 16),
        ProfilePhotoPicker(
          imageUrl: null,
          onSelected: (file) => setState(() => _pickedImage = file),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: _name,
          maxLength: 80,
          decoration: const InputDecoration(labelText: 'ชื่อที่แสดง'),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _age,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: 'อายุ (18+)'),
        ),
        const SizedBox(height: 12),
        KkuFacultyDropdown(
          value: _faculty,
          onChanged: (value) => setState(() => _faculty = value),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _bio,
          maxLength: 500,
          maxLines: 3,
          decoration: const InputDecoration(labelText: 'แนะนำตัว'),
        ),
        const SizedBox(height: 12),
        InterestMultiSelect(
          label: 'ความสนใจของคุณ',
          helperText: 'เลือกกิจกรรมที่คุณชอบได้สูงสุด 12 ข้อ',
          values: _interests,
          onChanged: (values) => setState(() {
            _interests
              ..clear()
              ..addAll(values);
          }),
        ),
        const SizedBox(height: 12),
        InterestMultiSelect(
          label: 'อยากพบคนที่สนใจเรื่องใด',
          helperText: 'ไม่เลือกก็ได้ ระบบจะใช้เป็นตัวช่วยจัดลำดับเท่านั้น',
          values: _preferredInterests,
          onChanged: (values) => setState(() {
            _preferredInterests
              ..clear()
              ..addAll(values);
          }),
        ),
        const SizedBox(height: 12),
        const Text('ช่วงอายุที่สนใจ'),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _preferredAgeMin,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'ตั้งแต่'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: TextField(
                controller: _preferredAgeMax,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'ถึง'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        KkuFacultyMultiSelect(
          values: _preferredFaculties,
          onChanged: (values) => setState(() {
            _preferredFaculties
              ..clear()
              ..addAll(values);
          }),
        ),
        const SizedBox(height: 12),
        const Text(
          'ลิงก์โซเชียล (ไม่บังคับ · จะแสดงเมื่อทั้งสองฝ่ายยินยอมแชร์อีเมล)',
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _instagramUrl,
          maxLength: 300,
          decoration: const InputDecoration(
            labelText: 'Instagram URL',
            hintText: 'https://instagram.com/ชื่อบัญชี',
          ),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _facebookUrl,
          maxLength: 300,
          decoration: const InputDecoration(
            labelText: 'Facebook URL',
            hintText: 'https://facebook.com/ชื่อบัญชี',
          ),
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.all(8),
            child: Text(_error!, style: const TextStyle(color: Colors.red)),
          ),
        const SizedBox(height: 12),
        FilledButton(
          onPressed: _busy ? null : _save,
          child: Text(_busy ? 'กำลังบันทึก…' : 'บันทึกโปรไฟล์'),
        ),
      ],
    ),
  );
}

class HomePage extends StatefulWidget {
  const HomePage({super.key});
  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  int _tab = 0;

  late final StreamSubscription<QuerySnapshot<Map<String, dynamic>>>
  _incomingCalls;
  late final StreamSubscription<QuerySnapshot<Map<String, dynamic>>>
  _matchesSubscription;
  final _handledCalls = <String>{};
  final _knownMatchStates = <String, String>{};
  bool _matchesInitialized = false;

  @override
  void initState() {
    super.initState();
    _incomingCalls = FirebaseService().watchIncomingCalls().listen(
      (snapshot) {
        for (final change in snapshot.docChanges) {
          final data = change.doc.data();
          if (data == null ||
              data['state'] != 'ringing' ||
              !_handledCalls.add(change.doc.id))
            continue;
          WidgetsBinding.instance.addPostFrameCallback(
            (_) => _showIncomingCall(change.doc),
          );
        }
      },
      onError: (Object error) {
        if (mounted)
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('ตรวจสายเรียกเข้าไม่ได้: $error')),
          );
      },
    );
    _matchesSubscription = FirebaseService().watchMatches().listen(
      (snapshot) {
        if (!_matchesInitialized) {
          for (final doc in snapshot.docs) {
            _knownMatchStates[doc.id] = (doc.data()['status'] ?? 'active')
                .toString();
          }
          _matchesInitialized = true;
          return;
        }
        for (final change in snapshot.docChanges) {
          if (change.type == DocumentChangeType.removed) {
            _knownMatchStates.remove(change.doc.id);
            continue;
          }
          final status = (change.doc.data()?['status'] ?? 'active').toString();
          final previousStatus = _knownMatchStates[change.doc.id];
          _knownMatchStates[change.doc.id] = status;
          if (status == 'active' && previousStatus != 'active') {
            final canSendFirstMessage =
                change.doc.data()?['matchedBy'] ==
                FirebaseService().currentUser?.uid;
            WidgetsBinding.instance.addPostFrameCallback(
              (_) => _showMatchPopup(
                change.doc.id,
                canSendFirstMessage: canSendFirstMessage,
              ),
            );
          }
        }
      },
      onError: (Object error) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('ตรวจสอบแมตช์ใหม่ไม่ได้: $error')),
          );
        }
      },
    );
  }

  Future<void> _showMatchPopup(
    String matchId, {
    required bool canSendFirstMessage,
  }) async {
    if (!mounted) return;
    final messageController = TextEditingController();
    var sending = false;
    Future<void> sendFirstMessage(
      StateSetter updateDialog,
      BuildContext dialogContext,
    ) async {
      final text = messageController.text.trim();
      if (text.isEmpty || sending) return;
      updateDialog(() => sending = true);
      try {
        await FirebaseService().sendMessage(matchId, text);
        if (dialogContext.mounted) Navigator.pop(dialogContext);
      } catch (error) {
        if (dialogContext.mounted) updateDialog(() => sending = false);
        if (mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text('ส่งข้อความไม่ได้: $error')));
        }
      }
    }

    await showDialog<void>(
      barrierDismissible: !canSendFirstMessage,
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setDialogState) => AlertDialog(
          icon: const Icon(Icons.favorite, color: Color(0xFF8B0000), size: 42),
          title: const Center(
            child: Text('MATCH', style: TextStyle(fontWeight: FontWeight.w900)),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'คุณและอีกฝ่ายกดถูกใจกันแล้ว!',
                textAlign: TextAlign.center,
              ),
              if (canSendFirstMessage) ...[
                const SizedBox(height: 18),
                TextField(
                  controller: messageController,
                  autofocus: true,
                  maxLength: 4000,
                  minLines: 1,
                  maxLines: 4,
                  decoration: const InputDecoration(
                    hintText: 'พิมพ์ข้อความแรกถึงคู่แมตช์…',
                    prefixIcon: Icon(Icons.chat_bubble_outline),
                  ),
                  onSubmitted: (_) =>
                      sendFirstMessage(setDialogState, dialogContext),
                ),
              ],
            ],
          ),
          actions: [
            if (!canSendFirstMessage)
              FilledButton(
                onPressed: () => Navigator.pop(dialogContext),
                child: const Text('ปิด'),
              )
            else ...[
              TextButton(
                onPressed: sending ? null : () => Navigator.pop(dialogContext),
                child: const Text('ไว้ทีหลัง'),
              ),
              FilledButton.icon(
                onPressed: sending
                    ? null
                    : () => sendFirstMessage(setDialogState, dialogContext),
                icon: sending
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.send),
                label: Text(sending ? 'กำลังส่ง…' : 'ส่งข้อความ'),
              ),
            ],
          ],
        ),
      ),
    );
    messageController.dispose();
  }

  Future<void> _showIncomingCall(
    DocumentSnapshot<Map<String, dynamic>> call,
  ) async {
    if (!mounted) return;
    final data = call.data();
    if (data == null) return;
    final caller = (data['callerName'] ?? 'สมาชิก KKU').toString();
    final accepted = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        icon: const Icon(Icons.call, color: Color(0xFF8B0000)),
        title: const Text('สายเรียกเข้า'),
        content: Text('$caller กำลังโทรหาคุณ'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('ไม่รับสาย'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('รับสาย'),
          ),
        ],
      ),
    );
    if (!mounted) return;
    try {
      if (accepted == true) {
        await Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => VoiceCallPage(callId: call.id, isCaller: false),
          ),
        );
      } else {
        await call.reference.update({
          'state': 'declined',
          'updatedAt': FieldValue.serverTimestamp(),
        });
      }
    } catch (error) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('จัดการสายไม่ได้: $error')));
    }
  }

  @override
  void dispose() {
    _incomingCalls.cancel();
    _matchesSubscription.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      const DiscoverPage(),
      const MatchesPage(),
      const MyProfilePage(),
    ];
    return Scaffold(
      body: SafeArea(
        child: IndexedStack(index: _tab, children: pages),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (index) => setState(() => _tab = index),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.explore_outlined),
            selectedIcon: Icon(Icons.explore),
            label: 'ค้นพบ',
          ),
          NavigationDestination(
            icon: Icon(Icons.chat_bubble_outline),
            label: 'แชท',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            label: 'โปรไฟล์',
          ),
        ],
      ),
    );
  }
}

class DiscoverPage extends StatefulWidget {
  const DiscoverPage({super.key});
  @override
  State<DiscoverPage> createState() => _DiscoverPageState();
}

class _DiscoverPageState extends State<DiscoverPage> {
  final _seen = <String>{};
  bool _busy = false;
  // Every page load begins a fresh cycle, including profiles swiped in
  // previous sessions; active matches remain filtered separately.
  bool _repeatSwipedProfiles = true;
  int _feedRevision = 0;
  double _dragDistance = 0;
  Future<void> _swipe(String uid, String action) async {
    setState(() => _busy = true);
    try {
      await FirebaseService().swipeUser(uid, action);
      if (!mounted) return;
      setState(() {
        _seen.add(uid);
        _busy = false;
      });
      // HomePage listens for the new match and shows the MATCH popup to both users.
    } catch (error) {
      if (mounted) {
        setState(() => _busy = false);
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('บันทึกไม่สำเร็จ: $error')));
      }
    }
  }

  void _onCardDragUpdate(DragUpdateDetails details) {
    _dragDistance += details.delta.dx;
  }

  void _onCardDragEnd(String uid, DragEndDetails details) {
    if (_busy) return;
    final velocity = details.velocity.pixelsPerSecond.dx;
    final distance = _dragDistance;
    _dragDistance = 0;
    if (distance.abs() < 80 && velocity.abs() < 350) return;
    _swipe(uid, (distance != 0 ? distance : velocity) > 0 ? 'like' : 'pass');
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('KKU Dating'),
      actions: [
        IconButton(
          tooltip: 'ค้นหาโปรไฟล์ใหม่',
          onPressed: () => setState(() {
            _seen.clear();
            _feedRevision++;
          }),
          icon: const Icon(Icons.refresh),
        ),
      ],
    ),
    body: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      key: ValueKey(_feedRevision),
      stream: FirebaseService().watchProfiles(),
      builder: (context, profiles) {
        if (profiles.hasError)
          return _ErrorPage(message: 'โหลดโปรไฟล์ไม่ได้: ${profiles.error}');
        if (!profiles.hasData)
          return const Center(child: CircularProgressIndicator());
        final myUid = FirebaseService().currentUser!.uid;
        return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
          stream: FirebaseService().watchMyProfile(),
          builder: (context, myProfileSnapshot) {
            if (myProfileSnapshot.hasError)
              return _ErrorPage(
                message: 'โหลดค่าความต้องการไม่ได้: ${myProfileSnapshot.error}',
              );
            if (!myProfileSnapshot.hasData)
              return const Center(child: CircularProgressIndicator());
            final myProfile =
                myProfileSnapshot.data!.data() ?? const <String, dynamic>{};
            return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
              stream: FirebaseService().watchMyBlocks(),
              builder: (context, blocks) {
                if (blocks.hasError)
                  return _ErrorPage(
                    message: 'โหลดรายการบล็อกไม่ได้: ${blocks.error}',
                  );
                if (!blocks.hasData)
                  return const Center(child: CircularProgressIndicator());
                final blocked = <String>{};
                for (final block in blocks.data!.docs) {
                  final fields = block.data();
                  blocked.add(
                    fields['blockerId'] == myUid
                        ? fields['blockedId'] as String
                        : fields['blockerId'] as String,
                  );
                }
                return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                  stream: FirebaseFirestore.instance
                      .collection('swipes')
                      .where('swiperId', isEqualTo: myUid)
                      .snapshots(),
                  builder: (context, swipes) {
                    if (swipes.hasError)
                      return _ErrorPage(
                        message: 'โหลดประวัติการเลือกไม่ได้: ${swipes.error}',
                      );
                    if (!swipes.hasData)
                      return const Center(child: CircularProgressIndicator());
                    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                      stream: FirebaseService().watchMatches(),
                      builder: (context, matchesSnapshot) {
                        if (matchesSnapshot.hasError) {
                          return _ErrorPage(
                            message:
                                'โหลดรายการแมตช์เพื่อกรองหน้า swipe ไม่ได้: ${matchesSnapshot.error}',
                          );
                        }
                        if (!matchesSnapshot.hasData) {
                          return const Center(
                            child: CircularProgressIndicator(),
                          );
                        }
                        final activeMatchedProfiles = <String>{};
                        for (final match in matchesSnapshot.data!.docs) {
                          final data = match.data();
                          final users = List<String>.from(
                            data['users'] ?? const <String>[],
                          );
                          if (users.length == 2 &&
                              users.contains(myUid) &&
                              data['status'] != 'unmatched') {
                            activeMatchedProfiles.add(
                              users.firstWhere((id) => id != myUid),
                            );
                          }
                        }
                        final alreadySwiped = swipes.data!.docs
                            .map((swipe) => swipe.data()['swipedId'])
                            .whereType<String>()
                            .toSet();
                        final availableProfiles = profiles.data!.docs
                            .where(
                              (doc) =>
                                  doc.id != myUid &&
                                  !blocked.contains(doc.id) &&
                                  !activeMatchedProfiles.contains(doc.id),
                            )
                            .toList();
                        final compatibleProfiles = availableProfiles
                            .where(
                              (doc) =>
                                  _profilesCompatible(myProfile, doc.data()),
                            )
                            .toList();
                        // Keep discovery populated when preferences exclude every
                        // available profile; show preference-matched profiles first
                        // whenever at least one match exists.
                        final eligibleProfiles = compatibleProfiles.isNotEmpty
                            ? compatibleProfiles
                            : availableProfiles;
                        final unseenProfiles = eligibleProfiles
                            .where((doc) => !_seen.contains(doc.id))
                            .toList();
                        final freshProfiles = unseenProfiles
                            .where((doc) => !alreadySwiped.contains(doc.id))
                            .toList();
                        final candidates =
                            (_repeatSwipedProfiles
                                  ? unseenProfiles
                                  : freshProfiles)
                              ..sort(
                                (a, b) =>
                                    _profileMatchScore(
                                      myProfile,
                                      b.data(),
                                    ).compareTo(
                                      _profileMatchScore(myProfile, a.data()),
                                    ),
                              );
                        if (eligibleProfiles.isEmpty)
                          return const _EmptyPage(
                            icon: Icons.favorite_border,
                            title: 'ยังไม่มีโปรไฟล์ให้ปัด',
                            detail: 'ลองกลับมาดูอีกครั้งภายหลัง',
                          );
                        if (candidates.isEmpty)
                          return _EmptyPage(
                            icon: Icons.favorite_border,
                            title: 'หมดโปรไฟล์ในรอบนี้แล้ว',
                            detail: _repeatSwipedProfiles
                                ? 'กดปุ่มด้านล่างเพื่อเริ่มปัดโปรไฟล์เดิมอีกรอบ'
                                : 'กดรีเฟรชเพื่อเริ่มปัดโปรไฟล์เดิมอีกครั้ง',
                            actionLabel: _repeatSwipedProfiles
                                ? 'เริ่มรอบใหม่'
                                : 'รีเฟรชเพื่อปัดโปรไฟล์เดิม',
                            onAction: () => setState(() {
                              _seen.clear();
                              _repeatSwipedProfiles = true;
                              _feedRevision++;
                            }),
                          );
                        final doc = candidates.first;
                        final data = doc.data();
                        final interests = List<String>.from(
                          data['interests'] ?? const <String>[],
                        );
                        final score = _profileMatchScore(myProfile, data);
                        return Center(
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 520),
                            child: Padding(
                              padding: const EdgeInsets.all(18),
                              child: Column(
                                children: [
                                  Expanded(
                                    child: GestureDetector(
                                      onHorizontalDragUpdate: _onCardDragUpdate,
                                      onHorizontalDragEnd: (details) =>
                                          _onCardDragEnd(doc.id, details),
                                      child: Card(
                                        clipBehavior: Clip.antiAlias,
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.stretch,
                                          children: [
                                            Expanded(
                                              child:
                                                  data['photoUrl'] is String &&
                                                      (data['photoUrl']
                                                              as String)
                                                          .isNotEmpty
                                                  ? Image.network(
                                                      data['photoUrl'],
                                                      fit: BoxFit.cover,
                                                      errorBuilder: (
                                                        context,
                                                        error,
                                                        stackTrace,
                                                      ) => const _PhotoPlaceholder(),
                                                    )
                                                  : const _PhotoPlaceholder(),
                                            ),
                                            Padding(
                                              padding: const EdgeInsets.all(18),
                                              child: Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.start,
                                                children: [
                                                  Text(
                                                    '${data['name'] ?? 'สมาชิก KKU'}, ${data['age'] ?? ''}',
                                                    style: Theme.of(context)
                                                        .textTheme
                                                        .headlineSmall
                                                        ?.copyWith(
                                                          fontWeight:
                                                              FontWeight.bold,
                                                        ),
                                                  ),
                                                  Text(
                                                    '${data['faculty'] ?? ''} · คะแนนความเข้ากัน $score',
                                                  ),
                                                  if ((data['bio'] ?? '')
                                                      .toString()
                                                      .isNotEmpty)
                                                    Padding(
                                                      padding:
                                                          const EdgeInsets.only(
                                                            top: 8,
                                                          ),
                                                      child: Text(data['bio']),
                                                    ),
                                                  if (interests.isNotEmpty)
                                                    Padding(
                                                      padding:
                                                          const EdgeInsets.only(
                                                            top: 8,
                                                          ),
                                                      child: Wrap(
                                                        spacing: 6,
                                                        runSpacing: 2,
                                                        children: interests
                                                            .take(6)
                                                            .map(
                                                              (item) => Chip(
                                                                label: Text(
                                                                  item,
                                                                ),
                                                                visualDensity:
                                                                    VisualDensity
                                                                        .compact,
                                                              ),
                                                            )
                                                            .toList(),
                                                      ),
                                                    ),
                                                ],
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 12),
                                  Row(
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceEvenly,
                                    children: [
                                      IconButton.filledTonal(
                                        onPressed: _busy
                                            ? null
                                            : () => _swipe(doc.id, 'pass'),
                                        icon: const Icon(
                                          Icons.close,
                                          color: Colors.red,
                                        ),
                                        iconSize: 32,
                                      ),
                                      IconButton.filled(
                                        onPressed: _busy
                                            ? null
                                            : () => _swipe(doc.id, 'superlike'),
                                        icon: const Icon(Icons.star),
                                        iconSize: 28,
                                      ),
                                      IconButton.filled(
                                        onPressed: _busy
                                            ? null
                                            : () => _swipe(doc.id, 'like'),
                                        icon: const Icon(Icons.favorite),
                                        iconSize: 32,
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ),
                        );
                      },
                    );
                  },
                );
              },
            );
          },
        );
      },
    ),
  );
}

bool _profilesCompatible(
  Map<String, dynamic> mine,
  Map<String, dynamic> candidate,
) {
  final age = (candidate['age'] as num?)?.toInt() ?? 18;
  final myAge = (mine['age'] as num?)?.toInt() ?? 18;
  final myMin = (mine['preferredAgeMin'] as num?)?.toInt() ?? 18;
  final myMax = (mine['preferredAgeMax'] as num?)?.toInt() ?? 99;
  final theirMin = (candidate['preferredAgeMin'] as num?)?.toInt() ?? 18;
  final theirMax = (candidate['preferredAgeMax'] as num?)?.toInt() ?? 99;
  if (age < myMin || age > myMax || myAge < theirMin || myAge > theirMax)
    return false;
  final mineFaculty = (mine['preferredFaculties'] as List? ?? const [])
      .map(normalizeKkuFaculty)
      .whereType<String>()
      .toSet();
  final theirFaculty = (candidate['preferredFaculties'] as List? ?? const [])
      .map(normalizeKkuFaculty)
      .whereType<String>()
      .toSet();
  final candidateFaculty = normalizeKkuFaculty(candidate['faculty']);
  final myFaculty = normalizeKkuFaculty(mine['faculty']);
  if (mineFaculty.isNotEmpty && !mineFaculty.contains(candidateFaculty))
    return false;
  if (theirFaculty.isNotEmpty && !theirFaculty.contains(myFaculty))
    return false;
  return true;
}

int _profileMatchScore(
  Map<String, dynamic> mine,
  Map<String, dynamic> candidate,
) => interestMatchScore(mine, candidate);

class MatchesPage extends StatelessWidget {
  const MatchesPage({super.key});

  @override
  Widget build(BuildContext context) => DefaultTabController(
    length: 2,
    child: Scaffold(
      appBar: AppBar(
        title: const Text('KKU Dating'),
        bottom: const TabBar(
          tabs: [
            Tab(text: 'Matches'),
            Tab(text: 'Messages'),
          ],
        ),
      ),
      body: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
        stream: FirebaseService().watchMyBlocks(),
        builder: (context, blockSnapshot) {
          if (blockSnapshot.hasError)
            return _ErrorPage(
              message: 'โหลดรายการบล็อกไม่ได้: ${blockSnapshot.error}',
            );
          if (!blockSnapshot.hasData)
            return const Center(child: CircularProgressIndicator());
          final uid = FirebaseService().currentUser!.uid;
          final blocked = <String>{};
          for (final block in blockSnapshot.data!.docs) {
            final fields = block.data();
            blocked.add(
              fields['blockerId'] == uid
                  ? fields['blockedId'] as String
                  : fields['blockerId'] as String,
            );
          }
          return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
            stream: FirebaseService().watchMatches(),
            builder: (context, snapshot) {
              if (snapshot.hasError)
                return _ErrorPage(
                  message: 'โหลดแมตช์ไม่ได้: ${snapshot.error}',
                );
              if (!snapshot.hasData)
                return const Center(child: CircularProgressIndicator());
              final matches = snapshot.data!.docs.where((doc) {
                final users = List<String>.from(
                  doc.data()['users'] ?? const [],
                );
                return users.length == 2 &&
                    users.contains(uid) &&
                    doc.data()['status'] != 'unmatched' &&
                    !blocked.contains(users.firstWhere((id) => id != uid));
              }).toList();
              final newMatches = matches
                  .where(
                    (doc) => (doc.data()['lastMessage'] ?? '')
                        .toString()
                        .trim()
                        .isEmpty,
                  )
                  .toList();
              final conversations = matches
                  .where(
                    (doc) => (doc.data()['lastMessage'] ?? '')
                        .toString()
                        .trim()
                        .isNotEmpty,
                  )
                  .toList();
              return TabBarView(
                children: [
                  newMatches.isEmpty
                      ? const _EmptyPage(
                          icon: Icons.favorite_border,
                          title: 'ยังไม่มีแมตช์ใหม่',
                          detail:
                              'คู่ที่แมตช์แล้วและยังไม่เริ่มคุยจะแสดงที่นี่',
                        )
                      : GridView.builder(
                          padding: const EdgeInsets.all(16),
                          gridDelegate:
                              const SliverGridDelegateWithMaxCrossAxisExtent(
                                maxCrossAxisExtent: 190,
                                mainAxisSpacing: 14,
                                crossAxisSpacing: 14,
                                childAspectRatio: 0.72,
                              ),
                          itemCount: newMatches.length,
                          itemBuilder: (context, index) => _MatchPreviewTile(
                            match: newMatches[index],
                            uid: uid,
                            showPreview: false,
                          ),
                        ),
                  conversations.isEmpty
                      ? const _EmptyPage(
                          icon: Icons.chat_bubble_outline,
                          title: 'ยังไม่มีข้อความ',
                          detail: 'เริ่มคุยกับคู่แมตช์ แล้วบทสนทนาจะแสดงที่นี่',
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          itemCount: conversations.length,
                          separatorBuilder: (_, _) =>
                              const Divider(height: 1, indent: 86),
                          itemBuilder: (context, index) => _MatchPreviewTile(
                            match: conversations[index],
                            uid: uid,
                            showPreview: true,
                          ),
                        ),
                ],
              );
            },
          );
        },
      ),
    ),
  );
}

class _MatchPreviewTile extends StatefulWidget {
  const _MatchPreviewTile({
    required this.match,
    required this.uid,
    required this.showPreview,
  });
  final QueryDocumentSnapshot<Map<String, dynamic>> match;
  final String uid;
  final bool showPreview;

  @override
  State<_MatchPreviewTile> createState() => _MatchPreviewTileState();
}

class _MatchPreviewTileState extends State<_MatchPreviewTile> {
  late Future<DocumentSnapshot<Map<String, dynamic>>> _profile;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  @override
  void didUpdateWidget(covariant _MatchPreviewTile oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.match.id != widget.match.id) _loadProfile();
  }

  void _loadProfile() {
    final users = List<String>.from(widget.match.data()['users'] ?? const []);
    final otherId = users.firstWhere(
      (id) => id != widget.uid,
      orElse: () => '',
    );
    _profile = FirebaseFirestore.instance
        .collection('users')
        .doc(otherId)
        .get();
  }

  void _openChat(Map<String, dynamic> profile) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ChatPage(
          matchId: widget.match.id,
          partnerUid: List<String>.from(
            widget.match.data()['users'] ?? const [],
          ).firstWhere((id) => id != widget.uid),
          partnerName: (profile['name'] ?? 'สมาชิก KKU').toString(),
        ),
      ),
    );
  }

  @override
  Widget build(
    BuildContext context,
  ) => FutureBuilder<DocumentSnapshot<Map<String, dynamic>>>(
    future: _profile,
    builder: (context, snapshot) {
      final profile = snapshot.data?.data() ?? const <String, dynamic>{};
      final name = (profile['name'] ?? 'สมาชิก KKU').toString();
      final photoUrl = (profile['photoUrl'] ?? '').toString();
      final lastMessage = (widget.match.data()['lastMessage'] ?? '').toString();
      if (widget.showPreview) {
        return ListTile(
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 18,
            vertical: 8,
          ),
          leading: CircleAvatar(
            radius: 30,
            backgroundColor: Theme.of(context).colorScheme.secondaryContainer,
            backgroundImage: photoUrl.isEmpty ? null : NetworkImage(photoUrl),
            child: photoUrl.isEmpty
                ? Text(name.isEmpty ? 'K' : name.substring(0, 1))
                : null,
          ),
          title: Text(
            name,
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
          subtitle: Text(
            lastMessage,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          onTap: () => _openChat(profile),
        );
      }
      return InkWell(
        onTap: () => _openChat(profile),
        borderRadius: BorderRadius.circular(18),
        child: Card(
          clipBehavior: Clip.antiAlias,
          margin: EdgeInsets.zero,
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (photoUrl.isNotEmpty)
                Image.network(
                  photoUrl,
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) => _matchPhotoFallback(name),
                )
              else
                _matchPhotoFallback(name),
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.center,
                    end: Alignment.bottomCenter,
                    colors: [Colors.transparent, Color(0x99000000)],
                  ),
                ),
              ),
              Positioned(
                left: 12,
                right: 8,
                bottom: 12,
                child: Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    },
  );

  Widget _matchPhotoFallback(String name) => Container(
    color: Theme.of(context).colorScheme.secondaryContainer,
    alignment: Alignment.center,
    child: Text(
      name.isEmpty ? 'K' : name.substring(0, 1),
      style: TextStyle(
        fontSize: 46,
        color: Theme.of(context).colorScheme.onSecondaryContainer,
      ),
    ),
  );
}

class ChatPage extends StatefulWidget {
  const ChatPage({
    super.key,
    required this.matchId,
    required this.partnerUid,
    required this.partnerName,
  });
  final String matchId;
  final String partnerUid;
  final String partnerName;
  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  final _controller = TextEditingController();
  bool _busy = false;
  bool _calling = false;
  Future<void> _startVoiceCall() async {
    if (_calling) return;
    setState(() => _calling = true);
    try {
      final call = await FirebaseService().createVoiceCall(widget.matchId);
      if (!mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => VoiceCallPage(
            callId: call.id,
            isCaller: true,
            partnerName: widget.partnerName,
          ),
        ),
      );
    } catch (error) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('เริ่มโทรไม่สำเร็จ: $error')));
    } finally {
      if (mounted) setState(() => _calling = false);
    }
  }

  Future<void> _send() async {
    final text = _controller.text;
    if (_busy || text.trim().isEmpty) return;
    setState(() => _busy = true);
    try {
      await FirebaseService().sendMessage(widget.matchId, text);
      if (_controller.text == text) _controller.clear();
    } catch (error) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('ส่งข้อความไม่สำเร็จ: $error')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _showSafetyMenu() async {
    final choice = await showModalBottomSheet<String>(
      context: context,
      builder: (sheetContext) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.privacy_tip_outlined),
              title: const Text('การเปิดเผยอีเมล'),
              subtitle: const Text(
                'จะแชร์อีเมล KKU เมื่อทั้งสองฝ่ายยินยอมเท่านั้น',
              ),
              onTap: () => Navigator.pop(sheetContext, 'contact'),
            ),
            ListTile(
              leading: const Icon(Icons.flag_outlined),
              title: const Text('รายงานบัญชี'),
              onTap: () => Navigator.pop(sheetContext, 'report'),
            ),
            ListTile(
              leading: const Icon(Icons.heart_broken_outlined),
              title: const Text('ยกเลิกการจับคู่'),
              onTap: () => Navigator.pop(sheetContext, 'unmatch'),
            ),
            ListTile(
              leading: const Icon(Icons.block),
              title: const Text('บล็อกและยกเลิกแมตช์'),
              onTap: () => Navigator.pop(sheetContext, 'block'),
            ),
          ],
        ),
      ),
    );
    if (!mounted || choice == null) return;
    if (choice == 'contact') {
      final consent = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('ยินยอมแชร์ช่องทางติดต่อ?'),
          content: const Text(
            'อีเมล KKU และลิงก์โซเชียลที่บันทึกไว้จะแสดงได้เมื่อคุณและอีกฝ่ายยินยอม เบอร์โทรจะไม่ถูกเปิดเผย',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('ถอนความยินยอม'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, null),
              child: const Text('ปิด'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('ยินยอม'),
            ),
          ],
        ),
      );
      if (consent == null) return;
      try {
        await FirebaseService().setContactConsent(widget.matchId, consent);
      } catch (error) {
        if (mounted)
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('บันทึกความยินยอมไม่ได้: $error')),
          );
      }
    } else if (choice == 'report') {
      const reasons = {
        'spam': 'สแปม',
        'harassment': 'คุกคาม',
        'fake_profile': 'โปรไฟล์ปลอม',
        'inappropriate': 'เนื้อหาไม่เหมาะสม',
        'other': 'อื่น ๆ',
      };
      final reason = await showDialog<String>(
        context: context,
        builder: (dialogContext) => SimpleDialog(
          title: const Text('เลือกเหตุผลที่รายงาน'),
          children: reasons.entries
              .map(
                (entry) => SimpleDialogOption(
                  onPressed: () => Navigator.pop(dialogContext, entry.key),
                  child: Text(entry.value),
                ),
              )
              .toList(),
        ),
      );
      if (reason == null) return;
      try {
        await FirebaseService().reportUser(
          matchId: widget.matchId,
          partnerId: widget.partnerUid,
          reason: reason,
        );
        if (mounted)
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('ส่งรายงานแล้ว ขอบคุณที่ช่วยดูแลชุมชน'),
            ),
          );
      } catch (error) {
        if (mounted)
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text('ส่งรายงานไม่ได้: $error')));
      }
    } else if (choice == 'unmatch') {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('ยกเลิกการจับคู่?'),
          content: const Text(
            'คู่แมตช์นี้จะถูกปิด และระบบจะไม่สร้างแมตช์หรือแจ้งเตือนซ้ำจากประวัติ swipe เดิม',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('กลับ'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('ยกเลิกการจับคู่'),
            ),
          ],
        ),
      );
      if (confirmed != true) return;
      try {
        await FirebaseService().unmatch(widget.matchId, widget.partnerUid);
        if (mounted) Navigator.pop(context);
      } catch (error) {
        if (mounted)
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('ยกเลิกการจับคู่ไม่ได้: $error')),
          );
      }
    } else {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('บล็อกและยกเลิกแมตช์?'),
          content: const Text(
            'ระบบจะซ่อนโปรไฟล์จากกันและลบข้อความกับประวัติการโทรของคู่นี้',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('ยกเลิก'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('บล็อก'),
            ),
          ],
        ),
      );
      if (confirmed != true) return;
      try {
        await FirebaseService().blockAndUnmatch(
          widget.matchId,
          widget.partnerUid,
        );
        if (mounted) Navigator.pop(context);
      } catch (error) {
        if (mounted)
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text('บล็อกไม่สำเร็จ: $error')));
      }
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(widget.partnerName),
      actions: [
        IconButton(
          tooltip: _calling ? 'กำลังเริ่มโทร' : 'โทรด้วยเสียง',
          onPressed: _calling ? null : _startVoiceCall,
          icon: Icon(_calling ? Icons.hourglass_top : Icons.call),
        ),
        IconButton(
          tooltip: 'ความปลอดภัยและความเป็นส่วนตัว',
          onPressed: _showSafetyMenu,
          icon: const Icon(Icons.more_vert),
        ),
      ],
    ),
    body: Column(
      children: [
        Expanded(
          child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
            stream: FirebaseService().watchMessages(widget.matchId),
            builder: (context, snapshot) {
              if (snapshot.hasError)
                return _ErrorPage(
                  message: 'โหลดข้อความไม่ได้: ${snapshot.error}',
                );
              if (!snapshot.hasData)
                return const Center(child: CircularProgressIndicator());
              final messages = snapshot.data!.docs;
              if (messages.isEmpty)
                return const Center(child: Text('เริ่มบทสนทนาได้เลย'));
              return ListView.builder(
                reverse: true,
                padding: const EdgeInsets.all(14),
                itemCount: messages.length,
                itemBuilder: (context, index) {
                  final message = messages[index].data();
                  final mine =
                      message['senderId'] == FirebaseService().currentUser!.uid;
                  return Align(
                    alignment: mine
                        ? Alignment.centerRight
                        : Alignment.centerLeft,
                    child: Container(
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 10,
                      ),
                      constraints: const BoxConstraints(maxWidth: 300),
                      decoration: BoxDecoration(
                        color: mine ? const Color(0xFF8B0000) : Colors.white,
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: Text(
                        message['text'] ?? '',
                        style: TextStyle(
                          color: mine ? Colors.white : Colors.black87,
                        ),
                      ),
                    ),
                  );
                },
              );
            },
          ),
        ),
        StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
          stream: FirebaseService().watchContactConsent(widget.matchId),
          builder: (context, snapshot) {
            final consent = snapshot.data?.data();
            final flags = Map<String, dynamic>.from(
              consent?['consents'] ?? const <String, dynamic>{},
            );
            final uid = FirebaseService().currentUser?.uid ?? '';
            final mutual =
                flags[uid] == true && flags[widget.partnerUid] == true;
            if (snapshot.hasError) return const SizedBox.shrink();
            if (!mutual)
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Text(
                  flags[uid] == true
                      ? 'ยินยอมแล้ว · รออีกฝ่ายยินยอม'
                      : 'อีเมลส่วนตัวจะแสดงเมื่อทั้งสองฝ่ายยินยอม',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              );
            return FutureBuilder<Map<String, dynamic>?>(
              future: FirebaseService().getRevealedPartnerContact(
                widget.matchId,
              ),
              builder: (context, contactSnapshot) {
                final contact = contactSnapshot.data;
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Column(
                    children: [
                      if ((contact?['email'] ?? '').toString().isNotEmpty)
                        SelectableText('อีเมลที่แชร์: ${contact!['email']}'),
                      if ((contact?['instagramUrl'] ?? '')
                          .toString()
                          .isNotEmpty)
                        SelectableText(
                          'Instagram: ${contact!['instagramUrl']}',
                        ),
                      if ((contact?['facebookUrl'] ?? '').toString().isNotEmpty)
                        SelectableText('Facebook: ${contact!['facebookUrl']}'),
                    ],
                  ),
                );
              },
            );
          },
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    enabled: !_busy,
                    onSubmitted: (_) => _send(),
                    maxLength: 4000,
                    decoration: const InputDecoration(
                      hintText: 'ข้อความ',
                      counterText: '',
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  onPressed: _busy ? null : _send,
                  icon: const Icon(Icons.send, color: Color(0xFF8B0000)),
                ),
              ],
            ),
          ),
        ),
      ],
    ),
  );
}

class MyProfilePage extends StatelessWidget {
  const MyProfilePage({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('โปรไฟล์')),
    body: StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream: FirebaseService().watchMyProfile(),
      builder: (context, snapshot) {
        if (!snapshot.hasData)
          return const Center(child: CircularProgressIndicator());
        final data = snapshot.data!.data() ?? {};
        final photoUrl = (data['photoUrl'] ?? '').toString();
        final interests = List<String>.from(
          data['interests'] ?? const <String>[],
        );
        final preferredInterests = List<String>.from(
          data['preferredInterests'] ?? const <String>[],
        );
        return ListView(
          padding: const EdgeInsets.all(20),
          children: [
            CircleAvatar(
              radius: 52,
              backgroundColor: const Color(0xFFF1E6E1),
              backgroundImage: photoUrl.isNotEmpty
                  ? NetworkImage(photoUrl)
                  : null,
              child: photoUrl.isEmpty
                  ? Text(
                      (data['name'] ?? 'K')[0].toString(),
                      style: const TextStyle(fontSize: 30),
                    )
                  : null,
            ),
            const SizedBox(height: 16),
            Text(
              data['name'] ?? '',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            Text(
              '${data['age'] ?? ''} · ${data['faculty'] ?? ''}',
              textAlign: TextAlign.center,
            ),
            if ((data['bio'] ?? '').toString().isNotEmpty)
              Padding(
                padding: const EdgeInsets.all(20),
                child: Text(data['bio'], textAlign: TextAlign.center),
              ),
            if (interests.isNotEmpty)
              Wrap(
                alignment: WrapAlignment.center,
                children: interests
                    .map((item) => Chip(label: Text(item)))
                    .toList(),
              ),
            Text(
              'ช่วงอายุที่สนใจ ${data['preferredAgeMin'] ?? 18}–${data['preferredAgeMax'] ?? 99} ปี',
              textAlign: TextAlign.center,
            ),
            if (preferredInterests.isNotEmpty)
              Text(
                'อยากพบคนที่สนใจ: ${preferredInterests.join(', ')}',
                textAlign: TextAlign.center,
              ),
            const SizedBox(height: 8),
            Text(
              FirebaseService().currentUser?.email ?? '',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 18),
            OutlinedButton.icon(
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => EditProfilePage(profile: data),
                ),
              ),
              icon: const Icon(Icons.edit),
              label: const Text('แก้ไขโปรไฟล์'),
            ),
            TextButton.icon(
              onPressed: () => FirebaseService().signOut(),
              icon: const Icon(Icons.logout),
              label: const Text('ออกจากระบบ'),
            ),
            const Divider(height: 32),
            TextButton.icon(
              onPressed: () => _confirmDeleteAccount(context),
              icon: const Icon(Icons.delete_forever, color: Colors.red),
              label: const Text(
                'ลบบัญชีและข้อมูลทั้งหมด',
                style: TextStyle(color: Colors.red),
              ),
            ),
          ],
        );
      },
    ),
  );
}

Future<void> _confirmDeleteAccount(BuildContext context) async {
  final password = TextEditingController();
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: const Text('ลบบัญชีถาวร?'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'โปรไฟล์ ประวัติการปัด แมตช์ ข้อความ และประวัติสายจะถูกลบ และกู้คืนไม่ได้ รูป Cloudinary จะลบอัตโนมัติเมื่อกำหนด Worker endpoint แล้วเท่านั้น',
          ),
          const SizedBox(height: 12),
          TextField(
            controller: password,
            obscureText: true,
            autofocus: true,
            decoration: const InputDecoration(
              labelText: 'กรอกรหัสผ่านเพื่อยืนยัน',
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(dialogContext, false),
          child: const Text('ยกเลิก'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(dialogContext, true),
          style: FilledButton.styleFrom(backgroundColor: Colors.red),
          child: const Text('ลบบัญชี'),
        ),
      ],
    ),
  );
  if (confirmed != true || !context.mounted) {
    password.dispose();
    return;
  }
  final value = password.text;
  password.dispose();
  try {
    await FirebaseService().deleteAccount(value);
    if (context.mounted)
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('ลบบัญชีและข้อมูลเรียบร้อยแล้ว')),
      );
  } on FirebaseAuthException catch (error) {
    if (context.mounted)
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            error.code == 'wrong-password' || error.code == 'invalid-credential'
                ? 'รหัสผ่านไม่ถูกต้อง'
                : 'ลบบัญชีไม่สำเร็จ: ${error.message ?? error.code}',
          ),
        ),
      );
  } catch (error) {
    if (context.mounted)
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'ลบบัญชีไม่สำเร็จ ข้อมูลยังไม่ถูกลบครบ ลองใหม่ได้: $error',
          ),
        ),
      );
  }
}

class EditProfilePage extends StatefulWidget {
  const EditProfilePage({super.key, required this.profile});
  final Map<String, dynamic> profile;
  @override
  State<EditProfilePage> createState() => _EditProfilePageState();
}

class _EditProfilePageState extends State<EditProfilePage> {
  late final _name = TextEditingController(text: widget.profile['name']);
  late final _age = TextEditingController(
    text: '${widget.profile['age'] ?? ''}',
  );
  String? _faculty;
  late final _bio = TextEditingController(text: widget.profile['bio']);
  final Set<String> _interests = {};
  final Set<String> _preferredInterests = {};
  late final _preferredAgeMin = TextEditingController(
    text: '${widget.profile['preferredAgeMin'] ?? 18}',
  );
  late final _preferredAgeMax = TextEditingController(
    text: '${widget.profile['preferredAgeMax'] ?? 99}',
  );
  final Set<String> _preferredFaculties = {};
  final _instagramUrl = TextEditingController();
  final _facebookUrl = TextEditingController();
  bool _busy = false;
  XFile? _pickedImage;
  @override
  void initState() {
    super.initState();
    _faculty = normalizeKkuFaculty(widget.profile['faculty']);
    final savedFaculties =
        widget.profile['preferredFaculties'] as List? ?? const [];
    _preferredFaculties.addAll(
      savedFaculties.map(normalizeKkuFaculty).whereType<String>(),
    );
    _interests.addAll(
      (widget.profile['interests'] as List? ?? const [])
          .map((value) => value.toString().trim())
          .where((value) => value.isNotEmpty),
    );
    _preferredInterests.addAll(
      (widget.profile['preferredInterests'] as List? ?? const [])
          .map((value) => value.toString().trim())
          .where((value) => value.isNotEmpty),
    );
    _loadPrivateLinks();
  }

  Future<void> _loadPrivateLinks() async {
    try {
      final data = await FirebaseService().getMyPrivateProfile();
      if (mounted) {
        _instagramUrl.text = (data['instagramUrl'] ?? '').toString();
        _facebookUrl.text = (data['facebookUrl'] ?? '').toString();
      }
    } catch (_) {
      /* The private links remain optional if the network is unavailable. */
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _age.dispose();
    _bio.dispose();
    _preferredAgeMin.dispose();
    _preferredAgeMax.dispose();
    _instagramUrl.dispose();
    _facebookUrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final age = int.tryParse(_age.text);
    final minAge = int.tryParse(_preferredAgeMin.text);
    final maxAge = int.tryParse(_preferredAgeMax.text);
    if (_name.text.trim().isEmpty ||
        age == null ||
        age < 18 ||
        age > 99 ||
        _faculty == null ||
        minAge == null ||
        maxAge == null ||
        minAge < 18 ||
        maxAge > 99 ||
        minAge > maxAge) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('กรุณาตรวจสอบชื่อ อายุ คณะ และช่วงอายุที่สนใจ'),
        ),
      );
      return;
    }
    setState(() => _busy = true);
    try {
      final service = FirebaseService();
      final uid = service.currentUser!.uid;
      final previousPhotoId = widget.profile['photoPublicId'] as String?;
      final upload = _pickedImage == null
          ? null
          : await service.uploadProfileImage(uid, _pickedImage!);
      await service.saveUserProfile(uid, {
        'name': _name.text.trim(),
        'age': age,
        'faculty': _faculty,
        'bio': _bio.text.trim(),
        'interests': _interests.take(12).toList(),
        'preferredInterests': _preferredInterests.take(12).toList(),
        'preferredAgeMin': minAge,
        'preferredAgeMax': maxAge,
        'preferredFaculties': _preferredFaculties.take(10).toList(),
        'photoUrl': upload?.url ?? (widget.profile['photoUrl'] ?? ''),
        if (upload != null) 'photoPublicId': upload.publicId,
        'isDiscoverable': true,
      });
      await service.savePrivateContactLinks(uid, {
        'instagramUrl': _instagramUrl.text,
        'facebookUrl': _facebookUrl.text,
      });
      if (upload != null &&
          previousPhotoId != null &&
          previousPhotoId != upload.publicId) {
        unawaited(
          service.deleteOwnedProfileImage(previousPhotoId).catchError((_) {}),
        );
      }
      if (mounted) Navigator.pop(context);
    } catch (error) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('บันทึกไม่สำเร็จ: $error')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('แก้ไขโปรไฟล์')),
    body: ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Center(
          child: ProfilePhotoPicker(
            imageUrl: (widget.profile['photoUrl'] ?? '').toString(),
            onSelected: (file) => setState(() => _pickedImage = file),
          ),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: _name,
          maxLength: 80,
          decoration: const InputDecoration(labelText: 'ชื่อที่แสดง'),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _age,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: 'อายุ (18+)'),
        ),
        const SizedBox(height: 12),
        KkuFacultyDropdown(
          value: _faculty,
          onChanged: (value) => setState(() => _faculty = value),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _bio,
          maxLength: 500,
          maxLines: 3,
          decoration: const InputDecoration(labelText: 'แนะนำตัว'),
        ),
        const SizedBox(height: 12),
        InterestMultiSelect(
          label: 'ความสนใจของคุณ',
          helperText: 'เลือกกิจกรรมที่คุณชอบได้สูงสุด 12 ข้อ',
          values: _interests,
          onChanged: (values) => setState(() {
            _interests
              ..clear()
              ..addAll(values);
          }),
        ),
        const SizedBox(height: 8),
        InterestMultiSelect(
          label: 'อยากพบคนที่สนใจเรื่องใด',
          helperText: 'ไม่เลือกก็ได้ ระบบจะใช้เป็นตัวช่วยจัดลำดับเท่านั้น',
          values: _preferredInterests,
          onChanged: (values) => setState(() {
            _preferredInterests
              ..clear()
              ..addAll(values);
          }),
        ),
        const SizedBox(height: 12),
        const Text('ช่วงอายุที่สนใจ'),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _preferredAgeMin,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'ตั้งแต่'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: TextField(
                controller: _preferredAgeMax,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'ถึง'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        KkuFacultyMultiSelect(
          values: _preferredFaculties,
          onChanged: (values) => setState(() {
            _preferredFaculties
              ..clear()
              ..addAll(values);
          }),
        ),
        const SizedBox(height: 16),
        const Text(
          'ลิงก์โซเชียลเป็นลิงก์ที่ผู้ใช้กรอกเอง ยังไม่ใช่การเชื่อมบัญชี OAuth',
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _instagramUrl,
          maxLength: 300,
          decoration: const InputDecoration(labelText: 'Instagram URL'),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _facebookUrl,
          maxLength: 300,
          decoration: const InputDecoration(labelText: 'Facebook URL'),
        ),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: _busy ? null : _save,
          child: Text(_busy ? 'กำลังบันทึก…' : 'บันทึก'),
        ),
      ],
    ),
  );
}

class _PhotoPlaceholder extends StatelessWidget {
  const _PhotoPlaceholder();
  @override
  Widget build(BuildContext context) => Container(
    color: const Color(0xFFF1E6E1),
    child: const Center(
      child: Icon(Icons.person, size: 100, color: Color(0xFFB8A8A2)),
    ),
  );
}

class _EmptyPage extends StatelessWidget {
  const _EmptyPage({
    required this.icon,
    required this.title,
    required this.detail,
    this.actionLabel,
    this.onAction,
  });
  final IconData icon;
  final String title, detail;
  final String? actionLabel;
  final VoidCallback? onAction;
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 56, color: const Color(0xFF8B0000)),
          const SizedBox(height: 14),
          Text(title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 6),
          Text(detail, textAlign: TextAlign.center),
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: 18),
            FilledButton.icon(
              onPressed: onAction,
              icon: const Icon(Icons.refresh),
              label: Text(actionLabel!),
            ),
          ],
        ],
      ),
    ),
  );
}

class _ErrorPage extends StatelessWidget {
  const _ErrorPage({required this.message});
  final String message;
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(20),
      child: Text(message, textAlign: TextAlign.center),
    ),
  );
}

String _authMessage(FirebaseAuthException error) => switch (error.code) {
  'invalid-email' => error.message ?? 'อีเมลไม่ถูกต้อง',
  'user-not-found' ||
  'wrong-password' ||
  'invalid-credential' => 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  'email-already-in-use' => 'อีเมลนี้มีบัญชีแล้ว ให้กด “เข้าสู่ระบบ” หรือเข้าสู่ระบบแล้วขอส่งอีเมลยืนยันอีกครั้ง',
  'weak-password' => 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร',
  'too-many-requests' => 'ลองใหม่อีกครั้งภายหลัง',
  'operation-not-allowed' =>
    'Firebase ยังไม่ได้เปิดวิธีเข้าสู่ระบบด้วยอีเมล/รหัสผ่าน',
  'network-request-failed' =>
    'เชื่อมต่อ Firebase ไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง',
  'unauthorized-domain' || 'app-not-authorized' => 'Firebase ยังไม่อนุญาตโดเมนเว็บนี้ ให้เพิ่ม projectnetwork-c403e-cf176.web.app ใน Authentication > Settings > Authorized domains',
  _ =>
    (error.message == null ||
            error.message!.trim().isEmpty ||
            error.message!.trim() == 'Error')
        ? 'สมัครไม่สำเร็จ (รหัส ${error.code}) กรุณาลองเข้าสู่ระบบหากเคยสมัครไว้แล้ว หรือส่งภาพข้อความนี้ให้ผู้ดูแล'
        : '${error.message} (รหัส ${error.code})',
};
