import { useState, useEffect } from 'react';
import { Crown, Trash2, VolumeX, Volume2, Users, BarChart3, MessageSquare, Image, Save, Camera, Palette, Type, Megaphone, Send } from 'lucide-react';
import { supabase, uploadFile } from '@/lib/supabase';
import { VIPMessage, UserProfile } from '@/types';
import { toast } from 'sonner';

const FONT_SIZE_OPTIONS = [
  { key: 'xs', label: 'XS', px: '11px' }, { key: 'sm', label: 'Sm', px: '13px' },
  { key: 'md', label: 'Md', px: '14px' }, { key: 'lg', label: 'Lg', px: '16px' },
  { key: 'xl', label: 'XL', px: '18px' }, { key: '2xl', label: '2XL', px: '20px' },
];
const FONT_FAMILY_OPTIONS = [
  { key: 'default', label: 'Default' }, { key: 'inter', label: 'Inter' },
  { key: 'roboto', label: 'Roboto' }, { key: 'poppins', label: 'Poppins' },
  { key: 'mono', label: 'Monospace' }, { key: 'serif', label: 'Serif' },
  { key: 'cursive', label: 'Cursive' }, { key: 'ubuntu', label: 'Ubuntu' },
];

export default function AdminVIPRoom() {
  const [messages, setMessages] = useState<(VIPMessage & { user_profiles: any })[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, members: 0, online: 0 });
  const [activeTab, setActiveTab] = useState<'messages' | 'settings'>('messages');
  const [announcementText, setAnnouncementText] = useState('');
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);

  // Room settings state
  const [roomName, setRoomName] = useState('');
  const [roomIcon, setRoomIcon] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadingWp, setUploadingWp] = useState(false);
  const [vipWallpaper, setVipWallpaper] = useState('');
  const [vipBgColor, setVipBgColor] = useState('#0d0d1a');
  const [vipBubbleOwn, setVipBubbleOwn] = useState('#FF1493');
  const [vipBubbleOther, setVipBubbleOther] = useState('#1e1e2e');
  const [vipFontSize, setVipFontSize] = useState('md');
  const [vipFontFamily, setVipFontFamily] = useState('default');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
    fetchSettings();
  }, []);

  async function fetchSettings() {
    const { data } = await supabase.from('site_settings')
      .select('website_name, logo_url, vip_wallpaper, vip_bg_color, vip_bubble_color_own, vip_bubble_color_other, vip_font_size, vip_font_family')
      .eq('id', 'main').single();
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
  }

  async function fetchData() {
    setLoading(true);
    const [msgRes, membersRes, onlineRes] = await Promise.all([
      supabase.from('vip_messages').select('*, user_profiles(*)').eq('is_deleted', false).order('created_at', { ascending: false }).limit(50),
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('is_vip', true),
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('is_online', true),
    ]);
    if (msgRes.data) setMessages(msgRes.data as any);
    setStats({ total: msgRes.data?.length || 0, members: membersRes.count || 0, online: onlineRes.count || 0 });
    setLoading(false);
  }

  async function deleteMessage(id: string) {
    await supabase.from('vip_messages').update({ is_deleted: true }).eq('id', id);
    toast.success('Message deleted');
    fetchData();
  }

  async function muteUser(userId: string, isMuted: boolean) {
    await supabase.from('user_profiles').update({ is_muted: !isMuted }).eq('id', userId);
    toast.success(isMuted ? 'User unmuted' : 'User muted');
    fetchData();
  }

  async function handleIconUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const url = await uploadFile('banners', `room_icon_${Date.now()}`, file);
    setRoomIcon(url);
    setUploading(false);
    toast.success('Icon uploaded');
  }

  async function handleWallpaperUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingWp(true);
    const url = await uploadFile('banners', `vip_wallpaper_${Date.now()}`, file);
    setVipWallpaper(url);
    setUploadingWp(false);
    toast.success('Wallpaper uploaded');
    e.target.value = '';
  }

  async function sendAnnouncement() {
    if (!announcementText.trim()) return toast.error('Enter announcement text');
    setSendingAnnouncement(true);
    // Get admin profile id
    const { data: adminProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', 'visionavaxforex@gmail.com')
      .single();
    if (!adminProfile) {
      toast.error('Admin profile not found');
      setSendingAnnouncement(false);
      return;
    }
    const { error } = await supabase.from('vip_messages').insert({
      user_id: adminProfile.id,
      message: announcementText.trim(),
      is_announcement: true,
      is_pinned: false,
    });
    if (error) {
      toast.error('Failed to send: ' + error.message);
    } else {
      toast.success('📢 Announcement posted to VIP Room!');
      setAnnouncementText('');
      fetchData();
    }
    setSendingAnnouncement(false);
  }

  async function saveSettings() {
    setSaving(true);
    const { error } = await supabase.from('site_settings').update({
      website_name: roomName,
      logo_url: roomIcon,
      vip_wallpaper: vipWallpaper || null,
      vip_bg_color: vipBgColor,
      vip_bubble_color_own: vipBubbleOwn,
      vip_bubble_color_other: vipBubbleOther,
      vip_font_size: vipFontSize,
      vip_font_family: vipFontFamily,
    } as any).eq('id', 'main');
    if (error) {
      toast.error(`Save failed: ${error.message}`);
    } else {
      toast.success('VIP Room settings saved!');
      fetchSettings();
    }
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Messages', value: stats.total, icon: MessageSquare, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'VIP Members', value: stats.members, icon: Crown, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
          { label: 'Online', value: stats.online, icon: Users, color: 'text-green-400', bg: 'bg-green-500/10' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
            <Icon className={`w-4 h-4 ${color} mx-auto mb-1`} />
            <p className={`text-sm font-black ${color}`}>{value}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { key: 'messages', label: 'Messages', icon: MessageSquare },
          { key: 'settings', label: 'Room Settings', icon: Palette },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key as any)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all press ${activeTab === key ? 'gradient-pink text-white pink-glow-xs' : 'bg-card border border-border text-muted-foreground'}`}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {activeTab === 'messages' && (
        <div className="space-y-4">
        {/* ── Broadcast Announcement ── */}
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/25 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-2xl gradient-pink flex items-center justify-center flex-shrink-0">
              <Megaphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-black text-foreground text-sm">Broadcast Announcement</p>
              <p className="text-xs text-muted-foreground">Posts a pinned admin message in VIP Room</p>
            </div>
          </div>
          <textarea
            className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary resize-none mb-3 transition-all"
            placeholder="Type your announcement here..."
            rows={3}
            value={announcementText}
            onChange={e => setAnnouncementText(e.target.value)}
          />
          <button
            onClick={sendAnnouncement}
            disabled={sendingAnnouncement || !announcementText.trim()}
            className="w-full py-3 gradient-pink rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 press pink-glow-xs disabled:opacity-50"
          >
            {sendingAnnouncement
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending...</>
              : <><Send className="w-4 h-4" /> Send Announcement to VIP Room</>
            }
          </button>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" /> Recent Messages
          </h3>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 bg-muted/30 rounded-xl animate-pulse" />)}</div>
          ) : messages.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-6">No messages yet</p>
          ) : (
            <div className="space-y-2">
              {messages.map(msg => {
                const sender = msg.user_profiles;
                return (
                  <div key={msg.id} className="flex items-start gap-3 p-3 bg-muted/20 rounded-xl">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-muted flex-shrink-0">
                      {sender?.avatar_url ? <img src={sender.avatar_url} alt="" className="w-full h-full object-cover" /> : (
                        <div className="w-full h-full gradient-pink flex items-center justify-center text-white text-xs font-black">
                          {(sender?.username || '?')[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground">{sender?.username || 'Member'}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{msg.message || '📎 Media'}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {sender?.id && (
                        <button onClick={() => muteUser(sender.id, sender.is_muted)} className="p-1.5 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 press">
                          {sender.is_muted ? <Volume2 className="w-3 h-3 text-yellow-400" /> : <VolumeX className="w-3 h-3 text-yellow-400" />}
                        </button>
                      )}
                      <button onClick={() => deleteMessage(msg.id)} className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 press">
                        <Trash2 className="w-3 h-3 text-red-400" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-4">
          {/* Room Identity */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
              <Crown className="w-4 h-4 text-primary" /> Room Identity
            </h3>
            <div className="flex items-center gap-4 mb-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-muted flex items-center justify-center gradient-pink">
                  {roomIcon ? <img src={roomIcon} alt="" className="w-full h-full object-cover" /> : <Crown className="w-8 h-8 text-white" />}
                </div>
                <label className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full gradient-pink flex items-center justify-center cursor-pointer press shadow-lg">
                  {uploading ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Camera className="w-3 h-3 text-white" />}
                  <input type="file" accept="image/*" className="hidden" onChange={handleIconUpload} />
                </label>
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Room Name</label>
                <input className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary" value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="VIP Room name" />
              </div>
            </div>
          </div>

          {/* Background */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
              <Image className="w-4 h-4 text-primary" /> Chat Background
            </h3>
            <div className="mb-3">
              <label className="text-xs text-muted-foreground mb-1 block font-medium">Background Color</label>
              <div className="flex gap-2">
                <input type="color" value={vipBgColor} onChange={e => setVipBgColor(e.target.value)} className="w-10 h-9 rounded-lg border border-border cursor-pointer bg-transparent" />
                <input value={vipBgColor} onChange={e => setVipBgColor(e.target.value)} className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block font-medium">Custom Wallpaper</label>
              <label className="flex items-center gap-2 p-3 border border-dashed border-primary/35 rounded-xl cursor-pointer hover:bg-primary/5 transition-all">
                {uploadingWp ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Image className="w-4 h-4 text-primary" />}
                <span className="text-sm text-muted-foreground flex-1">{vipWallpaper ? '✓ Wallpaper set' : 'Upload Wallpaper Image'}</span>
                {vipWallpaper && <button type="button" onClick={() => setVipWallpaper('')} className="text-red-400 text-xs px-2">Clear</button>}
                <input type="file" accept="image/*" className="hidden" onChange={handleWallpaperUpload} />
              </label>
            </div>
          </div>

          {/* Bubble Colors */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
              <Palette className="w-4 h-4 text-primary" /> Chat Bubble Colors
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Your Messages (Sent)</label>
                <div className="flex gap-2">
                  <input type="color" value={vipBubbleOwn} onChange={e => setVipBubbleOwn(e.target.value)} className="w-10 h-9 rounded-lg border border-border cursor-pointer bg-transparent" />
                  <input value={vipBubbleOwn} onChange={e => setVipBubbleOwn(e.target.value)} className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Others' Messages (Received)</label>
                <div className="flex gap-2">
                  <input type="color" value={vipBubbleOther} onChange={e => setVipBubbleOther(e.target.value)} className="w-10 h-9 rounded-lg border border-border cursor-pointer bg-transparent" />
                  <input value={vipBubbleOther} onChange={e => setVipBubbleOther(e.target.value)} className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none" />
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="mt-3 rounded-xl p-3 overflow-hidden" style={{ background: vipWallpaper ? `url(${vipWallpaper}) center/cover` : vipBgColor }}>
              <div className="flex justify-end mb-2">
                <div className="px-3 py-1.5 rounded-2xl" style={{ background: vipBubbleOwn }}><p className="text-white text-xs">Hello! 👋</p></div>
              </div>
              <div className="flex justify-start">
                <div className="px-3 py-1.5 rounded-2xl" style={{ background: vipBubbleOther }}><p className="text-foreground text-xs">Great signal! 📈</p></div>
              </div>
            </div>
          </div>

          {/* Font Size */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
              <Type className="w-4 h-4 text-primary" /> Font Settings
            </h3>
            <label className="text-xs text-muted-foreground mb-2 block font-medium">Font Size</label>
            <div className="grid grid-cols-6 gap-1.5 mb-3">
              {FONT_SIZE_OPTIONS.map(fs => (
                <button key={fs.key} onClick={() => setVipFontSize(fs.key)}
                  className={`py-2.5 rounded-xl border-2 transition-all press text-center ${vipFontSize === fs.key ? 'border-primary bg-primary/10' : 'border-border bg-muted/30'}`}>
                  <p className="font-black text-foreground" style={{ fontSize: fs.px }}>Aa</p>
                  <p className="text-[9px] text-muted-foreground">{fs.label}</p>
                </button>
              ))}
            </div>
            <label className="text-xs text-muted-foreground mb-2 block font-medium">Font Style</label>
            <div className="grid grid-cols-2 gap-1.5">
              {FONT_FAMILY_OPTIONS.map(ff => (
                <button key={ff.key} onClick={() => setVipFontFamily(ff.key)}
                  className={`py-2 px-3 rounded-xl border-2 text-sm font-bold text-left transition-all press ${vipFontFamily === ff.key ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/30 text-muted-foreground'}`}>
                  {ff.label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={saveSettings} disabled={saving} className="w-full flex items-center justify-center gap-2 py-3 gradient-pink rounded-xl text-white font-bold press pink-glow-xs disabled:opacity-50">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save VIP Room Settings'}
          </button>
        </div>
      )}
    </div>
  );
}
