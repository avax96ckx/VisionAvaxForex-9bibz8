import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, Crown, Lock, Image, Pin, Trash2,
  Reply, X, ChevronDown, ArrowLeft,
  Settings, Camera, Share2, Flag, Users, Video
} from 'lucide-react';
import { useCreateMeeting, MeetingJoinButton } from '@/components/features/MeetingRoom';
import { supabase, uploadFile, isVIPActive } from '@/lib/supabase';
import { playVIPRoomSound } from '@/lib/notificationSound';
import { notifyVIPRoomMessage } from '@/lib/browserNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { VIPMessage, VIPReaction } from '@/types';
import VIPBadge from '@/components/features/VIPBadge';
import VIPPlanSelector from '@/components/features/VIPPlanSelector';
import TelegramMediaGrid from '@/components/features/TelegramMediaGrid';
import GlobalMediaViewer from '@/components/features/GlobalMediaViewer';
import VoiceNoteRecorder from '@/components/features/VoiceNoteRecorder';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const ADMIN_EMAIL = 'visionavaxforex@gmail.com';
const EMOJI_REACTIONS = ['👍','❤️','🔥','💪','🎯','💰','✅','😂','🙏','📈'];

interface MessageWithMeta extends VIPMessage {
  replyMessage?: VIPMessage | null;
  reactions?: VIPReaction[];
  readCount?: number;
}

interface VIPTheme {
  bg: string;
  ownColor: string;
  otherColor: string;
  fontSize: string;
  fontFamily: string;
}

const FONT_FAMILIES: Record<string, string> = {
  default: 'inherit',
  inter: '"Inter", sans-serif',
  roboto: '"Roboto", sans-serif',
  poppins: '"Poppins", sans-serif',
  mono: '"Courier New", monospace',
  serif: '"Georgia", serif',
  cursive: '"Dancing Script", cursive',
  ubuntu: '"Ubuntu", sans-serif',
};

const FONT_SIZES: Record<string, string> = {
  xs: '11px', sm: '13px', md: '14px', lg: '16px', xl: '18px', '2xl': '20px',
};

