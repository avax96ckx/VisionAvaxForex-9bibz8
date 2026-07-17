// Fix Settings: edit profile name/username - no auto-refill, use separate edit state
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Crown, Bell, Moon, Sun, HelpCircle, LogOut, Camera, Edit2, Shield,
  ChevronRight, CheckCircle, User, Download, Gift, Phone,
  Eye, EyeOff, MessageCircle, ArrowLeft, Globe, X, BellRing, BellOff
} from 'lucide-react';
import { requestBrowserNotificationPermission, canShowBrowserNotification } from '@/lib/browserNotifications';
import LiveAgentChat from '@/components/features/LiveAgentChat';
import ImageCropper from '@/components/features/ImageCropper';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, uploadFile, isVIPActive, openWhatsApp, WHATSAPP_NUMBER, generateReferralCode } from '@/lib/supabase';
import { t } from '@/lib/i18n';
import VIPBadge from '@/components/features/VIPBadge';
import BadgeSelector from '@/components/features/BadgeSelector';
import APKSection from '@/components/features/APKSection';
import NotificationCenter from '@/components/features/NotificationCenter';
import VIPPlanSelector from '@/components/features/VIPPlanSelector';
import { toast } from 'sonner';
import type { BadgeStyle } from '@/types';

const DEFAULT_SETTINGS_ORDER = ['live_agent', 'messenger', 'language', 'theme', 'apk', 'notifications', 'help', 'logout'];

