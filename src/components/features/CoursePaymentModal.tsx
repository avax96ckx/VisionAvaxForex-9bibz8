import { useState, useEffect } from 'react';
import { X, Copy, CheckCircle, Upload, BookOpen, Crown, ArrowRight } from 'lucide-react';
import { supabase, openWhatsApp, WHATSAPP_NUMBER, PAYMENT_NAME, uploadFile } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Course, VIPPlan } from '@/types';
import VIPPlanSelector from './VIPPlanSelector';
import { toast } from 'sonner';

interface Props {
  course: Course;
  onClose: () => void;
}

export default function CoursePaymentModal({ course, onClose }: Props) {
  const { user } = useAuth();
  const [mode, setMode] = useState<'choose' | 'pay_course' | 'join_vip'>('choose');
  const [step, setStep] = useState<'info' | 'done'>('info');
  const [uploading, setUploading] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState({ name: PAYMENT_NAME, number: WHATSAPP_NUMBER, network: 'M-Pesa' });

  useEffect(() => {
    supabase.from('site_settings').select('payment_name,payment_number,payment_network').eq('id', 'main').single().then(({ data }) => {
      if (data) setPaymentInfo({ name: data.payment_name || PAYMENT_NAME, number: data.payment_number || WHATSAPP_NUMBER, network: (data as any).payment_network || 'M-Pesa' });
    });
  }, []);

  function copyNumber() {
    navigator.clipboard.writeText(paymentInfo.number);
    setCopied(true);
    toast.success('Number copied!');
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleScreenshot(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const url = await uploadFile('media', `course_payments/${user.id}_${Date.now()}`, file);
    setScreenshotUrl(url);
    setUploading(false);
    toast.success('Screenshot uploaded!');
  }

  async function handlePaid() {
    if (!user) { toast.error('Please login first'); return; }
    await supabase.from('course_payments').upsert({
      user_id: user.id,
      course_id: course.id,
      amount: course.price_usd,
      screenshot_url: screenshotUrl || null,
      status: 'pending',
    }, { onConflict: 'user_id,course_id' });

    const msg = `Hello Admin! 👋\n\nI paid for *${course.title}* course ($${course.price_usd} USD).\n\nEmail: ${user.email}\nCourse: ${course.title}\n\nPlease verify and activate my course access. Thank you! 🙏`;
    openWhatsApp(WHATSAPP_NUMBER, msg);
    setStep('done');
  }

  if (mode === 'join_vip') {
    return <VIPPlanSelector onClose={onClose} title="Join VIP — Unlock All Courses" subtitle="Get access to every course + signals + community" />;
  }

  if (mode === 'choose') {
    return (
      <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 animate-fade-in"
        style={{ background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(10px)' }}>
        <div className="bg-card border border-border rounded-3xl w-full max-w-sm relative overflow-hidden animate-slide-up">
          <div className="h-1.5 gradient-pink" />
          <div className="p-6">
            <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-muted flex items-center justify-center press">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
            <div className="text-center mb-5">
              <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center mx-auto mb-3">
                <BookOpen className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-lg font-black text-foreground">{course.title}</h2>
              <p className="text-sm text-muted-foreground mt-1">Choose how you'd like to access this course</p>
            </div>
            <div className="space-y-3">
              <button onClick={() => setMode('pay_course')}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border border-primary/40 bg-primary/5 hover:bg-primary/10 transition-all press text-left">
                <div className="w-10 h-10 rounded-xl gradient-pink flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-black text-foreground text-sm">Pay for This Course</p>
                  <p className="text-xs text-muted-foreground">One-time access · ${course.price_usd} USD</p>
                </div>
                <ArrowRight className="w-4 h-4 text-primary flex-shrink-0" />
              </button>
              <button onClick={() => setMode('join_vip')}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border border-yellow-500/40 bg-yellow-500/5 hover:bg-yellow-500/10 transition-all press text-left">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                  <Crown className="w-5 h-5 text-yellow-400" />
                </div>
                <div className="flex-1">
                  <p className="font-black text-foreground text-sm">Join VIP Membership</p>
                  <p className="text-xs text-muted-foreground">All courses + signals + community</p>
                </div>
                <ArrowRight className="w-4 h-4 text-yellow-400 flex-shrink-0" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Pay for course flow
  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(10px)' }}>
      <div className="bg-card border border-border rounded-3xl w-full max-w-sm relative overflow-hidden animate-slide-up">
        <div className="h-1.5 gradient-pink" />
        <div className="p-6">
          <button onClick={() => setMode('choose')} className="absolute top-4 left-4 w-8 h-8 rounded-full bg-muted flex items-center justify-center press">
            <ArrowRight className="w-4 h-4 text-muted-foreground rotate-180" />
          </button>
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-muted flex items-center justify-center press">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>

          {step === 'info' && (
            <>
              <div className="text-center mb-5 mt-2">
                <h2 className="text-lg font-black text-foreground">{course.title}</h2>
                <p className="text-3xl font-black text-gradient-pink mt-1">${course.price_usd} <span className="text-sm text-muted-foreground font-normal">USD</span></p>
              </div>
              <div className="bg-muted/40 border border-border rounded-2xl p-4 mb-4 space-y-3">
                <p className="text-xs font-bold text-foreground text-center uppercase tracking-wider">📱 Send Payment To</p>
                <div className="flex items-center justify-between bg-background/60 rounded-xl p-3 border border-border/60">
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase">Name</p>
                    <p className="font-bold text-foreground text-sm">{paymentInfo.name}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between bg-background/60 rounded-xl p-3 border border-border/60">
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase">Network · {paymentInfo.network}</p>
                    <p className="font-black text-foreground text-base">{paymentInfo.number}</p>
                  </div>
                  <button onClick={copyNumber} className={`p-2 rounded-xl transition-all press ${copied ? 'bg-green-500/20' : 'bg-primary/10'}`}>
                    {copied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-primary" />}
                  </button>
                </div>
                <p className="text-center text-xs text-muted-foreground">Amount: <span className="text-foreground font-black">${course.price_usd} USD</span></p>
              </div>
              <label className="flex items-center justify-center gap-2 p-3 border border-dashed border-border hover:border-primary/50 rounded-xl cursor-pointer transition-all mb-4 press">
                {uploading
                  ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  : screenshotUrl
                    ? <><CheckCircle className="w-4 h-4 text-green-400" /><span className="text-xs text-green-400 font-medium">Screenshot uploaded ✓</span></>
                    : <><Upload className="w-4 h-4 text-muted-foreground" /><span className="text-xs text-muted-foreground">Upload payment screenshot</span></>
                }
                <input type="file" accept="image/*" className="hidden" onChange={handleScreenshot} />
              </label>
              <button onClick={handlePaid} className="w-full py-4 gradient-pink rounded-2xl text-white font-bold text-base pink-glow press flex items-center justify-center gap-2">
                I Have Paid <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {step === 'done' && (
            <div className="text-center py-4 animate-fade-in">
              <div className="w-20 h-20 rounded-3xl gradient-pink flex items-center justify-center mx-auto mb-4 pink-glow">
                <CheckCircle className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-xl font-black text-foreground mb-2">Payment Submitted! 🎉</h2>
              <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                Admin will verify and activate your course access shortly.
              </p>
              <button onClick={onClose} className="w-full py-4 gradient-pink rounded-2xl text-white font-bold pink-glow press">Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
