import { useState, useEffect } from 'react';
import { Crown, X, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { VIPPlan } from '@/types';
import PaymentModal from './PaymentModal';

interface Props {
  onClose: () => void;
  title?: string;
  subtitle?: string;
}

export default function VIPPlanSelector({ onClose, title = 'Choose Your VIP Plan', subtitle = 'Select a plan to unlock full access' }: Props) {
  const [plans, setPlans] = useState<VIPPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<VIPPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('site_settings').select('vip_plans').eq('id', 'main').single().then(({ data }) => {
      if (data?.vip_plans) setPlans(data.vip_plans as VIPPlan[]);
      setLoading(false);
    });
  }, []);

  if (selectedPlan) {
    return <PaymentModal plan={selectedPlan} onClose={onClose} />;
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(10px)' }}>
      <div className="bg-card border border-border rounded-3xl w-full max-w-sm relative overflow-hidden animate-slide-up max-h-[90vh] flex flex-col">
        <div className="h-1.5 gradient-pink flex-shrink-0" />

        <div className="p-5 overflow-y-auto">
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-muted flex items-center justify-center press">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>

          <div className="text-center mb-5">
            <div className="w-14 h-14 rounded-2xl gradient-pink flex items-center justify-center mx-auto mb-3 pink-glow">
              <Crown className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-lg font-black text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          </div>

          {/* Features */}
          <div className="bg-muted/30 rounded-2xl p-3 mb-4">
            <div className="grid grid-cols-2 gap-1.5">
              {['Premium Signals', 'All Courses', 'VIP Chat Room', 'Expert Analysis', 'Blue Tick Badge', 'Priority Support'].map(f => (
                <div key={f} className="flex items-center gap-1.5 text-xs text-foreground">
                  <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-14 bg-muted/30 rounded-2xl animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {plans.map(plan => (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan)}
                  className={`rounded-2xl p-3 text-left border transition-all press card-hover relative overflow-hidden ${
                    plan.id === 'monthly'
                      ? 'border-primary/50 bg-primary/5 pink-glow-xs'
                      : 'border-border bg-muted/20'
                  }`}
                >
                  {plan.id === 'monthly' && (
                    <span className="absolute top-1 right-1 text-[8px] px-1.5 py-0.5 gradient-pink rounded-full text-white font-bold">HOT</span>
                  )}
                  {plan.id === 'lifetime' && (
                    <span className="absolute top-1 right-1 text-[8px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full font-bold border border-yellow-500/30">BEST</span>
                  )}
                  <p className="font-black text-foreground text-sm mb-0.5">{plan.name}</p>
                  <p className="text-[10px] text-muted-foreground mb-1.5">{plan.duration}</p>
                  <p className="text-xl font-black text-gradient-pink">${plan.price}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
