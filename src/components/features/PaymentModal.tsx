import { useState } from 'react';
import { X, Copy, CheckCircle, Upload, Crown, ArrowRight } from 'lucide-react';
import { VIPPlan } from '@/types';
import { supabase, openWhatsApp, WHATSAPP_NUMBER, PAYMENT_NAME, uploadFile } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Props {
  plan: VIPPlan;
  onClose: () => void;
}

export default function PaymentModal({ plan, onClose }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<'info' | 'done'>('info');
  const [uploading, setUploading] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState({ name: PAYMENT_NAME, number: WHATSAPP_NUMBER, network: 'M-Pesa' });

  // Load payment info from settings
  useState(() => {
    import('@/lib/supabase').then(({ supabase: sb }) => {
      sb.from('site_settings').select('payment_name, payment_number, payment_network').eq('id', 'main').single().then(({ data }) => {
        if (data) setPaymentInfo({ name: data.payment_name || PAYMENT_NAME, number: data.payment_number || WHATSAPP_NUMBER, network: (data as any).payment_network || 'M-Pesa' });
      });
    });
  });

  function copyNumber() {
    navigator.clipboard.writeText(paymentInfo.number);
    setCopied(true);
    toast.success('Number copied!');
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleScreenshotUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const url = await uploadFile('media', `payments/${user.id}_${Date.now()}`, file);
    setScreenshotUrl(url);
    setUploading(false);
    toast.success('Screenshot uploaded!');
  }

  async function handlePaid() {
    if (!user) { toast.error('Please login first'); return; }

    await supabase.from('payment_requests').insert({
      user_id: user.id,
      plan_id: plan.id,
      plan_name: plan.name,
      plan_duration: plan.duration,
      amount: plan.price,
      screenshot_url: screenshotUrl || null,
      notes: `VIP ${plan.name} plan payment submitted`,
    });

    const msg = `Hello Admin! 👋\n\nI have sent payment for *${plan.name} VIP Plan* ($${plan.price} USD).\n\nEmail: ${user.email}\nPlan: ${plan.name} (${plan.duration})\n\nPlease verify and activate my VIP. Thank you! 🙏`;
    openWhatsApp(WHATSAPP_NUMBER, msg);
    setStep('done');
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 animate-fade-in" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
      <div className="bg-card border border-border rounded-3xl w-full max-w-sm relative overflow-hidden animate-slide-up">
        {/* Pink top accent */}
        <div className="h-1.5 gradient-pink" />

        <div className="p-6">
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-all press">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>

          {step === 'info' && (
            <>
              {/* Plan header */}
              <div className="text-center mb-5">
                <div className="w-14 h-14 rounded-2xl gradient-pink flex items-center justify-center mx-auto mb-3 pink-glow">
                  <Crown className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-lg font-black text-foreground">{plan.name} VIP Plan</h2>
                <p className="text-muted-foreground text-sm">{plan.duration}</p>
                <p className="text-3xl font-black text-gradient-pink mt-1">${plan.price} <span className="text-sm text-muted-foreground font-normal">USD</span></p>
              </div>

              {/* Payment instructions */}
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
                  <button
                    onClick={copyNumber}
                    className={`p-2 rounded-xl transition-all press ${copied ? 'bg-green-500/20' : 'bg-primary/10 hover:bg-primary/20'}`}
                  >
                    {copied
                      ? <CheckCircle className="w-4 h-4 text-green-400" />
                      : <Copy className="w-4 h-4 text-primary" />
                    }
                  </button>
                </div>

                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Amount: <span className="text-foreground font-black">${plan.price} USD</span></p>
                </div>
              </div>

              {/* Steps */}
              <div className="mb-4 space-y-2">
                {[
                  { n: '1', text: 'Send the exact amount to the number above' },
                  { n: '2', text: 'Upload your payment screenshot below' },
                  { n: '3', text: 'Click "I Have Paid" to notify admin' },
                ].map(s => (
                  <div key={s.n} className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full gradient-pink flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[10px] font-black text-white">{s.n}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{s.text}</p>
                  </div>
                ))}
              </div>

              {/* Screenshot upload */}
              <label className="flex items-center justify-center gap-2 p-3 border border-dashed border-border hover:border-primary/50 rounded-xl cursor-pointer transition-all mb-4 press">
                {uploading ? (
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                ) : screenshotUrl ? (
                  <><CheckCircle className="w-4 h-4 text-green-400" /><span className="text-xs text-green-400 font-medium">Screenshot uploaded ✓</span></>
                ) : (
                  <><Upload className="w-4 h-4 text-muted-foreground" /><span className="text-xs text-muted-foreground">Upload payment screenshot</span></>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleScreenshotUpload} />
              </label>

              <button
                onClick={handlePaid}
                className="w-full py-4 gradient-pink rounded-2xl text-white font-bold text-base pink-glow hover:opacity-90 transition-all press flex items-center justify-center gap-2"
              >
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
              <p className="text-muted-foreground text-sm mb-2 leading-relaxed">
                Admin has been notified via WhatsApp. Your VIP will be activated after verification.
              </p>
              <p className="text-xs text-muted-foreground mb-6">
                You will receive a ✓ blue tick once your payment is approved.
              </p>
              <button onClick={onClose} className="w-full py-4 gradient-pink rounded-2xl text-white font-bold pink-glow press">
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
