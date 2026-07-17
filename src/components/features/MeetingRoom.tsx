import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Users, Monitor, X, Crown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────────────
interface Meeting {
  id: string;
  host_id: string;
  title: string;
  status: string;
  participants: string[];
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

interface Participant {
  id: string;
  username: string;
  avatar_url: string | null;
  is_online: boolean;
}

// ── MeetingJoinButton ──────────────────────────────────────────────────────
export function MeetingJoinButton({ meetingId, title }: { meetingId: string; title: string }) {
  const { user } = useAuth();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [joining, setJoining] = useState(false);
  const [showRoom, setShowRoom] = useState(false);

  useEffect(() => {
    supabase.from('meetings').select('*').eq('id', meetingId).single()
      .then(({ data }) => { if (data) setMeeting(data as Meeting); });
  }, [meetingId]);

  async function join() {
    if (!user || !meeting) return;
    setJoining(true);
    const participants = Array.isArray(meeting.participants) ? meeting.participants : [];
    if (!participants.includes(user.id)) {
      await supabase.from('meetings').update({
        participants: [...participants, user.id],
        status: 'active',
        started_at: meeting.started_at || new Date().toISOString(),
      }).eq('id', meetingId);
    }
    setJoining(false);
    setShowRoom(true);
  }

  const isEnded = meeting?.status === 'ended';

  return (
    <>
      {showRoom && meeting && (
        <ActiveMeetingRoom meeting={meeting} onLeave={() => setShowRoom(false)} />
      )}
      <div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/30 rounded-2xl min-w-[220px]">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
          <Video className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-foreground text-sm truncate">{title || 'VIP Meeting'}</p>
          <p className="text-xs text-muted-foreground">{isEnded ? 'Meeting ended' : 'Video meeting'}</p>
        </div>
        {!isEnded && (
          <button
            onClick={join}
            disabled={joining}
            className="px-3 py-1.5 gradient-pink rounded-xl text-white text-xs font-bold press disabled:opacity-50 flex-shrink-0"
          >
            {joining ? '...' : 'Join'}
          </button>
        )}
      </div>
    </>
  );
}

// ── ActiveMeetingRoom ──────────────────────────────────────────────────────
function ActiveMeetingRoom({ meeting, onLeave }: { meeting: Meeting; onLeave: () => void }) {
  const { user } = useAuth();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [showParticipants, setShowParticipants] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchParticipants = useCallback(async () => {
    const ids: string[] = Array.isArray(meeting.participants) ? meeting.participants : [];
    if (ids.length === 0) return;
    const { data } = await supabase.from('user_profiles').select('id, username, avatar_url, is_online').in('id', ids);
    if (data) setParticipants(data as Participant[]);
  }, [meeting.participants]);

  useEffect(() => {
    fetchParticipants();
    pollRef.current = setInterval(fetchParticipants, 5000);

    // Start local camera
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      })
      .catch(() => toast.error('Could not access camera/mic'));

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      localStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [fetchParticipants]);

  function toggleMic() {
    const audio = localStreamRef.current?.getAudioTracks()[0];
    if (audio) { audio.enabled = !audio.enabled; setMicOn(audio.enabled); }
  }

  function toggleCam() {
    const video = localStreamRef.current?.getVideoTracks()[0];
    if (video) { video.enabled = !video.enabled; setCamOn(video.enabled); }
  }

  async function leaveMeeting() {
    if (!user) return;
    const ids: string[] = Array.isArray(meeting.participants) ? meeting.participants : [];
    const remaining = ids.filter(id => id !== user.id);
    await supabase.from('meetings').update({
      participants: remaining,
      ...(remaining.length === 0 ? { status: 'ended', ended_at: new Date().toISOString() } : {}),
    }).eq('id', meeting.id);
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    onLeave();
  }