export default function Settings() {
  const { user, profile, isAdmin, logout, refreshProfile, theme, toggleTheme, lang, setLang } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  // Separate edit state — only initialized when edit starts, not auto-synced
  const [editUsername, setEditUsername] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [phonePrivacy, setPhonePrivacy] = useState<'public' | 'private'>('private');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralStats, setReferralStats] = useState({ registrations: 0, payments: 0 });
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLiveAgent, setShowLiveAgent] = useState(false);
  const [_uploadingCover] = useState(false);
  const [showBadgeSelector, setShowBadgeSelector] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [coverCropFile] = useState<File | null>(null);
  const [avatarCropFile, setAvatarCropFile] = useState<File | null>(null);
  const [globalCoverUrl, setGlobalCoverUrl] = useState<string>('');
  const [showVIPSelector, setShowVIPSelector] = useState(false);
  const [settingsOrder, setSettingsOrder] = useState<string[]>(DEFAULT_SETTINGS_ORDER);
  const [cropDisabled, setCropDisabled] = useState(false);
  const [notifPermission, setNotifPermission] = useState<'granted' | 'denied' | 'default'>(() => {
    if (!('Notification' in window)) return 'denied';
    return Notification.permission as 'granted' | 'denied' | 'default';
  });
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const avatarFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from('site_settings').select('global_cover_url,settings_order,crop_disabled').eq('id', 'main').single()
      .then(({ data }) => {
        if (data) {
          if ((data as any).global_cover_url) setGlobalCoverUrl((data as any).global_cover_url);
          if (Array.isArray((data as any).settings_order) && (data as any).settings_order.length > 0) {
            setSettingsOrder((data as any).settings_order);
          }
          setCropDisabled(!!(data as any).crop_disabled);
        }
      });
  }, []);

  useEffect(() => {
    if (!user) return;
    const checkUnread = async () => {
      const { data: convs } = await supabase.from('conversations').select('id').or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`);
      if (!convs) return;
      let total = 0;
      await Promise.all(convs.map(async (c) => {
        const { count } = await supabase.from('direct_messages').select('id', { count: 'exact', head: true }).eq('conversation_id', c.id).neq('sender_id', user.id).eq('is_read', false).eq('is_deleted', false);
        total += count || 0;
      }));
      setUnreadMessages(total);
    };
    checkUnread();
    const interval = setInterval(checkUnread, 8000);
    return () => clearInterval(interval);
  }, [user]);

  // DO NOT auto-sync edit fields from profile — only init when opening editor
  useEffect(() => {
    setPhonePrivacy((profile?.phone_privacy as 'public' | 'private') || 'private');
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    supabase.from('referral_links').select('*').eq('owner_user_id', user.id).single().then(({ data, error }) => {
      if (data) {
        setReferralCode(data.code);
        setReferralStats({ registrations: data.registrations || 0, payments: data.paying_referrals || 0 });
      } else {
        // Create referral code for this user (RLS now allows authenticated users to insert their own)
        const code = generateReferralCode(user.id);
        supabase.from('referral_links').insert({ code, label: user.email, owner_user_id: user.id })
          .select().single()
          .then(({ data: d }) => { if (d) setReferralCode(d.code); });
      }
    });
    supabase.from('user_profiles').update({ is_online: true, last_seen: new Date().toISOString() }).eq('id', user.id);
    // Set offline on unmount
    return () => {
      supabase.from('user_profiles').update({ is_online: false, last_seen: new Date().toISOString() }).eq('id', user.id);
    };
  }, [user]);

  function startEditing() {
    // Initialize edit fields ONLY when clicking Edit
    setEditUsername(profile?.username || user?.username || '');
    setEditFullName(profile?.full_name || '');
    setEditPhone(profile?.phone_number || '');
    setPhonePrivacy((profile?.phone_privacy as 'public' | 'private') || 'private');
    setEditing(true);
  }

  const hasVIP = isAdmin || (profile ? isVIPActive(profile) : false);

  async function handleSaveProfile() {
    if (!user) return;
    setSaving(true);
    await supabase.from('user_profiles').update({
      username: editUsername,
      full_name: editFullName,
      phone_number: editPhone,
      phone_privacy: phonePrivacy,
    }).eq('id', user.id);
    await refreshProfile();
    setEditing(false);
    toast.success('Profile updated!');
    setSaving(false);
  }

  function handleAvatarFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { toast.error('Please select JPG, PNG or WEBP'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Image must be under 10MB'); return; }
    if (cropDisabled) {
      // Skip cropper — upload directly
      handleAvatarCropped(file);
    } else {
      setAvatarCropFile(file);
    }
    e.target.value = '';
  }

  async function handleAvatarCropped(blob: Blob) {
    if (!user) return;
    setAvatarCropFile(null);
    setUploading(true);
    try {
      const file = new File([blob], `avatar_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const url = await uploadFile('avatars', `${user.id}/avatar_${Date.now()}`, file);
      await supabase.from('user_profiles').update({ avatar_url: url }).eq('id', user.id);
      await refreshProfile();
      toast.success('Photo updated!');
    } catch { toast.error('Upload failed. Please try again.'); }
    finally { setUploading(false); }
  }

  async function handleBadgeSelect(style: BadgeStyle) {
    if (!user) return;
    await supabase.from('user_profiles').update({ badge_style: style } as any).eq('id', user.id);
    await refreshProfile();
    toast.success('Badge updated!');
  }

  function copyReferral() {
    if (!referralCode) return;
    const link = `${window.location.origin}?ref=${referralCode}`;
    navigator.clipboard.writeText(link);
    toast.success('Referral link copied!');
  }

  const hasBadge = (profile?.blue_tick || isAdmin || hasVIP);
  const badgeStyle = ((profile as any)?.badge_style as BadgeStyle) || 'blue_burst';

  if (!user) {
    return (
      <div className="min-h-screen pb-24 flex flex-col items-center justify-center px-4 animate-fade-in" style={{ paddingTop: '80px' }}>
        <div className="w-20 h-20 rounded-3xl bg-muted flex items-center justify-center mx-auto mb-4">
          <User className="w-10 h-10 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-black text-foreground mb-2">Not Logged In</h2>
        <p className="text-muted-foreground text-sm mb-6 text-center">Login to access your profile and settings</p>
        <button onClick={() => navigate('/auth')} className="px-6 py-3 gradient-pink rounded-2xl text-white font-bold pink-glow press">Login / Register</button>
      </div>
    );
  }

  const coverUrl = (profile as any)?.cover_url || globalCoverUrl;

  return (
    <div className="min-h-screen pb-24 animate-fade-in">
      {/* Image Croppers */}
      {coverCropFile && null}
      {avatarCropFile && (
        <ImageCropper imageFile={avatarCropFile} aspectRatio={1} isCircular={true} title="Crop Profile Photo"
          onCrop={handleAvatarCropped} onCancel={() => setAvatarCropFile(null)} />
      )}
      {showNotifications && <NotificationCenter onClose={() => setShowNotifications(false)} />}
      {showLiveAgent && <LiveAgentChat onClose={() => setShowLiveAgent(false)} />}
      {showVIPSelector && <VIPPlanSelector onClose={() => setShowVIPSelector(false)} />}
      {showBadgeSelector && (
        <BadgeSelector currentStyle={badgeStyle} isVIP={hasVIP} onSelect={handleBadgeSelect}
          onClose={() => setShowBadgeSelector(false)} onUpgrade={() => setShowVIPSelector(true)} />
      )}

      {/* ── Profile Hero ── */}
      <div className="relative">
        <div className="relative" style={{ height: '48vw', maxHeight: 230, minHeight: 160 }}>
          {coverUrl
            ? <img src={coverUrl} alt="cover" className="w-full h-full object-cover" />
            : (
              <div className="w-full h-full"
                style={{ background: 'linear-gradient(135deg, #3D0033 0%, #7B0055 35%, #CC006A 65%, #FF1493 100%)' }}>
                <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 30% 70%, rgba(255,255,255,0.18) 0%, transparent 50%)' }} />
              </div>
            )
          }
          <button onClick={() => navigate(-1)} className="absolute top-3 left-3 w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center press"
            style={{ marginTop: 'max(0px, env(safe-area-inset-top))' }}>
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          {/* Change Cover removed — contact admin to update cover */}
        </div>

        <div className="flex justify-center" style={{ marginTop: '-48px', position: 'relative', zIndex: 10 }}>
          <div className="relative">
            <div className="rounded-full p-[4px]" style={{ background: 'linear-gradient(135deg, #FF1493, #FF69B4, #FF1493)', boxShadow: '0 0 0 3px hsl(var(--background))' }}>
              <div className="w-[88px] h-[88px] rounded-full overflow-hidden bg-muted flex items-center justify-center gradient-pink relative">
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                  : <span className="text-3xl font-black text-white">{(user.username || user.email)?.[0]?.toUpperCase()}</span>
                }
                {uploading && (
                  <div className="absolute inset-0 bg-black/55 rounded-full flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </div>
            <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-green-400 border-[3px] border-background" />
            <button type="button" onClick={() => avatarFileRef.current?.click()}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full gradient-pink flex items-center justify-center press shadow-xl border-2 border-background">
              {uploading
                ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Camera className="w-3.5 h-3.5 text-white" />
              }
            </button>
            <input ref={avatarFileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarFileSelect} />
          </div>
        </div>

        <div className="flex flex-col items-center px-6 mt-3 mb-1">
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <h2 className="text-xl font-black text-foreground">{profile?.full_name || user.username || 'Member'}</h2>
            {hasBadge && <VIPBadge size="lg" badgeStyle={badgeStyle} animate onClick={() => setShowBadgeSelector(true)} />}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">@{profile?.username || user.username}</p>
          {hasBadge && <p className="text-[10px] text-muted-foreground">Tap badge to customize</p>}
          {isAdmin && <span className="mt-1.5 text-[10px] px-2.5 py-0.5 gradient-pink rounded-full text-white font-black">⚡ Super Admin</span>}
        </div>
      </div>

      <div className="px-3 mt-4 mb-2">
        <h1 className="text-lg font-black text-foreground">Settings</h1>
        <p className="text-xs text-muted-foreground">Manage your account & preferences</p>
      </div>

      {/* Profile edit card */}
      <div className="mx-3 mb-4 bg-card border border-border rounded-3xl p-5 glass-card">
        <div className="flex items-center justify-between mb-3">
          <p className="font-bold text-foreground text-sm">Edit Profile</p>
          {editing
            ? <button onClick={() => setEditing(false)} className="p-2 rounded-xl bg-muted hover:bg-muted/80 press"><X className="w-4 h-4 text-muted-foreground" /></button>
            : <button onClick={startEditing} className="p-2 rounded-xl bg-muted hover:bg-muted/80 press"><Edit2 className="w-4 h-4 text-muted-foreground" /></button>
          }
        </div>

        {editing && (
          <div className="space-y-3 animate-slide-up">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block font-medium">Username</label>
              <input
                className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-foreground text-sm outline-none focus:border-primary transition-all"
                value={editUsername}
                onChange={e => setEditUsername(e.target.value)}
                placeholder="Enter username"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block font-medium">Full Name</label>
              <input
                className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-foreground text-sm outline-none focus:border-primary transition-all"
                value={editFullName}
                onChange={e => setEditFullName(e.target.value)}
                placeholder="Enter full name"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block font-medium flex items-center gap-1">
                <Phone className="w-3 h-3" /> Phone Number
              </label>
              <input
                className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-foreground text-sm outline-none focus:border-primary transition-all"
                value={editPhone}
                onChange={e => setEditPhone(e.target.value)}
                placeholder="+255..."
                type="tel"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block font-medium">Phone Privacy</label>
              <div className="flex gap-2">
                {(['public', 'private'] as const).map(opt => (
                  <button key={opt} onClick={() => setPhonePrivacy(opt)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border transition-all press ${phonePrivacy === opt ? 'gradient-pink text-white border-transparent' : 'border-border text-muted-foreground'}`}>
                    {opt === 'public' ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSaveProfile} disabled={saving} className="flex-1 py-3 gradient-pink rounded-xl text-white font-bold text-sm disabled:opacity-50 press">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={() => setEditing(false)} className="px-4 py-3 bg-muted rounded-xl text-muted-foreground text-sm press">Cancel</button>
            </div>
          </div>
        )}

        {/* VIP status */}
        <div className={`mt-3 rounded-2xl p-3 ${hasVIP ? 'bg-primary/10 border border-primary/25' : 'bg-muted/50 border border-border'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Crown className={`w-5 h-5 ${hasVIP ? 'text-primary' : 'text-muted-foreground'}`} />
              <div>
                <p className="text-sm font-bold text-foreground">
                  {hasVIP ? (isAdmin ? 'Admin Access' : 'VIP Member') : 'Free Member'}
                </p>
                {hasVIP && profile?.vip_expires_at && !isAdmin && (
                  <p className="text-[10px] text-muted-foreground">Expires: {new Date(profile.vip_expires_at).toLocaleDateString()}</p>
                )}
                {!hasVIP && <p className="text-[10px] text-muted-foreground">Upgrade for premium features</p>}
              </div>
            </div>
            {hasVIP
              ? <CheckCircle className="w-5 h-5 text-primary" />
              : <button onClick={() => setShowVIPSelector(true)} className="px-3 py-1.5 gradient-pink rounded-xl text-white text-xs font-bold press pink-glow-xs">Upgrade</button>
            }
          </div>
        </div>
      </div>

      {/* Referral card */}
      {referralCode && (
        <div className="mx-3 mb-4 bg-card border border-border rounded-3xl p-4 glass-card">
          <div className="flex items-center gap-2 mb-3">
            <Gift className="w-4 h-4 text-primary" />
            <p className="font-bold text-foreground text-sm">Referral Bonus System</p>
          </div>
          <div className="bg-muted/50 rounded-xl p-3 mb-3">
            <p className="text-[10px] text-muted-foreground mb-1">Your referral link</p>
            <p className="text-xs font-bold text-foreground break-all">{window.location.origin}?ref={referralCode}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: 'Joined', value: referralStats.registrations, color: 'text-foreground' },
              { label: 'Paid', value: referralStats.payments, color: 'text-primary' },
              { label: 'To Go', value: Math.max(0, 10 - referralStats.payments), color: 'text-green-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center p-2 bg-muted/30 rounded-xl">
                <p className={`text-sm font-black ${color}`}>{value}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          <div className="mb-3 p-2.5 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
            <p className="text-[11px] text-yellow-400 font-medium text-center">🎁 Invite 10 paying friends → <strong>Lifetime VIP FREE!</strong></p>
          </div>
          <button onClick={copyReferral} className="w-full py-2.5 gradient-pink rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 press pink-glow-xs">
            Copy Referral Link
          </button>
        </div>
      )}

      {/* Menu items — rendered in admin-defined order */}
      <div className="mx-3 space-y-2">
        {isAdmin && (
          <button onClick={() => navigate('/admin')} className="w-full flex items-center gap-3 bg-card border border-primary/25 rounded-2xl p-4 hover:border-primary/50 transition-all press">
            <div className="w-9 h-9 rounded-xl gradient-pink flex items-center justify-center flex-shrink-0 pink-glow-xs">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-bold text-foreground text-sm">Admin Dashboard</p>
              <p className="text-xs text-muted-foreground">Manage the entire platform</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        )}

        {settingsOrder.map(key => {
          if (key === 'live_agent') return (
            <button key={key} onClick={() => setShowLiveAgent(true)} className="w-full flex items-center gap-3 bg-card border border-border rounded-2xl p-4 hover:border-primary/25 transition-all press">
              <div className="relative w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-4 h-4 text-primary" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-background" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-bold text-foreground text-sm">Live Help Agent</p>
                <p className="text-xs text-muted-foreground">AI-powered support chat</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          );
          if (key === 'messenger') return (
            <button key={key} onClick={() => navigate('/messenger')} className="w-full flex items-center gap-3 bg-card border border-border rounded-2xl p-4 hover:border-primary/25 transition-all press">
              <div className="relative w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-4 h-4 text-blue-400" />
                {unreadMessages > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] gradient-pink rounded-full text-white text-[9px] font-black flex items-center justify-center px-1 pink-glow-xs">
                    {unreadMessages > 99 ? '99+' : unreadMessages}
                  </span>
                )}
              </div>
              <div className="flex-1 text-left">
                <p className="font-bold text-foreground text-sm">{t(lang, 'private_messenger')}</p>
                <p className="text-xs text-muted-foreground">{t(lang, 'messenger_sub')}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          );
          if (key === 'language') return (
            <div key={key} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/15 flex items-center justify-center flex-shrink-0">
                  <Globe className="w-4 h-4 text-purple-400" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-foreground text-sm">{t(lang, 'language')}</p>
                  <p className="text-xs text-muted-foreground">{t(lang, 'language_sub')}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {(['en', 'sw'] as const).map(l => (
                  <button key={l} onClick={() => setLang(l)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all press ${lang === l ? 'gradient-pink text-white border-transparent pink-glow-xs' : 'border-border text-muted-foreground'}`}>
                    {l === 'en' ? '🇺🇸 English' : '🇹🇿 Kiswahili'}
                  </button>
                ))}
              </div>
            </div>
          );
          if (key === 'theme') return (
            <button key={key} onClick={toggleTheme} className="w-full flex items-center gap-3 bg-card border border-border rounded-2xl p-4 hover:border-border/60 transition-all press">
              <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                {theme === 'dark' ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-blue-400" />}
              </div>
              <div className="flex-1 text-left">
                <p className="font-bold text-foreground text-sm">{theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</p>
                <p className="text-xs text-muted-foreground">Currently: {theme === 'dark' ? 'Dark' : 'Light'} mode</p>
              </div>
              <div className={`w-10 h-5 rounded-full transition-all relative ${theme === 'light' ? 'bg-primary' : 'bg-muted border border-border'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-300 ${theme === 'light' ? 'left-5' : 'left-0.5'}`} />
              </div>
            </button>
          );
          if (key === 'apk') return (
            <div key={key} className="bg-card border border-border rounded-2xl p-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                <Download className="w-3.5 h-3.5 text-primary" /> Mobile App
              </p>
              <APKSection minimal />
            </div>
          );
          if (key === 'notifications') return (
            <div key={key} className="space-y-2">
              <button onClick={() => setShowNotifications(true)} className="w-full flex items-center gap-3 bg-card border border-border rounded-2xl p-4 hover:border-border/60 transition-all press">
                <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                  <Bell className="w-4 h-4 text-orange-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-bold text-foreground text-sm">Notifications</p>
                  <p className="text-xs text-muted-foreground">View your latest alerts</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
              {/* Browser Push Notification Permission */}
              <button
                onClick={async () => {
                  const granted = await requestBrowserNotificationPermission();
                  setNotifPermission(granted ? 'granted' : (Notification.permission as any));
                  if (granted) { toast.success('Browser notifications enabled! \ud83d\udd14'); }
                  else { toast.error('Please enable notifications in your browser settings'); }
                }}
                className={`w-full flex items-center gap-3 rounded-2xl p-4 border transition-all press ${
                  notifPermission === 'granted'
                    ? 'bg-green-500/10 border-green-500/25 hover:border-green-500/40'
                    : 'bg-card border-border hover:border-primary/25'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  notifPermission === 'granted' ? 'bg-green-500/15' : 'bg-muted'
                }`}>
                  {notifPermission === 'granted'
                    ? <BellRing className="w-4 h-4 text-green-400" />
                    : <BellOff className="w-4 h-4 text-muted-foreground" />
                  }
                </div>
                <div className="flex-1 text-left">
                  <p className="font-bold text-foreground text-sm">Browser Notifications</p>
                  <p className={`text-xs ${
                    notifPermission === 'granted' ? 'text-green-400' : 'text-muted-foreground'
                  }`}>
                    {notifPermission === 'granted'
                      ? '\u2705 Enabled — signals & messages pop up in browser'
                      : notifPermission === 'denied'
                        ? '\u274c Blocked — enable in browser settings'
                        : 'Tap to enable browser pop-up alerts'}
                  </p>
                </div>
                {notifPermission === 'granted' && <span className="w-2.5 h-2.5 rounded-full bg-green-400 flex-shrink-0" />}
              </button>
            </div>
          );
          if (key === 'help') return (
            <button key={key} onClick={() => openWhatsApp(WHATSAPP_NUMBER, 'Hello Admin, I need help.')} className="w-full flex items-center gap-3 bg-card border border-border rounded-2xl p-4 hover:border-border/60 transition-all press">
              <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <HelpCircle className="w-4 h-4 text-green-400" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-bold text-foreground text-sm">Help & Support</p>
                <p className="text-xs text-muted-foreground">Chat with admin on WhatsApp</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          );
          if (key === 'logout') return (
            <button
              key={key}
              onClick={async () => {
                await supabase.from('user_profiles').update({ is_online: false }).eq('id', user.id);
                await logout();
                navigate('/auth');
              }}
              className="w-full flex items-center gap-3 bg-card border border-red-500/20 rounded-2xl p-4 hover:border-red-500/40 transition-all press"
            >
              <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <LogOut className="w-4 h-4 text-red-400" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-bold text-red-400 text-sm">Logout</p>
                <p className="text-xs text-muted-foreground">Sign out of your account</p>
              </div>
            </button>
          );
          return null;
        })}

        <p className="text-center text-[10px] text-muted-foreground py-2">
          VISION AVAX FOREX © {new Date().getFullYear()} · All Rights Reserved
        </p>
      </div>
    </div>
  );
}
