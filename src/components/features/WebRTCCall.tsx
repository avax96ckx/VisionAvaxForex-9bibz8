import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Phone, PhoneOff, Video, VideoOff, Mic, MicOff,
  RotateCcw, MonitorUp, Volume2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { UserProfile } from '@/types';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────────────────

interface RemoteUser {
  id: string;
  username: string;
  avatar?: string;
}

interface ActiveCallState {
  id: string;
  remoteUser: RemoteUser;
  callType: 'audio' | 'video';
  isInitiator: boolean;
}

interface IncomingCall {
  id: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  callType: 'audio' | 'video';
}

// ── RTC Config ────────────────────────────────────────────────────────────────

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
};

// ── Duration formatter ────────────────────────────────────────────────────────

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ── Avatar helper ─────────────────────────────────────────────────────────────

function Avatar({ src, name, size = 'lg' }: { src?: string; name: string; size?: 'sm' | 'lg' }) {
  const dim = size === 'lg' ? 'w-24 h-24' : 'w-10 h-10';
  const text = size === 'lg' ? 'text-3xl' : 'text-sm';
  return (
    <div className={`${dim} rounded-full overflow-hidden gradient-pink flex items-center justify-center flex-shrink-0`}>
      {src
        ? <img src={src} alt={name} className="w-full h-full object-cover" />
        : <span className={`${text} font-black text-white`}>{(name || '?')[0].toUpperCase()}</span>}
    </div>
  );
}

// ── Incoming Call Screen ──────────────────────────────────────────────────────

