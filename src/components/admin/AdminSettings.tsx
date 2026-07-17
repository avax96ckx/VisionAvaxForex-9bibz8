// Admin Settings with reorder capability
import { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, Save, Phone, DollarSign, Gift, Smartphone, GripVertical, ChevronUp, ChevronDown, Bot, MessageCircle, Palette } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SiteSettings, VIPPlan } from '@/types';
import { toast } from 'sonner';

// All available settings items that can be reordered
const ALL_SETTINGS_ITEMS = [
  { key: 'live_agent', label: 'Live Help Agent', desc: 'AI-powered support chat', emoji: '🤖' },
  { key: 'messenger', label: 'Private Messenger', desc: 'VIP members direct chat', emoji: '💬' },
  { key: 'language', label: 'Language', desc: 'Switch EN/SW', emoji: '🌐' },
  { key: 'theme', label: 'Dark/Light Mode', desc: 'Toggle display theme', emoji: '🌙' },
  { key: 'apk', label: 'Mobile App', desc: 'Download & update', emoji: '📱' },
  { key: 'notifications', label: 'Notifications', desc: 'View alerts', emoji: '🔔' },
  { key: 'help', label: 'Help & Support', desc: 'WhatsApp support', emoji: '💁' },
  { key: 'logout', label: 'Logout', desc: 'Sign out', emoji: '🚪' },
];

