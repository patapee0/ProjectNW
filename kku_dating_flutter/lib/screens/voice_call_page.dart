import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:kku_dating_flutter/services/firebase_service.dart';

class VoiceCallPage extends StatefulWidget {
  const VoiceCallPage({super.key, required this.callId, required this.isCaller, this.partnerName});

  final String callId;
  final bool isCaller;
  final String? partnerName;

  @override
  State<VoiceCallPage> createState() => _VoiceCallPageState();
}

class _VoiceCallPageState extends State<VoiceCallPage> {
  final _firestore = FirebaseFirestore.instance;
  final _remoteRenderer = RTCVideoRenderer();
  RTCPeerConnection? _peer;
  MediaStream? _localStream;
  StreamSubscription<DocumentSnapshot<Map<String, dynamic>>>? _callSub;
  StreamSubscription<QuerySnapshot<Map<String, dynamic>>>? _candidateSub;
  final _queuedCandidates = <RTCIceCandidate>[];
  final _candidateIds = <String>{};
  bool _remoteDescriptionSet = false;
  bool _descriptionHandled = false;
  bool _muted = false;
  bool _speaker = true;
  bool _ending = false;
  bool _rendererInitialized = false;
  String _status = 'กำลังเชื่อมต่อ…';
  String _partnerName = 'สมาชิก KKU';
  Timer? _ringTimeout;

  DocumentReference<Map<String, dynamic>> get _call =>
      _firestore.collection('calls').doc(widget.callId);

  String get _remoteRole => widget.isCaller ? 'calleeCandidates' : 'callerCandidates';
  String get _localRole => widget.isCaller ? 'callerCandidates' : 'calleeCandidates';

  @override
  void initState() {
    super.initState();
    _start();
  }

  Future<void> _start() async {
    try {
      if (!kIsWeb) {
        final permission = await Permission.microphone.request();
        if (!permission.isGranted) throw StateError('ต้องอนุญาตใช้ไมโครโฟนเพื่อโทร');
      }
      await _remoteRenderer.initialize();
      _rendererInitialized = true;
      final callSnapshot = await _call.get();
      final callData = callSnapshot.data();
      if (!callSnapshot.exists || callData == null) throw StateError('ไม่พบข้อมูลสายโทร');
      final uid = FirebaseAuth.instance.currentUser?.uid;
      final callerId = callData['callerId'] as String?;
      final calleeId = callData['recipientId'] as String?;
      if (uid == null || (uid != callerId && uid != calleeId)) {
        throw StateError('บัญชีนี้ไม่มีสิทธิ์เข้าร่วมสาย');
      }
      _partnerName = widget.isCaller
          ? (widget.partnerName ?? 'สมาชิก KKU')
          : (callData['callerName'] as String? ?? 'สมาชิก KKU');
      if (mounted) setState(() => _status = widget.isCaller ? 'กำลังโทร…' : 'กำลังรับสาย…');

      if (mounted) setState(() => _status = 'กำลังเตรียมการเชื่อมต่อเสียง…');
      final servers = await FirebaseService().getVoiceIceServers();

      _peer = await createPeerConnection({
        'iceServers': servers,
        'sdpSemantics': 'unified-plan',
        'iceTransportPolicy': 'all',
      });
      _peer!.onIceCandidate = (candidate) {
        if (candidate.candidate == null || candidate.candidate!.isEmpty) return;
        unawaited(_call.collection(_localRole).add({
          'candidate': candidate.candidate,
          'sdpMid': candidate.sdpMid,
          'sdpMLineIndex': candidate.sdpMLineIndex,
        }).then<void>((_) {}, onError: (Object error, StackTrace stackTrace) {
          if (mounted) setState(() => _status = 'ส่งข้อมูลเชื่อมต่อสายไม่ได้: $error');
        }));
      };
      _peer!.onTrack = (event) {
        if (event.streams.isNotEmpty) _remoteRenderer.srcObject = event.streams.first;
      };
      _peer!.onConnectionState = (state) {
        if (!mounted) return;
        setState(() => _status = switch (state) {
              RTCPeerConnectionState.RTCPeerConnectionStateConnected => 'กำลังสนทนา',
              RTCPeerConnectionState.RTCPeerConnectionStateConnecting => 'กำลังเชื่อมต่อเสียง…',
              RTCPeerConnectionState.RTCPeerConnectionStateDisconnected => 'สัญญาณขาด กำลังลองใหม่…',
              RTCPeerConnectionState.RTCPeerConnectionStateFailed => 'เชื่อมต่อไม่สำเร็จ เครือข่ายอาจต้องใช้ TURN',
              RTCPeerConnectionState.RTCPeerConnectionStateClosed => 'วางสายแล้ว',
              _ => _status,
            });
      };

      _localStream = await navigator.mediaDevices.getUserMedia({'audio': true, 'video': false});
      if (!kIsWeb) await Helper.setSpeakerphoneOn(true);
      for (final track in _localStream!.getAudioTracks()) {
        await _peer!.addTrack(track, _localStream!);
      }
      _listenForRemoteCandidates();
      _callSub = _call.snapshots().listen(_handleCallUpdate, onError: (Object error) {
        if (mounted) setState(() => _status = 'รับสัญญาณสายไม่ได้: $error');
      });

      if (widget.isCaller) {
        final offer = await _peer!.createOffer({'offerToReceiveAudio': 1});
        await _peer!.setLocalDescription(offer);
        await _call.update({
          'offer': {'type': offer.type, 'sdp': offer.sdp},
          'updatedAt': FieldValue.serverTimestamp(),
        });
        _ringTimeout = Timer(const Duration(seconds: 45), () async {
          final snapshot = await _call.get();
          if (snapshot.data()?['state'] == 'ringing') {
            await _call.update({'state': 'ended', 'updatedAt': FieldValue.serverTimestamp()});
            if (mounted) setState(() => _status = 'ไม่มีผู้รับสาย');
          }
        });
      }
    } catch (error) {
      try {
        await _call.update({
          'state': widget.isCaller ? 'ended' : 'declined',
          'updatedAt': FieldValue.serverTimestamp(),
        });
      } catch (_) {
        // The call may not exist yet or connectivity may already be lost.
      }
      if (mounted) setState(() => _status = _startErrorMessage(error));
    }
  }