// ── Voice Note Player ──
function VoiceNotePlayer({ url, isOwn }: { url: string; isOwn: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [dur, setDur] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function toggle() {
    if (!audioRef.current) {
      audioRef.current = new Audio(url);
      audioRef.current.onloadedmetadata = () => setDur(audioRef.current?.duration || 0);
      audioRef.current.ontimeupdate = () => setCurrentTime(audioRef.current?.currentTime || 0);
      audioRef.current.onended = () => { setPlaying(false); setCurrentTime(0); };
    }
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play().then(() => setPlaying(true)).catch(() => {}); }
  }

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const progress = dur > 0 ? (currentTime / dur) * 100 : 0;
  const bars = 28;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-2 min-w-[155px] max-w-[210px] py-1">
      <button onClick={toggle} className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 press ${isOwn ? 'bg-white/25' : 'gradient-pink'}`}>
        {playing
          ? <svg viewBox="0 0 24 24" fill="white" className="w-3.5 h-3.5"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          : <svg viewBox="0 0 24 24" fill="white" className="w-3.5 h-3.5"><polygon points="5,3 19,12 5,21"/></svg>
        }
      </button>
      <div className="flex flex-col gap-0.5 flex-1">
        <div className="flex items-center gap-[2px] h-7">
          {Array.from({ length: bars }).map((_, i) => {
            const h = Math.max(15, (Math.sin(i * 0.7 + 1) * 0.35 + 0.45) * 100);
            const filled = (i / bars) * 100 <= progress;
            return (
              <div key={i} className="flex-1 rounded-full" style={{
                height: `${h}%`,
                background: filled
                  ? (isOwn ? 'rgba(255,255,255,0.85)' : '#FF1493')
                  : (isOwn ? 'rgba(255,255,255,0.3)' : 'rgba(255,20,147,0.22)'),
                minWidth: 2,
              }} />
            );
          })}
        </div>
        <div className="flex justify-between">
          <span className={`text-[9px] ${isOwn ? 'text-white/60' : 'text-muted-foreground'}`}>{fmt(playing ? currentTime : 0)}</span>
          <span className={`text-[9px] ${isOwn ? 'text-white/60' : 'text-muted-foreground'}`}>{fmt(dur)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Pinned Message Banner (WhatsApp / Telegram style) ──
function PinnedBanner({ msg }: { msg: any }) {
  const [dismissed, setDismissed] = React.useState(false);
  if (dismissed) return null;
  return (
    <div
      className="fixed left-0 right-0 z-[115] px-3"
      style={{ top: 'max(58px, calc(env(safe-area-inset-top) + 58px))' }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-primary/30"
        style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)' }}
      >
        <Pin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-primary font-black leading-none mb-0.5 uppercase tracking-wide">Pinned Message</p>
          <p className="text-xs text-white/80 truncate">{msg.message || '\ud83d\udcce Media'}</p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded-lg hover:bg-white/10 press flex-shrink-0"
        >
          <X className="w-3 h-3 text-white/60" />
        </button>
      </div>
    </div>
  );
}

// ── VIP Benefits Popup ──
function VIPBenefitsPopup({ onGetVIP, onClose }: { onGetVIP: () => void; onClose: () => void }) {
  const benefits = [
    { icon: '🔥', title: 'Live Premium Signals', desc: 'Real-time forex, gold & crypto setups' },
    { icon: '💬', title: 'VIP Chat Room', desc: 'Exclusive community 24/7' },
    { icon: '📚', title: 'All Courses FREE', desc: 'Full trading education library' },
    { icon: '📢', title: 'Admin Announcements', desc: 'Be first to know market moves' },
    { icon: '✅', title: 'Verified Blue Tick', desc: 'Show your VIP status with a badge' },
    { icon: '🌐', title: 'Private Messenger', desc: 'Chat directly with VIP members' },
  ];
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-end sm:justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}>
      <div className="bg-card border border-border rounded-3xl w-full max-w-sm relative overflow-hidden animate-slide-up max-h-[90vh] flex flex-col">
        <div className="h-1.5 gradient-pink flex-shrink-0" />
        <div className="p-5 overflow-y-auto">
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-muted flex items-center justify-center press">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
          <div className="text-center mb-5">
            <div className="w-16 h-16 gradient-pink rounded-3xl flex items-center justify-center mx-auto mb-3 pink-glow">
              <Crown className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-black text-foreground">Join VIP Room</h2>
            <p className="text-sm text-muted-foreground mt-1">What you get with VIP membership</p>
          </div>
          <div className="space-y-2.5 mb-5">
            {benefits.map(b => (
              <div key={b.title} className="flex items-center gap-3 p-3 bg-muted/30 rounded-2xl border border-border/50">
                <span className="text-xl flex-shrink-0">{b.icon}</span>
                <div>
                  <p className="text-sm font-bold text-foreground">{b.title}</p>
                  <p className="text-xs text-muted-foreground">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <button onClick={onGetVIP} className="w-full py-4 gradient-pink rounded-2xl text-white font-black text-base pink-glow press flex items-center justify-center gap-2 mb-3">
            <Crown className="w-5 h-5" /> Get VIP Access
          </button>
          <button onClick={onClose} className="w-full py-3 text-muted-foreground text-sm press hover:text-foreground transition-colors">Maybe Later</button>
        </div>
      </div>
    </div>
  );
}

// ── Room Settings Modal ──
function RoomSettings({ onClose }: { onClose: () => void }) {
  const [roomName, setRoomName] = useState('');
  const [roomIcon, setRoomIcon] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [vipWallpaper, setVipWallpaper] = useState('');
  const [vipBgColor, setVipBgColor] = useState('#0d0d1a');
  const [vipBubbleOwn, setVipBubbleOwn] = useState('#FF1493');
  const [vipBubbleOther, setVipBubbleOther] = useState('#1e1e2e');
  const [vipFontSize, setVipFontSize] = useState('md');
  const [vipFontFamily, setVipFontFamily] = useState('default');
  const [uploadingWp, setUploadingWp] = useState(false);

  useEffect(() => {
    supabase.from('site_settings')
      .select('website_name, logo_url, vip_wallpaper, vip_bg_color, vip_bubble_color_own, vip_bubble_color_other, vip_font_size, vip_font_family')
      .eq('id', 'main').single()
      .then(({ data }) => {
        if (data) {
          setRoomName((data as any).website_name || '');
          setRoomIcon((data as any).logo_url || '');
          setVipWallpaper((data as any).vip_wallpaper || '');
          setVipBgColor((data as any).vip_bg_color || '#0d0d1a');
          setVipBubbleOwn((data as any).vip_bubble_color_own || '#FF1493');
          setVipBubbleOther((data as any).vip_bubble_color_other || '#1e1e2e');
          setVipFontSize((data as any).vip_font_size || 'md');
          setVipFontFamily((data as any).vip_font_family || 'default');
        }
      });
  }, []);

  async function handleIconUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const url = await uploadFile('banners', `room_icon_${Date.now()}`, file);
    setRoomIcon(url); setUploading(false);
    toast.success('Icon uploaded');
  }

  async function handleWallpaperUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingWp(true);
    const url = await uploadFile('banners', `vip_wallpaper_${Date.now()}`, file);
    setVipWallpaper(url); setUploadingWp(false);
    toast.success('Wallpaper uploaded');
    e.target.value = '';
  }

  async function save() {
    setSaving(true);
    await supabase.from('site_settings').update({
      website_name: roomName, logo_url: roomIcon,
      vip_wallpaper: vipWallpaper || null, vip_bg_color: vipBgColor,
      vip_bubble_color_own: vipBubbleOwn, vip_bubble_color_other: vipBubbleOther,
      vip_font_size: vipFontSize, vip_font_family: vipFontFamily,
    } as any).eq('id', 'main');
    toast.success('Room settings saved!');
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[300] bg-black/70 flex flex-col animate-fade-in" onClick={onClose} style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex-1" />
      <div className="w-full max-w-md mx-auto bg-card border border-border rounded-t-3xl p-5 overflow-y-auto animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxHeight: '85vh', paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-foreground">VIP Room Settings</h3>
          <button onClick={onClose} className="p-1.5 rounded-xl bg-muted press"><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="flex flex-col items-center mb-4">
          <div className="relative mb-1">
            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-muted flex items-center justify-center gradient-pink">
              {roomIcon ? <img src={roomIcon} alt="" className="w-full h-full object-cover" /> : <Crown className="w-8 h-8 text-white" />}
            </div>
            <label className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full gradient-pink flex items-center justify-center cursor-pointer press shadow-lg">
              {uploading ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Camera className="w-3 h-3 text-white" />}
              <input type="file" accept="image/*" className="hidden" onChange={handleIconUpload} />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">Room icon</p>
        </div>
        <div className="mb-3">
          <label className="text-xs text-muted-foreground mb-1 block font-medium">Room Name</label>
          <input className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary" value={roomName} onChange={e => setRoomName(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="text-xs text-muted-foreground mb-1 block font-medium">Background Color</label>
          <div className="flex gap-2">
            <input type="color" value={vipBgColor} onChange={e => setVipBgColor(e.target.value)} className="w-10 h-9 rounded-lg border border-border cursor-pointer bg-transparent" />
            <input value={vipBgColor} onChange={e => setVipBgColor(e.target.value)} className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary" />
          </div>
        </div>
        <div className="mb-3">
          <label className="text-xs text-muted-foreground mb-1 block font-medium">Chat Wallpaper</label>
          <label className="flex items-center gap-2 p-3 border border-dashed border-primary/35 rounded-xl cursor-pointer hover:bg-primary/5 transition-all">
            {uploadingWp ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Image className="w-4 h-4 text-primary" />}
            <span className="text-sm text-muted-foreground flex-1">{vipWallpaper && !vipWallpaper.startsWith('linear') ? '✓ Wallpaper set' : 'Upload Wallpaper'}</span>
            {vipWallpaper && <button type="button" onClick={() => setVipWallpaper('')} className="text-red-400 text-xs">Clear</button>}
            <input type="file" accept="image/*" className="hidden" onChange={handleWallpaperUpload} />
          </label>
        </div>
        <div className="mb-3">
          <label className="text-xs text-muted-foreground mb-1 block font-medium">Your Message Color</label>
          <div className="flex gap-2">
            <input type="color" value={vipBubbleOwn} onChange={e => setVipBubbleOwn(e.target.value)} className="w-10 h-9 rounded-lg border border-border cursor-pointer bg-transparent" />
            <input value={vipBubbleOwn} onChange={e => setVipBubbleOwn(e.target.value)} className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none" />
          </div>
        </div>
        <div className="mb-3">
          <label className="text-xs text-muted-foreground mb-1 block font-medium">Others' Message Color</label>
          <div className="flex gap-2">
            <input type="color" value={vipBubbleOther} onChange={e => setVipBubbleOther(e.target.value)} className="w-10 h-9 rounded-lg border border-border cursor-pointer bg-transparent" />
            <input value={vipBubbleOther} onChange={e => setVipBubbleOther(e.target.value)} className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none" />
          </div>
        </div>
        <button onClick={save} disabled={saving} className="w-full py-3 gradient-pink rounded-xl text-white font-bold press pink-glow-xs disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Room Settings'}
        </button>
      </div>
    </div>
  );
}

// ── Message Actions Sheet ──
function MessageActions({ msg, isOwn, isAdmin, onReply, onDelete, onPin, onForward, onReport, onClose }: {
  msg: MessageWithMeta; isOwn: boolean; isAdmin: boolean;
  onReply: () => void; onDelete: () => void; onPin: () => void; onForward: () => void; onReport: () => void; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[400] bg-black/60 flex items-end justify-center animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md bg-card border border-border rounded-t-3xl overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()} style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        <div className="px-4 py-3 border-b border-border">
          <p className="text-xs text-muted-foreground line-clamp-2">{msg.message || '🎤 Voice Note'}</p>
        </div>
        <div className="py-2">
          <button onClick={() => { onReply(); onClose(); }} className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-muted/50 press text-left">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center"><Reply className="w-4 h-4 text-blue-400" /></div>
            <p className="font-bold text-foreground text-sm">Reply</p>
          </button>
          <button onClick={() => { onForward(); onClose(); }} className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-muted/50 press text-left">
            <div className="w-9 h-9 rounded-xl bg-green-500/15 flex items-center justify-center"><Share2 className="w-4 h-4 text-green-400" /></div>
            <p className="font-bold text-foreground text-sm">Forward</p>
          </button>
          {!isOwn && (
            <button onClick={() => { onReport(); onClose(); }} className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-muted/50 press text-left">
              <div className="w-9 h-9 rounded-xl bg-orange-500/15 flex items-center justify-center"><Flag className="w-4 h-4 text-orange-400" /></div>
              <p className="font-bold text-foreground text-sm">Report to Admin</p>
            </button>
          )}
          {isAdmin && (
            <button onClick={() => { onPin(); onClose(); }} className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-muted/50 press text-left">
              <div className="w-9 h-9 rounded-xl bg-yellow-500/15 flex items-center justify-center"><Pin className="w-4 h-4 text-yellow-400" /></div>
              <p className="font-bold text-foreground text-sm">{msg.is_pinned ? 'Unpin' : 'Pin'}</p>
            </button>
          )}
          {(isOwn || isAdmin) && (
            <button onClick={() => { onDelete(); onClose(); }} className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-red-500/10 press text-left">
              <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center"><Trash2 className="w-4 h-4 text-red-400" /></div>
              <p className="font-bold text-red-400 text-sm">Delete</p>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Forward Modal ──
function ForwardModal({ message, currentUserId, onClose }: { message: MessageWithMeta; currentUserId: string; onClose: () => void }) {
  const [members, setMembers] = useState<any[]>([]);
  const [sending, setSending] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase.from('user_profiles').select('id, username, avatar_url, is_online').neq('id', currentUserId).order('username').then(({ data }) => {
      if (data) setMembers(data);
    });
  }, [currentUserId]);

  async function forwardToUser(userId: string) {
    setSending(userId);
    const p1 = currentUserId < userId ? currentUserId : userId;
    const p2 = currentUserId < userId ? userId : currentUserId;
    let { data: conv } = await supabase.from('conversations').select('*').eq('participant_one', p1).eq('participant_two', p2).single();
    if (!conv) { const { data: cr } = await supabase.from('conversations').insert({ participant_one: p1, participant_two: p2 }).select().single(); conv = cr; }
    if (conv) {
      const text = message.message ? `↪️ Forwarded: ${message.message}` : '↪️ Forwarded media';
      await supabase.from('direct_messages').insert({ conversation_id: conv.id, sender_id: currentUserId, message: text, media_url: message.media_url, media_type: message.media_type });
      await supabase.from('conversations').update({ last_message: text, last_message_at: new Date().toISOString() }).eq('id', conv.id);
    }
    toast.success('Forwarded!');
    setSending(null);
  }

  const filtered = members.filter(m => !search || (m.username || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fixed inset-0 z-[500] bg-black/70 flex flex-col animate-fade-in" onClick={onClose}>
      <div className="flex-1" />
      <div className="w-full max-w-md mx-auto bg-card border border-border rounded-t-3xl overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxHeight: '75vh', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        <div className="flex items-center justify-between px-4 py-4 border-b border-border">
          <h3 className="font-black text-foreground">Forward To</h3>
          <button onClick={onClose} className="p-1.5 rounded-xl bg-muted press"><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="px-4 py-2 border-b border-border">
          <input className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary" placeholder="Search members..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: '55vh' }}>
          {filtered.map(m => (
            <button key={m.id} onClick={() => forwardToUser(m.id)} disabled={sending === m.id} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 press text-left">
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-muted gradient-pink flex items-center justify-center">
                  {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-sm font-black text-white">{(m.username || '?')[0].toUpperCase()}</span>}
                </div>
                {m.is_online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-background" />}
              </div>
              <p className="flex-1 font-bold text-foreground text-sm">{m.username || 'Member'}</p>
              {sending === m.id && <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── VIPWhatsApp + Meeting button ──
function VIPWhatsAppBtn({ whatsappNumber, isAdmin, hasMeetingPermission, createMeeting, MeetingComponent }: {
  whatsappNumber: string;
  isAdmin: boolean;
  hasMeetingPermission: boolean;
  createMeeting: (title?: string) => Promise<void>;
  MeetingComponent: React.FC;
}) {
  const [showMenu, setShowMenu] = React.useState(false);
  return (
    <>
      <MeetingComponent />
      <button
        onClick={() => setShowMenu(true)}
        className="w-9 h-9 rounded-full flex items-center justify-center press flex-shrink-0"
        style={{ background: '#25D366', boxShadow: '0 2px 12px rgba(37,211,102,0.4)' }}
      >
        <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </button>
      {showMenu && (
        <div className="fixed inset-0 z-[500] bg-black/60 flex items-end justify-center animate-fade-in" onClick={() => setShowMenu(false)}>
          <div className="w-full max-w-md bg-card border border-border rounded-t-3xl overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()} style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
            <div className="px-4 py-3 border-b border-border">
              <p className="font-black text-foreground text-sm">Contact Admin</p>
            </div>
            <div className="py-2">
              {/* WhatsApp */}
              <a href={`https://wa.me/${whatsappNumber.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/50 press" onClick={() => setShowMenu(false)}>
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: '#25D366' }}>
                  <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </div>
                <div><p className="font-bold text-foreground">WhatsApp</p><p className="text-xs text-muted-foreground">Contact admin on WhatsApp</p></div>
              </a>
              {/* Meeting (admin only) */}
              {(isAdmin || hasMeetingPermission) && ( // prop correctly passed
                <button
                  onClick={() => { setShowMenu(false); createMeeting('VIP Room Meeting'); }}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/50 press text-left">
                  <div className="w-10 h-10 rounded-2xl bg-primary/15 flex items-center justify-center"><Video className="w-5 h-5 text-primary" /></div>
                  <div><p className="font-bold text-foreground">Start Meeting</p><p className="text-xs text-muted-foreground">Start a Google Meet-style group call</p></div>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function VIPRoom() {
  const { user, profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { createMeeting, MeetingComponent } = useCreateMeeting();
  const [messages, setMessages] = useState<MessageWithMeta[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [showVIPSelector, setShowVIPSelector] = useState(false);
  const [showBenefits, setShowBenefits] = useState(false);
  const [replyTo, setReplyTo] = useState<VIPMessage | null>(null);
  const [showEmojiFor, setShowEmojiFor] = useState<string | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [actionsFor, setActionsFor] = useState<MessageWithMeta | null>(null);
  const [forwardMsg, setForwardMsg] = useState<MessageWithMeta | null>(null);
  const [showRoomSettings, setShowRoomSettings] = useState(false);
  const [roomName, setRoomName] = useState('VIP Members Room');
  const [roomIcon, setRoomIcon] = useState('');
  const [mediaViewer, setMediaViewer] = useState<{ items: { url: string; type: 'image' | 'video' }[]; index: number } | null>(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<{userId: string; username: string}[]>([]);
  const [whatsappNumber, setWhatsappNumber] = useState('+255746715235');
  const [hasMeetingPermission, setHasMeetingPermission] = useState(false);
  const markedReadRef = useRef<Set<string>>(new Set());
  const [vipTheme, setVipTheme] = useState<VIPTheme>({
    bg: '#0d0d1a', ownColor: '#FF1493', otherColor: '#1e1e2e', fontSize: 'md', fontFamily: 'default',
  });
  const [profileStyles, setProfileStylesState] = useState<any>({ tickPosition: 'inline', tickSize: 'sm', tickGap: 'tight' });

  // Swipe-to-reply
  const touchStartX = useRef<number>(0);
  const touchMsgId = useRef<string | null>(null);
  const [swipingId, setSwipingId] = useState<string | null>(null);

  // Typing indicator
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef<number>(0);
  const typingChannelRef = useRef<any>(null); // kept for type compat

  const chatPattern = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cpath d='M10 10 Q15 5 20 10 Q25 15 20 20 Q15 25 10 20 Q5 15 10 10Z' fill='none' stroke='rgba(255,255,255,0.04)' stroke-width='1'/%3E%3Ccircle cx='45' cy='15' r='4' fill='none' stroke='rgba(255,255,255,0.035)' stroke-width='1'/%3E%3Cpath d='M30 35 L40 35 L35 45Z' fill='none' stroke='rgba(255,255,255,0.03)' stroke-width='1'/%3E%3Ccircle cx='10' cy='50' r='3' fill='none' stroke='rgba(255,255,255,0.03)' stroke-width='1'/%3E%3Cpath d='M45 40 Q50 35 55 40 Q50 45 45 40Z' fill='none' stroke='rgba(255,255,255,0.04)' stroke-width='1'/%3E%3C/svg%3E")`;

  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressActive = useRef(false);
  const initialScrollDone = useRef(false);

  const hasAccess = isAdmin || (profile ? isVIPActive(profile) : false);

  // Check meeting permission for current user
  useEffect(() => {
    if (!user) return;
    if (isAdmin) { setHasMeetingPermission(true); return; }
    supabase.from('meeting_permissions').select('user_id').eq('user_id', user.id).single()
      .then(({ data }) => setHasMeetingPermission(!!data));
  }, [user, isAdmin]);

  // Online count polling
  useEffect(() => {
    const fetch = async () => {
      const { count } = await supabase.from('user_profiles').select('id', { count: 'exact', head: true }).eq('is_online', true);
      setOnlineCount(count || 0);
    };
    fetch();
    const iv = setInterval(fetch, 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    supabase.from('site_settings')
      .select('website_name, logo_url, vip_wallpaper, vip_bg_color, vip_bubble_color_own, vip_bubble_color_other, vip_font_size, vip_font_family, whatsapp_number, vip_bg_gradient_from, vip_bg_gradient_to, profile_styles')
      .eq('id', 'main').single()
      .then(({ data }) => {
        if (data) {
          setRoomName((data as any).website_name || 'VIP Members Room');
          setRoomIcon((data as any).logo_url || '');
          if ((data as any).whatsapp_number) setWhatsappNumber((data as any).whatsapp_number);
          const wp = (data as any).vip_wallpaper;
          const gradFrom = (data as any).vip_bg_gradient_from || '#0d0d1a';
          const gradTo = (data as any).vip_bg_gradient_to || '#1a0026';
          const bg = wp
            ? (wp.startsWith('linear-gradient') ? wp : `url(${wp}) center/cover`)
            : `linear-gradient(160deg, ${gradFrom} 0%, ${gradTo} 100%)`;
          setVipTheme({
            bg, ownColor: (data as any).vip_bubble_color_own || '#FF1493',
            otherColor: (data as any).vip_bubble_color_other || '#1e1e2e',
            fontSize: (data as any).vip_font_size || 'md',
            fontFamily: (data as any).vip_font_family || 'default',
          });
          if ((data as any).profile_styles) setProfileStylesState({ tickPosition: 'inline', tickSize: 'sm', tickGap: 'tight', ...(data as any).profile_styles });
        }
      });
  }, [showRoomSettings]);

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from('vip_messages').select('*, user_profiles(*)')
      .eq('is_deleted', false).order('created_at', { ascending: true }).limit(300);
    if (!data) return;

    const replyIds = data.filter(m => m.reply_to).map(m => m.reply_to!);
    let replyMap: Record<string, VIPMessage> = {};
    if (replyIds.length > 0) {
      const { data: replies } = await supabase.from('vip_messages').select('*, user_profiles(*)').in('id', replyIds);
      if (replies) replies.forEach(r => { replyMap[r.id] = r; });
    }

    const msgIds = data.map(m => m.id);
    let reactionsMap: Record<string, VIPReaction[]> = {};
    let readCountMap: Record<string, number> = {};
    if (msgIds.length > 0) {
      const { data: reactions } = await supabase.from('vip_reactions').select('*').in('message_id', msgIds);
      if (reactions) reactions.forEach(r => {
        if (!reactionsMap[r.message_id]) reactionsMap[r.message_id] = [];
        reactionsMap[r.message_id].push(r);
      });
      const { data: reads } = await supabase.from('vip_message_reads').select('message_id').in('message_id', msgIds);
      if (reads) reads.forEach(r => { readCountMap[r.message_id] = (readCountMap[r.message_id] || 0) + 1; });
    }

    // Mark unread messages as read
    if (user) {
      const unread = data.filter(m => m.user_id !== user.id && !markedReadRef.current.has(m.id)).map(m => m.id);
      if (unread.length > 0) {
        supabase.from('vip_message_reads').upsert(
          unread.map(mid => ({ message_id: mid, user_id: user.id })),
          { onConflict: 'message_id,user_id' }
        );
        unread.forEach(id => markedReadRef.current.add(id));
      }
    }

    setMessages(data.map(m => ({
      ...m, replyMessage: m.reply_to ? replyMap[m.reply_to] : null,
      reactions: reactionsMap[m.id] || [],
      readCount: readCountMap[m.id] || 0,
    })));
  }, []);

  useEffect(() => {
    if (!hasAccess) return;
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [hasAccess, fetchMessages]);

  // DB-based typing indicator — syncs across all devices/browsers
  useEffect(() => {
    if (!hasAccess || !user) return;
    const poll = async () => {
      const cutoff = new Date(Date.now() - 4000).toISOString();
      const { data } = await supabase
        .from('vip_typing')
        .select('user_id, username, typed_at')
        .neq('user_id', user.id)
        .gte('typed_at', cutoff);
      setTypingUsers((data || []).map((r: any) => ({ userId: r.user_id, username: r.username || 'Member' })));
    };
    poll();
    const iv = setInterval(poll, 2000);
    return () => {
      clearInterval(iv);
      // Clear own typing on unmount
      supabase.from('vip_typing').delete().eq('user_id', user.id);
    };
  }, [hasAccess, user]);

  async function broadcastTyping() {
    if (!user) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 1500) return;
    lastTypingSentRef.current = now;
    const username = (user as any).username || user.email?.split('@')[0] || 'Member';
    await supabase.from('vip_typing').upsert(
      { user_id: user.id, username, typed_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  }

  // Auto-scroll to bottom on first load, then only scroll when near bottom
  const prevCount = useRef(0);
  useEffect(() => {
    if (messages.length !== prevCount.current) {
      const isFirstLoad = prevCount.current === 0 && messages.length > 0;
      if (messages.length > prevCount.current && prevCount.current > 0) {
        playVIPRoomSound();
        const newMsgs = messages.slice(prevCount.current);
        newMsgs.forEach(msg => {
          if (msg.user_id === user?.id) return;
          const senderName = (msg as any).user_profiles?.username || 'VIP Member';
          const preview = msg.message || (msg.media_type === 'audio' ? '🎤 Voice note' : msg.media_url ? '📎 Media' : '');
          if (preview) notifyVIPRoomMessage(senderName, preview);
        });
      }
      prevCount.current = messages.length;
      const el = messagesRef.current;
      if (!el) return;
      if (isFirstLoad) {
        // First load — always jump to bottom (latest message)
        setTimeout(() => {
          el.scrollTop = el.scrollHeight;
          initialScrollDone.current = true;
        }, 80);
      } else {
        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 220;
        if (nearBottom) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages]);

  const handleScroll = () => {
    const el = messagesRef.current;
    if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 200);
  };

  async function sendMessage() {
    if (!text.trim() || !user || sending) return;
    setSending(true);
    const msg = text.trim();
    setText('');
    await supabase.from('vip_messages').insert({
      user_id: user.id, message: msg,
      reply_to: replyTo?.id || null,
      is_announcement: isAdmin && msg.startsWith('📢'),
    });
    setReplyTo(null);
    setSending(false);
    fetchMessages();
    // Always scroll to bottom after sending
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }

  // Swipe handlers for reply
  function onMsgTouchStart(e: React.TouchEvent, msgId: string) {
    touchStartX.current = e.touches[0].clientX;
    touchMsgId.current = msgId;
  }
  function onMsgTouchEnd(e: React.TouchEvent, msg: MessageWithMeta) {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    if (deltaX > 55 && touchMsgId.current === msg.id) {
      setReplyTo(msg);
      setSwipingId(msg.id);
      setTimeout(() => setSwipingId(null), 400);
      inputRef.current?.focus();
    }
    touchMsgId.current = null;
  }

  async function sendVoiceNote(audioUrl: string, _duration: number) {
    if (!user) return;
    await supabase.from('vip_messages').insert({
      user_id: user.id, media_url: audioUrl, media_type: 'audio',
      reply_to: replyTo?.id || null,
    });
    setReplyTo(null);
    fetchMessages();
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    // No limit — allow as many files as user wants
    setSelectedFiles(prev => [...prev, ...files]);
    e.target.value = '';
  }

  async function sendMedia() {
    if (selectedFiles.length === 0 || !user) return;
    setUploading(true);
    setUploadTotal(selectedFiles.length);
    setUploadProgress(0);
    const uploaded: { url: string; type: string }[] = [];
    await Promise.all(selectedFiles.map(async (file, idx) => {
      const mediaType = file.type.startsWith('video') ? 'video' : 'image';
      const url = await uploadFile('media', `vip/${Date.now()}_${idx}_${file.name}`, file);
      uploaded.push({ url, type: mediaType });
      setUploadProgress(p => p + 1);
    }));
    if (uploaded.length === 1) {
      await supabase.from('vip_messages').insert({ user_id: user.id, media_url: uploaded[0].url, media_type: uploaded[0].type, reply_to: replyTo?.id || null });
    } else {
      await supabase.from('vip_messages').insert({ user_id: user.id, media_url: JSON.stringify(uploaded), media_type: 'multi', reply_to: replyTo?.id || null });
    }
    setUploading(false); setUploadProgress(0); setUploadTotal(0); setSelectedFiles([]); setReplyTo(null);
    fetchMessages();
  }

  async function toggleReaction(msgId: string, emoji: string) {
    if (!user) return;
    const { data: existing } = await supabase.from('vip_reactions').select('id').eq('message_id', msgId).eq('user_id', user.id).eq('emoji', emoji).single();
    if (existing) await supabase.from('vip_reactions').delete().eq('id', existing.id);
    else await supabase.from('vip_reactions').insert({ message_id: msgId, user_id: user.id, emoji });
    setShowEmojiFor(null);
    fetchMessages();
  }

  async function deleteMessage(id: string) {
    await supabase.from('vip_messages').update({ is_deleted: true }).eq('id', id);
    setMessages(prev => prev.filter(m => m.id !== id));
  }

  async function pinMessage(id: string, pinned: boolean) {
    await supabase.from('vip_messages').update({ is_pinned: !pinned }).eq('id', id);
    setActionsFor(null);
    fetchMessages();
  }

  function startLongPress(msg: MessageWithMeta) {
    longPressActive.current = false;
    longPressTimer.current = setTimeout(() => { longPressActive.current = true; setActionsFor(msg); }, 800);
  }
  function cancelLongPress() {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }
  function handleTap(_msg: MessageWithMeta) { longPressActive.current = false; }

  function formatTime(ts: string) { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  function groupReactions(reactions: VIPReaction[]) {
    const map: Record<string, number> = {};
    reactions.forEach(r => { map[r.emoji] = (map[r.emoji] || 0) + 1; });
    return Object.entries(map);
  }

  const fontSize = FONT_SIZES[vipTheme.fontSize] || '14px';
  const fontFamily = FONT_FAMILIES[vipTheme.fontFamily] || 'inherit';

  if (!user) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center px-4">
        <div className="w-20 h-20 rounded-3xl gradient-pink flex items-center justify-center mb-4 pink-glow animate-float">
          <Crown className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-xl font-black text-foreground mb-2">VIP Room</h2>
        <p className="text-muted-foreground text-sm text-center mb-6">Login to access the exclusive community</p>
        <button onClick={() => navigate('/auth')} className="px-6 py-3 gradient-pink rounded-2xl text-white font-bold pink-glow press">Login Now</button>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <>
        {showBenefits && <VIPBenefitsPopup onGetVIP={() => { setShowBenefits(false); setShowVIPSelector(true); }} onClose={() => setShowBenefits(false)} />}
        {showVIPSelector && <VIPPlanSelector onClose={() => setShowVIPSelector(false)} />}
        <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center px-4">
          <div className="max-w-sm w-full text-center">
            <div className="w-24 h-24 rounded-3xl gradient-pink flex items-center justify-center mx-auto mb-5 pink-glow animate-float">
              <Lock className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-2xl font-black text-foreground mb-2">VIP Members Only</h2>
            <p className="text-muted-foreground text-sm mb-6 leading-relaxed">Join the exclusive room where experts share live setups, analysis & premium signals 24/7.</p>
            <div className="bg-card border border-border rounded-2xl p-4 mb-5 text-left space-y-2">
              {['🔥 Live premium signals','💬 Real-time group chat','🎯 Expert guidance','📢 Admin announcements','✅ Verified blue tick','🌐 Community 24/7'].map(f => (
                <p key={f} className="text-sm text-foreground">{f}</p>
              ))}
            </div>
            <button onClick={() => setShowVIPSelector(true)} className="w-full py-4 gradient-pink rounded-2xl text-white font-black text-base pink-glow press">
              <Crown className="w-5 h-5 inline mr-2" /> Get VIP Access
            </button>
            <button onClick={() => navigate('/')} className="mt-3 text-sm text-muted-foreground press">← Back to Home</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {actionsFor && (
        <MessageActions msg={actionsFor} isOwn={actionsFor.user_id === user.id} isAdmin={isAdmin}
          onReply={() => { setReplyTo(actionsFor); inputRef.current?.focus(); }}
          onDelete={() => deleteMessage(actionsFor.id)}
          onPin={() => pinMessage(actionsFor.id, actionsFor.is_pinned)}
          onForward={() => setForwardMsg(actionsFor)}
          onReport={() => toast.success('Reported to admin')}
          onClose={() => setActionsFor(null)} />
      )}
      {forwardMsg && user && <ForwardModal message={forwardMsg} currentUserId={user.id} onClose={() => setForwardMsg(null)} />}
      {mediaViewer && <GlobalMediaViewer items={mediaViewer.items} initialIndex={mediaViewer.index} onClose={() => setMediaViewer(null)} />}
      {/* Pinned message banner — WhatsApp/Telegram style */}
      {(() => {
        const pinned = [...messages].reverse().find(m => m.is_pinned && !m.is_deleted);
        if (!pinned) return null;
        return <PinnedBanner msg={pinned} />;
      })()}
      {showRoomSettings && isAdmin && <RoomSettings onClose={() => setShowRoomSettings(false)} />}

      <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: vipTheme.bg, fontFamily }}>
        {/* Header */}
        <div className="flex items-center gap-2 px-3 flex-shrink-0"
          style={{ background: 'transparent', paddingTop: 'max(12px, env(safe-area-inset-top))', paddingBottom: '10px' }}>
          <button onClick={() => navigate('/')} className="w-9 h-9 rounded-full bg-[#1a1a1a] flex items-center justify-center press flex-shrink-0" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>

          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 gradient-pink flex items-center justify-center ring-2 ring-primary/40">
                {roomIcon ? <img src={roomIcon} alt="" className="w-full h-full object-cover" /> : <span className="text-[10px] font-black text-white">VM</span>}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-black text-white text-sm tracking-tight whitespace-nowrap">{roomName}</span>
                {onlineCount > 0 && (
                  <span className="flex items-center gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-[9px] text-green-400 font-bold">{onlineCount} online</span>
                  </span>
                )}
              </div>
              {/* Badge in header — apply profileStyles */}
              {profileStyles.tickPosition === 'below'
                ? null
                : <VIPBadge size={(profileStyles.tickSize || 'xs') as any} badgeStyle={((profile as any)?.badge_style as import('@/types').BadgeStyle) || 'blue_burst'} />
              }
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isAdmin && (
              <button onClick={() => setShowRoomSettings(true)} className="p-1.5 rounded-xl bg-muted/60 hover:bg-muted press" title="Room Settings">
                <Settings className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
            <VIPWhatsAppBtn whatsappNumber={whatsappNumber} isAdmin={isAdmin} hasMeetingPermission={hasMeetingPermission} createMeeting={createMeeting} MeetingComponent={MeetingComponent} />
          </div>
        </div>

        {/* Messages */}
        <div ref={messagesRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-2 py-2 relative"
          style={{ overscrollBehavior: 'contain' }}
          onClick={() => setShowEmojiFor(null)}>
          <div className="pointer-events-none absolute inset-0 z-0 opacity-60" style={{ backgroundImage: chatPattern, backgroundRepeat: 'repeat', backgroundSize: '60px 60px' }} />
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full opacity-50 pt-16">
              <Crown className="w-12 h-12 text-primary mb-2" />
              <p className="text-muted-foreground text-sm">No messages yet. Say hello! 👋</p>
            </div>
          )}

          {messages.map((msg, idx) => {
            const isOwn = msg.user_id === user.id;
            const sender = msg.user_profiles;
            const senderIsAdmin = sender?.email === ADMIN_EMAIL;
            const prevMsg = messages[idx - 1];
            const showAvatarAndName = !isOwn && (!prevMsg || prevMsg.user_id !== msg.user_id);
            const isGrouped = !isOwn && !!prevMsg && prevMsg.user_id === msg.user_id;
            const grouped = groupReactions(msg.reactions || []);
            const isSwiping = swipingId === msg.id;

            if (msg.is_announcement) {
              return (
                <div key={msg.id} className="flex justify-center my-3 animate-fade-in px-2">
                  <div className="msg-announcement px-4 py-2.5 max-w-[88%] text-center">
                    <p className="text-[11px] font-black text-primary mb-0.5 uppercase tracking-wide">📢 Announcement</p>
                    <p className="text-sm text-foreground" style={{ fontSize, fontFamily }}>{msg.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{formatTime(msg.created_at)}</p>
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${isGrouped ? 'mt-0.5' : 'mt-3'} px-1 animate-fade-in group select-none`}
                style={{ transform: isSwiping ? 'translateX(12px)' : 'translateX(0)', transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}
                onTouchStart={e => onMsgTouchStart(e, msg.id)}
                onTouchEnd={e => { onMsgTouchEnd(e, msg); cancelLongPress(); handleTap(msg); }}
                onMouseDown={() => startLongPress(msg)}
                onMouseUp={() => { cancelLongPress(); handleTap(msg); }}
                onMouseLeave={cancelLongPress}
                onContextMenu={e => { e.preventDefault(); setActionsFor(msg); }}>
                <div className={`flex ${isOwn ? 'flex-row-reverse' : 'flex-row'} items-start gap-1.5 max-w-[80%]`}>
                  {!isOwn && (
                    <div className="w-7 flex-shrink-0">
                      {showAvatarAndName ? (
                        <button onClick={() => navigate(`/profile/${msg.user_id}`)} className="w-7 h-7 rounded-full overflow-hidden gradient-pink flex items-center justify-center text-[10px] font-black text-white hover:ring-2 hover:ring-primary/50 transition-all">
                          {sender?.avatar_url ? <img src={sender.avatar_url} alt="" className="w-full h-full object-cover" /> : (sender?.username || '?')[0].toUpperCase()}
                        </button>
                      ) : <div className="w-7" />}
                    </div>
                  )}

                  <div className={`flex flex-col gap-0.5 ${isOwn ? 'items-end' : 'items-start'}`}>
                    {showAvatarAndName && !isOwn && (
                      <div className="flex items-center gap-1 mb-0.5">
                        <button onClick={() => navigate(`/profile/${msg.user_id}`)} className="text-[12px] font-bold hover:text-primary transition-colors leading-tight"
                          style={{ color: senderIsAdmin ? '#FF1493' : 'hsl(var(--foreground))' }}>
                          {senderIsAdmin ? '👑 Admin' : (sender?.username || 'Member')}
                        </button>
                        {sender?.blue_tick && (
                          profileStyles.tickPosition === 'far-right'
                            ? <span className="ml-4"><VIPBadge size={profileStyles.tickSize || 'xs'} badgeStyle={((sender as any)?.badge_style as import('@/types').BadgeStyle) || 'blue_burst'} /></span>
                            : <VIPBadge size={profileStyles.tickSize || 'xs'} badgeStyle={((sender as any)?.badge_style as import('@/types').BadgeStyle) || 'blue_burst'} />
                        )}
                        {senderIsAdmin && <span className="text-[9px] px-1.5 py-0.5 gradient-pink rounded text-white font-black">ADMIN</span>}
                        {sender?.is_online && <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />}
                      </div>
                    )}

                    {msg.replyMessage && (
                      <div className={`px-3 py-1.5 rounded-xl mb-1 border-l-[3px] border-primary max-w-full ${isOwn ? 'bg-black/20' : 'bg-muted/60'}`}>
                        <p className="text-[10px] text-primary font-bold mb-0.5">{(msg.replyMessage as MessageWithMeta).user_profiles?.username || 'Member'}</p>
                        <p className="text-[11px] text-muted-foreground line-clamp-1">{msg.replyMessage.message || '📎 Media'}</p>
                      </div>
                    )}

                    <div className={`relative ${msg.is_pinned ? 'ring-1 ring-primary/50' : ''} rounded-2xl overflow-hidden`}
                      style={{
                        padding: (msg.media_url && !msg.message && msg.media_type !== 'audio') ? 0 : '8px 12px',
                        background: (msg.media_url && !msg.message && msg.media_type !== 'audio') ? 'transparent' : isOwn ? vipTheme.ownColor : vipTheme.otherColor
                      }}
                      onClick={() => {
                        if (msg.media_url && msg.media_type !== 'audio') {
                          let items: { url: string; type: 'image' | 'video' }[] = [];
                          if (msg.media_type === 'multi') { try { items = JSON.parse(msg.media_url); } catch {} }
                          else items = [{ url: msg.media_url, type: (msg.media_type as 'image' | 'video') || 'image' }];
                          if (items.length > 0) setMediaViewer({ items, index: 0 });
                        }
                      }}>
                      {/* Voice Note */}
                      {msg.media_url && msg.media_type === 'audio' && (
                        <VoiceNotePlayer url={msg.media_url} isOwn={isOwn} />
                      )}
                      {/* Text */}
                      {msg.message && !msg.message.includes('meeting_id:') && (
                        <p className={`leading-relaxed break-words ${isOwn ? 'text-white' : 'text-foreground'}`} style={{ fontSize, fontFamily }}>
                          {msg.message}
                        </p>
                      )}
                      {/* Meeting join button */}
                      {msg.message && msg.message.includes('meeting_id:') && (() => {
                        const match = msg.message.match(/meeting_id:([\w-]+)/);
                        const titleMatch = msg.message.match(/\*\*([^*]+)\*\*/);
                        if (!match) return (
                          <p className={`leading-relaxed break-words ${isOwn ? 'text-white' : 'text-foreground'}`} style={{ fontSize, fontFamily }}>{msg.message}</p>
                        );
                        return (
                          <div className="py-1">
                            <MeetingJoinButton meetingId={match[1]} title={titleMatch ? titleMatch[1] : 'VIP Meeting'} />
                          </div>
                        );
                      })()}
                      {/* Media */}
                      {msg.media_url && msg.media_type === 'multi' && (() => {
                        let items: { url: string; type: 'image' | 'video' }[] = [];
                        try { items = JSON.parse(msg.media_url); } catch {}
                        return <TelegramMediaGrid items={items} maxWidth={260} onMediaClick={(its, idx) => setMediaViewer({ items: its, index: idx })} />;
                      })()}
                      {msg.media_url && msg.media_type === 'image' && <TelegramMediaGrid items={[{ url: msg.media_url, type: 'image' }]} maxWidth={220} onMediaClick={(its, idx) => setMediaViewer({ items: its, index: idx })} />}
                      {msg.media_url && msg.media_type === 'video' && <TelegramMediaGrid items={[{ url: msg.media_url, type: 'video' }]} maxWidth={200} onMediaClick={(its, idx) => setMediaViewer({ items: its, index: idx })} />}
                      <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        <p className={`text-[10px] leading-none ${isOwn ? 'text-white/50' : 'text-muted-foreground'}`}>{formatTime(msg.created_at)}</p>
                        {isOwn && msg.readCount && msg.readCount > 0 ? (
                          <span className="flex items-center gap-0.5">
                            <svg viewBox="0 0 16 10" className="w-3.5 h-2.5" fill="none">
                              <path d="M1 5L5 9L11 1" stroke="rgba(59,130,246,0.9)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M5 5L9 9L15 1" stroke="rgba(59,130,246,0.9)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </span>
                        ) : isOwn ? (
                          <svg viewBox="0 0 16 10" className="w-3.5 h-2.5" fill="none">
                            <path d="M1 5L5 9L11 1" stroke="rgba(255,255,255,0.4)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M5 5L9 9L15 1" stroke="rgba(255,255,255,0.4)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        ) : null}
                      </div>
                    </div>

                    {grouped.length > 0 && (
                      <div className={`flex flex-wrap gap-1 mt-0.5 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        {grouped.map(([emoji, count]) => (
                          <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)} className="flex items-center gap-0.5 px-2 py-0.5 bg-muted/80 border border-border/50 rounded-full text-xs hover:border-primary/40 transition-all press">
                            <span>{emoji}</span>
                            {count > 1 && <span className="text-[10px] text-muted-foreground">{count}</span>}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className={`flex items-center gap-1 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                      <button onClick={e => { e.stopPropagation(); setReplyTo(msg); inputRef.current?.focus(); }} className="p-1.5 rounded-lg bg-muted/70 hover:bg-muted transition-all press">
                        <Reply className="w-3 h-3 text-muted-foreground" />
                      </button>
                      <button onClick={e => { e.stopPropagation(); setShowEmojiFor(showEmojiFor === msg.id ? null : msg.id); }} className="p-1.5 rounded-lg bg-muted/70 hover:bg-muted transition-all press">
                        <span className="text-[13px] leading-none">😊</span>
                      </button>
                      <button onClick={e => { e.stopPropagation(); setForwardMsg(msg); }} className="p-1.5 rounded-lg bg-muted/70 hover:bg-muted transition-all press">
                        <Share2 className="w-3 h-3 text-muted-foreground" />
                      </button>
                      {(isOwn || isAdmin) && (
                        <button onClick={e => { e.stopPropagation(); deleteMessage(msg.id); }} className="p-1.5 rounded-lg bg-muted/70 hover:bg-red-500/20 press">
                          <Trash2 className="w-3 h-3 text-red-400" />
                        </button>
                      )}
                    </div>

                    {showEmojiFor === msg.id && (
                      <div className="flex gap-1 p-2 bg-card border border-border rounded-2xl shadow-2xl animate-scale-in z-20" onClick={e => e.stopPropagation()}>
                        {EMOJI_REACTIONS.map(e => (
                          <button key={e} className="text-lg hover:scale-125 transition-transform press" onClick={() => toggleReaction(msg.id, e)}>{e}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} className="h-2 w-full" />

          {/* Typing indicator */}
          {typingUsers.length > 0 && (
            <div className="flex items-end gap-2 px-1 pb-1 animate-fade-in">
              <div className="w-7 h-7 rounded-full gradient-pink flex items-center justify-center text-[10px] font-black text-white flex-shrink-0">
                {typingUsers[0]?.username?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="px-3 py-2 rounded-2xl" style={{ background: vipTheme.otherColor, borderRadius: '18px 18px 18px 4px' }}>
                <div className="flex gap-1 items-center h-4">
                  {[0, 150, 300].map(d => (
                    <div key={d} className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground">{typingUsers.map(u => u.username).join(', ')} typing...</span>
            </div>
          )}
        </div>

        {showScrollBtn && (
          <button onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })} className="absolute right-4 w-9 h-9 rounded-full bg-card border border-border shadow-xl flex items-center justify-center animate-fade-in z-20 press" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
        )}

        {/* Input area */}
        <div className="flex-shrink-0" style={{ background: 'transparent', paddingTop: '8px', paddingLeft: '12px', paddingRight: '12px', paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}>
          {replyTo && (
            <div className="flex items-center gap-2 px-3 py-2 mb-2 bg-muted/40 rounded-xl border-l-[3px] border-primary animate-slide-up">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-primary font-bold">{replyTo.user_profiles?.username || 'Member'}</p>
                <p className="text-xs text-muted-foreground truncate">{replyTo.message || '📎 Media'}</p>
              </div>
              <button onClick={() => setReplyTo(null)} className="p-1 rounded-lg hover:bg-muted press flex-shrink-0"><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
            </div>
          )}

          {uploadTotal > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 mb-2 bg-muted/60 rounded-xl animate-fade-in">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full gradient-pink rounded-full transition-all" style={{ width: `${uploadTotal > 0 ? Math.round((uploadProgress / uploadTotal) * 100) : 0}%` }} />
              </div>
              <span className="text-xs text-muted-foreground font-bold">{uploadTotal > 0 ? Math.round((uploadProgress / uploadTotal) * 100) : 0}%</span>
            </div>
          )}

          {selectedFiles.length > 0 && (
            <div className="grid gap-1 mb-2" style={{ gridTemplateColumns: `repeat(${Math.min(selectedFiles.length, 4)}, 1fr)` }}>
              {selectedFiles.map((f, i) => {
                const url = URL.createObjectURL(f);
                const isVid = f.type.startsWith('video');
                return (
                  <div key={i} className="relative rounded-xl overflow-hidden bg-muted" style={{ aspectRatio: '1' }}>
                    {isVid ? <video src={url} className="w-full h-full object-cover" /> : <img src={url} alt="" className="w-full h-full object-cover" />}
                    <button onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center">
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button onClick={() => fileInputRef.current?.click()} className="relative w-10 h-10 rounded-full flex items-center justify-center cursor-pointer hover:bg-muted/80 flex-shrink-0 press" style={{ background: 'rgba(26,26,26,0.95)', border: '1px solid rgba(255,255,255,0.12)' }}>
              {uploading ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Image className="w-4 h-4 text-muted-foreground" />}
              {selectedFiles.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 gradient-pink rounded-full text-white text-[9px] font-black flex items-center justify-center">{selectedFiles.length}</span>
              )}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileSelect} />

            {/* WhatsApp-style: voice recorder replaces send button when no text */}
            {text.trim() || selectedFiles.length > 0 ? (
              <>
                <input ref={inputRef} value={text}
                  onChange={e => { setText(e.target.value); broadcastTyping(); }}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (selectedFiles.length > 0 ? sendMedia() : sendMessage())}
                  placeholder={isAdmin ? '📢 Announcement or message...' : 'Message VIP room...'}
                  className="flex-1 bg-muted border border-border rounded-2xl px-4 py-2.5 text-foreground placeholder-muted-foreground text-sm outline-none focus:border-primary/50 transition-all"
                  style={{ fontFamily }} />
                <button onClick={() => { if (selectedFiles.length > 0 && !text.trim()) { sendMedia(); } else { sendMessage(); if (selectedFiles.length > 0) sendMedia(); } }}
                  disabled={sending || (!text.trim() && selectedFiles.length === 0)}
                  className="w-10 h-10 gradient-pink rounded-full text-white flex-shrink-0 flex items-center justify-center pink-glow-xs press disabled:opacity-40 transition-all">
                  <Send className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <input ref={inputRef} value={text}
                  onChange={e => { setText(e.target.value); broadcastTyping(); }}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder={isAdmin ? '📢 Announcement or message...' : 'Message VIP room...'}
                  className="flex-1 bg-muted border border-border rounded-2xl px-4 py-2.5 text-foreground placeholder-muted-foreground text-sm outline-none focus:border-primary/50 transition-all"
                  style={{ fontFamily }} />
                <VoiceNoteRecorder onSend={sendVoiceNote} bucket="media" folder="vip" />
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