export default function AdminSettings() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [plans, setPlans] = useState<VIPPlan[]>([]);
  const [whatsapp, setWhatsapp] = useState('');
  const [paymentName, setPaymentName] = useState('');
  const [paymentNumber, setPaymentNumber] = useState('');
  const [paymentNetwork, setPaymentNetwork] = useState('M-Pesa');
  const [socials, setSocials] = useState<Record<string, string>>({});
  const [settingsOrder, setSettingsOrder] = useState<string[]>(ALL_SETTINGS_ITEMS.map(i => i.key));
  const [savingOrder, setSavingOrder] = useState(false);
  // AI Agent settings
  const [agentName, setAgentName] = useState('AVAX Support');
  const [agentInstructions, setAgentInstructions] = useState('');
  const [savingAgent, setSavingAgent] = useState(false);

  // Gradient backgrounds
  const [vipGradFrom, setVipGradFrom] = useState('#0d0d1a');
  const [vipGradTo, setVipGradTo] = useState('#1a0026');
  const [chatGradFrom, setChatGradFrom] = useState('#0d0d1a');
  const [chatGradTo, setChatGradTo] = useState('#1a0026');
  const [agentGradFrom, setAgentGradFrom] = useState('#0d0d1a');
  const [agentGradTo, setAgentGradTo] = useState('#1a0026');
  const [savingGradients, setSavingGradients] = useState(false);

  useEffect(() => { fetchSettings(); }, []);

  async function fetchSettings() {
    setLoading(true);
    const { data } = await supabase.from('site_settings').select('*').eq('id', 'main').single();
    if (data) {
      setSettings(data);
      setPlans(data.vip_plans || []);
      setWhatsapp(data.whatsapp_number || '');
      setPaymentName(data.payment_name || '');
      setPaymentNumber(data.payment_number || '');
      setPaymentNetwork((data as any).payment_network || 'M-Pesa');
      setSocials(data.social_links || {});
      const order = (data as any).settings_order;
      if (Array.isArray(order) && order.length > 0) {
        setSettingsOrder(order);
      }
      setAgentName((data as any).agent_name || 'AVAX Support');
      setAgentInstructions((data as any).ai_support_instructions || '');
      setVipGradFrom((data as any).vip_bg_gradient_from || '#0d0d1a');
      setVipGradTo((data as any).vip_bg_gradient_to || '#1a0026');
      setChatGradFrom((data as any).chat_bg_gradient_from || '#0d0d1a');
      setChatGradTo((data as any).chat_bg_gradient_to || '#1a0026');
      setAgentGradFrom((data as any).agent_bg_gradient_from || '#0d0d1a');
      setAgentGradTo((data as any).agent_bg_gradient_to || '#1a0026');
    }
    setLoading(false);
  }

  async function saveContact() {
    setSaving(true);
    const { error } = await supabase.from('site_settings').update({
      whatsapp_number: whatsapp,
      payment_name: paymentName,
      payment_number: paymentNumber,
      payment_network: paymentNetwork,
    } as any).eq('id', 'main');
    if (error) { toast.error(`Save failed: ${error.message}`); } else { toast.success('Contact info saved!'); }
    setSaving(false);
  }

  async function savePlans() {
    setSaving(true);
    const { error } = await supabase.from('site_settings').update({ vip_plans: plans }).eq('id', 'main');
    if (error) { toast.error(`Save failed: ${error.message}`); } else { toast.success('VIP plans saved!'); }
    setSaving(false);
  }

  async function saveSocials() {
    setSaving(true);
    const { error } = await supabase.from('site_settings').update({ social_links: socials }).eq('id', 'main');
    if (error) { toast.error(`Save failed: ${error.message}`); } else { toast.success('Social links saved!'); }
    setSaving(false);
  }

  async function saveSettingsOrder() {
    setSavingOrder(true);
    const { error } = await supabase.from('site_settings').update({ settings_order: settingsOrder } as any).eq('id', 'main');
    if (error) { toast.error(`Save failed: ${error.message}`); } else { toast.success('Settings order saved!'); }
    setSavingOrder(false);
  }

  async function saveAgentSettings() {
    setSavingAgent(true);
    const { error } = await supabase.from('site_settings').update({
      agent_name: agentName,
      ai_support_instructions: agentInstructions,
    } as any).eq('id', 'main');
    if (error) { toast.error(`Save failed: ${error.message}`); } else { toast.success('Agent settings saved!'); }
    setSavingAgent(false);
  }

  async function saveGradients() {
    setSavingGradients(true);
    const { error } = await supabase.from('site_settings').update({
      vip_bg_gradient_from: vipGradFrom,
      vip_bg_gradient_to: vipGradTo,
      chat_bg_gradient_from: chatGradFrom,
      chat_bg_gradient_to: chatGradTo,
      agent_bg_gradient_from: agentGradFrom,
      agent_bg_gradient_to: agentGradTo,
    } as any).eq('id', 'main');
    if (error) toast.error('Save failed: ' + error.message);
    else toast.success('Gradient backgrounds saved!');
    setSavingGradients(false);
  }

  function swapOrder(idx: number, dir: -1 | 1) {
    const arr = [...settingsOrder];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    setSettingsOrder(arr);
  }

  function updatePlan(idx: number, field: string, value: string | number) {
    setPlans(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  }

  function addPlan() {
    setPlans(prev => [...prev, { id: `plan_${Date.now()}`, name: 'New Plan', duration: '30 days', days: 30, price: 10 }]);
  }

  const MOBILE_NETWORKS = [
    'M-Pesa', 'Airtel Money', 'Tigo Pesa', 'Halopesa', 'T-Pesa', 'MTN Mobile Money',
    'Vodacom', 'Equitel', 'Orange Money', 'Wave', 'Other',
  ];

  if (loading) return <div className="h-32 bg-muted/30 rounded-2xl animate-pulse" />;

  // Build ordered list with meta
  const orderedItems = settingsOrder
    .map(key => ALL_SETTINGS_ITEMS.find(i => i.key === key))
    .filter(Boolean) as typeof ALL_SETTINGS_ITEMS;

  return (
    <div className="space-y-5">
      {/* AI Support Agent Settings */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary" /> AI Support Agent Settings
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Agent Name</label>
            <input
              className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary"
              value={agentName}
              onChange={e => setAgentName(e.target.value)}
              placeholder="AVAX Support"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block font-medium">
              Custom AI Instructions
              <span className="ml-1 text-muted-foreground/60">(optional — how the AI should behave)</span>
            </label>
            <textarea
              className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary resize-none"
              rows={4}
              value={agentInstructions}
              onChange={e => setAgentInstructions(e.target.value)}
              placeholder="e.g. Always greet users in Swahili. Focus only on trading topics. Promote the monthly plan..."
            />
          </div>
          <div className="p-3 bg-muted/30 rounded-xl">
            <p className="text-[11px] text-muted-foreground">
              💡 The AI automatically reads your WhatsApp number, payment info, VIP plans, and app download link from your settings — no need to repeat them here.
            </p>
          </div>
          <button
            onClick={saveAgentSettings}
            disabled={savingAgent}
            className="w-full py-2.5 gradient-pink rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 press"
          >
            <Save className="w-4 h-4" /> {savingAgent ? 'Saving...' : 'Save Agent Settings'}
          </button>
        </div>
      </div>

      {/* ── Gradient Backgrounds ── */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="font-bold text-foreground mb-1 flex items-center gap-2">
          <Palette className="w-4 h-4 text-primary" /> Chat Gradient Backgrounds
        </h3>
        <p className="text-xs text-muted-foreground mb-4">Set gradient background colors for VIPRoom, Messenger, and AI Support chats.</p>

        {/* ── Live Chat Preview ── */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[
            { label: '👑 VIP Room', from: vipGradFrom, to: vipGradTo },
            { label: '💬 Messenger', from: chatGradFrom, to: chatGradTo },
            { label: '🤖 AI Support', from: agentGradFrom, to: agentGradTo },
          ].map(p => (
            <div key={p.label} className="rounded-2xl overflow-hidden border border-white/5" style={{ background: `linear-gradient(160deg, ${p.from}, ${p.to})` }}>
              {/* Mock chat messages */}
              <div className="p-2 space-y-1.5 min-h-[90px]">
                <div className="flex justify-start">
                  <div className="px-2 py-1 rounded-xl text-[8px] text-white font-medium max-w-[70%]" style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(4px)' }}>Hello! 👋</div>
                </div>
                <div className="flex justify-end">
                  <div className="px-2 py-1 rounded-xl text-[8px] text-white font-medium" style={{ background: 'rgba(255,20,147,0.7)' }}>Trading signal 📊</div>
                </div>
                <div className="flex justify-start">
                  <div className="px-2 py-1 rounded-xl text-[8px] text-white/80 font-medium" style={{ background: 'rgba(255,255,255,0.10)' }}>Got it! ✅</div>
                </div>
              </div>
              <div className="py-1 px-2 bg-black/20">
                <p className="text-[9px] text-white/50 text-center font-medium">{p.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          {/* VIP Room */}
          <div className="p-3 bg-muted/20 rounded-xl">
            <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1.5"><span>👑</span> VIP Room Background</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">From</p>
                <div className="flex gap-1.5">
                  <input type="color" value={vipGradFrom} onChange={e => setVipGradFrom(e.target.value)} className="w-9 h-8 rounded-lg border border-border cursor-pointer bg-transparent flex-shrink-0" />
                  <input value={vipGradFrom} onChange={e => setVipGradFrom(e.target.value)} className="flex-1 bg-muted border border-border rounded-xl px-2 py-1.5 text-foreground text-xs outline-none font-mono" />
                </div>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">To</p>
                <div className="flex gap-1.5">
                  <input type="color" value={vipGradTo} onChange={e => setVipGradTo(e.target.value)} className="w-9 h-8 rounded-lg border border-border cursor-pointer bg-transparent flex-shrink-0" />
                  <input value={vipGradTo} onChange={e => setVipGradTo(e.target.value)} className="flex-1 bg-muted border border-border rounded-xl px-2 py-1.5 text-foreground text-xs outline-none font-mono" />
                </div>
              </div>
            </div>
          </div>

          {/* Messenger */}
          <div className="p-3 bg-muted/20 rounded-xl">
            <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1.5"><span>💬</span> Messenger Background</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">From</p>
                <div className="flex gap-1.5">
                  <input type="color" value={chatGradFrom} onChange={e => setChatGradFrom(e.target.value)} className="w-9 h-8 rounded-lg border border-border cursor-pointer bg-transparent flex-shrink-0" />
                  <input value={chatGradFrom} onChange={e => setChatGradFrom(e.target.value)} className="flex-1 bg-muted border border-border rounded-xl px-2 py-1.5 text-foreground text-xs outline-none font-mono" />
                </div>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">To</p>
                <div className="flex gap-1.5">
                  <input type="color" value={chatGradTo} onChange={e => setChatGradTo(e.target.value)} className="w-9 h-8 rounded-lg border border-border cursor-pointer bg-transparent flex-shrink-0" />
                  <input value={chatGradTo} onChange={e => setChatGradTo(e.target.value)} className="flex-1 bg-muted border border-border rounded-xl px-2 py-1.5 text-foreground text-xs outline-none font-mono" />
                </div>
              </div>
            </div>
          </div>

          {/* AI Support */}
          <div className="p-3 bg-muted/20 rounded-xl">
            <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1.5"><span>🤖</span> AI Support Background</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">From</p>
                <div className="flex gap-1.5">
                  <input type="color" value={agentGradFrom} onChange={e => setAgentGradFrom(e.target.value)} className="w-9 h-8 rounded-lg border border-border cursor-pointer bg-transparent flex-shrink-0" />
                  <input value={agentGradFrom} onChange={e => setAgentGradFrom(e.target.value)} className="flex-1 bg-muted border border-border rounded-xl px-2 py-1.5 text-foreground text-xs outline-none font-mono" />
                </div>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">To</p>
                <div className="flex gap-1.5">
                  <input type="color" value={agentGradTo} onChange={e => setAgentGradTo(e.target.value)} className="w-9 h-8 rounded-lg border border-border cursor-pointer bg-transparent flex-shrink-0" />
                  <input value={agentGradTo} onChange={e => setAgentGradTo(e.target.value)} className="flex-1 bg-muted border border-border rounded-xl px-2 py-1.5 text-foreground text-xs outline-none font-mono" />
                </div>
              </div>
            </div>
          </div>

          <button onClick={saveGradients} disabled={savingGradients}
            className="w-full py-2.5 gradient-pink rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 press">
            <Save className="w-4 h-4" /> {savingGradients ? 'Saving...' : 'Save All Gradient Backgrounds'}
          </button>
        </div>
      </div>

      {/* Settings Page Order */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="font-bold text-foreground mb-1 flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary" /> Settings Menu Order
        </h3>
        <p className="text-xs text-muted-foreground mb-4">Drag or use arrows to reorder settings items. Users will see them in this order.</p>
        <div className="space-y-1.5 mb-4">
          {orderedItems.map((item, idx) => (
            <div key={item.key} className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-muted/20">
              <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary text-[10px] font-black flex items-center justify-center flex-shrink-0">
                {idx + 1}
              </div>
              <span className="text-base flex-shrink-0">{item.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">{item.label}</p>
                <p className="text-[10px] text-muted-foreground">{item.desc}</p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => swapOrder(idx, -1)}
                  disabled={idx === 0}
                  className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center disabled:opacity-30 press"
                >
                  <ChevronUp className="w-3.5 h-3.5 text-foreground" />
                </button>
                <button
                  onClick={() => swapOrder(idx, 1)}
                  disabled={idx === orderedItems.length - 1}
                  className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center disabled:opacity-30 press"
                >
                  <ChevronDown className="w-3.5 h-3.5 text-foreground" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={saveSettingsOrder}
          disabled={savingOrder}
          className="w-full py-2.5 gradient-pink rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 press"
        >
          <Save className="w-4 h-4" /> {savingOrder ? 'Saving...' : 'Save Settings Order'}
        </button>
      </div>

      {/* Contact & Payment */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
          <Phone className="w-4 h-4 text-primary" /> Contact & Payment Info
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block font-medium">WhatsApp Number</label>
            <input className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary transition-all" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+255746715235" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Payment Recipient Name</label>
            <input className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary transition-all" value={paymentName} onChange={e => setPaymentName(e.target.value)} placeholder="LAURENT MATABAZI" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Payment Number</label>
            <input className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary transition-all" value={paymentNumber} onChange={e => setPaymentNumber(e.target.value)} placeholder="+255746715235" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block font-medium flex items-center gap-1">
              <Smartphone className="w-3 h-3" /> Mobile Network / Payment Method
            </label>
            <select
              className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary transition-all"
              value={MOBILE_NETWORKS.includes(paymentNetwork) ? paymentNetwork : 'Other'}
              onChange={e => setPaymentNetwork(e.target.value)}
            >
              {MOBILE_NETWORKS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            {!MOBILE_NETWORKS.slice(0, -1).includes(paymentNetwork) && (
              <input
                className="w-full mt-2 bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary transition-all"
                value={paymentNetwork}
                onChange={e => setPaymentNetwork(e.target.value)}
                placeholder="Enter network name..."
              />
            )}
          </div>
          <button onClick={saveContact} disabled={saving} className="w-full py-2.5 gradient-pink rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 press">
            <Save className="w-4 h-4" /> Save Contact Info
          </button>
        </div>
      </div>

      {/* VIP Plans */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" /> VIP Plans ({plans.length})
          </h3>
          <button onClick={addPlan} className="flex items-center gap-1.5 px-3 py-1.5 gradient-pink rounded-xl text-white text-xs font-bold press">
            <Plus className="w-3.5 h-3.5" /> Add Plan
          </button>
        </div>
        <div className="space-y-3 mb-4">
          {plans.map((plan, idx) => (
            <div key={plan.id} className="p-3 bg-muted/30 rounded-xl">
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input className="bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary" placeholder="Plan name" value={plan.name} onChange={e => updatePlan(idx, 'name', e.target.value)} />
                <input className="bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary" placeholder="e.g. 30 days" value={plan.duration} onChange={e => updatePlan(idx, 'duration', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">Days</label>
                  <input type="number" className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary" value={plan.days} onChange={e => updatePlan(idx, 'days', +e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Price (USD)</label>
                  <input type="number" className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary" value={plan.price} onChange={e => updatePlan(idx, 'price', +e.target.value)} />
                </div>
              </div>
              <button onClick={() => setPlans(prev => prev.filter((_, i) => i !== idx))} className="text-xs text-red-400 flex items-center gap-1 hover:text-red-300">
                <Trash2 className="w-3 h-3" /> Remove plan
              </button>
            </div>
          ))}
        </div>
        <button onClick={savePlans} disabled={saving} className="w-full py-2.5 gradient-pink rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 press">
          <Save className="w-4 h-4" /> Save All Plans
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
          <Gift className="w-4 h-4 text-primary" /> Referral Reward Settings
        </h3>
        <div className="p-3 bg-muted/30 rounded-xl mb-3">
          <p className="text-xs text-muted-foreground mb-1.5">Paying referrals needed for Lifetime VIP reward</p>
          <p className="text-xs text-muted-foreground">Currently fixed at <strong>10 paying referrals</strong> = Lifetime VIP + Gold Badge reward</p>
        </div>
        <p className="text-xs text-muted-foreground">When a user&apos;s referrals reach 10 paying members, they automatically receive Lifetime VIP + Gold Badge.</p>
      </div>

      {/* Social Links */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
          <Settings className="w-4 h-4 text-primary" /> Social Links
        </h3>
        <div className="space-y-3">
          {Object.entries(socials).map(([key, val]) => (
            <div key={key}>
              <label className="text-xs text-muted-foreground mb-1.5 block capitalize font-medium">{key}</label>
              <input className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary transition-all" value={val} onChange={e => setSocials(prev => ({ ...prev, [key]: e.target.value }))} placeholder={`${key} link`} />
            </div>
          ))}
          <button onClick={saveSocials} disabled={saving} className="w-full py-2.5 gradient-pink rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 press">
            <Save className="w-4 h-4" /> Save Social Links
          </button>
        </div>
      </div>
    </div>
  );
}
