import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  MessageCircle, Phone, Share2, Camera, Crown, Clock, User, ArrowLeft,
  UserPlus, UserCheck, GraduationCap, Download, Award, Video, PhoneCall, X
} from 'lucide-react';
import { supabase, isVIPActive, uploadFile } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { UserProfile } from '@/types';
import type { BadgeStyle } from '@/types';
import VIPBadge from '@/components/features/VIPBadge';
import BadgeSelector from '@/components/features/BadgeSelector';
import ImageCropper from '@/components/features/ImageCropper';
import PaymentModal from '@/components/features/PaymentModal';
import { useCall, ActiveCallScreen } from '@/components/features/WebRTCCall';
import CourseCertificate from '@/components/features/CourseCertificate';
import { toast } from 'sonner';

const defaultPlan = { id: 'monthly', name: 'Monthly', duration: '30 days', days: 30, price: 30 };

export default function Profile() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user, profile: myProfile, isAdmin, refreshProfile, theme } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [payModal, setPayModal] = useState(false);
  const [showBadgeSelector, setShowBadgeSelector] = useState(false);
  const [completedCourses, setCompletedCourses] = useState<{courseTitle: string; completedAt: string; courseId: string}[]>([]);
  const [showCertificate, setShowCertificate] = useState<{title: string; date: string} | null>(null);
  const [showCallMenu, setShowCallMenu] = useState(false);
  const { startCall, activeCall, setActiveCall, callBg } = useCall();

  // Cropper state
  const [coverCropFile, setCoverCropFile] = useState<File | null>(null);
  const [avatarCropFile, setAvatarCropFile] = useState<File | null>(null);

  // Follow state
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [globalCoverUrl, setGlobalCoverUrl] = useState<string>('');
  const [cropDisabled, setCropDisabled] = useState(false);
  const [profileStyles, setProfileStyles] = useState<any>({
    tickPosition: 'inline', tickSize: 'sm', nameFontSize: 'md', tickGap: 'tight',
  });
  const iHaveAccess = isAdmin || (myProfile ? isVIPActive(myProfile) : false);
  const isOwnProfile = user?.id === userId;

  // Load completed courses from DB (course_progress)
  useEffect(() => {
    if (!isOwnProfile || !user) return;
    supabase.from('course_progress').select('course_id, completed_at').eq('user_id', user.id).then(async ({ data }) => {
      if (!data || data.length === 0) return;
      // Group by course_id and get courses with all lessons done
      const courseIds = [...new Set(data.map((d: any) => d.course_id as string))];
      // For each course, check if all lessons are completed
      const completed: {courseTitle: string; completedAt: string; courseId: string}[] = [];
      await Promise.all(courseIds.map(async (courseId) => {
        const [{ count: totalLessons }, { count: completedLessons }, { data: courseData }] = await Promise.all([
          supabase.from('course_lessons').select('id', { count: 'exact', head: true }).eq('course_id', courseId),
          supabase.from('course_progress').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('course_id', courseId),
          supabase.from('courses').select('title, created_at').eq('id', courseId).single(),
        ]);
        if (totalLessons && completedLessons && totalLessons > 0 && completedLessons >= totalLessons && courseData) {
          const lastEntry = data.filter((d: any) => d.course_id === courseId).sort((a: any, b: any) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())[0];
          completed.push({ courseId, courseTitle: courseData.title, completedAt: lastEntry?.completed_at || new Date().toISOString() });
        }
      }));
      setCompletedCourses(completed);
    });
  }, [isOwnProfile, user]);

  useEffect(() => {
    supabase.from('site_settings').select('global_cover_url, profile_styles, crop_disabled').eq('id', 'main').single()
      .then(({ data }) => {
        if (data && (data as any).global_cover_url) setGlobalCoverUrl((data as any).global_cover_url);
        if (data && (data as any).profile_styles) setProfileStyles({ tickPosition: 'inline', tickSize: 'sm', nameFontSize: 'md', tickGap: 'tight', ...(data as any).profile_styles });
        if (data) setCropDisabled(!!(data as any).crop_disabled);
      });
  }, []);

  useEffect(() => {
    if (!userId) return;
    Promise.all([
      supabase.from('user_profiles').select('*').eq('id', userId).single(),
      // followers = people who follow this user (following_id = userId)
      supabase.from('user_follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
      // following = people this user follows (follower_id = userId)
      supabase.from('user_follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
    ]).then(([profileRes, followersRes, followingRes]) => {
      if (profileRes.data) setProfile(profileRes.data);
      setFollowersCount(followersRes.count || 0);
      setFollowingCount(followingRes.count || 0);
      setLoading(false);
    });

    // Check if current user follows this profile
    if (user && userId && user.id !== userId) {
      supabase.from('user_follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', userId)
        .single()
        .then(({ data }) => setIsFollowing(!!data));
    }
  }, [userId, user]);

  async function toggleFollow() {
    if (!user || !userId) return;
    if (!iHaveAccess) { setPayModal(true); return; }
    if (isFollowing) {
      await supabase.from('user_follows').delete().eq('follower_id', user.id).eq('following_id', userId);
      setIsFollowing(false);
      setFollowersCount(c => Math.max(0, c - 1));
      toast.success('Unfollowed');
    } else {
      await supabase.from('user_follows').insert({ follower_id: user.id, following_id: userId });
      setIsFollowing(true);
      setFollowersCount(c => c + 1);
      toast.success('Following!');
    }
  }

  async function startChat() {
    if (!user) { navigate('/auth'); return; }
    if (!iHaveAccess) { setPayModal(true); return; }
    navigate(`/messenger?user=${userId}`);
  }

  function callUser() {
    setShowCallMenu(true);
  }

  async function shareProfile() {
    const url = `${window.location.origin}/profile/${userId}`;
    if (navigator.share) {
      navigator.share({ title: profile?.username || 'Member', url });
    } else {
      navigator.clipboard.writeText(url);
      toast.success('Profile link copied!');
    }
  }

  /* ── Cover: open gallery → crop → upload ── */
  function handleCoverFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { toast.error('Please select JPG, PNG or WEBP'); return; }
    if (file.size > 15 * 1024 * 1024) { toast.error('Image must be under 15MB'); return; }
    if (cropDisabled) {
      // Skip cropper — upload directly
      handleCoverCropped(file);
    } else {
      setCoverCropFile(file);
    }
    e.target.value = '';
  }

  async function handleCoverCropped(blob: Blob) {
    if (!user) return;
    setCoverCropFile(null);
    setUploadingCover(true);
    try {
      const file = new File([blob], `cover_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const url = await uploadFile('banners', `cover_${user.id}_${Date.now()}`, file);
      await supabase.from('user_profiles').update({ cover_url: url } as any).eq('id', user.id);
      setProfile(p => p ? { ...p, cover_url: url } as any : p);
      await refreshProfile();
      toast.success('Cover photo updated!');
    } catch { toast.error('Upload failed.'); }
    finally { setUploadingCover(false); }
  }

  /* ── Avatar: open gallery → crop → upload ── */
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
    setUploadingAvatar(true);
    try {
      const file = new File([blob], `avatar_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const url = await uploadFile('avatars', `${user.id}/avatar_${Date.now()}`, file);
      await supabase.from('user_profiles').update({ avatar_url: url }).eq('id', user.id);
      setProfile(p => p ? { ...p, avatar_url: url } : p);
      await refreshProfile();
      toast.success('Profile photo updated!');
    } catch { toast.error('Upload failed.'); }
    finally { setUploadingAvatar(false); }
  }

  async function handleBadgeSelect(style: BadgeStyle) {
    if (!user) return;
    await supabase.from('user_profiles').update({ badge_style: style } as any).eq('id', user.id);
    setProfile(p => p ? { ...p, badge_style: style } as any : p);
    await refreshProfile();
    toast.success('Verification badge updated!');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <User className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-black text-foreground mb-2">Profile Not Found</h2>
        <p className="text-sm text-muted-foreground mb-6 text-center">This member may have deleted their account.</p>
        <button onClick={() => navigate(-1)} className="px-5 py-2.5 gradient-pink rounded-xl text-white font-bold press pink-glow-xs">Go Back</button>
      </div>
    );
  }

  const NAME_FONT_SIZES: Record<string, string> = { xs: '13px', sm: '15px', md: '18px', lg: '22px', xl: '26px' };
  const TICK_GAPS: Record<string, string> = { tight: '4px', normal: '8px', wide: '14px' };

  const coverUrl = (profile as any).cover_url || globalCoverUrl;
  const displayName = profile.full_name || profile.username || profile.email?.split('@')[0] || 'Member';
  const handle = profile.username || profile.email?.split('@')[0] || 'member';
  const isOnline = profile.is_online;
  const profileIsVIP = isVIPActive(profile) || (profile.is_vip && profile.vip_expires_at && new Date(profile.vip_expires_at) > new Date());
  const showPhone = profile.phone_number && (isOwnProfile || profile.phone_privacy === 'public');
  // ⚠️ badgeStyle MUST be declared before psBadgeStyle to avoid temporal dead zone crash
  const badgeStyle = ((profile as any).badge_style as BadgeStyle) || 'blue_burst';
  const hasBadge = profile.blue_tick || profileIsVIP || isAdmin;

  const psFontSize = NAME_FONT_SIZES[profileStyles.nameFontSize] || '18px';
  const psGap = TICK_GAPS[profileStyles.tickGap] || '4px';
  const psTickSize = (profileStyles.tickSize || 'sm') as 'xs' | 'sm' | 'md' | 'lg';
  const psBadgeStyle = (profileStyles.badgeStyle as BadgeStyle) || badgeStyle;

  const pageBg = theme === 'light' ? 'bg-[#f3f4f6]' : 'bg-background';
  const cardBg = theme === 'light' ? 'bg-white' : 'bg-card';
  const textPrimary = theme === 'light' ? 'text-gray-900' : 'text-foreground';
  const textSub = theme === 'light' ? 'text-gray-500' : 'text-muted-foreground';
  const borderCol = theme === 'light' ? 'border-gray-200' : 'border-border';

  return (
    <>
      {/* Croppers */}
      {coverCropFile && (
        <ImageCropper
          imageFile={coverCropFile}
          aspectRatio={16 / 9}
          isCircular={false}
          title="Crop Cover Photo"
          onCrop={handleCoverCropped}
          onCancel={() => setCoverCropFile(null)}
        />
      )}
      {avatarCropFile && (
        <ImageCropper
          imageFile={avatarCropFile}
          aspectRatio={1}
          isCircular={true}
          title="Crop Profile Photo"
          onCrop={handleAvatarCropped}
          onCancel={() => setAvatarCropFile(null)}
        />
      )}

      <Helmet>
        <title>{displayName} — VISION AVAX FOREX</title>
        <meta property="og:title" content={`${displayName}${profileIsVIP ? ' 👑 VIP' : ''} — VISION AVAX FOREX`} />
        <meta property="og:description" content={`${profileIsVIP ? 'VIP Member' : 'Member'} @${handle} on VISION AVAX FOREX — Professional Forex Signals & Trading Education`} />
        {profile.avatar_url && <meta property="og:image" content={profile.avatar_url} />}
        <meta property="og:url" content={`${window.location.origin}/profile/${userId}`} />
        <meta property="og:type" content="profile" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={`${displayName} — VISION AVAX FOREX`} />
        {profile.avatar_url && <meta name="twitter:image" content={profile.avatar_url} />}
      </Helmet>

      {payModal && <PaymentModal plan={defaultPlan} onClose={() => setPayModal(false)} />}

      {/* Call menu */}
      {showCallMenu && profile && (
        <div className="fixed inset-0 z-[500] bg-black/70 flex items-end justify-center animate-fade-in" onClick={() => setShowCallMenu(false)}>
          <div className="w-full max-w-md bg-card border border-border rounded-t-3xl overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()} style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
            <div className="px-4 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full overflow-hidden bg-muted gradient-pink flex items-center justify-center flex-shrink-0">
                  {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-sm font-black text-white">{(profile.username || '?')[0].toUpperCase()}</span>}
                </div>
                <p className="font-black text-foreground">{profile.username || profile.full_name || 'Member'}</p>
              </div>
              <button onClick={() => setShowCallMenu(false)} className="p-1.5 rounded-xl bg-muted press"><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="py-2">
              {/* Normal call */}
              <button onClick={() => { setShowCallMenu(false); if (!profile.phone_number) { toast.error('No phone number shared'); return; } window.location.href = `tel:${profile.phone_number}`; }}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-all press text-left">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/15 flex items-center justify-center"><Phone className="w-5 h-5 text-blue-400" /></div>
                <div><p className="font-bold text-foreground">Normal Call</p><p className="text-xs text-muted-foreground">Regular phone call</p></div>
              </button>
              {/* Here call (WebRTC audio) */}
              <button onClick={() => { setShowCallMenu(false); startCall(profile, 'audio'); }}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-all press text-left">
                <div className="w-10 h-10 rounded-2xl bg-green-500/15 flex items-center justify-center"><PhoneCall className="w-5 h-5 text-green-400" /></div>
                <div><p className="font-bold text-foreground">Here Call</p><p className="text-xs text-muted-foreground">Online audio call (like WhatsApp)</p></div>
              </button>
              {/* Video call (WebRTC video) */}
              <button onClick={() => { setShowCallMenu(false); startCall(profile, 'video'); }}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-all press text-left">
                <div className="w-10 h-10 rounded-2xl bg-primary/15 flex items-center justify-center"><Video className="w-5 h-5 text-primary" /></div>
                <div><p className="font-bold text-foreground">Video Call</p><p className="text-xs text-muted-foreground">Online video call (like WhatsApp)</p></div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active call screen */}
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

      {showBadgeSelector && isOwnProfile && (
        <BadgeSelector
          currentStyle={badgeStyle}
          isVIP={iHaveAccess}
          onSelect={handleBadgeSelect}
          onClose={() => setShowBadgeSelector(false)}
          onUpgrade={() => setPayModal(true)}
        />
      )}

      <div className={`min-h-screen ${pageBg} pb-28 animate-fade-in`}>

        {/* ── Back + Edit overlay ── */}
        <div
          className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4"
          style={{ paddingTop: 'max(14px, env(safe-area-inset-top))' }}
        >
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-black/35 backdrop-blur-sm flex items-center justify-center press hover:bg-black/50 transition-all"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          {isOwnProfile && (
            <button
              onClick={() => navigate('/settings')}
              className="px-3 py-1.5 rounded-full bg-black/35 backdrop-blur-sm text-white text-xs font-bold press hover:bg-black/50 transition-all"
            >
              Edit Profile
            </button>
          )}
        </div>

        {/* ── Cover Photo ── */}
        <div className="relative" style={{ height: '52vw', maxHeight: 260, minHeight: 180 }}>
          {coverUrl
            ? <img src={coverUrl} alt="cover" className="w-full h-full object-cover" />
            : (
              <div className="w-full h-full" style={{ background: 'linear-gradient(135deg,#3D0033 0%,#7B0055 35%,#CC006A 65%,#FF1493 100%)' }}>
                <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 30% 70%,rgba(255,255,255,0.18) 0%,transparent 50%)' }} />
              </div>
            )
          }

          {/* Cover change button removed — edit from Settings page */}
        </div>

        {/* ── Avatar ── */}
        <div className="flex justify-center" style={{ marginTop: '-52px', position: 'relative', zIndex: 10 }}>
          <div className="relative">
            <div
              className="rounded-full p-[4px]"
              style={{
                background: 'linear-gradient(135deg,#FF1493,#FF69B4,#FF1493)',
                boxShadow: `0 0 0 3px ${theme === 'light' ? '#f3f4f6' : 'hsl(var(--background))'}`,
              }}
            >
              <div className="w-[96px] h-[96px] rounded-full overflow-hidden bg-muted flex items-center justify-center gradient-pink relative">
                {profile.avatar_url
                  ? <img src={profile.avatar_url} alt={displayName} className="w-full h-full object-cover" />
                  : <span className="text-4xl font-black text-white">{displayName[0]?.toUpperCase()}</span>
                }
                {uploadingAvatar && (
                  <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </div>

            {isOnline && (
              <span
                className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-green-400 border-[3px]"
                style={{ borderColor: theme === 'light' ? '#f3f4f6' : 'hsl(var(--background))' }}
              />
            )}

            {isOwnProfile && (
              <>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute bottom-0 right-0 w-8 h-8 rounded-full gradient-pink flex items-center justify-center press shadow-xl border-2 border-background"
                >
                  {uploadingAvatar
                    ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Camera className="w-3.5 h-3.5 text-white" />
                  }
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleAvatarFileSelect}
                />
              </>
            )}
          </div>
        </div>

        {/* ── Name + Badge ── */}
        <div className="flex flex-col items-center px-6 mt-3 mb-1">
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {profileStyles.tickPosition === 'below' ? (
              <div className="flex flex-col items-center" style={{ gap: '4px' }}>
                <h1 className="font-black leading-tight text-center" style={{ fontSize: psFontSize, color: theme === 'light' ? '#111827' : 'hsl(var(--foreground))' }}>{displayName}</h1>
                {hasBadge && <VIPBadge size={psTickSize} badgeStyle={psBadgeStyle} animate onClick={isOwnProfile ? () => setShowBadgeSelector(true) : undefined} />}
              </div>
            ) : profileStyles.tickPosition === 'far-right' ? (
              <div className="flex items-center w-full justify-center" style={{ gap: '28px' }}>
                <h1 className="font-black leading-tight text-center" style={{ fontSize: psFontSize, color: theme === 'light' ? '#111827' : 'hsl(var(--foreground))' }}>{displayName}</h1>
                {hasBadge && <VIPBadge size={psTickSize} badgeStyle={psBadgeStyle} animate onClick={isOwnProfile ? () => setShowBadgeSelector(true) : undefined} />}
              </div>
            ) : (
              <div className="flex items-center" style={{ gap: psGap }}>
                <h1 className="font-black leading-tight text-center" style={{ fontSize: psFontSize, color: theme === 'light' ? '#111827' : 'hsl(var(--foreground))' }}>{displayName}</h1>
                {hasBadge && <VIPBadge size={psTickSize} badgeStyle={psBadgeStyle} animate onClick={isOwnProfile ? () => setShowBadgeSelector(true) : undefined} />}
              </div>
            )}
          </div>

          {isOwnProfile && hasBadge && (
            <p className="text-[10px] text-muted-foreground mt-0.5">Tap badge to customize</p>
          )}

          {/* Followers / Following counts */}
          <div className="flex items-center gap-5 mt-2">
            <div className="text-center">
              <p className="text-sm font-black text-foreground">{followersCount}</p>
              <p className="text-[10px] text-muted-foreground">Followers</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <p className="text-sm font-black text-foreground">{followingCount}</p>
              <p className="text-[10px] text-muted-foreground">Following</p>
            </div>
          </div>

          {/* Online status */}
          <div className="flex items-center gap-1.5 mt-2">
            {isOnline ? (
              <span className={`text-[13px] font-medium ${textSub} flex items-center gap-1`}>
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
                Online now
              </span>
            ) : profile.last_seen ? (
              <span className={`text-[13px] ${textSub} flex items-center gap-1`}>
                <Clock className="w-3 h-3" />
                Last seen {new Date(profile.last_seen).toLocaleDateString([], { month: 'short', day: 'numeric' })}
              </span>
            ) : (
              <span className={`text-[13px] ${textSub}`}>@{handle}</span>
            )}
            {profileIsVIP && (
              <span className="ml-1 flex items-center gap-0.5 px-2 py-0.5 gradient-pink rounded-full text-white text-[10px] font-black">
                <Crown className="w-2.5 h-2.5" />VIP
              </span>
            )}
          </div>
        </div>

        {/* ── Phone ── */}
        {showPhone && (
          <div className="flex justify-center px-6 mt-3 mb-1">
            <div className={`px-6 py-2.5 rounded-2xl border ${borderCol} ${cardBg}`}>
              <p className="font-black text-center tracking-wide" style={{ fontSize: 'clamp(17px,4.5vw,22px)', color: theme === 'light' ? '#111827' : 'hsl(var(--foreground))' }}>
                {profile.phone_number}
              </p>
            </div>
          </div>
        )}

        {/* ── Action Buttons ── */}
        <div className="px-5 mt-5 grid grid-cols-3 gap-3 max-w-sm mx-auto">
          {[
            { label: 'message', icon: MessageCircle, onClick: startChat },
            { label: 'audio', icon: Phone, onClick: callUser },
            { label: 'share', icon: Share2, onClick: shareProfile },
          ].map(({ label, icon: Icon, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className={`flex flex-col items-center gap-2 py-4 rounded-2xl border ${borderCol} ${cardBg} press active:scale-95 transition-all hover:border-primary/30`}
            >
              <Icon className="w-7 h-7" style={{ color: theme === 'light' ? '#1565C0' : 'hsl(var(--primary))' }} strokeWidth={1.8} />
              <span className="text-xs font-semibold underline" style={{ color: theme === 'light' ? '#1565C0' : 'hsl(var(--primary))' }}>{label}</span>
            </button>
          ))}
        </div>

        {/* ── Follow button (for other profiles) ── */}
        {!isOwnProfile && (
          <div className="px-5 mt-3 max-w-sm mx-auto">
            <button
              onClick={toggleFollow}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm press transition-all ${
                isFollowing
                  ? `border ${borderCol} ${cardBg} text-foreground`
                  : 'gradient-pink text-white pink-glow-xs'
              }`}
            >
              {isFollowing ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          </div>
        )}

        {/* ── Info section ── */}
        <div className="px-5 mt-5 max-w-sm mx-auto space-y-3">
          {profileIsVIP && profile.vip_expires_at && (
            <div className={`rounded-2xl border p-4 ${cardBg}`} style={{ borderColor: 'rgba(255,20,147,0.25)' }}>
              <p className={`text-xs ${textSub} mb-1 font-medium`}>VIP Expires</p>
              <p className="text-sm font-bold text-primary">
                {new Date(profile.vip_expires_at).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          )}

          {!iHaveAccess && !isOwnProfile && (
            <div className={`rounded-2xl border p-4 flex items-start gap-3 ${cardBg}`} style={{ borderColor: 'rgba(255,20,147,0.2)' }}>
              <div className="w-9 h-9 rounded-xl gradient-pink flex items-center justify-center flex-shrink-0">
                <Crown className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <p className={`text-sm font-bold ${textPrimary} mb-0.5`}>Premium Feature</p>
                <p className={`text-xs ${textSub}`}>Upgrade to VIP to message & call this member.</p>
                <button onClick={() => setPayModal(true)} className="mt-2 text-xs text-primary font-bold press">Upgrade to VIP →</button>
              </div>
            </div>
          )}
        </div>

        {profile.joined_at && (
          <div className="px-5 mt-3 max-w-sm mx-auto">
            <p className={`text-center text-xs ${textSub}`}>
              Member since {new Date(profile.joined_at).toLocaleDateString([], { year: 'numeric', month: 'long' })}
            </p>
          </div>
        )}

        {/* My Certificates Section */}
        {isOwnProfile && completedCourses.length > 0 && (
          <div className="px-5 mt-5 max-w-sm mx-auto">
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-4 h-4 text-primary" />
              <h3 className="font-black text-foreground text-sm">My Certificates</h3>
              <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-bold">{completedCourses.length}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {completedCourses.map(cert => (
                <button
                  key={cert.courseId}
                  onClick={() => setShowCertificate({ title: cert.courseTitle, date: new Date(cert.completedAt).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' }) })}
                  className="relative bg-card border border-border rounded-2xl overflow-hidden press hover:border-primary/40 transition-all"
                >
                  <div className="p-3" style={{ background: 'linear-gradient(135deg, hsl(var(--primary)/0.12) 0%, hsl(var(--primary)/0.05) 100%)' }}>
                    <GraduationCap className="w-8 h-8 text-primary mx-auto mb-2" />
                    <p className="text-[10px] font-bold text-foreground text-center line-clamp-2 leading-tight">{cert.courseTitle}</p>
                    <p className="text-[9px] text-muted-foreground text-center mt-1">{new Date(cert.completedAt).toLocaleDateString([], { month: 'short', year: 'numeric' })}</p>
                  </div>
                  <div className="flex items-center justify-center gap-1 px-3 py-1.5 border-t border-border/50 bg-primary/5">
                    <Download className="w-3 h-3 text-primary" />
                    <span className="text-[10px] text-primary font-bold">Download</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Certificate viewer */}
        {showCertificate && profile && (
          <CourseCertificate
            userName={profile.full_name || profile.username || 'Member'}
            courseTitle={showCertificate.title}
            completionDate={showCertificate.date}
            onClose={() => setShowCertificate(null)}
          />
        )}
      </div>
    </>
  );
}