  return (
    <div className="fixed inset-0 z-[600] flex flex-col" style={{ background: 'linear-gradient(160deg, #0a0a1a 0%, #120020 100%)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 flex-shrink-0"
        style={{ paddingTop: 'max(16px, env(safe-area-inset-top))', paddingBottom: '12px' }}>
        <div>
          <p className="font-black text-white text-sm">{meeting.title}</p>
          <p className="text-xs text-white/50">{participants.length} participant{participants.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowParticipants(!showParticipants)}
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center press">
          <Users className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Video grid */}
      <div className="flex-1 overflow-hidden p-3">
        <div className={`grid gap-2 h-full ${participants.length <= 1 ? 'grid-cols-1' : participants.length <= 4 ? 'grid-cols-2' : 'grid-cols-2 grid-rows-3'}`}>
          {/* Local video */}
          <div className="relative rounded-2xl overflow-hidden bg-gray-900 border border-white/10">
            <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            {!camOn && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                <div className="w-12 h-12 rounded-full gradient-pink flex items-center justify-center">
                  <span className="text-white font-black text-lg">{(user as any)?.username?.[0]?.toUpperCase() || '?'}</span>
                </div>
              </div>
            )}
            <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 bg-black/60 rounded-lg">
              <span className="text-white text-xs font-bold">You</span>
              {!micOn && <MicOff className="w-3 h-3 text-red-400" />}
            </div>
          </div>
          {/* Remote participants (avatars only — WebRTC signaling for full video omitted) */}
          {participants.filter(p => p.id !== user?.id).map(p => (
            <div key={p.id} className="relative rounded-2xl overflow-hidden bg-gray-900 border border-white/10 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full overflow-hidden gradient-pink flex items-center justify-center">
                {p.avatar_url
                  ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <span className="text-white font-black text-2xl">{(p.username || '?')[0].toUpperCase()}</span>
                }
              </div>
              <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded-lg">
                <span className="text-white text-xs font-bold">{p.username || 'Member'}</span>
              </div>
              {p.is_online && <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-background" />}
            </div>
          ))}
        </div>
      </div>

      {/* Participants panel */}
      {showParticipants && (
        <div className="absolute top-16 right-3 w-56 bg-card border border-border rounded-2xl shadow-2xl z-10 overflow-hidden animate-scale-in">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
            <p className="font-bold text-foreground text-sm">Participants</p>
            <button onClick={() => setShowParticipants(false)} className="p-1 rounded-lg hover:bg-muted press">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {participants.map(p => (
              <div key={p.id} className="flex items-center gap-2 px-3 py-2">
                <div className="w-7 h-7 rounded-full overflow-hidden gradient-pink flex items-center justify-center flex-shrink-0">
                  {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-[10px] font-black text-white">{(p.username || '?')[0].toUpperCase()}</span>}
                </div>
                <span className="text-sm text-foreground flex-1 truncate">{p.id === user?.id ? 'You' : (p.username || 'Member')}</span>
                {p.is_online && <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 flex-shrink-0"
        style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))', paddingTop: '16px' }}>
        <button onClick={toggleMic}
          className={`w-14 h-14 rounded-full flex items-center justify-center press transition-all ${micOn ? 'bg-white/15 border border-white/20' : 'bg-red-500'}`}>
          {micOn ? <Mic className="w-6 h-6 text-white" /> : <MicOff className="w-6 h-6 text-white" />}
        </button>
        <button onClick={leaveMeeting}
          className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center press shadow-lg"
          style={{ boxShadow: '0 4px 20px rgba(239,68,68,0.5)' }}>
          <PhoneOff className="w-7 h-7 text-white" />
        </button>
        <button onClick={toggleCam}
          className={`w-14 h-14 rounded-full flex items-center justify-center press transition-all ${camOn ? 'bg-white/15 border border-white/20' : 'bg-red-500'}`}>
          {camOn ? <Video className="w-6 h-6 text-white" /> : <VideoOff className="w-6 h-6 text-white" />}
        </button>
      </div>
    </div>
  );
}

// ── useCreateMeeting hook ──────────────────────────────────────────────────
export function useCreateMeeting() {
  const { user } = useAuth();
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);

  async function createMeeting(title = 'VIP Meeting') {
    if (!user) { toast.error('Login required'); return; }
    const { data, error } = await supabase.from('meetings').insert({
      host_id: user.id,
      title,
      status: 'waiting',
      participants: [user.id],
    }).select().single();
    if (error || !data) { toast.error('Failed to create meeting'); return; }
    setActiveMeeting(data as Meeting);
    // Post meeting invite message to VIP chat
    const meetingMsg = `**${title}** — Join the live meeting!\nmeeting_id:${data.id}`;
    await supabase.from('vip_messages').insert({ user_id: user.id, message: meetingMsg });
    toast.success('Meeting created! Invite sent to VIP room.');
  }

  const MeetingComponent: React.FC = useCallback(() => {
    if (!activeMeeting) return null;
    return (
      <ActiveMeetingRoom
        meeting={activeMeeting}
        onLeave={() => setActiveMeeting(null)}
      />
    );
  }, [activeMeeting]);

  return { createMeeting, MeetingComponent };
}

// ── Default export ─────────────────────────────────────────────────────────
export default function MeetingRoom() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center">
        <div className="w-20 h-20 rounded-3xl gradient-pink flex items-center justify-center mx-auto mb-4">
          <Crown className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-2xl font-black">VIP Meeting Room</h1>
        <p className="text-white/50 mt-2">Join a meeting from the VIP chat</p>
      </div>
    </div>
  );
}
