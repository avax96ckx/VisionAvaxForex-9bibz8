import { useState, useEffect } from 'react';
import { CreditCard, CheckCircle, XCircle, Eye, BookOpen } from 'lucide-react';
import { supabase, isVIPActive } from '@/lib/supabase';
import { PaymentRequest, VIPPlan } from '@/types';
import { toast } from 'sonner';

type MainTab = 'vip' | 'course';

export default function AdminPayments() {
  const [mainTab, setMainTab] = useState<MainTab>('vip');
  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [coursePayments, setCoursePayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [viewImg, setViewImg] = useState<string | null>(null);

  useEffect(() => {
    fetchPayments();
    fetchCoursePayments();
  }, []);

  async function fetchPayments() {
    setLoading(true);
    const { data } = await supabase
      .from('payment_requests')
      .select('*, user_profiles(*)')
      .order('created_at', { ascending: false });
    if (data) setPayments(data);
    setLoading(false);
  }

  async function fetchCoursePayments() {
    const { data } = await supabase
      .from('course_payments')
      .select('*, user_profiles(*), courses(*)')
      .order('created_at', { ascending: false });
    if (data) setCoursePayments(data);
  }

  async function approvePayment(p: PaymentRequest) {
    const { data: s } = await supabase.from('site_settings').select('vip_plans').eq('id', 'main').single();
    const plans: VIPPlan[] = s?.vip_plans || [];
    const plan = plans.find((pl: VIPPlan) => pl.id === p.plan_id);
    const days = plan?.days || 30;

    const isLifetime = days >= 99999;
    const expiresAt = isLifetime
      ? new Date(Date.now() + 99 * 365 * 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    await supabase.from('payment_requests').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', p.id);
    await supabase.from('user_profiles').update({ is_vip: true, vip_expires_at: expiresAt, blue_tick: true, badge_style: 'blue_burst' } as any).eq('id', p.user_id);

    // Send approval notification
    await supabase.from('notifications').insert({
      title: '✅ VIP Activated!',
      body: `Your ${p.plan_name} VIP plan has been activated. Enjoy premium access!`,
      type: 'vip',
      target_user_id: p.user_id,
    });

    // Referral auto-reward check
    const userProfile = p.user_profiles as any;
    const referredBy = userProfile?.referred_by;
    if (referredBy) {
      const { data: refLink } = await supabase.from('referral_links').select('*').eq('code', referredBy).single();
      if (refLink) {
        const newPayingCount = (refLink.paying_referrals || 0) + 1;
        await supabase.from('referral_links').update({
          payments: (refLink.payments || 0) + 1,
          paying_referrals: newPayingCount,
        }).eq('id', refLink.id);

        if (newPayingCount >= 10 && !refLink.reward_granted && refLink.owner_user_id) {
          const lifetimeExpiry = new Date(Date.now() + 99 * 365 * 24 * 60 * 60 * 1000).toISOString();
          await supabase.from('user_profiles').update({
            is_vip: true, vip_expires_at: lifetimeExpiry, blue_tick: true, badge_style: 'gold_burst',
          } as any).eq('id', refLink.owner_user_id);
          await supabase.from('referral_links').update({ reward_granted: true }).eq('id', refLink.id);
          await supabase.from('notifications').insert({
            title: '🎉 Lifetime VIP Unlocked!',
            body: 'Congratulations! You reached 10 paying referrals and earned a FREE Lifetime VIP membership with Gold Badge!',
            type: 'referral_reward',
            target_user_id: refLink.owner_user_id,
          });
          toast.success('🎁 Referral reward granted! Lifetime VIP activated.');
        }
      }
    }

    toast.success('Payment approved! VIP activated.');
    fetchPayments();
  }

  async function rejectPayment(id: string) {
    if (!confirm('Reject this payment request?')) return;
    await supabase.from('payment_requests').update({ status: 'rejected', admin_notes: 'Rejected by admin' }).eq('id', id);
    // Notify user
    const payment = payments.find(p => p.id === id);
    if (payment) {
      await supabase.from('notifications').insert({
        title: '❌ Payment Rejected',
        body: `Your ${payment.plan_name} payment request has been rejected. Please contact support for assistance.`,
        type: 'vip',
        target_user_id: payment.user_id,
      });
    }
    toast.success('Payment rejected');
    fetchPayments();
  }

  async function approveCoursePayment(cp: any) {
    await supabase.from('course_payments').update({ status: 'approved' }).eq('id', cp.id);
    // Send notification
    await supabase.from('notifications').insert({
      title: '✅ Course Access Granted!',
      body: `Your payment for "${cp.courses?.title}" has been approved. Enjoy the course!`,
      type: 'update',
      target_user_id: cp.user_id,
    });
    toast.success('Course payment approved!');
    fetchCoursePayments();
  }

  async function rejectCoursePayment(id: string) {
    await supabase.from('course_payments').update({ status: 'rejected' }).eq('id', id);
    toast.success('Course payment rejected');
    fetchCoursePayments();
  }

  const filtered = filter === 'all' ? payments : payments.filter(p => p.status === filter);
  const statusColor = { pending: 'text-yellow-400', approved: 'text-green-400', rejected: 'text-red-400' };
  const statusBg = { pending: 'bg-yellow-500/20', approved: 'bg-green-500/20', rejected: 'bg-red-500/20' };

  return (
    <div className="space-y-4">
      {/* Main tab selector */}
      <div className="flex gap-2">
        <button onClick={() => setMainTab('vip')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold border transition-all press ${mainTab === 'vip' ? 'gradient-pink text-white border-transparent' : 'border-border bg-card text-muted-foreground'}`}>
          <CreditCard className="w-4 h-4" /> VIP Payments
        </button>
        <button onClick={() => setMainTab('course')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold border transition-all press ${mainTab === 'course' ? 'gradient-pink text-white border-transparent' : 'border-border bg-card text-muted-foreground'}`}>
          <BookOpen className="w-4 h-4" /> Course Payments
        </button>
      </div>

      {/* VIP Payments */}
      {mainTab === 'vip' && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white flex items-center gap-2"><CreditCard className="w-4 h-4 text-primary" /> VIP Payments ({payments.length})</h3>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-yellow-500/10 rounded-xl p-2 text-center">
              <p className="text-sm font-black text-yellow-400">{payments.filter(p => p.status === 'pending').length}</p>
              <p className="text-[10px] text-muted-foreground">Pending</p>
            </div>
            <div className="bg-green-500/10 rounded-xl p-2 text-center">
              <p className="text-sm font-black text-green-400">{payments.filter(p => p.status === 'approved').length}</p>
              <p className="text-[10px] text-muted-foreground">Approved</p>
            </div>
            <div className="bg-red-500/10 rounded-xl p-2 text-center">
              <p className="text-sm font-black text-red-400">{payments.filter(p => p.status === 'rejected').length}</p>
              <p className="text-[10px] text-muted-foreground">Rejected</p>
            </div>
          </div>
          <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
            {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${filter === f ? 'gradient-pink text-white' : 'bg-muted text-muted-foreground'}`}>
                {f}
              </button>
            ))}
          </div>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 bg-muted/30 rounded-xl animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8"><CreditCard className="w-8 h-8 text-muted-foreground mx-auto mb-2" /><p className="text-sm text-muted-foreground">No payments</p></div>
          ) : (
            <div className="space-y-3">
              {filtered.map(p => (
                <div key={p.id} className="p-3 bg-muted/20 rounded-xl border border-border">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-sm font-bold text-white">{p.user_profiles?.email || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">@{p.user_profiles?.username || 'N/A'}</p>
                      {(p.user_profiles as any)?.referred_by && (
                        <p className="text-[10px] text-primary">Referred by: {(p.user_profiles as any).referred_by}</p>
                      )}
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${statusBg[p.status as keyof typeof statusBg]} ${statusColor[p.status as keyof typeof statusColor]}`}>
                      {p.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-bold">{p.plan_name}</span>
                    <span className="text-xs text-muted-foreground">{p.plan_duration}</span>
                    <span className="text-xs font-black text-white ml-auto">${p.amount}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{new Date(p.created_at).toLocaleDateString()} {new Date(p.created_at).toLocaleTimeString()}</p>
                  <div className="flex gap-1.5">
                    {p.screenshot_url && (
                      <button onClick={() => setViewImg(p.screenshot_url!)} className="px-2.5 py-1 bg-muted rounded-lg text-xs text-muted-foreground flex items-center gap-1">
                        <Eye className="w-3 h-3" /> Screenshot
                      </button>
                    )}
                    {p.status === 'pending' && (
                      <>
                        <button onClick={() => approvePayment(p)} className="px-2.5 py-1 bg-green-500/20 rounded-lg text-xs text-green-400 font-bold flex items-center gap-1 hover:bg-green-500/30">
                          <CheckCircle className="w-3 h-3" /> Approve
                        </button>
                        <button onClick={() => rejectPayment(p.id)} className="px-2.5 py-1 bg-red-500/20 rounded-lg text-xs text-red-400 font-bold flex items-center gap-1 hover:bg-red-500/30">
                          <XCircle className="w-3 h-3" /> Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Course Payments */}
      {mainTab === 'course' && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="font-bold text-white flex items-center gap-2 mb-4">
            <BookOpen className="w-4 h-4 text-primary" /> Course Payments ({coursePayments.length})
          </h3>
          {coursePayments.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No course payment requests yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {coursePayments.map(cp => (
                <div key={cp.id} className="p-3 bg-muted/20 rounded-xl border border-border">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-sm font-bold text-white">{cp.user_profiles?.email || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">@{cp.user_profiles?.username || 'N/A'}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      cp.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                      cp.status === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>{cp.status.toUpperCase()}</span>
                  </div>
                  <p className="text-xs text-primary font-bold mb-1">📚 {cp.courses?.title || 'Course'}</p>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-black text-white">${cp.amount}</span>
                    <span className="text-xs text-muted-foreground">{new Date(cp.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex gap-1.5">
                    {cp.screenshot_url && (
                      <button onClick={() => setViewImg(cp.screenshot_url)} className="px-2.5 py-1 bg-muted rounded-lg text-xs text-muted-foreground flex items-center gap-1">
                        <Eye className="w-3 h-3" /> Screenshot
                      </button>
                    )}
                    {cp.status === 'pending' && (
                      <>
                        <button onClick={() => approveCoursePayment(cp)} className="px-2.5 py-1 bg-green-500/20 rounded-lg text-xs text-green-400 font-bold flex items-center gap-1 hover:bg-green-500/30">
                          <CheckCircle className="w-3 h-3" /> Approve
                        </button>
                        <button onClick={() => rejectCoursePayment(cp.id)} className="px-2.5 py-1 bg-red-500/20 rounded-lg text-xs text-red-400 font-bold flex items-center gap-1 hover:bg-red-500/30">
                          <XCircle className="w-3 h-3" /> Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {viewImg && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4" onClick={() => setViewImg(null)}>
          <img src={viewImg} alt="screenshot" className="max-w-full max-h-full rounded-2xl" />
        </div>
      )}
    </div>
  );
}
