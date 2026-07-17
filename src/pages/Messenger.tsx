import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Send, Image as ImageIcon, Crown, Lock,
  Check, CheckCheck, Plus, X, Trash2, Phone, Reply,
  UserX, Eye, MessageCircle, MoreVertical, AlertTriangle, Flag, Share2, Mic,
  PhoneCall, Video
} from 'lucide-react';
import { supabase, uploadFile, isVIPActive, openWhatsApp, WHATSAPP_NUMBER } from '@/lib/supabase';
import { playMessageSound } from '@/lib/notificationSound';
import { useAuth } from '@/contexts/AuthContext';
import { t } from '@/lib/i18n';
import { Conversation, DirectMessage, UserProfile } from '@/types';
import type { BadgeStyle } from '@/types';
import VIPBadge from '@/components/features/VIPBadge';
import VIPPlanSelector from '@/components/features/VIPPlanSelector';
import TelegramMediaGrid from '@/components/features/TelegramMediaGrid';
import GlobalMediaViewer from '@/components/features/GlobalMediaViewer';
import VoiceNoteRecorder from '@/components/features/VoiceNoteRecorder';
import { useCall, ActiveCallScreen } from '@/components/features/WebRTCCall';
import { MeetingJoinButton } from '@/components/features/MeetingRoom';
import { toast } from 'sonner';



function formatTime(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
function formatTimeFull(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Unread badge ──
function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 gradient-pink rounded-full text-white text-[10px] font-black flex items-center justify-center" style={{ boxShadow: '0 2px 8px rgba(255,20,147,0.45)' }}>
      {count > 99 ? '99+' : count}
    </span>
  );
}

// ── Message Tick ──
function MessageTick({ isRead, otherOnline }: { isRead: boolean; otherOnline: boolean }) {
  if (isRead) return <span className="flex items-center" title="Seen"><CheckCheck className="w-3.5 h-3.5 text-blue-400" /></span>;
  if (otherOnline) return <span className="flex items-center" title="Delivered"><CheckCheck className="w-3.5 h-3.5 text-white/45" /></span>;
  return <span className="flex items-center" title="Sent"><Check className="w-3.5 h-3.5 text-white/45" /></span>;
}

// ── Typing Indicator ──
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      {[0, 1, 2].map(i => (
        <span key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground" style={{ animation: `typingBounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
      ))}
    </div>
  );
}

