import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, FileImage, Users, TrendingUp, CreditCard, Settings, Link2,
  MessageSquare, Smartphone, Bell, Plus, Upload, Trash2, Save, RefreshCw, Home, Layout, Phone, Video, Trophy, Bot, BookOpen, Key
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import AdminContent from '@/components/admin/AdminContent';
import AdminUsers from '@/components/admin/AdminUsers';
import AdminSignals from '@/components/admin/AdminSignals';
import AdminPayments from '@/components/admin/AdminPayments';
import AdminSettings from '@/components/admin/AdminSettings';
import AdminReferrals from '@/components/admin/AdminReferrals';
import AdminVIPRoom from '@/components/admin/AdminVIPRoom';
import AdminNotifications from '@/components/admin/AdminNotifications';
import AdminThemes from '@/components/admin/AdminThemes';
import AdminSignalAnalytics from '@/components/admin/AdminSignalAnalytics';
import AdminHomeEditor from '@/components/admin/AdminHomeEditor';
import AdminCourses from '@/components/admin/AdminCourses';
import AdminTestimonials from '@/components/admin/AdminTestimonials';
import AdminSounds from '@/components/admin/AdminSounds';
import AdminHeaderStyles from '@/components/admin/AdminHeaderStyles';
import AdminCallStyles from '@/components/admin/AdminCallStyles';
import AdminMeetingPermissions from '@/components/admin/AdminMeetingPermissions';
import AdminTradingChallenge from '@/components/admin/AdminTradingChallenge';
import AdminTradingJournal from '@/components/admin/AdminTradingJournal';
import AdminProfileStyles from '@/components/admin/AdminProfileStyles';
import AdminAPKComponent from '@/components/admin/AdminAPK';
import AdminAVAXAI from '@/components/admin/AdminAVAXAI';
import AdminAPIKeys from '@/components/admin/AdminAPIKeys';
import LiveAgentChat from '@/components/features/LiveAgentChat';
import { supabase, uploadFile } from '@/lib/supabase';
import { AppVersion } from '@/types';
import { toast } from 'sonner';

type Tab = 'home' | 'content' | 'courses' | 'users' | 'signals' | 'analytics' | 'vip' | 'payments' | 'notifications' | 'apk' | 'themes' | 'sounds' | 'header' | 'settings' | 'referrals' | 'testimonials' | 'ai' | 'avax_ai' | 'calls' | 'meetings' | 'challenge' | 'journal' | 'profile_styles' | 'api_keys';

const tabs: { key: Tab; icon: React.ElementType; label: string }[] = [
  { key: 'home', icon: Home, label: 'Home' },
  { key: 'content', icon: FileImage, label: 'Content' },
  { key: 'courses', icon: FileImage, label: 'Courses' },
  { key: 'users', icon: Users, label: 'Users' },
  { key: 'signals', icon: TrendingUp, label: 'Signals' },
  { key: 'analytics', icon: TrendingUp, label: 'Analytics' },
  { key: 'vip', icon: MessageSquare, label: 'VIP' },
  { key: 'payments', icon: CreditCard, label: 'Payments' },
  { key: 'notifications', icon: Bell, label: 'Notify' },
  { key: 'apk', icon: Smartphone, label: 'APK' },
  { key: 'themes', icon: Settings, label: 'Themes' },
  { key: 'sounds', icon: Bell, label: 'Sounds' },
  { key: 'header', icon: Layout, label: 'Header' },
  { key: 'settings', icon: Settings, label: 'Settings' },
  { key: 'referrals', icon: Link2, label: 'Referrals' },
  { key: 'testimonials', icon: Users, label: 'Reviews' },
  { key: 'calls', icon: Phone, label: 'Calls' },
  { key: 'meetings', icon: Video, label: 'Meetings' },
  { key: 'challenge', icon: Trophy, label: 'Challenge' },
  { key: 'journal', icon: BookOpen, label: 'Journal' },
  { key: 'profile_styles', icon: Users, label: 'Profile Style' },
  { key: 'avax_ai', icon: Bot, label: 'AVAX AI' },
  { key: 'api_keys', icon: Key, label: 'API Keys' },
  { key: 'ai', icon: Shield, label: 'AI Help' },
];