function IncomingCallScreen({ call, onAccept, onDecline, callBg }: {
  call: IncomingCall;
  onAccept: () => void;
  onDecline: () => void;
  callBg: string;
}) {
  return (
    <div
      className="fixed inset-0 z-[9900] flex flex-col items-center justify-between pb-16 pt-24"
      style={{ background: callBg }}
    >
      {/* Pulse rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className="absolute rounded-full border border-white/20"
            style={{
              width: `${i * 100 + 96}px`,
              height: `${i * 100 + 96}px`,
              animation: `pulse ${1 + i * 0.4}s ease-out infinite`,
              opacity: 1 - i * 0.25,
            }}
          />
        ))}
      </div>

      <div className="flex flex-col items-center gap-4 z-10">
        <p className="text-white/60 text-sm font-medium tracking-widest uppercase">
          Incoming {call.callType} call
        </p>
        <Avatar src={call.callerAvatar} name={call.callerName} size="lg" />
        <div className="text-center">
          <p className="text-white text-2xl font-black">{call.callerName}</p>
          <p className="text-white/50 text-sm mt-1">
            {call.callType === 'video' ? '📹 Video call' : '📞 Audio call'}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-16 z-10">
        {/* Decline */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={onDecline}
            className="w-16 h-16 rounded-full flex items-center justify-center press"
            style={{ background: '#e5263d', boxShadow: '0 4px 24px rgba(229,38,61,0.5)' }}
          >
            <PhoneOff className="w-7 h-7 text-white" />
          </button>
          <p className="text-white/50 text-xs">Decline</p>
        </div>
        {/* Accept */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={onAccept}
            className="w-16 h-16 rounded-full flex items-center justify-center press"
            style={{ background: '#16a34a', boxShadow: '0 4px 24px rgba(22,163,74,0.5)' }}
          >
            {call.callType === 'video'
              ? <Video className="w-7 h-7 text-white" />
              : <Phone className="w-7 h-7 text-white" />}
          </button>
          <p className="text-white/50 text-xs">Accept</p>
        </div>
      </div>
    </div>
  );
}

// ── Active Call Screen ────────────────────────────────────────────────────────

interface ActiveCallScreenProps {
  callId: string;
  localUser: { id: string; username: string; avatar?: string };
  remoteUser: RemoteUser;
  callType: 'audio' | 'video';
  isInitiator: boolean;
  callBg: string;
  onEnd: () => void;
}

export function ActiveCallScreen({
  callId, localUser, remoteUser, callType, isInitiator, callBg, onEnd
}: ActiveCallScreenProps) {
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [duration, setDuration] = useState(0);
  const [status, setStatus] = useState<'connecting' | 'ringing' | 'active'>('connecting');
  const [facingUser, setFacingUser] = useState(true);
  const [audioBlocked, setAudioBlocked] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const doneRef = useRef(false);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sigPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callIdRef = useRef(callId);
  const localUserIdRef = useRef(localUser.id);

  const sigState = useRef({ remoteDescSet: false, appliedCandidates: 0, candidateQueue: [] as RTCIceCandidateInit[] });

  useEffect(() => {
    setup();
    return () => { cleanup(); };
  }, []);

  async function setup() {
    if (doneRef.current) return;
    const _callId = callIdRef.current;
    const _uid = localUserIdRef.current;

    // Acquire media
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: callType === 'video' ? { facingMode: 'user' } : false,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current && callType === 'video') {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true;
        localVideoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      toast.error(`Media error: ${err.message}`);
    }

    // Set up peer connection
    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current!));
    }

    pc.ontrack = async (e) => {
      const stream = e.streams[0];
      if (!stream || !remoteVideoRef.current) return;
      remoteVideoRef.current.srcObject = stream;
      try {
        await remoteVideoRef.current.play();
        setStatus('active');
        durationRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      } catch {
        setAudioBlocked(true);
      }
    };

    // Batch ICE candidates
    const pendingCands: RTCIceCandidateInit[] = [];
    let batchTimer: ReturnType<typeof setTimeout> | null = null;
    pc.onicecandidate = (e) => {
      if (!e.candidate || doneRef.current) return;
      pendingCands.push(e.candidate.toJSON());
      if (batchTimer) clearTimeout(batchTimer);
      batchTimer = setTimeout(async () => {
        const batch = [...pendingCands]; pendingCands.length = 0;
        if (!batch.length) return;
        const col = isInitiator ? 'caller_candidates' : 'callee_candidates';
        const { data: existing } = await supabase.from('calls').select(col).eq('id', _callId).single();
        const prev: RTCIceCandidateInit[] = (existing as any)?.[col] || [];
        await supabase.from('calls').update({ [col]: [...prev, ...batch] }).eq('id', _callId);
      }, 300);
    };

    if (isInitiator) {
      // Create offer
      setStatus('ringing');
      try {
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: callType === 'video' });
        await pc.setLocalDescription(offer);
        await supabase.from('calls').update({
          offer: JSON.stringify(pc.localDescription),
          status: 'ringing',
        }).eq('id', _callId);
      } catch (err) {
        console.error('[Call] createOffer error:', err);
      }
    }

    // Poll for signaling
    sigPollRef.current = setInterval(() => signalingPoll(pc, _callId, _uid), 1200);
  }

  async function signalingPoll(pc: RTCPeerConnection, _callId: string, _uid: string) {
    if (doneRef.current) return;
    const { data: callRow } = await supabase.from('calls').select('*').eq('id', _callId).single();
    if (!callRow) return;

    // Check if ended remotely
    if (callRow.status === 'ended') {
      cleanup();
      onEnd();
      return;
    }

    const ss = sigState.current;

    if (!isInitiator && callRow.offer && !ss.remoteDescSet && pc.signalingState === 'stable') {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(callRow.offer)));
        ss.remoteDescSet = true;
        for (const c of ss.candidateQueue) {
          try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
        }
        ss.candidateQueue = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await supabase.from('calls').update({
          answer: JSON.stringify(pc.localDescription),
          status: 'active',
        }).eq('id', _callId);
        setStatus('active');
        durationRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      } catch (err) {
        ss.remoteDescSet = false;
      }
    }

    if (isInitiator && callRow.answer && !ss.remoteDescSet && pc.signalingState === 'have-local-offer') {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(callRow.answer)));
        ss.remoteDescSet = true;
        for (const c of ss.candidateQueue) {
          try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
        }
        ss.candidateQueue = [];
        setStatus('active');
        if (!durationRef.current) durationRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      } catch (err) {
        ss.remoteDescSet = false;
      }
    }

    // Apply remote ICE candidates
    const remoteCandCol = isInitiator ? 'callee_candidates' : 'caller_candidates';
    const remoteCands: RTCIceCandidateInit[] = callRow[remoteCandCol] || [];
    const newCands = remoteCands.slice(ss.appliedCandidates);
    for (const c of newCands) {
      if (ss.remoteDescSet) {
        try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
      } else {
        ss.candidateQueue.push(c);
      }
    }
    ss.appliedCandidates = remoteCands.length;
  }

  function cleanup() {
    doneRef.current = true;
    if (sigPollRef.current) clearInterval(sigPollRef.current);
    if (durationRef.current) clearInterval(durationRef.current);
    pcRef.current?.close();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
  }

  async function endCall() {
    cleanup();
    await supabase.from('calls').update({
      status: 'ended',
      ended_at: new Date().toISOString(),
    }).eq('id', callId);
    onEnd();
  }

  function toggleMute() {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = muted; });
    setMuted(!muted);
  }

  function toggleVideo() {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = videoOff; });
    setVideoOff(!videoOff);
  }

  async function flipCamera() {
    if (!localStreamRef.current) return;
    try {
      localStreamRef.current.getVideoTracks().forEach(t => t.stop());
      const next = !facingUser;
      setFacingUser(next);
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: next ? 'user' : 'environment' }, audio: false,
      });
      const newVt = newStream.getVideoTracks()[0];
      localStreamRef.current.getVideoTracks().forEach(t => localStreamRef.current!.removeTrack(t));
      localStreamRef.current.addTrack(newVt);
      if (localVideoRef.current) { localVideoRef.current.srcObject = localStreamRef.current; }
      const sender = pcRef.current?.getSenders().find(s => s.track?.kind === 'video');
      if (sender) await sender.replaceTrack(newVt).catch(() => {});
    } catch { toast.error('Camera flip failed'); }
  }

  function unlockAudio() {
    remoteVideoRef.current?.play().catch(() => {});
    setAudioBlocked(false);
  }

  const statusLabel = status === 'connecting' ? 'Connecting...' : status === 'ringing' ? 'Ringing...' : formatDuration(duration);

  return (
    <div
      className="fixed inset-0 z-[9800] flex flex-col"
      style={{ background: callBg, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
    >
      {/* Remote video or avatar */}
      {callType === 'video' ? (
        <video
          ref={remoteVideoRef}
          autoPlay playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            {/* Pulse rings behind avatar */}
            <div className="relative flex items-center justify-center">
              {status !== 'active' && [1, 2].map(i => (
                <div
                  key={i}
                  className="absolute rounded-full border border-white/20"
                  style={{ width: `${i * 80 + 96}px`, height: `${i * 80 + 96}px`, animation: `pulse ${1 + i * 0.4}s ease-out infinite` }}
                />
              ))}
              <Avatar src={remoteUser.avatar} name={remoteUser.username} size="lg" />
            </div>
            <p className="text-white text-2xl font-black">{remoteUser.username}</p>
            <p className="text-white/60 text-sm">{statusLabel}</p>
          </div>
        </div>
      )}

      {/* Audio unblock banner */}
      {audioBlocked && (
        <div className="absolute top-24 left-4 right-4 z-10 flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{ background: 'rgba(255,20,147,0.9)', backdropFilter: 'blur(12px)' }}>
          <Volume2 className="w-5 h-5 text-white flex-shrink-0" />
          <p className="text-white text-sm font-bold flex-1">Audio blocked by browser</p>
          <button onClick={unlockAudio} className="px-3 py-1.5 bg-white/20 rounded-xl text-white text-xs font-black press">Enable</button>
        </div>
      )}

      {/* Top bar */}
      <div className="relative z-10 flex flex-col items-center pt-12 pb-4">
        {callType !== 'video' && (
          <>
            <p className="text-white/60 text-xs tracking-widest uppercase mb-1">
              {callType === 'video' ? 'Video Call' : 'Audio Call'}
            </p>
            <p className="text-white/50 text-sm">{statusLabel}</p>
          </>
        )}
        {callType === 'video' && (
          <div className="absolute top-4 left-0 right-0 flex flex-col items-center pointer-events-none">
            <p className="text-white font-black text-lg drop-shadow-lg">{remoteUser.username}</p>
            <p className="text-white/60 text-xs drop-shadow-lg">{statusLabel}</p>
          </div>
        )}
      </div>

      {/* Local video PiP */}
      {callType === 'video' && (
        <div
          className="absolute z-20 rounded-2xl overflow-hidden shadow-2xl"
          style={{ width: 90, height: 120, bottom: 140, right: 16, border: '2px solid rgba(255,255,255,0.3)' }}
        >
          <video
            ref={localVideoRef}
            autoPlay playsInline muted
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)', display: videoOff ? 'none' : 'block' }}
          />
          {videoOff && (
            <div className="w-full h-full bg-black/60 flex items-center justify-center">
              <VideoOff className="w-5 h-5 text-white/50" />
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-center gap-5 px-6 pb-8">
        <div className="flex items-center justify-center gap-5 px-6 py-4 rounded-3xl"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)' }}>
          {/* Mute */}
          <button onClick={toggleMute} className="flex flex-col items-center gap-1 press">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${muted ? 'bg-red-500/70' : 'bg-white/15'}`}>
              {muted ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}
            </div>
            <p className="text-white/40 text-[9px]">{muted ? 'Unmute' : 'Mute'}</p>
          </button>

          {/* Video toggle */}
          {callType === 'video' && (
            <button onClick={toggleVideo} className="flex flex-col items-center gap-1 press">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${videoOff ? 'bg-red-500/70' : 'bg-white/15'}`}>
                {videoOff ? <VideoOff className="w-5 h-5 text-white" /> : <Video className="w-5 h-5 text-white" />}
              </div>
              <p className="text-white/40 text-[9px]">{videoOff ? 'Start Video' : 'Stop Video'}</p>
            </button>
          )}

          {/* Flip camera */}
          {callType === 'video' && (
            <button onClick={flipCamera} className="flex flex-col items-center gap-1 press">
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-white/15">
                <RotateCcw className="w-5 h-5 text-white" />
              </div>
              <p className="text-white/40 text-[9px]">Flip</p>
            </button>
          )}

          {/* End call */}
          <button onClick={endCall} className="flex flex-col items-center gap-1 press">
            <div className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: '#e5263d', boxShadow: '0 4px 20px rgba(229,38,61,0.5)' }}>
              <PhoneOff className="w-6 h-6 text-white" />
            </div>
            <p className="text-white/40 text-[9px]">End</p>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── useCall hook ──────────────────────────────────────────────────────────────