  String _startErrorMessage(Object error) {
    final details = error.toString().toLowerCase();
    final permissionDenied =
        details.contains('notallowederror') ||
        details.contains('permission denied') ||
        details.contains('permissiondeniedexception') ||
        details.contains('ต้องอนุญาตใช้ไมโครโฟน');
    if (permissionDenied) {
      return kIsWeb
          ? 'ยังไม่ได้รับอนุญาตใช้ไมโครโฟน เปิดการตั้งค่าเว็บไซต์ข้างแถบที่อยู่ เลือกไมโครโฟน > อนุญาต แล้วรีโหลดหน้าและโทรอีกครั้ง'
          : 'ยังไม่ได้รับอนุญาตใช้ไมโครโฟน ไปที่การตั้งค่าแอปบนอุปกรณ์ แล้วอนุญาตสิทธิ์ไมโครโฟนก่อนโทรอีกครั้ง';
    }
    return 'เริ่มสายไม่ได้: $error';
  }

  void _listenForRemoteCandidates() {
    _candidateSub = _call.collection(_remoteRole).snapshots().listen((snapshot) async {
      for (final change in snapshot.docChanges) {
        if (change.type == DocumentChangeType.removed || !_candidateIds.add(change.doc.id)) continue;
        final data = change.doc.data();
        if (data == null) continue;
        final candidate = RTCIceCandidate(
          data['candidate'] as String?,
          data['sdpMid'] as String?,
          (data['sdpMLineIndex'] as num?)?.toInt(),
        );
        if (_remoteDescriptionSet) {
          await _peer?.addCandidate(candidate);
        } else {
          _queuedCandidates.add(candidate);
        }
      }
    }, onError: (Object error) {
      if (mounted) setState(() => _status = 'รับข้อมูลเครือข่ายไม่ได้: $error');
    });
  }

  Future<void> _applyQueuedCandidates() async {
    _remoteDescriptionSet = true;
    for (final candidate in _queuedCandidates) {
      await _peer?.addCandidate(candidate);
    }
    _queuedCandidates.clear();
  }