function AdminAPKLegacy() {
  const [versions, setVersions] = useState<AppVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ version_name: '', release_notes: '', apk_url: '' });

  useEffect(() => { fetchVersions(); }, []);

  async function fetchVersions() {
    setLoading(true);
    const { data } = await supabase.from('app_versions').select('*').order('created_at', { ascending: false });
    if (data) setVersions(data);
    setLoading(false);
  }

  async function handleAPKUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadFile('media', `apk/${Date.now()}_${file.name}`, file);
    setForm(p => ({ ...p, apk_url: url }));
    setUploading(false);
    toast.success('APK uploaded! Fill in version details and save.');
  }

  async function addVersion() {
    if (!form.version_name) return toast.error('Enter version name');
    await supabase.from('app_versions').update({ is_latest: false }).neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('app_versions').insert({
      version_name: form.version_name,
      release_notes: form.release_notes,
      apk_url: form.apk_url || null,
      is_latest: true,
    });
    toast.success('New version published!');
    setAdding(false);
    setForm({ version_name: '', release_notes: '', apk_url: '' });
    fetchVersions();
  }

  async function deleteVersion(id: string) {
    await supabase.from('app_versions').delete().eq('id', id);
    fetchVersions();
  }

  async function setLatest(id: string) {
    await supabase.from('app_versions').update({ is_latest: false }).neq('id', id);
    await supabase.from('app_versions').update({ is_latest: true }).eq('id', id);
    toast.success('Set as latest');
    fetchVersions();
  }

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-foreground flex items-center gap-2"><Smartphone className="w-4 h-4 text-primary" /> APK Management</h3>
          <button onClick={() => setAdding(!adding)} className="flex items-center gap-1.5 px-3 py-1.5 gradient-pink rounded-xl text-white text-xs font-bold press">
            <Plus className="w-3.5 h-3.5" /> New Version
          </button>
        </div>

        {adding && (
          <div className="mb-4 p-4 bg-muted/30 rounded-xl space-y-3 animate-slide-up">
            <input className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary" placeholder="Version name (e.g. 1.0.1)" value={form.version_name} onChange={e => setForm(p => ({ ...p, version_name: e.target.value }))} />
            <textarea className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary resize-none" placeholder="What's new..." rows={3} value={form.release_notes} onChange={e => setForm(p => ({ ...p, release_notes: e.target.value }))} />
            <input className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary" placeholder="Or paste APK download URL" value={form.apk_url} onChange={e => setForm(p => ({ ...p, apk_url: e.target.value }))} />
            <label className="flex items-center gap-2 p-3 border border-dashed border-primary/40 rounded-xl cursor-pointer hover:bg-primary/5 transition-all">
              {uploading ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Upload className="w-4 h-4 text-primary" />}
              <span className="text-sm text-muted-foreground">{form.apk_url?.includes('supabase') ? '✓ APK uploaded' : 'Upload APK file'}</span>
              <input type="file" accept=".apk" className="hidden" onChange={handleAPKUpload} />
            </label>
            <button onClick={addVersion} className="w-full py-2.5 gradient-pink rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 press">
              <Save className="w-4 h-4" /> Publish Version
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 bg-muted/30 rounded-xl animate-pulse" />)}</div>
        ) : versions.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">No versions uploaded yet</p>
        ) : (
          <div className="space-y-2">
            {versions.map(v => (
              <div key={v.id} className={`p-3 rounded-xl border ${v.is_latest ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/20'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-bold text-foreground text-sm">v{v.version_name}</p>
                  {v.is_latest && <span className="text-[10px] px-2 py-0.5 gradient-pink rounded-full text-white font-bold">LATEST</span>}
                  {v.apk_url && <span className="text-[10px] px-1.5 py-0.5 bg-green-500/15 text-green-400 rounded font-medium">APK ✓</span>}
                </div>
                {v.release_notes && <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{v.release_notes}</p>}
                <p className="text-[10px] text-muted-foreground mb-2">{new Date(v.created_at).toLocaleDateString()}</p>
                <div className="flex gap-2 flex-wrap">
                  {!v.is_latest && (
                    <button onClick={() => setLatest(v.id)} className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-[11px] font-bold flex items-center gap-1 press">
                      <RefreshCw className="w-3 h-3" /> Set Latest
                    </button>
                  )}
                  {v.apk_url && (
                    <a href={v.apk_url} target="_blank" rel="noreferrer" className="px-2.5 py-1 rounded-lg bg-muted text-muted-foreground text-[11px] font-bold">Download</a>
                  )}
                  <button onClick={() => deleteVersion(v.id)} className="px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 text-[11px] font-bold flex items-center gap-1 press">
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Admin() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('home');
  const [stats, setStats] = useState({ users: 0, signals: 0, pendingPayments: 0, vipUsers: 0 });

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate('/');
  }, [user, isAdmin, loading, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    Promise.all([
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }),
      supabase.from('signals').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('payment_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('is_vip', true),
    ]).then(([u, s, p, v]) => {
      setStats({ users: u.count || 0, signals: s.count || 0, pendingPayments: p.count || 0, vipUsers: v.count || 0 });
    });
  }, [isAdmin]);

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen pb-24 animate-fade-in" style={{ paddingTop: '70px' }}>
      <div className="px-3 py-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl gradient-pink flex items-center justify-center pink-glow-sm">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-foreground">Admin Dashboard</h1>
            <p className="text-xs text-primary font-bold">⚡ Super Admin · Full Control</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: 'Users', value: stats.users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { label: 'Signals', value: stats.signals, color: 'text-green-400', bg: 'bg-green-500/10' },
            { label: 'Pending', value: stats.pendingPayments, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
            { label: 'VIP', value: stats.vipUsers, color: 'text-primary', bg: 'bg-primary/10' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-xl p-2.5 text-center`}>
              <p className={`text-sm font-black ${s.color}`}>{s.value}</p>
              <p className="text-[9px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-3 mb-4 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 pb-1">
          {tabs.map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all press ${
                tab === key
                  ? 'gradient-pink text-white pink-glow-xs'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-3">
        {tab === 'home' && <AdminHomeEditor />}
        {tab === 'content' && <AdminContent />}
        {tab === 'courses' && <AdminCourses />}
        {tab === 'users' && <AdminUsers />}
        {tab === 'signals' && <AdminSignals />}
        {tab === 'analytics' && <AdminSignalAnalytics />}
        {tab === 'vip' && <AdminVIPRoom />}
        {tab === 'payments' && <AdminPayments />}
        {tab === 'notifications' && <AdminNotifications />}
        {tab === 'apk' && <AdminAPKComponent />}
        {tab === 'themes' && <AdminThemes />}
        {tab === 'sounds' && <AdminSounds />}
        {tab === 'header' && <AdminHeaderStyles />}
        {tab === 'settings' && <AdminSettings />}
        {tab === 'referrals' && <AdminReferrals />}
        {tab === 'testimonials' && <AdminTestimonials />}
        {tab === 'calls' && <AdminCallStyles />}
        {tab === 'meetings' && <AdminMeetingPermissions />}
        {tab === 'challenge' && <AdminTradingChallenge />}
        {tab === 'journal' && <AdminTradingJournal />}
        {tab === 'profile_styles' && <AdminProfileStyles />}
        {tab === 'avax_ai' && <AdminAVAXAI />}
        {tab === 'api_keys' && <AdminAPIKeys />}
        {tab === 'ai' && <LiveAgentChat onClose={() => setTab('home')} adminMode={true} />}
      </div>
    </div>
  );
}