// ── Confirm Dialog ──
function ConfirmDialog({ title, message, onConfirm, onCancel, danger = false }: {
  title: string; message: string; onConfirm: () => void; onCancel: () => void; danger?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[600] bg-black/70 flex items-center justify-center px-4 animate-fade-in">
      <div className="w-full max-w-sm bg-card border border-border rounded-3xl p-5 animate-scale-in shadow-2xl">
        <div className="flex items-start gap-3 mb-4">
          {danger && <div className="w-10 h-10 rounded-2xl bg-red-500/15 flex items-center justify-center flex-shrink-0"><AlertTriangle className="w-5 h-5 text-red-400" /></div>}
          <div className="flex-1">
            <h3 className="font-black text-foreground mb-1">{title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 bg-muted border border-border rounded-xl text-foreground text-sm font-bold press">Cancel</button>
          <button onClick={onConfirm} className={`flex-1 py-2.5 rounded-xl text-white text-sm font-bold press ${danger ? 'bg-red-500' : 'gradient-pink'}`}>
            {danger ? 'Delete' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── File preview grid before send ──
function MediaGrid({ files, onRemove }: { files: File[]; onRemove: (i: number) => void }) {
  if (files.length === 0) return null;
  const cols = files.length === 1 ? 1 : files.length === 2 ? 2 : files.length <= 4 ? 2 : 3;
  return (
    <div className="grid gap-1 mb-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {files.map((f, i) => {
        const url = URL.createObjectURL(f);
        const isVideo = f.type.startsWith('video');
        return (
          <div key={i} className="relative rounded-xl overflow-hidden bg-muted" style={{ aspectRatio: '1' }}>
            {isVideo ? <video src={url} className="w-full h-full object-cover" /> : <img src={url} alt="" className="w-full h-full object-cover" />}
            <button onClick={() => onRemove(i)} className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center press"><X className="w-3 h-3 text-white" /></button>
            <div className="absolute bottom-1 left-1 text-[9px] text-white bg-black/50 rounded px-1">{formatBytes(f.size)}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Upload Progress Bar ──
function UploadProgress({ progress, total }: { progress: number; total: number }) {
  const pct = total > 0 ? Math.round((progress / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-muted/60 rounded-xl mb-2 animate-fade-in">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full gradient-pink rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground font-bold flex-shrink-0">{pct}% · {progress}/{total}</span>
    </div>
  );
}

// ── Conversation Context Menu ──
function ConvContextMenu({ conv, onClose, onDelete, onBlock, onReport, onViewProfile }: {
  conv: Conversation; onClose: () => void; onDelete: () => void;
  onBlock: () => void; onReport: () => void; onViewProfile: () => void;
}) {
  const other = conv.other_user;
  const badgeStyle = ((other as any)?.badge_style as BadgeStyle) || 'blue_burst';
  return (
    <div className="fixed inset-0 z-[400] bg-black/60 flex items-end justify-center animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md bg-card border border-border rounded-t-3xl overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()} style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        <div className="flex items-center gap-3 px-4 py-4 border-b border-border">
          <div className="w-11 h-11 rounded-full overflow-hidden bg-muted gradient-pink flex items-center justify-center flex-shrink-0">
            {other?.avatar_url ? <img src={other.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-sm font-black text-white">{(other?.username || '?')[0].toUpperCase()}</span>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-black text-foreground truncate">{other?.username || other?.full_name || 'Member'}</p>
              {other?.blue_tick && <VIPBadge size="xs" badgeStyle={badgeStyle} />}
            </div>
            <p className="text-xs text-muted-foreground">{other?.is_online ? '🟢 Online' : 'Offline'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl bg-muted press"><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="py-2">
          <button onClick={() => { onViewProfile(); onClose(); }} className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-muted/50 transition-all press text-left">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center"><Eye className="w-4 h-4 text-blue-400" /></div>
            <div><p className="font-bold text-foreground text-sm">View Profile</p><p className="text-xs text-muted-foreground">See full profile</p></div>
          </button>
          <button onClick={() => { onBlock(); onClose(); }} className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-muted/50 transition-all press text-left">
            <div className="w-9 h-9 rounded-xl bg-yellow-500/15 flex items-center justify-center"><UserX className="w-4 h-4 text-yellow-400" /></div>
            <div><p className="font-bold text-foreground text-sm">Block User</p><p className="text-xs text-muted-foreground">Stop receiving messages</p></div>
          </button>
          <button onClick={() => { onReport(); onClose(); }} className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-muted/50 transition-all press text-left">
            <div className="w-9 h-9 rounded-xl bg-orange-500/15 flex items-center justify-center"><Flag className="w-4 h-4 text-orange-400" /></div>
            <div><p className="font-bold text-foreground text-sm">Report to Admin</p><p className="text-xs text-muted-foreground">Flag inappropriate behavior</p></div>
          </button>
          <div className="mx-4 my-1 border-t border-border/50" />
          <button onClick={() => { onDelete(); onClose(); }} className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-red-500/10 transition-all press text-left">
            <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center"><Trash2 className="w-4 h-4 text-red-400" /></div>
            <div><p className="font-bold text-red-400 text-sm">Delete Chat</p><p className="text-xs text-muted-foreground">Remove all messages permanently</p></div>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── New Chat Popup ──
function NewChatPopup({ currentUserId, lang, onSelect, onClose }: {
  currentUserId: string; lang: ReturnType<typeof useAuth>['lang'];
  onSelect: (userId: string) => void; onClose: () => void;
}) {
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase.from('user_profiles').select('*').neq('id', currentUserId).order('username').then(({ data }) => {
      if (data) setMembers(data);
      setLoading(false);
    });
  }, [currentUserId]);

  const filtered = members.filter(m => !search || (m.username || m.full_name || m.email || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fixed inset-0 z-[300] bg-black/70 flex items-end justify-center animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md bg-card border border-border rounded-t-3xl overflow-hidden animate-slide-up" style={{ maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-4 border-b border-border">
          <h3 className="font-black text-foreground">{t(lang, 'new_message')}</h3>
          <button onClick={onClose} className="p-1.5 rounded-xl bg-muted press"><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="px-4 py-3 border-b border-border">
          <div className="relative">
            <svg className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            <input className="w-full bg-muted border border-border rounded-xl pl-9 pr-4 py-2 text-foreground placeholder-muted-foreground text-sm outline-none focus:border-primary/50 transition-all" placeholder={t(lang, 'search_members')} value={search} onChange={e => setSearch(e.target.value)} autoFocus />
          </div>
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: '60vh' }}>
          {loading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 bg-muted/30 rounded-xl animate-pulse" />)}</div>
          ) : (
            <div className="p-2">
              {filtered.map(member => {
                const mBadge = ((member as any).badge_style as BadgeStyle) || 'blue_burst';
                return (
                  <button key={member.id} onClick={() => { onSelect(member.id); onClose(); }} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-all press text-left">
                    <div className="relative flex-shrink-0">
                      <div className="w-11 h-11 rounded-full overflow-hidden bg-muted gradient-pink flex items-center justify-center">
                        {member.avatar_url ? <img src={member.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-sm font-black text-white">{(member.username || '?')[0].toUpperCase()}</span>}
                      </div>
                      {member.is_online && <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 border-2 border-background" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <p className="font-bold text-foreground text-sm truncate">{member.username || member.full_name || 'Member'}</p>
                        {member.blue_tick && <VIPBadge size="xs" badgeStyle={mBadge} />}
                      </div>
                      <p className="text-xs text-muted-foreground">{member.is_online ? `🟢 ${t(lang, 'online')}` : t(lang, 'offline')}</p>
                    </div>
                    {member.is_vip && <Crown className="w-4 h-4 text-primary flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Chat View ──
function ChatView({ conversationId, otherUser, chatTheme, profileStyles, onBack, onDelete }: {
  conversationId: string;
  otherUser: UserProfile;
  chatTheme: { bg: string; ownColor: string; otherColor: string; fontSize: string };
  profileStyles: any;
  onBack: () => void;
  onDelete: () => void;
}) {
  const { user, lang } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [replyTo, setReplyTo] = useState<DirectMessage | null>(null);
  const [swipingId, setSwipingId] = useState<string | null>(null);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [mediaViewer, setMediaViewer] = useState<{ items: { url: string; type: 'image' | 'video' }[]; index: number } | null>(null);
  const [forwardMsg, setForwardMsg] = useState<DirectMessage | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef<number>(0);
  const touchStartX = useRef<number>(0);
  const touchMsgId = useRef<string | null>(null);

  const otherBadge = ((otherUser as any).badge_style as BadgeStyle) || 'blue_burst';
  const { startCall, activeCall, setActiveCall, callBg } = useCall();
  const [showCallMenu, setShowCallMenu] = useState(false);

  // ── Mark messages as read when chat opens ──
  useEffect(() => {
    if (!user || !conversationId) return;
    // Mark all unread messages from other user as read immediately
    supabase.from('direct_messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', user.id)
      .eq('is_read', false);
  }, [conversationId, user]);

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase.from('direct_messages').select('*').eq('conversation_id', conversationId).eq('is_deleted', false).order('created_at', { ascending: true }).limit(300);
    if (data) setMessages(data as DirectMessage[]);
    if (user) {
      await supabase.from('direct_messages').update({ is_read: true }).eq('conversation_id', conversationId).neq('sender_id', user.id).eq('is_read', false);
    }
    const { data: conv } = await supabase.from('conversations').select('participant_one, participant_two, participant_one_typing_at, participant_two_typing_at').eq('id', conversationId).single();
    if (conv && user) {
      const isP1 = conv.participant_one === user.id;
      const otherTypingAt = isP1 ? conv.participant_two_typing_at : conv.participant_one_typing_at;
      setIsOtherTyping(otherTypingAt ? Date.now() - new Date(otherTypingAt).getTime() < 4000 : false);
    }
  }, [conversationId, user]);

  useEffect(() => {
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 2500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); if (typingTimerRef.current) clearTimeout(typingTimerRef.current); };
  }, [fetchMessages]);

  const prevCount = useRef(0);
  useEffect(() => {
    if (messages.length !== prevCount.current) {
      if (messages.length > prevCount.current && prevCount.current > 0) {
        // Only play sound for incoming messages
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.sender_id !== user?.id) playMessageSound();
      }
      prevCount.current = messages.length;
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  async function notifyTyping() {
    if (!user) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 1500) return;
    lastTypingSentRef.current = now;
    const { data: conv } = await supabase.from('conversations').select('participant_one, participant_two').eq('id', conversationId).single();
    if (!conv) return;
    const isP1 = conv.participant_one === user.id;
    await supabase.from('conversations').update(isP1 ? { participant_one_typing_at: new Date().toISOString() } : { participant_two_typing_at: new Date().toISOString() }).eq('id', conversationId);
  }

  async function clearTyping() {
    if (!user) return;
    const { data: conv } = await supabase.from('conversations').select('participant_one, participant_two').eq('id', conversationId).single();
    if (!conv) return;
    const isP1 = conv.participant_one === user.id;
    await supabase.from('conversations').update(isP1 ? { participant_one_typing_at: null } : { participant_two_typing_at: null }).eq('id', conversationId);
  }

  function handleTextChange(val: string) {
    setText(val);
    if (val.trim()) {
      notifyTyping();
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(clearTyping, 3000);
    } else {
      clearTyping();
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setSelectedFiles(prev => [...prev, ...files]);
    e.target.value = '';
  }

  async function sendVoiceDM(audioUrl: string, _dur: number) {
    if (!user) return;
    await supabase.from('direct_messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      media_url: audioUrl,
      media_type: 'audio',
      message: null,
      reply_to_id: replyTo?.id || null,
    });
    await supabase.from('conversations').update({ last_message: '🎤 Voice note', last_message_at: new Date().toISOString() }).eq('id', conversationId);
    setReplyTo(null);
    fetchMessages();
  }

  async function sendMessage() {
    if ((!text.trim() && selectedFiles.length === 0) || !user || sending) return;
    setSending(true);
    clearTyping();
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

    if (selectedFiles.length > 0) {
      setUploadTotal(selectedFiles.length);
      setUploadProgress(0);
      const uploadedMedia: { url: string; type: string }[] = [];
      await Promise.all(selectedFiles.map(async (file, idx) => {
        const mediaType = file.type.startsWith('video') ? 'video' : 'image';
        const url = await uploadFile('media', `dm/${Date.now()}_${idx}_${file.name}`, file);
        uploadedMedia.push({ url, type: mediaType });
        setUploadProgress(p => p + 1);
      }));

      const base = { conversation_id: conversationId, sender_id: user.id, message: text.trim() || null, reply_to_id: replyTo?.id || null, reply_preview: replyTo ? (replyTo.message || '📎 Media') : null, reply_sender: replyTo ? (otherUser.username || 'Member') : null };
      if (uploadedMedia.length === 1) {
        await supabase.from('direct_messages').insert({ ...base, media_url: uploadedMedia[0].url, media_type: uploadedMedia[0].type });
      } else {
        await supabase.from('direct_messages').insert({ ...base, media_url: JSON.stringify(uploadedMedia), media_type: 'multi' });
      }
      await supabase.from('conversations').update({ last_message: text.trim() || `📷 ${uploadedMedia.length} Photo${uploadedMedia.length > 1 ? 's' : ''}`, last_message_at: new Date().toISOString() }).eq('id', conversationId);
      setUploadProgress(0);
      setUploadTotal(0);
      setSelectedFiles([]);
    }

    if (text.trim() && selectedFiles.length === 0) {
      const insertData: Record<string, unknown> = { conversation_id: conversationId, sender_id: user.id, message: text.trim() };
      if (replyTo) { insertData.reply_to_id = replyTo.id; insertData.reply_preview = replyTo.message || '📎 Media'; insertData.reply_sender = otherUser.username || 'Member'; }
      await supabase.from('direct_messages').insert(insertData);
      await supabase.from('conversations').update({ last_message: text.trim(), last_message_at: new Date().toISOString() }).eq('id', conversationId);
    }

    setText('');
    setReplyTo(null);
    setSending(false);
    fetchMessages();
  }

  async function deleteMessage(id: string) {
    await supabase.from('direct_messages').update({ is_deleted: true }).eq('id', id);
    setMessages(prev => prev.filter(m => m.id !== id));
    fetchMessages();
  }

  async function forwardMessage(msg: DirectMessage, toUserId: string) {
    if (!user) return;
    const p1 = user.id < toUserId ? user.id : toUserId;
    const p2 = user.id < toUserId ? toUserId : user.id;
    let { data: conv } = await supabase.from('conversations').select('*').eq('participant_one', p1).eq('participant_two', p2).single();
    if (!conv) {
      const { data: created } = await supabase.from('conversations').insert({ participant_one: p1, participant_two: p2 }).select().single();
      conv = created;
    }
    if (conv) {
      const text = msg.message ? `↪️ Forwarded: ${msg.message}` : '↪️ Forwarded media';
      await supabase.from('direct_messages').insert({ conversation_id: conv.id, sender_id: user.id, message: text, media_url: msg.media_url, media_type: msg.media_type });
      await supabase.from('conversations').update({ last_message: text, last_message_at: new Date().toISOString() }).eq('id', conv.id);
    }
    toast.success('Forwarded!');
  }

  async function forwardToVIPRoom(msg: DirectMessage) {
    if (!user) return;
    const text = msg.message ? `↪️ Forwarded: ${msg.message}` : '↪️ Forwarded media';
    await supabase.from('vip_messages').insert({ user_id: user.id, message: text, media_url: msg.media_url, media_type: msg.media_type });
    toast.success('Forwarded to VIP Room!');
  }

  async function handleDeleteConversation() {
    await supabase.from('direct_messages').delete().eq('conversation_id', conversationId);
    await supabase.from('conversations').delete().eq('id', conversationId);
    toast.success('Chat deleted');
    onDelete();
  }

  function onTouchStart(e: React.TouchEvent, msgId: string) {
    touchStartX.current = e.touches[0].clientX;
    touchMsgId.current = msgId;
  }
  function onTouchEnd(e: React.TouchEvent, msg: DirectMessage) {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    if (deltaX > 55 && touchMsgId.current === msg.id) {
      setReplyTo(msg);
      setSwipingId(msg.id);
      setTimeout(() => setSwipingId(null), 400);
      inputRef.current?.focus();
    }
    touchMsgId.current = null;
  }

  function parseMedia(msg: DirectMessage): { url: string; type: string }[] {
    if (!msg.media_url) return [];
    if (msg.media_type === 'multi') { try { return JSON.parse(msg.media_url); } catch { return []; } }
    return [{ url: msg.media_url, type: msg.media_type || 'image' }];
  }

  const otherIsOnline = otherUser.is_online;
  const lastSeenText = otherUser.last_seen ? `${t(lang, 'last_seen')} ${new Date(otherUser.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : t(lang, 'offline');
  const fontSize = chatTheme.fontSize === 'sm' ? '13px' : chatTheme.fontSize === 'lg' ? '16px' : chatTheme.fontSize === 'xl' ? '18px' : '14px';

  return (
    <>
      {mediaViewer && <GlobalMediaViewer items={mediaViewer.items} initialIndex={mediaViewer.index} onClose={() => setMediaViewer(null)} />}

      {/* Call menu */}
      {showCallMenu && (
        <div className="fixed inset-0 z-[600] bg-black/70 flex items-end justify-center animate-fade-in" onClick={() => setShowCallMenu(false)}>
          <div className="w-full max-w-md bg-card border border-border rounded-t-3xl overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()} style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
            <div className="px-4 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full overflow-hidden bg-muted gradient-pink flex items-center justify-center flex-shrink-0">
                  {otherUser.avatar_url ? <img src={otherUser.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-sm font-black text-white">{(otherUser.username || '?')[0].toUpperCase()}</span>}
                </div>
                <p className="font-black text-foreground">{otherUser.username || otherUser.full_name || 'Member'}</p>
              </div>
              <button onClick={() => setShowCallMenu(false)} className="p-1.5 rounded-xl bg-muted press"><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="py-2">
              {/* WhatsApp */}
              <button onClick={() => { setShowCallMenu(false); if (!otherUser.phone_number) { toast.error('This user has not added a phone number'); return; } window.open(`https://wa.me/${otherUser.phone_number.replace(/\D/g,'')}`, '_blank'); }}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-all press text-left">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: '#25D366' }}>
                  <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </div>
                <div><p className="font-bold text-foreground">WhatsApp</p><p className="text-xs text-muted-foreground">Open in WhatsApp</p></div>
              </button>
              {/* Normal call */}
              <button onClick={() => { setShowCallMenu(false); if (!otherUser.phone_number) { toast.error('No phone number shared'); return; } window.location.href = `tel:${otherUser.phone_number}`; }}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-all press text-left">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/15 flex items-center justify-center"><Phone className="w-5 h-5 text-blue-400" /></div>
                <div><p className="font-bold text-foreground">Normal Call</p><p className="text-xs text-muted-foreground">Regular phone call</p></div>
              </button>
              {/* Here call */}
              <button onClick={() => { setShowCallMenu(false); startCall(otherUser, 'audio'); }}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-all press text-left">
                <div className="w-10 h-10 rounded-2xl bg-green-500/15 flex items-center justify-center"><PhoneCall className="w-5 h-5 text-green-400" /></div>
                <div><p className="font-bold text-foreground">Here Call</p><p className="text-xs text-muted-foreground">Online audio call (like WhatsApp)</p></div>
              </button>
              {/* Video call */}
              <button onClick={() => { setShowCallMenu(false); startCall(otherUser, 'video'); }}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-all press text-left">
                <div className="w-10 h-10 rounded-2xl bg-primary/15 flex items-center justify-center"><Video className="w-5 h-5 text-primary" /></div>
                <div><p className="font-bold text-foreground">Video Call</p><p className="text-xs text-muted-foreground">Online video call (like WhatsApp)</p></div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active call */}
      {activeCall && user && (
        <ActiveCallScreen
          callId={activeCall.id}
          localUser={{ id: user.id, username: user.username, avatar: user.avatar }}
          remoteUser={activeCall.remoteUser}
          callType={activeCall.callType}
          isInitiator={activeCall.isInitiator}
          callBg={callBg}
          onEnd={() => setActiveCall(null)}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog title="Delete Chat" message={`Delete your conversation with ${otherUser.username || 'this member'}? This cannot be undone.`} danger onConfirm={() => { setConfirmDelete(false); handleDeleteConversation(); }} onCancel={() => setConfirmDelete(false)} />
      )}

      {/* Forward dialog */}
      {forwardMsg && user && (
        <div className="fixed inset-0 z-[500] bg-black/70 flex flex-col animate-fade-in" onClick={() => setForwardMsg(null)}>
          <div className="flex-1" />
          <div className="w-full max-w-md mx-auto bg-card border border-border rounded-t-3xl overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxHeight: '70vh', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
            <div className="flex items-center justify-between px-4 py-4 border-b border-border">
              <h3 className="font-black text-foreground">Forward To</h3>
              <button onClick={() => setForwardMsg(null)} className="p-1.5 rounded-xl bg-muted press"><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: '55vh' }}>
              <button onClick={() => { forwardToVIPRoom(forwardMsg!); setForwardMsg(null); }} className="w-full flex items-center gap-3 px-4 py-3 border-b border-border/30 hover:bg-muted/50 press">
                <div className="w-10 h-10 rounded-full gradient-pink flex items-center justify-center flex-shrink-0"><Crown className="w-5 h-5 text-white" /></div>
                <div className="flex-1 text-left"><p className="font-bold text-foreground text-sm">VIP Room</p><p className="text-xs text-muted-foreground">Community chat</p></div>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed inset-0 z-[200] flex flex-col" style={{ background: chatTheme.bg }}>
        {/* Header — BLACK PILL exactly like image: back arrow (black circle) + [profile avatar + name + blue tick] as center pill + WhatsApp (green circle) */}
        <div className="flex items-center gap-2 px-3 flex-shrink-0" style={{ background: 'transparent', paddingTop: 'max(12px, env(safe-area-inset-top))', paddingBottom: '12px' }}>
          {/* Back arrow — black circle */}
          <button onClick={onBack} className="w-9 h-9 rounded-full bg-[#1a1a1a] flex items-center justify-center press flex-shrink-0" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>

          {/* CENTER pill: profile avatar + name + blue tick */}
          <button onClick={() => navigate(`/profile/${otherUser.id}`)} className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)' }}>
              {/* Profile avatar of the person you're chatting with */}
              <div className="relative w-7 h-7 flex-shrink-0">
                <div className="w-7 h-7 rounded-full overflow-hidden bg-muted flex items-center justify-center gradient-pink">
                  {otherUser.avatar_url
                    ? <img src={otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
                    : <span className="text-[9px] font-black text-white">{(otherUser.username || '?')[0].toUpperCase()}</span>
                  }
                </div>
                <span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-background ${otherIsOnline ? 'bg-green-400' : 'bg-muted-foreground/40'}`} />
              </div>
              {/* Name + Badge — apply profileStyles tick position */}
              <span className="font-black text-white text-sm tracking-tight whitespace-nowrap max-w-[140px] truncate">{otherUser.username || otherUser.full_name}</span>
              {otherUser.blue_tick && profileStyles?.tickPosition !== 'below' && (
                profileStyles?.tickPosition === 'far-right'
                  ? <span className="ml-2"><VIPBadge size={(profileStyles?.tickSize || 'xs') as any} badgeStyle={otherBadge} /></span>
                  : <VIPBadge size={(profileStyles?.tickSize || 'xs') as any} badgeStyle={otherBadge} />
              )}
            </div>
          </button>

          {/* Right: phone + WhatsApp */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => setShowCallMenu(true)}
              className="w-9 h-9 rounded-full flex items-center justify-center press flex-shrink-0"
              style={{ background: '#25D366', boxShadow: '0 2px 12px rgba(37,211,102,0.4)' }}
            >
              <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </button>
          </div>
        </div>

        {showMenu && (
          <div className="fixed inset-0 z-[350] bg-black/50 animate-fade-in" onClick={() => setShowMenu(false)}>
            <div className="absolute right-3 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-scale-in min-w-[180px]" onClick={e => e.stopPropagation()} style={{ top: 'calc(max(56px, env(safe-area-inset-top)) + 56px)' }}>
              <button onClick={() => { navigate(`/profile/${otherUser.id}`); setShowMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/60 transition-all text-sm text-foreground press"><Eye className="w-4 h-4 text-blue-400" /> View Profile</button>
              <button onClick={() => { toast.success('User blocked'); setShowMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/60 transition-all text-sm text-foreground press"><UserX className="w-4 h-4 text-yellow-400" /> Block User</button>
              <button onClick={() => { toast.success('Reported to admin'); setShowMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/60 transition-all text-sm text-foreground press"><Flag className="w-4 h-4 text-orange-400" /> Report</button>
              <div className="mx-3 border-t border-border/50" />
              <button onClick={() => { setConfirmDelete(true); setShowMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 transition-all text-sm text-red-400 press"><Trash2 className="w-4 h-4" /> Delete Chat</button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-2.5 py-3 relative" style={{ overscrollBehavior: 'contain' }}>
          {/* Decorative chat pattern overlay */}
          <div className="pointer-events-none absolute inset-0 z-0 opacity-50" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cpath d='M10 10 Q15 5 20 10 Q25 15 20 20 Q15 25 10 20 Q5 15 10 10Z' fill='none' stroke='rgba(255,255,255,0.05)' stroke-width='1'/%3E%3Ccircle cx='45' cy='15' r='4' fill='none' stroke='rgba(255,255,255,0.04)' stroke-width='1'/%3E%3Cpath d='M30 35 L40 35 L35 45Z' fill='none' stroke='rgba(255,255,255,0.03)' stroke-width='1'/%3E%3C/svg%3E")`, backgroundRepeat: 'repeat', backgroundSize: '60px 60px' }} />
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full opacity-40 gap-3">
              <MessageCircle className="w-12 h-12 text-primary" />
              <p className="text-sm text-muted-foreground">Start a conversation</p>
            </div>
          )}
          {messages.map((msg, idx) => {
            const isOwn = msg.sender_id === user?.id;
            const prevMsg = messages[idx - 1];
            const isGrouped = prevMsg?.sender_id === msg.sender_id;
            const isSwiping = swipingId === msg.id;
            const replyPreview = (msg as any).reply_preview;
            const replySender = (msg as any).reply_sender;
            const mediaItems = parseMedia(msg);
            const hasMedia = mediaItems.length > 0;
            const hasText = !!msg.message;

            return (
              <div
                key={msg.id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${isGrouped ? 'mt-0.5' : 'mt-2.5'} group animate-fade-in select-none`}
                style={{ transform: isSwiping ? 'translateX(12px)' : 'translateX(0)', transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}
                onTouchStart={e => onTouchStart(e, msg.id)}
                onTouchEnd={e => onTouchEnd(e, msg)}
              >
                {!isOwn && (
                  <div className="w-7 flex-shrink-0 mr-1.5">
                    {!isGrouped ? (
                      <button onClick={() => navigate(`/profile/${msg.sender_id}`)} className="w-7 h-7 rounded-full overflow-hidden bg-muted flex items-center justify-center gradient-pink mt-auto">
                        {otherUser.avatar_url ? <img src={otherUser.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xs font-black text-white">{(otherUser.username || '?')[0].toUpperCase()}</span>}
                      </button>
                    ) : <div className="w-7" />}
                  </div>
                )}
                <div className={`max-w-[70%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`relative rounded-2xl overflow-hidden ${hasMedia && !hasText && !replyPreview ? '' : 'px-3 py-2'}`}
                    style={{ background: hasMedia && !hasText && !replyPreview ? 'transparent' : isOwn ? chatTheme.ownColor : chatTheme.otherColor, fontSize }}
                  >
                    {replyPreview && (
                      <div className={`flex items-start gap-2 mb-2 p-2 rounded-lg border-l-[3px] border-primary ${isOwn ? 'bg-black/20' : 'bg-muted/60'}`}>
                        <Reply className="w-3 h-3 text-primary flex-shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-[10px] text-primary font-bold leading-none mb-0.5">{replySender}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{replyPreview}</p>
                        </div>
                      </div>
                    )}
                    {hasMedia && msg.media_type !== 'audio' && (
                      <div className={hasText || replyPreview ? 'mb-2 -mx-3 -mt-2 rounded-t-2xl overflow-hidden' : ''}>
                        <TelegramMediaGrid
                          items={mediaItems as { url: string; type: 'image' | 'video' }[]}
                          maxWidth={230}
                          onMediaClick={(items, idx) => setMediaViewer({ items, index: idx })}
                        />
                      </div>
                    )}
        {hasText && <p className={`leading-relaxed break-words ${isOwn ? 'text-white' : 'text-foreground'}`}>{msg.message}</p>}
                    {/* Meeting join button in DM */}
                    {msg.message && msg.message.includes('meeting_id:') && (() => {
                      const match = msg.message.match(/meeting_id:([\w-]+)/);
                      const titleMatch = msg.message.match(/\*\*([^*]+)\*\*/);
                      if (!match) return null;
                      return <MeetingJoinButton meetingId={match[1]} title={titleMatch ? titleMatch[1] : 'Meeting'} />;
                    })()}
                    {/* Voice note playback */}
                    {msg.media_url && msg.media_type === 'audio' && (() => {
                      const VN = ({ isOwn: own }: { isOwn: boolean }) => {
                        const [playing, setPlaying] = useState(false);
                        const [ct, setCt] = useState(0);
                        const [dur, setDur] = useState(0);
                        const aRef = useRef<HTMLAudioElement | null>(null);
                        function toggle() {
                          if (!aRef.current) {
                            aRef.current = new Audio(msg.media_url!);
                            aRef.current.onloadedmetadata = () => setDur(aRef.current?.duration || 0);
                            aRef.current.ontimeupdate = () => setCt(aRef.current?.currentTime || 0);
                            aRef.current.onended = () => { setPlaying(false); setCt(0); };
                          }
                          if (playing) { aRef.current.pause(); setPlaying(false); }
                          else { aRef.current.play().then(() => setPlaying(true)).catch(() => {}); }
                        }
                        const progress = dur > 0 ? (ct / dur) * 100 : 0;
                        const bars = 24;
                        const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
                        return (
                          <div className="flex items-center gap-2 min-w-[140px] max-w-[190px] py-1">
                            <button onClick={toggle} className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${own ? 'bg-white/25' : 'gradient-pink'}`}>
                              {playing
                                ? <svg viewBox="0 0 24 24" fill="white" className="w-3.5 h-3.5"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                                : <svg viewBox="0 0 24 24" fill="white" className="w-3.5 h-3.5"><polygon points="5,3 19,12 5,21"/></svg>
                              }
                            </button>
                            <div className="flex flex-col gap-0.5 flex-1">
                              <div className="flex items-center gap-[2px] h-6">
                                {Array.from({ length: bars }).map((_, i) => {
                                  const h = Math.max(15, (Math.sin(i * 0.7 + 1) * 0.35 + 0.45) * 100);
                                  const filled = (i / bars) * 100 <= progress;
                                  return <div key={i} className="flex-1 rounded-full" style={{ height: `${h}%`, background: filled ? (own ? 'rgba(255,255,255,0.85)' : '#FF1493') : (own ? 'rgba(255,255,255,0.3)' : 'rgba(255,20,147,0.22)'), minWidth: 2 }} />;
                                })}
                              </div>
                              <div className="flex justify-between">
                                <span className={`text-[9px] ${own ? 'text-white/60' : 'text-muted-foreground'}`}>{fmt(playing ? ct : 0)}</span>
                                <span className={`text-[9px] ${own ? 'text-white/60' : 'text-muted-foreground'}`}>{fmt(dur)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      };
                      return <VN isOwn={isOwn} />;
                    })()}
                    {(hasText || hasMedia) && (
                      <div className={`flex items-center gap-1 mt-0.5 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        <p className={`text-[10px] leading-none ${isOwn ? 'text-white/50' : 'text-muted-foreground'}`}>{formatTimeFull(msg.created_at)}</p>
                        {isOwn && <MessageTick isRead={msg.is_read} otherOnline={otherIsOnline ?? false} />}
                      </div>
                    )}
                  </div>
                  <div className={`flex items-center gap-1 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                    <button onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }} className="p-1.5 rounded-lg bg-muted/70 hover:bg-muted transition-all press" title="Reply">
                      <Reply className="w-3 h-3 text-muted-foreground" />
                    </button>
                    <button onClick={() => setForwardMsg(msg)} className="p-1.5 rounded-lg bg-muted/70 hover:bg-muted transition-all press" title="Forward">
                      <Share2 className="w-3 h-3 text-muted-foreground" />
                    </button>
                    {isOwn && (
                      <button onClick={() => deleteMessage(msg.id)} className="p-1.5 rounded-lg bg-muted/70 hover:bg-red-500/20 press" title="Delete">
                        <Trash2 className="w-3 h-3 text-red-400" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {isOtherTyping && (
            <div className="flex items-end gap-2 mt-2 animate-fade-in">
              <div className="w-7 h-7 rounded-full overflow-hidden bg-muted flex items-center justify-center gradient-pink flex-shrink-0">
                {otherUser.avatar_url ? <img src={otherUser.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xs font-black text-white">{(otherUser.username || '?')[0].toUpperCase()}</span>}
              </div>
              <div className="px-3 py-2 rounded-2xl" style={{ background: chatTheme.otherColor }}><TypingIndicator /></div>
            </div>
          )}
          <div ref={bottomRef} className="h-2" />
        </div>

        {/* Input */}
        <div className="flex-shrink-0" style={{ background: 'transparent', paddingTop: '8px', paddingLeft: '12px', paddingRight: '12px', paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}>
          {uploadTotal > 0 && <UploadProgress progress={uploadProgress} total={uploadTotal} />}
          <MediaGrid files={selectedFiles} onRemove={i => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))} />
          {replyTo && (
            <div className="flex items-center gap-2 px-3 py-2 mb-2 bg-muted/40 rounded-xl border-l-[3px] border-primary animate-slide-up">
              <Reply className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-primary font-bold leading-none mb-0.5">{replyTo.sender_id === user?.id ? 'You' : otherUser.username || 'Member'}</p>
                <p className="text-xs text-muted-foreground truncate">{replyTo.message || '📎 Media'}</p>
              </div>
              <button onClick={() => setReplyTo(null)} className="p-1 rounded-lg hover:bg-muted press flex-shrink-0"><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center cursor-pointer hover:bg-muted/80 flex-shrink-0 press relative" style={{ background: 'rgba(26,26,26,0.95)', border: '1px solid rgba(255,255,255,0.12)' }}>
              {sending && uploadTotal > 0 ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <ImageIcon className="w-4 h-4 text-muted-foreground" />}
              {selectedFiles.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 gradient-pink rounded-full text-white text-[9px] font-black flex items-center justify-center">{selectedFiles.length}</span>
              )}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileSelect} />
            <input ref={inputRef} value={text} onChange={e => handleTextChange(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()} placeholder={t(lang, 'message_placeholder')} className="flex-1 bg-muted border border-border rounded-2xl px-4 py-2.5 text-foreground placeholder-muted-foreground text-sm outline-none focus:border-primary/50 transition-all" />
            {text.trim() || selectedFiles.length > 0 ? (
              <button onClick={sendMessage} disabled={sending || (!text.trim() && selectedFiles.length === 0)} className="w-10 h-10 gradient-pink rounded-full text-white disabled:opacity-40 flex-shrink-0 flex items-center justify-center pink-glow-xs press transition-all">
                <Send className="w-4 h-4" />
              </button>
            ) : (
              <VoiceNoteRecorder onSend={sendVoiceDM} bucket="media" folder="dm" />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main Messenger ──
export default function Messenger() {
  const { user, profile, isAdmin, lang } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [activeOtherUser, setActiveOtherUser] = useState<UserProfile | null>(null);
  const [showVIPSelector, setShowVIPSelector] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [contextMenuConv, setContextMenuConv] = useState<Conversation | null>(null);
  const [confirmDeleteConv, setConfirmDeleteConv] = useState<Conversation | null>(null);
  const [chatTheme, setChatTheme] = useState({ bg: '#0d0d1a', ownColor: '#FF1493', otherColor: '#1e1e2e', fontSize: 'md' });
  const [messengerTab, setMessengerTab] = useState<'chats' | 'calls'>('chats');
  const [callHistory, setCallHistory] = useState<any[]>([]);
  const [profileStyles, setProfileStylesM] = useState<any>({ tickPosition: 'inline', tickSize: 'xs', tickGap: 'tight' });
  // Persist deleted conversation IDs in localStorage across sessions
  const LS_DELETED_CONVS = 'vaf_deleted_conv_ids';
  function getPersistedDeletedConvIds(): Set<string> {
    try {
      const raw = localStorage.getItem(LS_DELETED_CONVS);
      if (raw) return new Set(JSON.parse(raw));
    } catch {}
    return new Set();
  }
  function persistDeletedConvIds(ids: Set<string>) {
    try { localStorage.setItem(LS_DELETED_CONVS, JSON.stringify(Array.from(ids).slice(-200))); } catch {}
  }
  const deletedConvIds = useRef<Set<string>>(getPersistedDeletedConvIds());
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasAccess = isAdmin || (profile ? isVIPActive(profile) : false);

  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    supabase.from('site_settings').select('chat_wallpaper,chat_bg_color,chat_bubble_color_own,chat_bubble_color_other,chat_font_size,logo_url,website_name,chat_bg_gradient_from,chat_bg_gradient_to,profile_styles').eq('id', 'main').single().then(({ data }) => {
      if (data) {
        const gradFrom = (data as any).chat_bg_gradient_from || '#0d0d1a';
        const gradTo = (data as any).chat_bg_gradient_to || '#1a0026';
        const bg = data.chat_wallpaper
          ? (data.chat_wallpaper.startsWith('linear-gradient') ? data.chat_wallpaper : `url(${data.chat_wallpaper}) center/cover`)
          : `linear-gradient(160deg, ${gradFrom} 0%, ${gradTo} 100%)`;
        setChatTheme({ bg, ownColor: data.chat_bubble_color_own || '#FF1493', otherColor: data.chat_bubble_color_other || '#1e1e2e', fontSize: data.chat_font_size || 'md' });
        if ((data as any).logo_url) setLogoUrl((data as any).logo_url);
        if ((data as any).profile_styles) setProfileStylesM({ tickPosition: 'inline', tickSize: 'xs', tickGap: 'tight', ...(data as any).profile_styles });
      }
    });
  }, []);

  useEffect(() => {
    const targetUserId = searchParams.get('user');
    if (targetUserId && hasAccess && user) openOrCreateConversation(targetUserId);
  }, [searchParams, hasAccess, user]);

  async function fetchConversations() {
    if (!user) return;
    const { data } = await supabase.from('conversations').select('*').or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`).order('last_message_at', { ascending: false });
    if (!data) { setLoading(false); return; }
    // Filter out locally deleted conversations
    const filtered = data.filter(c => !deletedConvIds.current.has(c.id));
    const enriched = await Promise.all(filtered.map(async (conv) => {
      const otherId = conv.participant_one === user.id ? conv.participant_two : conv.participant_one;
      const { data: otherProfile } = await supabase.from('user_profiles').select('*').eq('id', otherId).single();
      const { count } = await supabase.from('direct_messages').select('id', { count: 'exact', head: true }).eq('conversation_id', conv.id).neq('sender_id', user.id).eq('is_read', false).eq('is_deleted', false);
      return { ...conv, other_user: otherProfile, unread_count: count || 0 };
    }));
    setConversations(enriched as Conversation[]);
    setLoading(false);
  }

  useEffect(() => {
    if (!hasAccess) { setLoading(false); return; }
    fetchConversations();
    const interval = setInterval(fetchConversations, 4000);
    return () => clearInterval(interval);
  }, [user, hasAccess]);

  // Fetch call history
  useEffect(() => {
    if (!user || !hasAccess) return;
    supabase.from('calls')
      .select('*, caller:user_profiles!calls_caller_id_fkey(id,username,avatar_url), callee:user_profiles!calls_callee_id_fkey(id,username,avatar_url)')
      .or(`caller_id.eq.${user.id},callee_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => { if (data) setCallHistory(data); });
  }, [user, hasAccess]);

  async function openOrCreateConversation(otherUserId: string) {
    if (!user) return;
    const p1 = user.id < otherUserId ? user.id : otherUserId;
    const p2 = user.id < otherUserId ? otherUserId : user.id;
    let { data: existing } = await supabase.from('conversations').select('*').eq('participant_one', p1).eq('participant_two', p2).single();
    if (!existing) {
      const { data: created } = await supabase.from('conversations').insert({ participant_one: p1, participant_two: p2 }).select().single();
      existing = created;
    }
    if (existing) {
      const { data: otherProfile } = await supabase.from('user_profiles').select('*').eq('id', otherUserId).single();
      setActiveConvId(existing.id);
      setActiveOtherUser(otherProfile);
    }
  }

  async function deleteConversation(conv: Conversation) {
    try {
      // Mark as deleted in ref AND persist to localStorage
      deletedConvIds.current.add(conv.id);
      persistDeletedConvIds(deletedConvIds.current);
      // Remove from UI immediately
      setConversations(prev => prev.filter(c => c.id !== conv.id));
      if (activeConvId === conv.id) {
        setActiveConvId(null);
        setActiveOtherUser(null);
      }
      // Delete from DB
      await supabase.from('direct_messages').delete().eq('conversation_id', conv.id);
      await supabase.from('conversations').delete().eq('id', conv.id);
      toast.success('Chat deleted');
      setConfirmDeleteConv(null);
    } catch {
      // Restore on failure
      deletedConvIds.current.delete(conv.id);
      persistDeletedConvIds(deletedConvIds.current);
      toast.error('Failed to delete chat');
      fetchConversations();
    }
  }

  function startLongPress(conv: Conversation) { longPressTimer.current = setTimeout(() => setContextMenuConv(conv), 500); }
  function cancelLongPress() { if (longPressTimer.current) clearTimeout(longPressTimer.current); }

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
  const filtered = conversations.filter(c => !searchQuery || (c.other_user?.username || '').toLowerCase().includes(searchQuery.toLowerCase()));

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ paddingTop: '80px' }}>
        <Lock className="w-12 h-12 text-primary mb-3 opacity-60" />
        <h2 className="text-xl font-black text-foreground mb-2">{t(lang, 'login_required')}</h2>
        <button onClick={() => navigate('/auth')} className="px-6 py-3 gradient-pink rounded-2xl text-white font-bold press pink-glow-xs">Login / Register</button>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center" style={{ paddingTop: '80px' }}>
        <div className="w-20 h-20 rounded-3xl gradient-pink flex items-center justify-center mx-auto mb-4 pink-glow animate-float"><Crown className="w-10 h-10 text-white" /></div>
        <h2 className="text-xl font-black text-foreground mb-2">{t(lang, 'premium_only')}</h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-xs">Upgrade to VIP to access the private messenger and connect with other premium members.</p>
        <button onClick={() => setShowVIPSelector(true)} className="px-6 py-3 gradient-pink rounded-2xl text-white font-bold press pink-glow">{t(lang, 'upgrade_vip')}</button>
        {showVIPSelector && <VIPPlanSelector onClose={() => setShowVIPSelector(false)} />}
      </div>
    );
  }

  return (
    <>
      {confirmDeleteConv && (
        <ConfirmDialog
          title={t(lang, 'delete_chat')}
          message={`Are you sure you want to delete the conversation with ${confirmDeleteConv.other_user?.username || 'this member'}? All messages will be removed permanently.`}
          danger
          onConfirm={() => deleteConversation(confirmDeleteConv)}
          onCancel={() => setConfirmDeleteConv(null)}
        />
      )}
      {contextMenuConv && (
        <ConvContextMenu
          conv={contextMenuConv}
          onClose={() => setContextMenuConv(null)}
          onDelete={() => { setContextMenuConv(null); setConfirmDeleteConv(contextMenuConv); }}
          onBlock={() => toast.success('Block feature coming soon')}
          onReport={() => toast.success('Reported to admin')}
          onViewProfile={() => { navigate(`/profile/${contextMenuConv.other_user?.id}`); setContextMenuConv(null); }}
        />
      )}

      {/* Full-screen messenger list */}
      <div className="fixed inset-0 flex flex-col bg-background animate-fade-in" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        {/* Header — BLACK PILL exactly like image: back arrow + [VM logo + VISION AVAX FOREX + blue tick] center pill + WhatsApp */}
        <div className="flex items-center gap-2 px-3 py-3 flex-shrink-0" style={{ background: 'transparent' }}>
          <button onClick={() => navigate('/')} className="w-9 h-9 rounded-full bg-[#1a1a1a] flex items-center justify-center press hover:bg-[#222]" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>

          {/* CENTER pill */}
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="w-7 h-7 rounded-full gradient-pink flex items-center justify-center flex-shrink-0 overflow-hidden">
                {logoUrl
                  ? <img src={logoUrl} alt="" className="w-full h-full object-cover" />
                  : profile?.avatar_url
                    ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                    : <span className="text-[9px] font-black text-white">VM</span>
                }
              </div>
              <span className="font-black text-white text-sm tracking-tight whitespace-nowrap">VISION AVAX FOREX</span>
              {/* Badge in header — apply profileStyles */}
              {profileStyles.tickPosition === 'below'
                ? null
                : <VIPBadge size={(profileStyles.tickSize || 'xs') as any} badgeStyle={((profile as any)?.badge_style as BadgeStyle) || 'blue_burst'} />
              }
            </div>
          </div>

          {/* Right: WhatsApp */}
          <a
            href="https://wa.me/255746715235"
            target="_blank" rel="noopener noreferrer"
            className="w-9 h-9 rounded-full flex items-center justify-center press flex-shrink-0"
            style={{ background: '#25D366', boxShadow: '0 2px 12px rgba(37,211,102,0.4)' }}
          >
            <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </a>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto pb-20">
          <div className="px-4 mt-3 mb-3">
            <div className="relative">
              <svg className="absolute left-3.5 top-3 w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
              <input className="w-full bg-muted border border-border rounded-2xl pl-10 pr-4 py-2.5 text-foreground placeholder-muted-foreground text-sm outline-none focus:border-primary/50 transition-all" placeholder={t(lang, 'search_conversations')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
          </div>

          {loading ? (
            <div className="px-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-[60px] bg-muted/30 rounded-2xl animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-3"><MessageCircle className="w-8 h-8 text-muted-foreground opacity-40" /></div>
              <p className="text-foreground font-bold mb-1">{t(lang, 'no_conversations')}</p>
              <p className="text-xs text-muted-foreground mb-4">{t(lang, 'start_chatting')}</p>
            </div>
          ) : (
            <div className="px-4 space-y-1">
              {filtered.map(conv => {
                const other = conv.other_user;
                const unread = conv.unread_count || 0;
                const otherBadge = ((other as any)?.badge_style as BadgeStyle) || 'blue_burst';
                const isOtherTyping = (() => {
                  if (!user) return false;
                  const isP1 = conv.participant_one === user.id;
                  const otherTypingAt = isP1 ? (conv as any).participant_two_typing_at : (conv as any).participant_one_typing_at;
                  if (!otherTypingAt) return false;
                  return Date.now() - new Date(otherTypingAt).getTime() < 4000;
                })();
                return (
                  <div
                    key={conv.id}
                    className="relative"
                    onMouseDown={() => startLongPress(conv)}
                    onMouseUp={cancelLongPress}
                    onMouseLeave={cancelLongPress}
                    onTouchStart={() => startLongPress(conv)}
                    onTouchEnd={cancelLongPress}
                    onContextMenu={e => { e.preventDefault(); setContextMenuConv(conv); }}
                  >
                    <button
                      onClick={() => {
                        // Persist read state so header badge doesn't bounce back
                        try {
                          const rMap = JSON.parse(localStorage.getItem('vaf_dm_read_conv_map') || '{}');
                          rMap[conv.id] = Date.now();
                          localStorage.setItem('vaf_dm_read_conv_map', JSON.stringify(rMap));
                        } catch {}
                        setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c));
                        setActiveConvId(conv.id);
                        setActiveOtherUser(other || null);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 bg-card border rounded-2xl hover:border-primary/25 active:scale-[0.98] transition-all text-left ${unread > 0 ? 'border-primary/30' : 'border-border'}`}
                    >
                      <div className="relative flex-shrink-0">
                        <div className="w-11 h-11 rounded-full overflow-hidden bg-muted flex items-center justify-center gradient-pink">
                          {other?.avatar_url ? <img src={other.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-sm font-black text-white">{(other?.username || '?')[0].toUpperCase()}</span>}
                        </div>
                        <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background transition-colors ${other?.is_online ? 'bg-green-400' : 'bg-muted-foreground/40'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className={`text-sm truncate ${unread > 0 ? 'font-black text-foreground' : 'font-bold text-foreground'}`}>{other?.username || other?.full_name || 'Member'}</p>
                            {other?.blue_tick && (
                              profileStyles.tickPosition === 'below'
                                ? null // handled below
                                : <VIPBadge size={(profileStyles.tickSize as any) || 'xs'} badgeStyle={otherBadge} />
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">{formatTime(conv.last_message_at)}</p>
                        </div>
                        {other?.blue_tick && profileStyles.tickPosition === 'below' && (
                          <VIPBadge size={(profileStyles.tickSize as any) || 'xs'} badgeStyle={otherBadge} />
                        )}
                        <p className={`text-xs truncate transition-colors ${isOtherTyping ? 'text-primary font-medium' : unread > 0 ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                          {isOtherTyping ? t(lang, 'typing') : conv.last_message || 'Start chatting...'}
                        </p>
                      </div>
                      {unread > 0 && <UnreadBadge count={unread} />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* New Chat FAB */}
      <button
        onClick={() => setShowNewChat(true)}
        className="fixed right-4 w-14 h-14 gradient-pink rounded-2xl text-white flex items-center justify-center pink-glow press z-50 shadow-2xl"
        style={{ boxShadow: '0 8px 32px rgba(255,20,147,0.4)', bottom: 'max(24px, env(safe-area-inset-bottom))' }}
      >
        <Plus className="w-6 h-6" />
      </button>

      {showNewChat && user && (
        <NewChatPopup currentUserId={user.id} lang={lang} onSelect={openOrCreateConversation} onClose={() => setShowNewChat(false)} />
      )}

      {activeConvId && activeOtherUser && (
        <ChatView
          conversationId={activeConvId}
          otherUser={activeOtherUser}
          chatTheme={chatTheme}
          profileStyles={profileStyles}
          onBack={() => { setActiveConvId(null); setActiveOtherUser(null); fetchConversations(); }}
      onDelete={() => { 
        if (activeConvId) {
          deletedConvIds.current.add(activeConvId);
          persistDeletedConvIds(deletedConvIds.current);
        }
        setActiveConvId(null); setActiveOtherUser(null); 
        setConversations(prev => prev.filter(c => c.id !== activeConvId));
      }}
        />
      )}
    </>
  );
}