export function useCall() {
  const { user } = useAuth();
  const [activeCall, setActiveCall] = useState<ActiveCallState | null>(null);
  const [callBg, setCallBg] = useState('linear-gradient(135deg, #0d0d1a 0%, #1a0026 100%)');

  useEffect(() => {
    supabase.from('call_settings').select('bg_gradient_from,bg_gradient_to').eq('id', 'main').single()
      .then(({ data }) => {
        if (data) {
          setCallBg(`linear-gradient(135deg, ${data.bg_gradient_from || '#0d0d1a'} 0%, ${data.bg_gradient_to || '#1a0026'} 100%)`);
        }
      });
  }, []);

  const startCall = useCallback(async (otherUser: UserProfile, callType: 'audio' | 'video') => {
    if (!user) return;
    const { data: callRow } = await supabase.from('calls').insert({
      caller_id: user.id,
      callee_id: otherUser.id,
      call_type: callType,
      status: 'ringing',
      caller_candidates: [],
      callee_candidates: [],
    }).select('id').single();

    if (callRow) {
      setActiveCall({
        id: callRow.id,
        remoteUser: { id: otherUser.id, username: otherUser.username || otherUser.full_name || 'Member', avatar: otherUser.avatar_url },
        callType,
        isInitiator: true,
      });
    }
  }, [user]);

  return { startCall, activeCall, setActiveCall, callBg };
}