  Future<void> _handleCallUpdate(DocumentSnapshot<Map<String, dynamic>> snapshot) async {
    final data = snapshot.data();
    if (data == null || _ending) return;
    final state = data['state'];
    if (state == 'declined' || state == 'ended') {
      _ringTimeout?.cancel();
      if (mounted) {
        setState(() => _status = state == 'declined' ? 'อีกฝ่ายไม่สะดวกรับสาย' : 'วางสายแล้ว');
        Future<void>.delayed(const Duration(milliseconds: 900), () {
          if (mounted && Navigator.of(context).canPop()) Navigator.of(context).pop();
        });
      }
      return;
    }

    if (widget.isCaller && !_descriptionHandled && data['answer'] is Map) {
      _descriptionHandled = true;
      final answer = Map<String, dynamic>.from(data['answer'] as Map);
      await _peer?.setRemoteDescription(RTCSessionDescription(answer['sdp'] as String?, answer['type'] as String?));
      await _applyQueuedCandidates();
      _ringTimeout?.cancel();
    } else if (!widget.isCaller && !_descriptionHandled && data['offer'] is Map) {
      _descriptionHandled = true;
      final offer = Map<String, dynamic>.from(data['offer'] as Map);
      await _peer?.setRemoteDescription(RTCSessionDescription(offer['sdp'] as String?, offer['type'] as String?));
      await _applyQueuedCandidates();
      final answer = await _peer!.createAnswer({'offerToReceiveAudio': 1});
      await _peer!.setLocalDescription(answer);
      await _call.update({
        'answer': {'type': answer.type, 'sdp': answer.sdp},
        'state': 'accepted',
        'updatedAt': FieldValue.serverTimestamp(),
      });
    }
  }

  Future<void> _toggleMute() async {
    _muted = !_muted;
    for (final track in _localStream?.getAudioTracks() ?? <MediaStreamTrack>[]) {
      track.enabled = !_muted;
    }
    if (mounted) setState(() {});
  }

  Future<void> _toggleSpeaker() async {
    _speaker = !_speaker;
    if (!kIsWeb) await Helper.setSpeakerphoneOn(_speaker);
    if (mounted) setState(() {});
  }

  Future<void> _endCall() async {
    if (_ending) return;
    _ending = true;
    try {
      final snapshot = await _call.get();
      if (snapshot.data()?['state'] != 'ended' && snapshot.data()?['state'] != 'declined') {
        await _call.update({'state': 'ended', 'updatedAt': FieldValue.serverTimestamp()});
      }
    } catch (_) {
      // Local cleanup still needs to happen when the network drops.
    }
    await _cleanup();
    if (mounted) Navigator.of(context).pop();
  }

  Future<void> _cleanup() async {
    _ringTimeout?.cancel();
    await _callSub?.cancel();
    await _candidateSub?.cancel();
    await _localStream?.dispose();
    await _peer?.close();
    if (_rendererInitialized) await _remoteRenderer.dispose();
  }

  @override
  void dispose() {
    _ringTimeout?.cancel();
    _callSub?.cancel();
    _candidateSub?.cancel();
    _localStream?.dispose();
    _peer?.close();
    if (_rendererInitialized) _remoteRenderer.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, result) {
          if (!didPop) _endCall();
        },
        child: Scaffold(
        appBar: AppBar(title: const Text('โทรด้วยเสียง')),
        body: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.account_circle, size: 112, color: Color(0xFF8B0000)),
                  const SizedBox(height: 20),
                  Text(_partnerName, style: Theme.of(context).textTheme.headlineSmall),
                  const SizedBox(height: 8),
                  Text(_status, textAlign: TextAlign.center),
                  const SizedBox(height: 32),
                  SizedBox(width: 1, height: 1, child: RTCVideoView(_remoteRenderer)),
                  Wrap(
                    alignment: WrapAlignment.center,
                    spacing: 18,
                    children: [
                      IconButton.filledTonal(
                        tooltip: _muted ? 'เปิดไมโครโฟน' : 'ปิดไมโครโฟน',
                        onPressed: _toggleMute,
                        icon: Icon(_muted ? Icons.mic_off : Icons.mic),
                      ),
                      IconButton.filledTonal(
                        tooltip: _speaker ? 'ปิดลำโพง' : 'เปิดลำโพง',
                        onPressed: _toggleSpeaker,
                        icon: Icon(_speaker ? Icons.volume_up : Icons.hearing),
                      ),
                      IconButton.filled(
                        tooltip: 'วางสาย',
                        style: IconButton.styleFrom(backgroundColor: Colors.red),
                        onPressed: _endCall,
                        icon: const Icon(Icons.call_end),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
        ),
      );
}
