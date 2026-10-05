import 'dart:async';
import 'dart:convert';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';

class FirebaseService {
  FirebaseService({FirebaseAuth? auth, FirebaseFirestore? firestore})
    : _auth = auth ?? FirebaseAuth.instance,
      _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseAuth _auth;
  final FirebaseFirestore _firestore;

  // Cloudinary cloud name and unsigned preset are public client upload settings.
  // Never put a Cloudinary API secret in Flutter/web code.
  static const _cloudinaryCloudName = 'bd1v9fzm';
  static const _cloudinaryUploadPreset = 'kku_profile_upload';
  // Configure with --dart-define=TURN_CREDENTIALS_ENDPOINT=https://... .
  // The endpoint must verify the Firebase ID token and return short-lived ICE servers.
  static const _turnCredentialsEndpoint = String.fromEnvironment(
    'TURN_CREDENTIALS_ENDPOINT',
  );
  static const _accountAssetsEndpoint = String.fromEnvironment(
    'ACCOUNT_ASSETS_ENDPOINT',
  );

  User? get currentUser => _auth.currentUser;
  Stream<User?> get authChanges => _auth.userChanges();

  Future<List<Map<String, dynamic>>> getVoiceIceServers() async {
    final servers = <Map<String, dynamic>>[
      {'urls': 'stun:stun.l.google.com:19302'},
    ];
    if (_turnCredentialsEndpoint.isEmpty) return servers;

    final uri = Uri.tryParse(_turnCredentialsEndpoint);
    if (uri == null || uri.scheme != 'https' || uri.host.isEmpty) {
      throw StateError('TURN endpoint ต้องเป็น HTTPS URL ที่ถูกต้อง');
    }
    final user = _auth.currentUser;
    if (user == null) throw StateError('กรุณาเข้าสู่ระบบก่อนโทร');
    final idToken = await user.getIdToken();
    if (idToken == null || idToken.isEmpty)
      throw StateError('ยืนยันตัวตนเพื่อโทรไม่สำเร็จ');

    final response = await http
        .post(
          uri,
          headers: {
            'Authorization': 'Bearer $idToken',
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: '{}',
        )
        .timeout(const Duration(seconds: 8));
    if (response.statusCode != 200) {
      throw StateError('ขอข้อมูล TURN ไม่สำเร็จ (${response.statusCode})');
    }
    final body = jsonDecode(response.body);
    if (body is! Map || body['iceServers'] is! List) {
      throw const FormatException('TURN endpoint ส่งข้อมูลไม่ถูกต้อง');
    }
    final turnServers = (body['iceServers'] as List)
        .whereType<Map>()
        .map((server) => Map<String, dynamic>.from(server))
        .where((server) {
          final urls = server['urls'];
          return urls is String
              ? urls.startsWith('turn:') || urls.startsWith('turns:')
              : urls is List &&
                    urls.any(
                      (url) =>
                          url is String &&
                          (url.startsWith('turn:') || url.startsWith('turns:')),
                    );
        });
    servers.addAll(turnServers);
    if (servers.length == 1)
      throw const FormatException('TURN endpoint ไม่มี TURN server');
    return servers;
  }

  static bool isKkuEmail(String email) =>
      email.trim().toLowerCase().endsWith('@kkumail.com');

  Future<UserCredential> signUp(String email, String password) async {
    final normalizedEmail = email.trim().toLowerCase();
    if (!isKkuEmail(normalizedEmail)) {
      throw FirebaseAuthException(
        code: 'invalid-email',
        message: 'กรุณาใช้อีเมล @kkumail.com',
      );
    }
    final credential = await _auth.createUserWithEmailAndPassword(
      email: normalizedEmail,
      password: password,
    );
    await credential.user!.sendEmailVerification();
    return credential;
  }

  Future<UserCredential> signIn(String email, String password) {
    final normalizedEmail = email.trim().toLowerCase();
    if (!isKkuEmail(normalizedEmail)) {
      throw FirebaseAuthException(
        code: 'invalid-email',
        message: 'กรุณาใช้อีเมล @kkumail.com',
      );
    }
    return _auth.signInWithEmailAndPassword(
      email: normalizedEmail,
      password: password,
    );
  }

  Future<void> sendPasswordResetEmail(String email) {
    final normalizedEmail = email.trim().toLowerCase();
    if (!isKkuEmail(normalizedEmail)) {
      throw FirebaseAuthException(
        code: 'invalid-email',
        message: 'กรุณาใช้อีเมล @kkumail.com',
      );
    }
    return _auth.sendPasswordResetEmail(email: normalizedEmail);
  }

  Future<void> reloadUser() async {
    final user = _auth.currentUser;
    if (user == null) return;
    await user.reload();
    // Verification changes the email_verified claim. Force-refresh the ID token
    // so Firestore rules see the new claim immediately after the user returns.
    await _auth.currentUser?.getIdToken(true);
  }

  Future<void> sendVerificationEmail() async =>
      _auth.currentUser?.sendEmailVerification();
  Future<void> signOut() => _auth.signOut();

  Future<void> deleteOwnedProfileImage(String publicId) async {
    final user = _auth.currentUser;
    if (user == null || !publicId.startsWith('kku_profiles/${user.uid}/')) {
      throw StateError('ไม่มีสิทธิ์ลบรูปนี้');
    }
    if (_accountAssetsEndpoint.isEmpty) return;
    final uri = Uri.tryParse(_accountAssetsEndpoint);
    if (uri == null || uri.scheme != 'https' || uri.host.isEmpty) {
      throw StateError(
        'ตั้งค่า ACCOUNT_ASSETS_ENDPOINT ให้เป็น HTTPS URL ก่อน',
      );
    }
    final idToken = await user.getIdToken();
    final response = await http
        .post(
          uri,
          headers: {
            'Authorization': 'Bearer $idToken',
            'Content-Type': 'application/json',
          },
          body: jsonEncode({'publicId': publicId}),
        )
        .timeout(const Duration(seconds: 12));
    if (response.statusCode != 200) {
      throw StateError(
        'ลบรูปโปรไฟล์จาก Cloudinary ไม่สำเร็จ (${response.statusCode})',
      );
    }
  }

  Future<void> deleteAccount(String password) async {
    final user = _auth.currentUser;
    if (user == null) throw StateError('กรุณาเข้าสู่ระบบก่อนลบบัญชี');
    final email = user.email;
    if (email == null || !isKkuEmail(email))
      throw StateError('บัญชีนี้ไม่ใช่อีเมล @kkumail.com');

    // Firebase requires a recent sign-in for account deletion. Re-authenticate
    // before changing any data so a stale session cannot trigger deletion.
    final credential = EmailAuthProvider.credential(
      email: email,
      password: password,
    );
    await user.reauthenticateWithCredential(credential);
    final uid = user.uid;
    final profileRef = _firestore.collection('users').doc(uid);
    final profileSnapshot = await profileRef.get();
    final photoPublicId = profileSnapshot.data()?['photoPublicId'] as String?;

    // Hide the profile first. If cleanup is interrupted, retrying this method
    // can continue while the account stays out of discovery.
    if (profileSnapshot.exists) {
      await profileRef.update({
        'isDiscoverable': false,
        'deletionInProgress': true,
      });
    }

    // Cloudinary's API secret stays in a server-side Worker secret. If that
    // free endpoint has not been configured yet, continue account deletion;
    // the final UI warns that the image asset may need manual removal.
    if (photoPublicId != null && photoPublicId.isNotEmpty)
      await deleteOwnedProfileImage(photoPublicId);

    final matches = _firestore.collection('matches');
    final calls = _firestore.collection('calls');

    // Remove subcollections explicitly; Firestore does not cascade deletes.
    await _deleteQueryInPages(calls.where('users', arrayContains: uid), 200, (
      call,
    ) async {
      await _deleteCollectionInPages(
        call.reference.collection('callerCandidates'),
      );
      await _deleteCollectionInPages(
        call.reference.collection('calleeCandidates'),
      );
      await call.reference.delete();
    });
    await _deleteQueryInPages(matches.where('users', arrayContains: uid), 200, (
      match,
    ) async {
      await _deleteCollectionInPages(match.reference.collection('messages'));
      await _firestore
          .collection('contactConsents')
          .doc(match.id)
          .delete()
          .catchError((_) {});
      await match.reference.delete();
    });
    await _deleteQueryInPages(
      _firestore.collection('swipes').where('swiperId', isEqualTo: uid),
      200,
      (doc) => doc.reference.delete(),
    );
    await _deleteQueryInPages(
      _firestore.collection('swipes').where('swipedId', isEqualTo: uid),
      200,
      (doc) => doc.reference.delete(),
    );
    await _deleteQueryInPages(
      _firestore.collection('blocks').where('blockerId', isEqualTo: uid),
      200,
      (doc) => doc.reference.delete(),
    );
    await _deleteQueryInPages(
      _firestore.collection('blocks').where('blockedId', isEqualTo: uid),
      200,
      (doc) => doc.reference.delete(),
    );
    await _deleteQueryInPages(
      _firestore.collection('reports').where('reporterId', isEqualTo: uid),
      200,
      (doc) => doc.reference.delete(),
    );

    await _firestore
        .collection('privateProfiles')
        .doc(uid)
        .delete()
        .catchError((_) {});
    if (profileSnapshot.exists) await profileRef.delete();
    // Auth is deleted last: any earlier failure leaves a signed-in account
    // that can retry cleanup instead of an inaccessible orphaned data set.
    await user.delete();
  }

  Future<void> _deleteCollectionInPages(
    CollectionReference<Map<String, dynamic>> collection,
  ) => _deleteQueryInPages(collection, 200, (doc) => doc.reference.delete());

  Future<void> _deleteQueryInPages(
    Query<Map<String, dynamic>> query,
    int pageSize,
    Future<void> Function(QueryDocumentSnapshot<Map<String, dynamic>>) delete,
  ) async {
    while (true) {
      final page = await query.limit(pageSize).get();
      if (page.docs.isEmpty) return;
      for (final doc in page.docs) {
        await delete(doc);
      }
    }
  }

  Future<void> saveUserProfile(String uid, Map<String, dynamic> data) async {
    if (_auth.currentUser?.uid != uid)
      throw StateError('You can only update your own profile.');
    final email = _auth.currentUser?.email ?? '';
    if (!isKkuEmail(email) || _auth.currentUser?.emailVerified != true) {
      throw StateError(
        'กรุณาใช้อีเมล @kkumail.com และยืนยันอีเมลก่อนบันทึกโปรไฟล์',
      );
    }
    final profile = _firestore.collection('users').doc(uid);
    final existing = await profile.get();
    final safeData = {...data, 'updatedAt': FieldValue.serverTimestamp()};
    if (!existing.exists) safeData['createdAt'] = FieldValue.serverTimestamp();
    await profile.set(safeData, SetOptions(merge: true));
    // Contact details are kept in a private collection. They are never placed
    // on discoverable profile documents.
    await _firestore.collection('privateProfiles').doc(uid).set({
      // Firestore rules compare this to the exact email claim in the ID token.
      'email': email.trim(), 'updatedAt': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
  }

  Future<void> savePrivateContactLinks(
    String uid,
    Map<String, String> links,
  ) async {
    if (_auth.currentUser?.uid != uid ||
        _auth.currentUser?.emailVerified != true) {
      throw StateError('ไม่มีสิทธิ์แก้ไขข้อมูลติดต่อ');
    }
    String normalizeUrl(String value, String host) {
      final clean = value.trim();
      if (clean.isEmpty) return '';
      final uri = Uri.tryParse(clean);
      if (uri == null ||
          uri.scheme != 'https' ||
          (uri.host != host && !uri.host.endsWith('.$host'))) {
        throw ArgumentError('ลิงก์โซเชียลต้องเป็น HTTPS ของ $host');
      }
      return uri.toString();
    }

    final privateData = <String, dynamic>{
      'email': _auth.currentUser!.email!.trim(),
      'updatedAt': FieldValue.serverTimestamp(),
    };
    if (links.containsKey('instagramUrl'))
      privateData['instagramUrl'] = normalizeUrl(
        links['instagramUrl']!,
        'instagram.com',
      );
    if (links.containsKey('facebookUrl'))
      privateData['facebookUrl'] = normalizeUrl(
        links['facebookUrl']!,
        'facebook.com',
      );
    await _firestore
        .collection('privateProfiles')
        .doc(uid)
        .set(privateData, SetOptions(merge: true));
  }

  Future<Map<String, dynamic>> getMyPrivateProfile() async {
    final uid = _auth.currentUser?.uid;
    if (uid == null) throw StateError('กรุณาเข้าสู่ระบบก่อน');
    final snapshot = await _firestore
        .collection('privateProfiles')
        .doc(uid)
        .get();
    return snapshot.data() ?? <String, dynamic>{};
  }

  Stream<DocumentSnapshot<Map<String, dynamic>>> watchMyProfile() =>
      _firestore.collection('users').doc(_auth.currentUser!.uid).snapshots();

  Stream<QuerySnapshot<Map<String, dynamic>>> watchProfiles() => _firestore
      .collection('users')
      .where('isDiscoverable', isEqualTo: true)
      .orderBy('createdAt', descending: true)
      .limit(100)
      .snapshots();

  Stream<QuerySnapshot<Map<String, dynamic>>> watchMyBlocks() {
    final uid = _auth.currentUser!.uid;
    return _firestore
        .collection('blocks')
        .where(
          Filter.or(
            Filter('blockerId', isEqualTo: uid),
            Filter('blockedId', isEqualTo: uid),
          ),
        )
        .snapshots();
  }

  Future<void> blockAndUnmatch(String matchId, String partnerId) async {
    final user = _auth.currentUser;
    if (user == null || user.uid == partnerId)
      throw StateError('ไม่สามารถบล็อกบัญชีนี้ได้');
    final pair = [user.uid, partnerId]..sort();
    await _firestore.collection('blocks').doc('${pair[0]}_${pair[1]}').set({
      'blockerId': user.uid,
      'blockedId': partnerId,
      'createdAt': FieldValue.serverTimestamp(),
    });
    final match = _firestore.collection('matches').doc(matchId);
    await _deleteCollectionInPages(match.collection('messages'));
    await _firestore.collection('contactConsents').doc(matchId).delete();
    final calls = await _firestore
        .collection('calls')
        .where('matchId', isEqualTo: matchId)
        .where('users', arrayContains: user.uid)
        .get();
    for (final call in calls.docs) {
      await _deleteCollectionInPages(
        call.reference.collection('callerCandidates'),
      );
      await _deleteCollectionInPages(
        call.reference.collection('calleeCandidates'),
      );
      await call.reference.delete();
    }
    await match.delete();
  }

  Future<void> unmatch(String matchId, String partnerId) async {
    final user = _auth.currentUser;
    if (user == null || user.uid == partnerId)
      throw StateError('ไม่สามารถยกเลิกแมตช์นี้ได้');
    final match = _firestore.collection('matches').doc(matchId);
    await _firestore.runTransaction((transaction) async {
      final snapshot = await transaction.get(match);
      final members = List<String>.from(
        snapshot.data()?['users'] ?? const <String>[],
      );
      if (!snapshot.exists ||
          members.length != 2 ||
          !members.contains(user.uid) ||
          !members.contains(partnerId)) {
        throw StateError('ไม่พบคู่แมตช์');
      }
      if (snapshot.data()?['status'] == 'unmatched') return;
      final ownSwipe = _firestore
          .collection('swipes')
          .doc('${user.uid}_$partnerId');
      final partnerSwipe = _firestore
          .collection('swipes')
          .doc('${partnerId}_${user.uid}');
      final ownSwipeSnapshot = await transaction.get(ownSwipe);
      final partnerSwipeSnapshot = await transaction.get(partnerSwipe);
      transaction.update(match, {
        'status': 'unmatched',
        'unmatchedBy': user.uid,
        'unmatchedAt': FieldValue.serverTimestamp(),
      });
      if (ownSwipeSnapshot.exists) transaction.delete(ownSwipe);
      if (partnerSwipeSnapshot.exists) transaction.delete(partnerSwipe);
    });
  }

  Future<void> reportUser({
    required String matchId,
    required String partnerId,
    required String reason,
    String note = '',
  }) async {
    final user = _auth.currentUser;
    if (user == null || user.uid == partnerId)
      throw StateError('ไม่สามารถรายงานบัญชีนี้ได้');
    const reasons = {
      'spam',
      'harassment',
      'fake_profile',
      'inappropriate',
      'other',
    };
    if (!reasons.contains(reason) || note.trim().length > 500)
      throw ArgumentError('ข้อมูลรายงานไม่ถูกต้อง');
    final match = await _firestore.collection('matches').doc(matchId).get();
    if (!(List<String>.from(match.data()?['users'] ?? const <String>[])
            .contains(user.uid)) ||
        !(List<String>.from(match.data()?['users'] ?? const <String>[])
            .contains(partnerId))) {
      throw StateError('รายงานได้เฉพาะคู่ที่แมตช์กันแล้ว');
    }
    await _firestore.collection('reports').add({
      'reporterId': user.uid,
      'reportedUserId': partnerId,
      'matchId': matchId,
      'reason': reason,
      'note': note.trim(),
      'createdAt': FieldValue.serverTimestamp(),
      'status': 'new',
    });
  }

  Stream<DocumentSnapshot<Map<String, dynamic>>> watchContactConsent(
    String matchId,
  ) => _firestore.collection('contactConsents').doc(matchId).snapshots();

  Future<void> setContactConsent(String matchId, bool consent) async {
    final user = _auth.currentUser;
    if (user == null) throw StateError('กรุณาเข้าสู่ระบบก่อน');
    final match = await _firestore.collection('matches').doc(matchId).get();
    final members = List<String>.from(
      match.data()?['users'] ?? const <String>[],
    );
    if (!match.exists || members.length != 2 || !members.contains(user.uid))
      throw StateError('ไม่พบคู่แมตช์');
    final ref = _firestore.collection('contactConsents').doc(matchId);
    await _firestore.runTransaction((transaction) async {
      final current = await transaction.get(ref);
      final consents = Map<String, dynamic>.from(
        current.data()?['consents'] ?? const <String, dynamic>{},
      );
      consents[user.uid] = consent;
      transaction.set(ref, {
        'users': members,
        'consents': consents,
        'updatedAt': FieldValue.serverTimestamp(),
      });
    });
  }

  Future<Map<String, dynamic>?> getRevealedPartnerContact(
    String matchId,
  ) async {
    final user = _auth.currentUser;
    if (user == null) return null;
    final consent = await _firestore
        .collection('contactConsents')
        .doc(matchId)
        .get();
    final data = consent.data();
    final users = List<String>.from(data?['users'] ?? const <String>[]);
    final consents = Map<String, dynamic>.from(
      data?['consents'] ?? const <String, dynamic>{},
    );
    if (users.length != 2 ||
        !users.contains(user.uid) ||
        !users.every((id) => consents[id] == true))
      return null;
    final partner = users.firstWhere((id) => id != user.uid);
    final privateProfile = await _firestore
        .collection('privateProfiles')
        .doc(partner)
        .get();
    return privateProfile.data();
  }

  Future<bool> swipeUser(String targetUid, String action) async {
    final user = _auth.currentUser;
    if (user == null || targetUid == user.uid)
      throw StateError('Invalid swipe.');
    if (!{'like', 'pass', 'superlike'}.contains(action))
      throw ArgumentError.value(action, 'action');
    final pair = [user.uid, targetUid]..sort();
    final matchId = '${pair[0]}_${pair[1]}';
    final swipeRef = _firestore
        .collection('swipes')
        .doc('${user.uid}_$targetUid');
    final reverseRef = _firestore
        .collection('swipes')
        .doc('${targetUid}_${user.uid}');
    final matchRef = _firestore.collection('matches').doc(matchId);

    await _firestore.runTransaction((transaction) async {
      await transaction.get(swipeRef);
      transaction.set(swipeRef, {
        'swiperId': user.uid,
        'swipedId': targetUid,
        'action': action,
        'createdAt': FieldValue.serverTimestamp(),
      });
    });

    if (!{'like', 'superlike'}.contains(action)) return false;
    return _firestore.runTransaction((transaction) async {
      final ownSwipe = await transaction.get(swipeRef);
      final reverse = await transaction.get(reverseRef);
      final existingMatch = await transaction.get(matchRef);
      if (ownSwipe.data()?['action'] != action ||
          !{'like', 'superlike'}.contains(action) ||
          !reverse.exists ||
          !{'like', 'superlike'}.contains(reverse.data()?['action'])) {
        return false;
      }
      if (existingMatch.data()?['status'] == 'unmatched') {
        transaction.update(matchRef, {
          'status': 'active',
          'matchedBy': user.uid,
          'lastMessage': '',
          'lastMessageAt': FieldValue.serverTimestamp(),
          'unmatchedBy': FieldValue.delete(),
          'unmatchedAt': FieldValue.delete(),
        });
      } else if (!existingMatch.exists) {
        transaction.set(matchRef, {
          'users': pair,
          'matchedBy': user.uid,
          'createdAt': FieldValue.serverTimestamp(),
          'lastMessage': '',
          'lastMessageAt': FieldValue.serverTimestamp(),
        });
      } else {
        return false;
      }
      return true;
    });
  }

  Stream<QuerySnapshot<Map<String, dynamic>>> watchMatches() {
    return _firestore
        .collection('matches')
        .where('users', arrayContains: _auth.currentUser!.uid)
        .orderBy('lastMessageAt', descending: true)
        .snapshots();
  }

  Stream<QuerySnapshot<Map<String, dynamic>>> watchMessages(String matchId) =>
      _firestore
          .collection('matches')
          .doc(matchId)
          .collection('messages')
          .orderBy('createdAt', descending: true)
          .limit(50)
          .snapshots();

  Stream<QuerySnapshot<Map<String, dynamic>>> watchIncomingCalls() => _firestore
      .collection('calls')
      .where('recipientId', isEqualTo: _auth.currentUser!.uid)
      .where('state', isEqualTo: 'ringing')
      .snapshots();

  Future<DocumentReference<Map<String, dynamic>>> createVoiceCall(
    String matchId,
  ) async {
    final user = _auth.currentUser;
    if (user == null || !user.emailVerified || !isKkuEmail(user.email ?? '')) {
      throw StateError(
        'ต้องเข้าสู่ระบบด้วยอีเมล @kkumail.com ที่ยืนยันแล้วก่อนโทร',
      );
    }
    final match = await _firestore.collection('matches').doc(matchId).get();
    final members = List<String>.from(match.data()?['users'] ?? const []);
    if (!match.exists || !members.contains(user.uid) || members.length != 2) {
      throw StateError('โทรได้เฉพาะคู่ที่แมตช์กันแล้ว');
    }
    final recipientId = members.firstWhere((id) => id != user.uid);
    final profile = await _firestore.collection('users').doc(user.uid).get();
    final call = _firestore.collection('calls').doc();
    await call.set({
      'matchId': matchId,
      'users': members,
      'callerId': user.uid,
      'recipientId': recipientId,
      'callerName': (profile.data()?['name'] ?? 'สมาชิก KKU').toString(),
      'state': 'ringing',
      'createdAt': FieldValue.serverTimestamp(),
    });
    return call;
  }

  Future<void> sendMessage(String matchId, String text) async {
    final user = _auth.currentUser;
    final cleanText = text.trim();
    if (user == null || cleanText.isEmpty || cleanText.length > 4000) return;
    final match = _firestore.collection('matches').doc(matchId);
    final message = match.collection('messages').doc();
    await _firestore.runTransaction((transaction) async {
      final snapshot = await transaction.get(match);
      if (!(snapshot.data()?['users'] as List? ?? []).contains(user.uid)) {
        throw StateError('You are not a member of this match.');
      }
      transaction.set(message, {
        'senderId': user.uid,
        'text': cleanText,
        'createdAt': FieldValue.serverTimestamp(),
      });
      transaction.update(match, {
        'lastMessage': cleanText,
        'lastMessageAt': FieldValue.serverTimestamp(),
      });
    });
  }

  Future<({String url, String publicId})> uploadProfileImage(
    String uid,
    XFile imageFile,
  ) async {
    if (_auth.currentUser?.uid != uid)
      throw StateError('You can only upload your own image.');
    if (_auth.currentUser?.emailVerified != true ||
        !isKkuEmail(_auth.currentUser?.email ?? '')) {
      throw StateError('กรุณายืนยันอีเมล @kkumail.com ก่อนอัปโหลดรูป');
    }
    final size = await imageFile.length();
    if (size == 0 || size >= 8 * 1024 * 1024) {
      throw FirebaseException(
        plugin: 'firebase_storage',
        code: 'object-too-large',
        message: 'รูปต้องมีขนาดไม่เกิน 8 MB',
      );
    }
    final extension = imageFile.name.contains('.')
        ? imageFile.name.split('.').last.toLowerCase()
        : 'jpg';
    final allowedExtensions = {'jpg', 'jpeg', 'png', 'webp'};
    if (!allowedExtensions.contains(extension)) {
      throw ArgumentError('รองรับไฟล์ JPG, PNG หรือ WEBP เท่านั้น');
    }
    final bytes = await imageFile.readAsBytes();
    final uri = Uri.https(
      'api.cloudinary.com',
      '/v1_1/$_cloudinaryCloudName/image/upload',
    );
    final request = http.MultipartRequest('POST', uri)
      ..fields['upload_preset'] = _cloudinaryUploadPreset
      ..fields['context'] = 'owner_uid=$uid'
      ..fields['public_id'] =
          'kku_profiles/$uid/${DateTime.now().microsecondsSinceEpoch}'
      ..files.add(
        http.MultipartFile.fromBytes('file', bytes, filename: imageFile.name),
      );

    try {
      final streamed = await request.send().timeout(
        const Duration(seconds: 30),
      );
      final response = await http.Response.fromStream(streamed)
          .timeout(const Duration(seconds: 10));
      final result = jsonDecode(response.body);
      if (response.statusCode < 200 ||
          response.statusCode >= 300 ||
          result is! Map<String, dynamic>) {
        final errorPayload = result is Map ? result['error'] : null;
        final message = errorPayload is Map
            ? errorPayload['message']?.toString()
            : null;
        throw StateError(
          message ?? 'อัปโหลดรูปไม่สำเร็จ (HTTP ${response.statusCode})',
        );
      }
      final secureUrl = result['secure_url'];
      if (secureUrl is! String ||
          !secureUrl.startsWith(
            'https://res.cloudinary.com/$_cloudinaryCloudName/',
          )) {
        throw StateError('Cloudinary ไม่ได้ส่ง URL รูปที่ปลอดภัยกลับมา');
      }
      // Caller can persist the public ID alongside photoUrl so the trusted
      // server-side cleanup endpoint can remove it when the user deletes their account.
      final publicId = result['public_id'];
      if (publicId is! String || !publicId.startsWith('kku_profiles/$uid/')) {
        throw StateError('Cloudinary ไม่ได้ส่งรหัสรูปที่ถูกต้องกลับมา');
      }
      return (url: secureUrl, publicId: publicId);
    } on http.ClientException catch (error) {
      throw StateError(
        'เชื่อมต่อ Cloudinary ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตและ Upload Preset: $error',
      );
    } on FormatException {
      throw StateError('Cloudinary ตอบกลับข้อมูลไม่ถูกต้อง กรุณาลองใหม่');
    } on TimeoutException {
      throw StateError(
        'อัปโหลดรูปใช้เวลานานเกินไป กรุณาลองรูปที่เล็กลงหรือตรวจสอบอินเทอร์เน็ต',
      );
    }
  }
}