// ── GlobalCallListener ────────────────────────────────────────────────────────

export function GlobalCallListener() {
  const { user, profile } = useAuth();
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCallState | null>(null);
  const [callBg, setCallBg] = useState('linear-gradient(135deg, #0d0d1a 0%, #1a0026 100%)');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seenCallIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    supabase.from('call_settings').select('bg_gradient_from,bg_gradient_to,incoming_bg_from,incoming_bg_to').eq('id', 'main').single()
      .then(({ data }) => {
        if (data) {
          setCallBg(`linear-gradient(135deg, ${(data as any).incoming_bg_from || '#0d0d1a'} 0%, ${(data as any).incoming_bg_to || '#1a0026'} 100%)`);
        }
      });
  }, []);

  useEffect(() => {
    if (!user) return;

    async function checkIncoming() {
      const { data } = await supabase
        .from('calls')
        .select('id, caller_id, call_type, status, user_profiles!calls_caller_id_fkey(id,username,avatar_url)')
        .eq('callee_id', user!.id)
        .eq('status', 'ringing')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data && !seenCallIds.current.has(data.id)) {
        seenCallIds.current.add(data.id);
        const caller = (data as any).user_profiles;
        setIncomingCall({
          id: data.id,
          callerId: data.caller_id,
          callerName: caller?.username || 'Unknown',
          callerAvatar: caller?.avatar_url,
          callType: data.call_type as 'audio' | 'video',
        });
      }
    }

    pollRef.current = setInterval(checkIncoming, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [user]);

  async function acceptCall(call: IncomingCall) {
    await supabase.from('calls').update({ status: 'active' }).eq('id', call.id);
    setIncomingCall(null);
    setActiveCall({
      id: call.id,
      remoteUser: { id: call.callerId, username: call.callerName, avatar: call.callerAvatar },
      callType: call.callType,
      isInitiator: false,
    });
  }

  async function declineCall(call: IncomingCall) {
    await supabase.from('calls').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', call.id);
    setIncomingCall(null);
  }

  if (!user) return null;

  return (
    <>
      {incomingCall && !activeCall && (
        <IncomingCallScreen
          call={incomingCall}
          callBg={callBg}
          onAccept={() => acceptCall(incomingCall)}
          onDecline={() => declineCall(incomingCall)}
        />
      )}
      {activeCall && user && (
        <ActiveCallScreen
          callId={activeCall.id}
          localUser={{ id: user.id, username: profile?.username || user.username || 'You', avatar: profile?.avatar_url }}
          remoteUser={activeCall.remoteUser}
          callType={activeCall.callType}
          isInitiator={activeCall.isInitiator}
          callBg={callBg}
          onEnd={() => setActiveCall(null)}
        />
      )}
    </>
  );
}
