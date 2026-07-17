import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Video, VideoOff, Mic, MicOff, MonitorUp, PhoneOff, Users,
  Share2, Crown, X, Copy, Check, UserCheck, RotateCcw,
  MessageCircle, Send, Volume2, ChevronDown
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { UserProfile } from '@/types';
import { toast } from 'sonner';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
      ],
    },

    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
};

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

interface Participant {
  userId: string;
  username: string;
  avatar_url?: string;
}

// ── Pre-join screen ──
interface PreJoinProps {
  meeting: { id: string; title: string; hostName: string };
  onJoin: (video: boolean, audio: boolean) => void;
  onCancel: () => void;
}
export function PreJoinScreen({ meeting, onJoin, onCancel }: PreJoinProps) {
  const [videoOn, setVideoOn] = useState(true);
  const [audioOn, setAudioOn] = useState(true);
  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let active = true;
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(s => {
        if (!active) { s.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = s;
        if (previewRef.current) {
          previewRef.current.srcObject = s;
          previewRef.current.play().catch(() => {});
        }
      })
      .catch(() => setVideoOn(false));
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  function join() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    onJoin(videoOn, audioOn);
  }

  return (
    <div className="fixed inset-0 z-[9800] bg-black/90 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#1c1c2e] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <p className="text-white font-black text-base">{meeting.title}</p>
            <p className="text-white/40 text-xs">Hosted by {meeting.hostName}</p>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-xl bg-white/10 press">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
        <div className="relative mx-5 my-4 rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: '4/3' }}>
          <video ref={previewRef} autoPlay playsInline muted
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)', display: videoOn ? 'block' : 'none' }} />
          {!videoOn && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <VideoOff className="w-10 h-10 text-white/30 mb-2" />
              <p className="text-white/30 text-xs">Camera off</p>
            </div>
          )}
        </div>
        <div className="flex items-center justify-center gap-6 px-5 mb-5">
          <button onClick={() => setVideoOn(!videoOn)} className="flex flex-col items-center gap-1.5">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${videoOn ? 'bg-white/15' : 'bg-red-500/70'}`}>
              {videoOn ? <Video className="w-6 h-6 text-white" /> : <VideoOff className="w-6 h-6 text-white" />}
            </div>
            <p className="text-white/50 text-[10px]">{videoOn ? 'Camera On' : 'Camera Off'}</p>
          </button>
          <button onClick={() => setAudioOn(!audioOn)} className="flex flex-col items-center gap-1.5">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${audioOn ? 'bg-white/15' : 'bg-red-500/70'}`}>
              {audioOn ? <Mic className="w-6 h-6 text-white" /> : <MicOff className="w-6 h-6 text-white" />}
            </div>
            <p className="text-white/50 text-[10px]">{audioOn ? 'Mic On' : 'Mic Off'}</p>
          </button>
        </div>
        <div className="px-5 pb-5">
          <button onClick={join}
            className="w-full py-3.5 rounded-2xl text-white font-black text-sm press shadow-xl"
            style={{ background: 'linear-gradient(135deg, #FF1493, #FF69B4)', boxShadow: '0 6px 24px rgba(255,20,147,0.4)' }}>
            Join Meeting
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Share Meeting Modal ──
function ShareMeetingModal({ meetingId, meetingTitle, onClose, onShared }: {
  meetingId: string; meetingTitle: string; onClose: () => void; onShared?: () => void;
}) {
  const { user } = useAuth();
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);
  const [sharedToVIP, setSharedToVIP] = useState(false);
  const [copied, setCopied] = useState(false);
  const joinLink = `${window.location.origin}/vip`;

  useEffect(() => {
    supabase.from('user_profiles').select('id,username,full_name,avatar_url,is_online')
      .neq('id', user?.id || '').order('username')
      .then(({ data }) => { if (data) setMembers(data as UserProfile[]); });
  }, [user]);

  async function shareToVIPRoom() {
    if (!user) return;
    await supabase.from('vip_messages').insert({
      user_id: user.id,
      message: `🎥 **${meetingTitle}**\n\nAdmin has started a meeting. Join now!\n\nmeeting_id:${meetingId}`,
    });
    setSharedToVIP(true);
    toast.success('Shared to VIP Room!');
    onShared?.();
  }

  async function shareToMembers() {
    if (!user || selected.size === 0) { toast.error('Select at least one member'); return; }
    setSending(true);
    for (const memberId of selected) {
      const p1 = user.id < memberId ? user.id : memberId;
      const p2 = user.id < memberId ? memberId : user.id;
      let { data: conv } = await supabase.from('conversations').select('id').eq('participant_one', p1).eq('participant_two', p2).single();
      if (!conv) {
        const { data: c } = await supabase.from('conversations').insert({ participant_one: p1, participant_two: p2 }).select('id').single();
        conv = c;
      }
      if (conv) {
        const msg = `🎥 **${meetingTitle}**\n\nYou've been invited to a meeting!\n\nmeeting_id:${meetingId}`;
        await supabase.from('direct_messages').insert({ conversation_id: conv.id, sender_id: user.id, message: msg });
        await supabase.from('conversations').update({ last_message: '🎥 Meeting invitation', last_message_at: new Date().toISOString() }).eq('id', conv.id);
      }
    }
    toast.success(`Invitation sent to ${selected.size} member${selected.size > 1 ? 's' : ''}!`);
    setSending(false);
    onShared?.();
    onClose();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(joinLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Link copied!');
    } catch {
      toast.error('Could not copy link');
    }
  }

  const filtered = members.filter(m => !search || (m.username || m.full_name || '').toLowerCase().includes(search.toLowerCase()));

  // Render as portal to avoid z-index conflicts inside the meeting room
  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-black/80 flex flex-col" onClick={onClose}>
      <div className="flex-1" />
      <div className="w-full max-w-md mx-auto bg-[#1c1c2e] border border-white/10 rounded-t-3xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ maxHeight: '85vh', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h3 className="font-black text-white">Share Meeting</h3>
          <button onClick={onClose} className="p-1.5 rounded-xl bg-white/10 press"><X className="w-4 h-4 text-white" /></button>
        </div>
        {/* Link row */}
        <div className="px-5 py-3 border-b border-white/10">
          <p className="text-white/40 text-xs mb-2 font-bold">Meeting Link</p>
          <div className="flex gap-2">
            <div className="flex-1 bg-white/5 rounded-xl px-3 py-2.5 text-white/60 text-xs font-mono truncate border border-white/8">{joinLink}</div>
            <button onClick={copyLink}
              className="px-4 py-2 bg-primary/20 border border-primary/30 rounded-xl text-primary text-xs font-bold press flex items-center gap-1.5">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
        {/* VIP Room */}
        <div className="px-5 py-3 border-b border-white/10">
          <button onClick={shareToVIPRoom} disabled={sharedToVIP}
            className="w-full flex items-center gap-3 py-3 px-4 rounded-2xl press transition-all disabled:opacity-60"
            style={{ background: sharedToVIP ? 'rgba(34,197,94,0.15)' : 'rgba(255,20,147,0.15)', border: '1px solid rgba(255,20,147,0.3)' }}>
            <Crown className="w-5 h-5 text-primary flex-shrink-0" />
            <div className="flex-1 text-left">
              <p className="text-white font-bold text-sm">{sharedToVIP ? '✅ Shared to VIP Room' : 'Share to VIP Room'}</p>
              <p className="text-white/40 text-xs">All VIP members will see a Join button</p>
            </div>
          </button>
        </div>
        {/* Direct members */}
        <div className="px-5 pt-3 pb-2">
          <p className="text-white/60 text-xs font-bold uppercase tracking-wide mb-2">Share to Specific Members</p>
          <input className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-primary/50 mb-2"
            placeholder="Search members..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="overflow-y-auto px-5 pb-2" style={{ maxHeight: '25vh' }}>
          {filtered.map(m => (
            <button key={m.id} onClick={() => setSelected(prev => { const n = new Set(prev); n.has(m.id) ? n.delete(m.id) : n.add(m.id); return n; })}
              className="w-full flex items-center gap-3 py-2.5 press">
              <div className="w-9 h-9 rounded-full overflow-hidden bg-muted gradient-pink flex items-center justify-center flex-shrink-0">
                {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <span className="text-sm font-black text-white">{(m.username || '?')[0].toUpperCase()}</span>}
              </div>
              <p className="flex-1 text-sm text-white font-medium text-left">{m.username || m.full_name || 'Member'}</p>
              {selected.has(m.id) && <UserCheck className="w-4 h-4 text-green-400 flex-shrink-0" />}
            </button>
          ))}
        </div>
        <div className="px-5 pt-2 pb-1">
          <button onClick={shareToMembers} disabled={sending || selected.size === 0}
            className="w-full py-3 rounded-2xl text-white font-black text-sm press disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #FF1493, #FF69B4)' }}>
            {sending ? 'Sending...' : `Share Now${selected.size > 0 ? ` (${selected.size})` : ''}`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Meeting Chat Panel ──
interface ChatMessage {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  username?: string;
  avatar_url?: string;
}

function MeetingChat({ meetingId, userId, username, onClose }: {
  meetingId: string; userId: string; username: string; onClose: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchMessages() {
    const { data } = await supabase
      .from('meeting_messages')
      .select('id, user_id, message, created_at, user_profiles(username, avatar_url)')
      .eq('meeting_id', meetingId)
      .order('created_at', { ascending: true })
      .limit(100);
    if (data) {
      setMessages(data.map((m: any) => ({
        id: m.id, user_id: m.user_id, message: m.message, created_at: m.created_at,
        username: m.user_profiles?.username || 'Member',
        avatar_url: m.user_profiles?.avatar_url,
      })));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }

  useEffect(() => {
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [meetingId]);

  async function sendMessage() {
    const msg = text.trim();
    if (!msg || sending) return;
    setSending(true);
    setText('');
    await supabase.from('meeting_messages').insert({ meeting_id: meetingId, user_id: userId, message: msg });
    await fetchMessages();
    setSending(false);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  return createPortal(
    <div className="fixed inset-0 z-[99998] bg-black/50 flex flex-col justify-end" onClick={onClose}>
      <div className="w-full max-w-md mx-auto bg-[#1c1c2e] border border-white/10 rounded-t-3xl overflow-hidden flex flex-col"
        style={{ height: '65vh', paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-primary" />
            <h3 className="font-black text-white text-sm">Meeting Chat</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl bg-white/10 press">
            <ChevronDown className="w-4 h-4 text-white" />
          </button>
        </div>
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 opacity-40">
              <MessageCircle className="w-10 h-10 text-white/20" />
              <p className="text-white/30 text-sm">No messages yet. Say hi!</p>
            </div>
          )}
          {messages.map(m => {
            const isMe = m.user_id === userId;
            return (
              <div key={m.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                {!isMe && (
                  <div className="w-7 h-7 rounded-full gradient-pink flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                      : <span className="text-[10px] font-black text-white">{(m.username || '?')[0].toUpperCase()}</span>}
                  </div>
                )}
                <div className={`max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {!isMe && <p className="text-white/40 text-[10px] font-bold mb-1 px-1">{m.username}</p>}
                  <div className={`px-3.5 py-2.5 rounded-2xl text-sm ${isMe ? 'rounded-br-sm text-white' : 'rounded-bl-sm text-white'}`}
                    style={{ background: isMe ? 'linear-gradient(135deg,#FF1493,#FF69B4)' : 'rgba(255,255,255,0.08)' }}>
                    {m.message}
                  </div>
                  <p className="text-white/20 text-[9px] mt-1 px-1">
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
        {/* Input */}
        <div className="px-4 py-3 border-t border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <input
              className="flex-1 bg-white/8 border border-white/12 rounded-2xl px-4 py-2.5 text-white text-sm outline-none focus:border-primary/50 placeholder-white/25"
              placeholder="Send a message..."
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKey}
              autoFocus
            />
            <button onClick={sendMessage} disabled={!text.trim() || sending}
              className="w-11 h-11 rounded-2xl flex items-center justify-center press disabled:opacity-40 flex-shrink-0"
              style={{ background: text.trim() ? 'linear-gradient(135deg,#FF1493,#FF69B4)' : 'rgba(255,255,255,0.08)' }}>
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Active Meeting Room ──
interface MeetingRoomProps {
  meetingId: string;
  meetingTitle: string;
  isHost: boolean;
  videoOn: boolean;
  audioOn: boolean;
  onLeave: () => void;
}

export function ActiveMeetingRoom({ meetingId, meetingTitle, isHost, videoOn: initVideo, audioOn: initAudio, onLeave }: MeetingRoomProps) {
  const { user, profile } = useAuth();

  // ── UI state ──
  const [muted, setMuted] = useState(!initAudio);
  const [videoOff, setVideoOff] = useState(!initVideo);
  const [sharing, setSharing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [showShare, setShowShare] = useState(false);
  const [facingUser, setFacingUser] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastReadMsgCount, setLastReadMsgCount] = useState(0);
  const [audioBlocked, setAudioBlocked] = useState(false); // browser autoplay blocked
  const [msgCount, setMsgCount] = useState(0);

  // ── Stable prop refs — never change, no re-render side effects ──
  const meetingIdRef = useRef(meetingId);
  const isHostRef = useRef(isHost);
  const userIdRef = useRef(user?.id || '');
  const userUsernameRef = useRef(profile?.username || user?.username || 'You');
  const onLeaveRef = useRef(onLeave);
  useEffect(() => { onLeaveRef.current = onLeave; }, [onLeave]);

  // ── Media refs ──
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // ── Peer management (all via refs — zero closure issues) ──
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const peerPollsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const remoteVideoRefsMap = useRef<Map<string, HTMLVideoElement>>(new Map());
  const connectedPeersRef = useRef<Set<string>>(new Set());
  const lastPeerIdsRef = useRef<Set<string>>(new Set());

  // ── Lifecycle refs ──
  const doneRef = useRef(false);
  const meetingPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const msgPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Mute state ref ──
  const mutedRef = useRef(!initAudio);
  const videoOffRef = useRef(!initVideo);

  // ── Poll message count for unread badge ──
  useEffect(() => {
    async function checkMsgs() {
      const { count } = await supabase
        .from('meeting_messages')
        .select('id', { count: 'exact', head: true })
        .eq('meeting_id', meetingId);
      const n = count || 0;
      setMsgCount(n);
    }
    msgPollRef.current = setInterval(checkMsgs, 4000);
    return () => { if (msgPollRef.current) clearInterval(msgPollRef.current); };
  }, [meetingId]);

  // Track unread messages
  useEffect(() => {
    if (showChat) {
      setLastReadMsgCount(msgCount);
      setUnreadCount(0);
    } else {
      const newUnread = Math.max(0, msgCount - lastReadMsgCount);
      setUnreadCount(newUnread);
    }
  }, [msgCount, showChat]);

  // ── SETUP — runs exactly once on mount ──
  useEffect(() => {
    const _meetingId = meetingIdRef.current;
    const _userId = userIdRef.current;
    const _isHost = isHostRef.current;

    async function setup() {
      if (doneRef.current || !_userId) return;

      // 1. Acquire media
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: initAudio ? { echoCancellation: true, noiseSuppression: true } : false,
          video: initVideo ? { facingMode: 'user' } : false,
        });
        localStreamRef.current = stream;
        if (localVideoRef.current && initVideo) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.muted = true;
          localVideoRef.current.play().catch(() => {});
        }
      } catch (err: any) {
        toast.error(`Microphone/camera denied: ${err.message || 'Permission error'}`);
      }

      // 2. Announce presence (DELETE + INSERT avoids NULL unique constraint issues)
      await supabase.from('meeting_peers')
        .delete()
        .eq('meeting_id', _meetingId)
        .eq('user_id', _userId)
        .is('target_user_id', null);

      await supabase.from('meeting_peers').insert({
        meeting_id: _meetingId,
        user_id: _userId,
        target_user_id: null,
        offer: null,
        answer: null,
        ice_candidates: [],
      });

      // 3. Update meeting status if host
      if (_isHost) {
        await supabase.from('meetings').update({
          status: 'active',
          started_at: new Date().toISOString(),
        }).eq('id', _meetingId);
      }

      // 4. Start duration timer
      durationRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);

      // 5. Start participant polling
      await pollParticipants();
      meetingPollRef.current = setInterval(pollParticipants, 3000);
    }

    async function pollParticipants() {
      if (doneRef.current) return;
      const _mid = meetingIdRef.current;
      const _uid = userIdRef.current;

      const { data: mtg } = await supabase
        .from('meetings').select('status').eq('id', _mid).single();
      if (mtg?.status === 'ended') {
        onLeaveRef.current();
        return;
      }

      const { data: rows } = await supabase
        .from('meeting_peers')
        .select('user_id, user_profiles(id,username,avatar_url)')
        .eq('meeting_id', _mid)
        .is('target_user_id', null);

      if (!rows || doneRef.current) return;

      const others = rows.filter((r: any) => r.user_id !== _uid);
      const currentIds = new Set(others.map((r: any) => r.user_id as string));

      setParticipants(others.map((r: any) => ({
        userId: r.user_id,
        username: (r.user_profiles as any)?.username || 'Member',
        avatar_url: (r.user_profiles as any)?.avatar_url,
      })));

      for (const row of others) {
        const pid = row.user_id as string;
        if (!connectedPeersRef.current.has(pid)) {
          connectedPeersRef.current.add(pid);
          connectToPeer(pid);
        }
      }

      for (const knownId of lastPeerIdsRef.current) {
        if (!currentIds.has(knownId)) {
          connectedPeersRef.current.delete(knownId);
          closePeer(knownId);
        }
      }

      lastPeerIdsRef.current = currentIds;
    }

    function closePeer(peerId: string) {
      const poll = peerPollsRef.current.get(peerId);
      if (poll) { clearInterval(poll); peerPollsRef.current.delete(peerId); }
      const pc = peersRef.current.get(peerId);
      if (pc) { try { pc.close(); } catch {} peersRef.current.delete(peerId); }
      const el = remoteVideoRefsMap.current.get(peerId);
      if (el) { el.srcObject = null; }
      remoteStreamsRef.current.delete(peerId);
    }

    async function connectToPeer(peerId: string) {
      if (doneRef.current) return;
      const _mid = meetingIdRef.current;
      const _uid = userIdRef.current;
      const stream = localStreamRef.current;

      const pc = new RTCPeerConnection(RTC_CONFIG);
      peersRef.current.set(peerId, pc);

      if (stream) {
        stream.getTracks().forEach(t => pc.addTrack(t, stream));
      }

      pc.ontrack = async (e) => {
        const remoteStream = e.streams[0];
        if (!remoteStream) return;
        remoteStreamsRef.current.set(peerId, remoteStream);
        const el = remoteVideoRefsMap.current.get(peerId);
        if (el) {
          el.srcObject = remoteStream;
          try {
            await el.play();
          } catch {
            setAudioBlocked(true);
          }
        }
      };

      const pendingCands: RTCIceCandidateInit[] = [];
      let batchTimer: ReturnType<typeof setTimeout> | null = null;
      pc.onicecandidate = (e) => {
        if (!e.candidate || doneRef.current) return;
        pendingCands.push(e.candidate.toJSON());
        if (batchTimer) clearTimeout(batchTimer);
        batchTimer = setTimeout(async () => {
          const batch = [...pendingCands]; pendingCands.length = 0;
          if (!batch.length || doneRef.current) return;
          const { data: ex } = await supabase.from('meeting_peers')
            .select('ice_candidates')
            .eq('meeting_id', _mid)
            .eq('user_id', _uid)
            .eq('target_user_id', peerId)
            .maybeSingle();
          const prev: RTCIceCandidateInit[] = (ex as any)?.ice_candidates || [];
          await supabase.from('meeting_peers').upsert({
            meeting_id: _mid,
            user_id: _uid,
            target_user_id: peerId,
            ice_candidates: [...prev, ...batch],
          }, { onConflict: 'meeting_id,user_id,target_user_id' });
        }, 300);
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed' && !doneRef.current) {
          if (_uid < peerId) {
            setTimeout(async () => {
              if (doneRef.current || !peersRef.current.has(peerId)) return;
              try {
                const offer = await pc.createOffer({ iceRestart: true, offerToReceiveAudio: true, offerToReceiveVideo: true });
                await pc.setLocalDescription(offer);
                await supabase.from('meeting_peers').upsert({
                  meeting_id: _mid, user_id: _uid, target_user_id: peerId,
                  offer: JSON.stringify(pc.localDescription), answer: null, ice_candidates: [],
                }, { onConflict: 'meeting_id,user_id,target_user_id' });
              } catch {}
            }, 2000);
          }
        }
      };

      const isInitiator = _uid < peerId;

      if (isInitiator) {
        try {
          const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
          await pc.setLocalDescription(offer);
          await supabase.from('meeting_peers').upsert({
            meeting_id: _mid, user_id: _uid, target_user_id: peerId,
            offer: JSON.stringify(pc.localDescription), answer: null, ice_candidates: [],
          }, { onConflict: 'meeting_id,user_id,target_user_id' });
        } catch (err) {
          console.error('[Meeting] createOffer error:', err);
        }
      }

      const sigState = {
        remoteDescSet: false,
        appliedCandidates: 0,
        candidateQueue: [] as RTCIceCandidateInit[],
      };

      const sigPoll = setInterval(async () => {
        if (doneRef.current || !peersRef.current.has(peerId)) {
          clearInterval(sigPoll);
          peerPollsRef.current.delete(peerId);
          return;
        }

        const { data: remote } = await supabase.from('meeting_peers')
          .select('offer, answer, ice_candidates')
          .eq('meeting_id', _mid)
          .eq('user_id', peerId)
          .eq('target_user_id', _uid)
          .maybeSingle();

        if (!remote) return;

        if (!isInitiator && (remote as any).offer && !sigState.remoteDescSet && pc.signalingState === 'stable') {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse((remote as any).offer)));
            sigState.remoteDescSet = true;
            for (const c of sigState.candidateQueue) {
              try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
            }
            sigState.candidateQueue = [];
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await supabase.from('meeting_peers').upsert({
              meeting_id: _mid, user_id: _uid, target_user_id: peerId,
              answer: JSON.stringify(pc.localDescription), ice_candidates: [],
            }, { onConflict: 'meeting_id,user_id,target_user_id' });
          } catch (err) {
            sigState.remoteDescSet = false;
          }
        }

        if (isInitiator && (remote as any).answer && !sigState.remoteDescSet && pc.signalingState === 'have-local-offer') {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse((remote as any).answer)));
            sigState.remoteDescSet = true;
            for (const c of sigState.candidateQueue) {
              try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
            }
            sigState.candidateQueue = [];
          } catch (err) {
            sigState.remoteDescSet = false;
          }
        }

        if (!isInitiator && (remote as any).offer && sigState.remoteDescSet) {
          try {
            const parsed = JSON.parse((remote as any).offer);
            if (pc.remoteDescription && pc.remoteDescription.sdp !== parsed.sdp) {
              sigState.remoteDescSet = false;
              sigState.appliedCandidates = 0;
              sigState.candidateQueue = [];
            }
          } catch {}
        }

        const remoteCands: RTCIceCandidateInit[] = (remote as any).ice_candidates || [];
        const newCands = remoteCands.slice(sigState.appliedCandidates);
        for (const c of newCands) {
          if (sigState.remoteDescSet) {
            try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
          } else {
            sigState.candidateQueue.push(c);
          }
        }
        sigState.appliedCandidates = remoteCands.length;
      }, 1200);

      peerPollsRef.current.set(peerId, sigPoll);
    }

    setup();

    return () => {
      doneRef.current = true;
      if (meetingPollRef.current) clearInterval(meetingPollRef.current);
      if (durationRef.current) clearInterval(durationRef.current);
      if (msgPollRef.current) clearInterval(msgPollRef.current);

      peerPollsRef.current.forEach(iv => clearInterval(iv));
      peerPollsRef.current.clear();
      peersRef.current.forEach(pc => { try { pc.close(); } catch {} });
      peersRef.current.clear();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current?.getTracks().forEach(t => t.stop());

      const uid = userIdRef.current;
      const mid = meetingIdRef.current;
      if (uid) {
        supabase.from('meeting_peers').delete().eq('meeting_id', mid).eq('user_id', uid).then(() => {});
      }
      if (isHostRef.current) {
        supabase.from('meetings').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', mid).then(() => {});
      }
    };
  }, []);

  // ── Audio unlock: try to play all remote videos ──
  function unlockAudio() {
    remoteVideoRefsMap.current.forEach(el => {
      if (el && el.paused) {
        el.muted = false;
        el.play().catch(() => {});
      }
    });
    setAudioBlocked(false);
    toast.success('Audio enabled!');
  }

  // ── Controls ──
  function toggleMute() {
    const next = !muted;
    mutedRef.current = next;
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !next; });
    setMuted(next);
  }

  function toggleVideo() {
    const next = !videoOff;
    videoOffRef.current = next;
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !next; });
    setVideoOff(next);
  }

  async function toggleScreenShare() {
    if (sharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      setSharing(false);
      const vt = localStreamRef.current?.getVideoTracks()[0];
      if (vt) {
        peersRef.current.forEach(pc => {
          const s = pc.getSenders().find(sv => sv.track?.kind === 'video');
          if (s) s.replaceTrack(vt).catch(() => {});
        });
        if (localVideoRef.current && localStreamRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
          localVideoRef.current.play().catch(() => {});
        }
      }
      return;
    }
    if (typeof (navigator.mediaDevices as any)?.getDisplayMedia !== 'function') {
      toast.error('Screen sharing requires Chrome or Edge on desktop.');
      return;
    }
    try {
      const screen = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = screen;
      setSharing(true);
      const st = screen.getVideoTracks()[0];
      if (localVideoRef.current) { localVideoRef.current.srcObject = screen; localVideoRef.current.play().catch(() => {}); }
      peersRef.current.forEach(pc => {
        const s = pc.getSenders().find(sv => sv.track?.kind === 'video');
        if (s) s.replaceTrack(st).catch(() => {});
        else pc.addTrack(st, screen);
      });
      st.onended = () => {
        setSharing(false); screenStreamRef.current = null;
        const vt = localStreamRef.current?.getVideoTracks()[0];
        if (vt) {
          peersRef.current.forEach(pc => {
            const s = pc.getSenders().find(sv => sv.track?.kind === 'video');
            if (s) s.replaceTrack(vt).catch(() => {});
          });
        }
        if (localVideoRef.current && localStreamRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
          localVideoRef.current.play().catch(() => {});
        }
      };
    } catch (err: any) {
      if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
        toast.error('Screen sharing not available. Use Chrome or Edge on desktop.');
      }
    }
  }

  async function flipCamera() {
    if (!localStreamRef.current) return;
    try {
      localStreamRef.current.getVideoTracks().forEach(t => t.stop());
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingUser ? 'environment' : 'user' }, audio: false,
      });
      setFacingUser(!facingUser);
      const newVt = newStream.getVideoTracks()[0];
      localStreamRef.current.getVideoTracks().forEach(t => localStreamRef.current!.removeTrack(t));
      localStreamRef.current.addTrack(newVt);
      if (localVideoRef.current) { localVideoRef.current.srcObject = localStreamRef.current; localVideoRef.current.play().catch(() => {}); }
      peersRef.current.forEach(async pc => {
        const s = pc.getSenders().find(sv => sv.track?.kind === 'video');
        if (s) await s.replaceTrack(newVt).catch(() => {});
      });
    } catch { toast.error('Camera flip failed'); }
  }

  function handleLeave() {
    doneRef.current = true;
    if (meetingPollRef.current) clearInterval(meetingPollRef.current);
    if (durationRef.current) clearInterval(durationRef.current);
    if (msgPollRef.current) clearInterval(msgPollRef.current);
    peerPollsRef.current.forEach(iv => clearInterval(iv));
    peerPollsRef.current.clear();
    peersRef.current.forEach(pc => { try { pc.close(); } catch {} });
    peersRef.current.clear();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());

    const uid = userIdRef.current;
    const mid = meetingIdRef.current;
    if (uid) {
      supabase.from('meeting_peers').delete().eq('meeting_id', mid).eq('user_id', uid).then(() => {});
    }
    if (isHostRef.current) {
      supabase.from('meetings').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', mid).then(() => {});
    }
    onLeaveRef.current();
  }

  const allParticipants = [
    { userId: userIdRef.current, username: 'You', avatar_url: profile?.avatar_url, isLocal: true },
    ...participants.map(p => ({ ...p, isLocal: false })),
  ];
  const cols =
  allParticipants.length <= 1
    ? 1
    : allParticipants.length <= 4
    ? 2
    : allParticipants.length <= 9
    ? 3
    : 4;

  return (
    <>
      {showShare && (
        <ShareMeetingModal
          meetingId={meetingId}
          meetingTitle={meetingTitle}
          onClose={() => setShowShare(false)}
        />
      )}
      {showChat && user && (
        <MeetingChat
          meetingId={meetingId}
          userId={user.id}
          username={profile?.username || user.username || 'You'}
          onClose={() => setShowChat(false)}
        />
      )}

      <div
        className="fixed inset-0 flex flex-col"
        style={{ background: '#000', zIndex: 9999, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>

        {/* Audio unlock banner */}
        {audioBlocked && (
          <div className="absolute top-20 left-0 right-0 z-[100] flex justify-center px-4 pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl"
              style={{ background: 'rgba(255,20,147,0.9)', backdropFilter: 'blur(12px)' }}>
              <Volume2 className="w-5 h-5 text-white flex-shrink-0" />
              <p className="text-white text-sm font-bold">Audio blocked by browser</p>
              <button onClick={unlockAudio} className="px-3 py-1.5 bg-white/20 rounded-xl text-white text-xs font-black press">
                Tap to Enable
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ background: 'rgba(28,28,30,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <p className="text-white font-black text-sm">{meetingTitle}</p>
            <p className="text-white/40 text-xs">{formatDuration(duration)} · {allParticipants.length} participant{allParticipants.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowShare(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 border border-primary/30 rounded-xl press">
              <Share2 className="w-3.5 h-3.5 text-primary" />
              <span className="text-primary text-xs font-bold">Invite</span>
            </button>
            <div className="flex items-center gap-1 px-2 py-1 bg-white/5 rounded-xl">
              <Users className="w-3.5 h-3.5 text-white/50" />
              <span className="text-white/50 text-xs">{allParticipants.length}</span>
            </div>
          </div>
        </div>

        {/* Video grid */}
        <div
          className="flex-1 p-2 overflow-hidden"
          style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 4, alignContent: 'center' }}>
          {allParticipants.map((p) => (
            <div key={p.userId} className="relative rounded-2xl overflow-hidden bg-[#2c2c2e]"
              style={{ aspectRatio: '4/3', minHeight: 80 }}>
              {p.isLocal ? (
                <>
                  <video
                    ref={localVideoRef}
                    autoPlay playsInline muted
                    className="w-full h-full object-cover"
                    style={{ transform: sharing ? 'none' : 'scaleX(-1)', display: (videoOff && !sharing) ? 'none' : 'block' }}
                  />
                  {videoOff && !sharing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#2c2c2e]">
                      <div className="w-14 h-14 rounded-full overflow-hidden gradient-pink flex items-center justify-center">
                        {p.avatar_url
                          ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                          : <span className="text-xl font-black text-white">{(p.username || '?')[0].toUpperCase()}</span>}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="relative w-full h-full bg-[#2c2c2e]">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full overflow-hidden gradient-pink flex items-center justify-center">
                      {p.avatar_url
                        ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                        : <span className="text-xl font-black text-white">{(p.username || '?')[0].toUpperCase()}</span>}
                    </div>
                  </div>
                  <video
                    ref={el => {
                      if (!el) return;
                      remoteVideoRefsMap.current.set(p.userId, el);
                      const stream = remoteStreamsRef.current.get(p.userId);
                      if (stream && el.srcObject !== stream) {
                        el.srcObject = stream;
                        el.muted = false;
                        el.play().catch((err) => {
                          if (err.name === 'NotAllowedError') setAudioBlocked(true);
                        });
                      }
                    }}
                    autoPlay playsInline
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/70 to-transparent">
                <div className="flex items-center gap-1">
                  <span className="text-white text-[10px] font-bold truncate">{p.isLocal ? 'You' : p.username}</span>
                  {p.isLocal && muted && <MicOff className="w-2.5 h-2.5 text-red-400 flex-shrink-0" />}
                  {p.isLocal && isHost && <Crown className="w-2.5 h-2.5 text-primary flex-shrink-0" />}
                  {sharing && p.isLocal && <MonitorUp className="w-2.5 h-2.5 text-green-400 flex-shrink-0" />}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex-shrink-0 px-4 py-3">
          <div className="flex items-center justify-center gap-3 px-4 py-3.5 rounded-3xl"
            style={{ background: 'rgba(28,28,30,0.95)', backdropFilter: 'blur(20px)' }}>
            <button onClick={toggleMute} className="flex flex-col items-center gap-1">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${muted ? 'bg-red-500/70' : 'bg-white/10'}`}>
                {muted ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}
              </div>
              <p className="text-white/40 text-[9px]">{muted ? 'Unmute' : 'Mute'}</p>
            </button>
            <button onClick={toggleVideo} className="flex flex-col items-center gap-1">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${videoOff ? 'bg-red-500/70' : 'bg-white/10'}`}>
                {videoOff ? <VideoOff className="w-5 h-5 text-white" /> : <Video className="w-5 h-5 text-white" />}
              </div>
              <p className="text-white/40 text-[9px]">{videoOff ? 'Start Video' : 'Stop Video'}</p>
            </button>
            <button onClick={toggleScreenShare} className="flex flex-col items-center gap-1">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${sharing ? 'bg-green-500/70' : 'bg-white/10'}`}>
                <MonitorUp className="w-5 h-5 text-white" />
              </div>
              <p className="text-white/40 text-[9px]">{sharing ? 'Stop' : 'Share'}</p>
            </button>
            <button onClick={flipCamera} className="flex flex-col items-center gap-1">
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-white/10">
                <RotateCcw className="w-5 h-5 text-white" />
              </div>
              <p className="text-white/40 text-[9px]">Flip</p>
            </button>
            {/* Chat button with unread badge */}
            <button onClick={() => setShowChat(true)} className="flex flex-col items-center gap-1 relative">
              <div className="relative w-12 h-12 rounded-full flex items-center justify-center bg-white/10">
                <MessageCircle className="w-5 h-5 text-white" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-white text-[9px] font-black">{unreadCount > 9 ? '9+' : unreadCount}</span>
                  </span>
                )}
              </div>
              <p className="text-white/40 text-[9px]">Chat</p>
            </button>
            <button onClick={handleLeave} className="flex flex-col items-center gap-1">
              <div className="w-14 h-14 rounded-full flex items-center justify-center press"
                style={{ background: '#e5263d', boxShadow: '0 4px 20px rgba(229,38,61,0.5)' }}>
                <PhoneOff className="w-6 h-6 text-white" />
              </div>
              <p className="text-white/40 text-[9px]">Leave</p>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Meeting Join Button — uses React Portal ──
export function MeetingJoinButton({ meetingId, title }: { meetingId: string; title: string }) {
  const [status, setStatus] = useState<'waiting' | 'active' | 'ended'>('waiting');
  const [showPreJoin, setShowPreJoin] = useState(false);
  const [showMeeting, setShowMeeting] = useState(false);
  const [joinParams, setJoinParams] = useState({ video: true, audio: true });

  useEffect(() => {
    supabase.from('meetings').select('status').eq('id', meetingId).single()
      .then(({ data }) => { if (data) setStatus(data.status as any); });
    const iv = setInterval(async () => {
      const { data } = await supabase.from('meetings').select('status').eq('id', meetingId).single();
      if (data) setStatus(data.status as any);
    }, 5000);
    return () => clearInterval(iv);
  }, [meetingId]);

  function handleJoinClick() {
    setShowPreJoin(true);
  }

  function handlePreJoin(video: boolean, audio: boolean) {
    setJoinParams({ video, audio });
    setShowPreJoin(false);
    setShowMeeting(true);
  }

  return (
    <>
      {showPreJoin && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999 }}>
          <PreJoinScreen
            meeting={{ id: meetingId, title, hostName: 'Host' }}
            onJoin={handlePreJoin}
            onCancel={() => setShowPreJoin(false)}
          />
        </div>,
        document.body
      )}
      {showMeeting && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999 }}>
          <ActiveMeetingRoom
            meetingId={meetingId}
            meetingTitle={title}
            isHost={false}
            videoOn={joinParams.video}
            audioOn={joinParams.audio}
            onLeave={() => setShowMeeting(false)}
          />
        </div>,
        document.body
      )}
      <div className="rounded-2xl overflow-hidden my-1"
        style={{ background: 'rgba(255,20,147,0.10)', border: '1px solid rgba(255,20,147,0.35)', minWidth: 220 }}>
        <div className="flex items-center gap-3 px-3 py-3">
          <div className="w-11 h-11 rounded-xl gradient-pink flex items-center justify-center flex-shrink-0">
            <Video className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-sm truncate">{title}</p>
            <p className="text-white/50 text-[11px] mt-0.5">
              {status === 'ended' ? '⏹ Meeting ended' : status === 'active' ? '🔴 Live now' : '⏳ Waiting to start'}
            </p>
          </div>
        </div>
        {status !== 'ended' && (
          <button
            onClick={handleJoinClick}
            className="w-full py-3.5 flex items-center justify-center gap-2 press font-black text-base text-white"
            style={{
              background: status === 'active'
                ? 'linear-gradient(90deg,#16a34a,#22c55e)'
                : 'linear-gradient(90deg,#FF1493,#FF69B4)',
            }}
          >
            <Video className="w-5 h-5" />
            Join Now
          </button>
        )}
      </div>
    </>
  );
}

// ── useCreateMeeting hook ──
export function useCreateMeeting() {
  const { user, profile } = useAuth();
  const [meetingState, setMeetingState] = useState<{
    meeting: { id: string; title: string } | null;
    phase: 'idle' | 'prejoin' | 'room';
    joinParams: { video: boolean; audio: boolean };
  }>({ meeting: null, phase: 'idle', joinParams: { video: true, audio: true } });

  async function createMeeting(title = 'VIP Meeting') {
    if (!user) return;
    const { data } = await supabase.from('meetings').insert({
      host_id: user.id, title, status: 'waiting',
    }).select('id, title').single();
    if (data) setMeetingState(s => ({ ...s, meeting: data, phase: 'prejoin' }));
  }

  const MeetingComponent = useCallback(() => {
    const { meeting, phase, joinParams } = meetingState;
    if (!meeting || phase === 'idle') return null;

    const content = phase === 'prejoin' ? (
      <PreJoinScreen
        meeting={{ id: meeting.id, title: meeting.title, hostName: profile?.username || user?.username || 'Host' }}
        onJoin={(v, a) => setMeetingState(s => ({ ...s, phase: 'room', joinParams: { video: v, audio: a } }))}
        onCancel={() => setMeetingState({ meeting: null, phase: 'idle', joinParams: { video: true, audio: true } })}
      />
    ) : (
      <ActiveMeetingRoom
        meetingId={meeting.id}
        meetingTitle={meeting.title}
        isHost
        videoOn={joinParams.video}
        audioOn={joinParams.audio}
        onLeave={() => setMeetingState({ meeting: null, phase: 'idle', joinParams: { video: true, audio: true } })}
      />
    );

    return createPortal(
      <div style={{ position: 'fixed', inset: 0, zIndex: 99999 }}>
        {content}
      </div>,
      document.body
    );
  }, [meetingState, profile, user]);

  return { createMeeting, MeetingComponent };
}
