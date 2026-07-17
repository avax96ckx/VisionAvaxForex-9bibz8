import { useState, useEffect } from 'react';
import {
  Key, CheckCircle2, XCircle, Loader2, Save, Eye, EyeOff,
  RefreshCw, AlertCircle, Zap, Activity, Globe, Shield,
  ChevronDown, ChevronUp, AlertTriangle, BarChart2, CreditCard,
  Gauge, Clock
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { FunctionsHttpError } from '@supabase/supabase-js';

interface ApiService {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  provider: 'groq' | 'openrouter';
  placeholder: string;
  testProvider: string;
  usedBy: string[];
  docsUrl: string;
  docsLabel: string;
  supportsBalance: boolean;
}

const API_SERVICES: ApiService[] = [
  {
    id: 'groq',
    name: 'Groq Cloud API',
    description: 'Powers AVAX AI Hub, Live Agent, Challenge AI, Trading Journal AI',
    icon: Zap,
    color: 'text-orange-400',
    bgColor: 'rgba(249,115,22,0.15)',
    provider: 'groq',
    placeholder: 'gsk_...',
    testProvider: 'groq',
    usedBy: ['AVAX AI Hub', 'Live Agent', 'AI Challenge', 'Trading Journal AI'],
    docsUrl: 'https://console.groq.com/keys',
    docsLabel: 'console.groq.com/keys',
    supportsBalance: true,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter API',
    description: 'Primary for Signal Analysis & Vision tasks (Gemini 2.5 Flash). Groq used as fallback.',
    icon: Globe,
    color: 'text-blue-400',
    bgColor: 'rgba(59,130,246,0.15)',
    provider: 'openrouter',
    placeholder: 'sk-or-v1-...',
    testProvider: 'openrouter',
    usedBy: ['Signal Analysis', 'Chart Vision AI'],
    docsUrl: 'https://openrouter.ai/keys',
    docsLabel: 'openrouter.ai/keys',
    supportsBalance: true,
  },
];

interface KeyStatus {
  tested: boolean;
  working: boolean;
  latency?: number;
  error?: string;
}

interface BalanceInfo {
  // Groq fields
  limit_requests?: string | null;
  remaining_requests?: string | null;
  reset_requests?: string | null;
  limit_tokens?: string | null;
  remaining_tokens?: string | null;
  reset_tokens?: string | null;
  latency_ms?: number;
  // OpenRouter fields
  label?: string;
  usage?: number;
  limit?: number | null;
  is_free_tier?: boolean;
  rate_limit?: { requests: number; interval: string };
}

interface HealthResult {
  feature: string;
  status: 'ok' | 'error' | 'testing';
  latency?: number;
  error?: string;
}

const SLOW_LATENCY_MS = 8000;
const WARN_LATENCY_MS = 5000;

export default function AdminAPIKeys() {
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [savedKeys, setSavedKeys] = useState<Record<string, string>>({});
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [statuses, setStatuses] = useState<Record<string, KeyStatus>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [loadingCurrent, setLoadingCurrent] = useState(true);
  const [balances, setBalances] = useState<Record<string, BalanceInfo | null>>({});
  const [checkingBalance, setCheckingBalance] = useState<Record<string, boolean>>({});

  // Health check
  const [healthResults, setHealthResults] = useState<HealthResult[]>([]);
  const [runningHealth, setRunningHealth] = useState(false);
  const [showHealth, setShowHealth] = useState(false);

  // Custom key
  const [customLabel, setCustomLabel] = useState('');
  const [customValue, setCustomValue] = useState('');
  const [showCustomValue, setShowCustomValue] = useState(false);
  const [savingCustom, setSavingCustom] = useState(false);
  const [savedCustomKeys, setSavedCustomKeys] = useState<Array<{ id: string; label: string; value: string; show: boolean }>>([]);

  useEffect(() => { loadSavedKeys(); }, []);

  async function loadSavedKeys() {
    setLoadingCurrent(true);
    const { data } = await supabase.from('site_settings').select('api_keys').eq('id', 'main').single();
    if (data?.api_keys) {
      const saved = data.api_keys as Record<string, string>;
      setSavedKeys(saved);
      const filled: Record<string, string> = {};
      for (const svc of API_SERVICES) {
        if (saved[svc.id]) filled[svc.id] = saved[svc.id];
      }
      setKeys(filled);
      const knownIds = new Set(API_SERVICES.map(s => s.id));
      const customs: Array<{ id: string; label: string; value: string; show: boolean }> = [];
      for (const [k, v] of Object.entries(saved)) {
        if (!knownIds.has(k) && typeof v === 'string') {
          customs.push({ id: k, label: k.replace(/^custom_/, '').replace(/_/g, ' '), value: v, show: false });
        }
      }
      setSavedCustomKeys(customs);
    }
    setLoadingCurrent(false);
  }

  function getQuotaWarning(status: KeyStatus | undefined): { level: 'ok' | 'warn' | 'slow' | null; msg: string } {
    if (!status?.tested || !status.working || !status.latency) return { level: null, msg: '' };
    if (status.latency > SLOW_LATENCY_MS) return { level: 'slow', msg: `Very slow (${status.latency}ms) — quota may be exhausted.` };
    if (status.latency > WARN_LATENCY_MS) return { level: 'warn', msg: `Slow (${status.latency}ms) — approaching free tier limit.` };
    return { level: 'ok', msg: '' };
  }

  // ── Check API Balance ──────────────────────────────────────────
  async function checkBalance(service: ApiService) {
    const keyVal = (savedKeys[service.id] || keys[service.id] || '').trim();
    if (!keyVal || keyVal.length < 10) { toast.error('Save an API key first before checking balance'); return; }

    setCheckingBalance(p => ({ ...p, [service.id]: true }));
    setBalances(p => ({ ...p, [service.id]: null }));

    try {
      const { data, error } = await supabase.functions.invoke('avax-ai', {
        body: {
          aiId: 'forex_basics',
          _checkBalance: true,
          _testProvider: service.testProvider,
          _testKey: keyVal,
        },
      });

      if (error) {
        let errMsg = error.message;
        if (error instanceof FunctionsHttpError) {
          try { errMsg = (await error.context?.text?.()) || error.message; } catch {}
        }
        toast.error('Balance check failed: ' + errMsg.slice(0, 100));
        setBalances(p => ({ ...p, [service.id]: null }));
      } else if (data?.balance) {
        setBalances(p => ({ ...p, [service.id]: data.balance }));
        toast.success(`✅ ${service.name} balance loaded`);
      } else {
        toast.error('No balance data returned');
      }
    } catch (err: any) {
      toast.error('Balance check failed: ' + err.message);
    }
    setCheckingBalance(p => ({ ...p, [service.id]: false }));
  }

  async function testApiKey(service: ApiService) {
    const keyVal = (keys[service.id] || savedKeys[service.id] || '').trim();
    if (!keyVal || keyVal.length < 10) { toast.error('Enter a valid API key first'); return; }

    setTesting(p => ({ ...p, [service.id]: true }));
    setStatuses(p => ({ ...p, [service.id]: { tested: false, working: false } }));

    const start = Date.now();
    try {
      const { data, error } = await supabase.functions.invoke('avax-ai', {
        body: {
          aiId: 'forex_basics',
          messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
          _testKey: keyVal,
          _testProvider: service.testProvider,
          _testMode: true,
        },
      });
      const latency = Date.now() - start;
      if (error) {
        let errMsg = error.message;
        if (error instanceof FunctionsHttpError) {
          try { const txt = await error.context?.text?.(); errMsg = txt || error.message; } catch {}
        }
        setStatuses(p => ({ ...p, [service.id]: { tested: true, working: false, error: errMsg.slice(0, 180) } }));
        toast.error('Test failed: ' + errMsg.slice(0, 80));
      } else if (data?.text || data?.tested) {
        setStatuses(p => ({ ...p, [service.id]: { tested: true, working: true, latency } }));
        const quota = latency > WARN_LATENCY_MS ? ' ⚠️ Slow response' : '';
        toast.success(`✅ ${service.name} working! (${latency}ms)${quota}`);
      } else {
        setStatuses(p => ({ ...p, [service.id]: { tested: true, working: false, error: 'No response from API' } }));
        toast.error('API test returned empty response');
      }
    } catch (err: any) {
      setStatuses(p => ({ ...p, [service.id]: { tested: true, working: false, error: err.message } }));
      toast.error('Test failed: ' + err.message);
    }
    setTesting(p => ({ ...p, [service.id]: false }));
  }

  async function saveApiKey(service: ApiService) {
    const keyVal = (keys[service.id] || '').trim();
    if (!keyVal || keyVal.length < 10) { toast.error('Enter a valid API key'); return; }
    setSaving(p => ({ ...p, [service.id]: true }));
    try {
      const { data: current } = await supabase.from('site_settings').select('api_keys').eq('id', 'main').single();
      const existing = (current?.api_keys as Record<string, string>) || {};
      const updated = { ...existing, [service.id]: keyVal };
      const { error } = await supabase.from('site_settings').update({ api_keys: updated } as any).eq('id', 'main');
      if (error) throw error;
      setSavedKeys(p => ({ ...p, [service.id]: keyVal }));
      toast.success(`✅ ${service.name} key saved & active!`);
      await testApiKey(service);
    } catch (err: any) {
      toast.error('Failed to save: ' + err.message);
    }
    setSaving(p => ({ ...p, [service.id]: false }));
  }

  // ── Health Check ──────────────────────────────────────────────
  async function runHealthCheck() {
    setRunningHealth(true);
    setShowHealth(true);
    const features = [
      { feature: 'AVAX AI Hub (Groq)', fn: 'avax-ai', body: { aiId: 'forex_basics', messages: [{ role: 'user', content: 'Say OK' }] } },
      { feature: 'Live Agent (Groq)', fn: 'live-agent', body: { messages: [{ role: 'user', content: 'Hi' }] } },
      { feature: 'Signal Vision (analyze-signal)', fn: 'analyze-signal', body: { imageUrl: 'https://picsum.photos/100', mode: 'setup' } },
      { feature: 'Challenge AI (Groq)', fn: 'avax-ai', body: { aiId: 'risk_management', messages: [{ role: 'user', content: 'Test' }] } },
    ];
    setHealthResults(features.map(f => ({ feature: f.feature, status: 'testing' as const })));
    await Promise.all(
      features.map(async (f, idx) => {
        const start = Date.now();
        try {
          const { data, error } = await supabase.functions.invoke(f.fn, { body: f.body });
          const latency = Date.now() - start;
          let result: HealthResult;
          if (error) {
            let errMsg = error.message;
            if (error instanceof FunctionsHttpError) {
              try { errMsg = (await error.context?.text?.()) || error.message; } catch {}
            }
            result = { feature: f.feature, status: 'error', latency, error: errMsg.slice(0, 100) };
          } else if (data?.text || data?.success || data?.data) {
            result = { feature: f.feature, status: 'ok', latency };
          } else {
            result = { feature: f.feature, status: 'error', latency, error: 'Empty response' };
          }
          setHealthResults(prev => { const u = [...prev]; u[idx] = result; return u; });
        } catch (err: any) {
          setHealthResults(prev => { const u = [...prev]; u[idx] = { feature: f.feature, status: 'error', error: err.message.slice(0, 80) }; return u; });
        }
      })
    );
    setRunningHealth(false);
    toast.success('Health check complete');
  }

  // ── Custom Key Save ────────────────────────────────────────────
  async function saveCustomKey() {
    if (!customLabel.trim() || !customValue.trim()) { toast.error('Enter both label and key value'); return; }
    setSavingCustom(true);
    try {
      const id = 'custom_' + customLabel.toLowerCase().replace(/\s+/g, '_');
      const { data: current } = await supabase.from('site_settings').select('api_keys').eq('id', 'main').single();
      const existing = (current?.api_keys as Record<string, string>) || {};
      const updated = { ...existing, [id]: customValue.trim() };
      const { error } = await supabase.from('site_settings').update({ api_keys: updated } as any).eq('id', 'main');
      if (error) throw error;
      setSavedCustomKeys(prev => {
        const idx = prev.findIndex(k => k.id === id);
        const entry = { id, label: customLabel.trim(), value: customValue.trim(), show: false };
        if (idx >= 0) { const u = [...prev]; u[idx] = entry; return u; }
        return [...prev, entry];
      });
      setSavedKeys(p => ({ ...p, [id]: customValue.trim() }));
      setCustomLabel(''); setCustomValue('');
      toast.success(`✅ "${customLabel}" saved!`);
    } catch (err: any) { toast.error('Save failed: ' + err.message); }
    setSavingCustom(false);
  }

  async function deleteCustomKey(id: string) {
    if (!confirm('Delete this key?')) return;
    const { data: current } = await supabase.from('site_settings').select('api_keys').eq('id', 'main').single();
    const existing = { ...(current?.api_keys as Record<string, string>) };
    delete existing[id];
    await supabase.from('site_settings').update({ api_keys: existing } as any).eq('id', 'main');
    setSavedCustomKeys(prev => prev.filter(k => k.id !== id));
    toast.success('Key deleted');
  }

  function maskKey(key: string): string {
    if (!key || key.length < 8) return key;
    return key.slice(0, 8) + '•'.repeat(Math.min(18, key.length - 12)) + key.slice(-4);
  }

  // ── Balance display helpers ──────────────────────────────────
  function renderGroqBalance(b: BalanceInfo) {
    const used = b.limit_requests && b.remaining_requests
      ? parseInt(b.limit_requests) - parseInt(b.remaining_requests)
      : null;
    const pct = b.limit_requests && b.remaining_requests
      ? Math.round((parseInt(b.remaining_requests) / parseInt(b.limit_requests)) * 100)
      : null;
    const tokUsed = b.limit_tokens && b.remaining_tokens
      ? parseInt(b.limit_tokens) - parseInt(b.remaining_tokens)
      : null;
    const barColor = pct === null ? '#6b7280' : pct > 50 ? '#22c55e' : pct > 20 ? '#f59e0b' : '#ef4444';
    return (
      <div className="space-y-2">
        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide flex items-center gap-1">
          <Gauge className="w-3 h-3" /> Groq Rate Limits
          {b.latency_ms !== undefined && <span className="ml-auto text-muted-foreground font-normal">{b.latency_ms}ms</span>}
        </p>
        {b.limit_requests && (
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[10px] text-muted-foreground">Requests</span>
              <span className="text-[10px] font-bold text-foreground">
                {b.remaining_requests}/{b.limit_requests}
                {pct !== null && <span className="text-muted-foreground ml-1">({pct}% left)</span>}
              </span>
            </div>
            {pct !== null && (
              <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
              </div>
            )}
            {b.reset_requests && <p className="text-[9px] text-muted-foreground mt-0.5">Resets: {b.reset_requests}</p>}
          </div>
        )}
        {b.limit_tokens && (
          <div>
            <div className="flex justify-between mb-0.5">
              <span className="text-[10px] text-muted-foreground">Tokens</span>
              <span className="text-[10px] font-bold text-foreground">{b.remaining_tokens}/{b.limit_tokens} left</span>
            </div>
            {b.reset_tokens && <p className="text-[9px] text-muted-foreground">Resets: {b.reset_tokens}</p>}
          </div>
        )}
        {used !== null && <p className="text-[10px] text-muted-foreground">Used this window: {used} requests</p>}
      </div>
    );
  }

  function renderOpenRouterBalance(b: BalanceInfo) {
    const usage = typeof b.usage === 'number' ? b.usage : null;
    const limit = typeof b.limit === 'number' ? b.limit : null;
    const pct = usage !== null && limit !== null && limit > 0
      ? Math.round(((limit - usage) / limit) * 100)
      : null;
    const barColor = pct === null ? '#6b7280' : pct > 50 ? '#22c55e' : pct > 20 ? '#f59e0b' : '#ef4444';
    return (
      <div className="space-y-2">
        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide flex items-center gap-1">
          <CreditCard className="w-3 h-3" /> OpenRouter Credits
        </p>
        {b.label && <p className="text-xs text-foreground font-bold">{b.label}</p>}
        {b.is_free_tier !== undefined && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${b.is_free_tier ? 'bg-green-500/15 text-green-400' : 'bg-blue-500/15 text-blue-400'}`}>
            {b.is_free_tier ? '🆓 Free Tier' : '💳 Paid Account'}
          </span>
        )}
        {usage !== null && (
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[10px] text-muted-foreground">Credits Used</span>
              <span className="text-[10px] font-bold text-foreground">
                ${usage.toFixed(4)}{limit !== null && <span className="text-muted-foreground"> / ${limit.toFixed(2)}</span>}
              </span>
            </div>
            {pct !== null && (
              <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
              </div>
            )}
            {pct !== null && <p className="text-[9px] text-muted-foreground mt-0.5">{pct}% remaining</p>}
          </div>
        )}
        {b.rate_limit && (
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" /> Rate limit: {b.rate_limit.requests} req / {b.rate_limit.interval}
          </p>
        )}
        {b.is_free_tier && (
          <p className="text-[10px] text-yellow-400/80">⚠️ Free tier — limited credits/day</p>
        )}
      </div>
    );
  }

  if (loadingCurrent) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-48 bg-muted/30 rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 to-blue-500/10 border border-primary/25 rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Key className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-black text-foreground text-sm">AI API Keys Manager</p>
            <p className="text-xs text-muted-foreground">Saved to DB — applied instantly to ALL AI features</p>
          </div>
        </div>
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-400">Keys stored securely. Changes take effect instantly — no restart needed.</p>
          </div>
        </div>
      </div>

      {/* API Service Cards */}
      {API_SERVICES.map(service => {
        const status = statuses[service.id];
        const isTesting = testing[service.id];
        const isSaving = saving[service.id];
        const isCheckingBal = checkingBalance[service.id];
        const currentKey = keys[service.id] || '';
        const savedKey = savedKeys[service.id] || '';
        const isVisible = showKey[service.id];
        const hasSavedKey = savedKey.length > 0;
        const quota = getQuotaWarning(status);
        const balance = balances[service.id];

        return (
          <div key={service.id} className="bg-card border border-border rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 pb-3 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: service.bgColor }}>
                  <service.icon className={`w-5 h-5 ${service.color}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-black text-foreground text-sm">{service.name}</p>
                    {status?.tested && (
                      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${status.working ? 'bg-green-500/15 text-green-400 border border-green-500/25' : 'bg-red-500/15 text-red-400 border border-red-500/25'}`}>
                        {status.working
                          ? <><CheckCircle2 className="w-3 h-3" /> Active {status.latency ? `${status.latency}ms` : ''}</>
                          : <><XCircle className="w-3 h-3" /> Failed</>}
                      </div>
                    )}
                    {!status?.tested && hasSavedKey && (
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/25">
                        <Shield className="w-3 h-3" /> Saved
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{service.description}</p>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {/* Saved key display */}
              {hasSavedKey && (
                <div className="flex items-center gap-2 p-2.5 bg-muted/30 rounded-xl border border-border/50">
                  <Shield className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground">Current saved key</p>
                    <p className="text-xs font-mono text-foreground truncate">{maskKey(savedKey)}</p>
                  </div>
                </div>
              )}

              {/* Quota warning */}
              {quota.level === 'slow' && (
                <div className="flex items-start gap-2 p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-400">⚠️ {quota.msg}</p>
                </div>
              )}
              {quota.level === 'warn' && (
                <div className="flex items-start gap-2 p-2.5 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-400">⚠️ {quota.msg}</p>
                </div>
              )}

              {/* Balance Info Panel */}
              {balance && (
                <div className="p-3 bg-muted/20 border border-border/50 rounded-xl">
                  {service.id === 'groq' ? renderGroqBalance(balance) : renderOpenRouterBalance(balance)}
                </div>
              )}

              {/* Key input */}
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">
                  {hasSavedKey ? 'Replace key' : 'Enter key'} — get it from{' '}
                  <a href={service.docsUrl} target="_blank" rel="noreferrer" className="text-primary underline">{service.docsLabel}</a>
                </p>
                <div className="relative">
                  <input
                    type={isVisible ? 'text' : 'password'}
                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary font-mono pr-10"
                    placeholder={service.placeholder}
                    value={currentKey}
                    onChange={e => setKeys(p => ({ ...p, [service.id]: e.target.value }))}
                  />
                  <button onClick={() => setShowKey(p => ({ ...p, [service.id]: !isVisible }))} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded press">
                    {isVisible ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {status?.tested && !status.working && status.error && (
                <div className="flex items-start gap-2 p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-400 break-all">{status.error}</p>
                </div>
              )}

              {/* Success */}
              {status?.tested && status.working && quota.level === 'ok' && (
                <div className="flex items-center gap-2 p-2.5 bg-green-500/10 border border-green-500/20 rounded-xl">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-green-400 font-bold">Working correctly</p>
                    {status.latency && <p className="text-[10px] text-green-400/70">Response: {status.latency}ms — healthy</p>}
                  </div>
                </div>
              )}

              {/* Used by tags */}
              <div className="flex flex-wrap gap-1.5">
                {service.usedBy.map(feature => (
                  <span key={feature} className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">{feature}</span>
                ))}
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => testApiKey(service)}
                  disabled={isTesting || (!currentKey && !savedKey)}
                  className="flex items-center gap-1.5 px-3 py-2.5 bg-muted border border-border rounded-xl text-foreground text-xs font-bold press disabled:opacity-40 justify-center"
                >
                  {isTesting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Testing...</> : <><RefreshCw className="w-3.5 h-3.5" /> Test Key</>}
                </button>
                <button
                  onClick={() => saveApiKey(service)}
                  disabled={isSaving || !currentKey || currentKey.length < 10}
                  className="flex items-center gap-1.5 px-3 py-2.5 gradient-pink rounded-xl text-white text-xs font-bold press disabled:opacity-40 justify-center"
                >
                  {isSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</> : <><Save className="w-3.5 h-3.5" /> Save & Activate</>}
                </button>
              </div>

              {/* Balance Check button */}
              {service.supportsBalance && hasSavedKey && (
                <button
                  onClick={() => checkBalance(service)}
                  disabled={isCheckingBal}
                  className="w-full flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold press disabled:opacity-40 justify-center border"
                  style={{
                    background: 'rgba(99,102,241,0.08)',
                    borderColor: 'rgba(99,102,241,0.25)',
                    color: '#818cf8',
                  }}
                >
                  {isCheckingBal
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking balance...</>
                    : <><BarChart2 className="w-3.5 h-3.5" /> Check Balance / Credits</>}
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* API Health Check */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <button onClick={() => setShowHealth(!showHealth)} className="w-full flex items-center gap-3 p-4 press">
          <div className="w-10 h-10 rounded-2xl bg-green-500/15 flex items-center justify-center flex-shrink-0">
            <Activity className="w-5 h-5 text-green-400" />
          </div>
          <div className="flex-1 text-left">
            <p className="font-black text-foreground text-sm">API Health Check</p>
            <p className="text-xs text-muted-foreground">Test all AI features simultaneously</p>
          </div>
          {showHealth ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        {showHealth && (
          <div className="px-4 pb-4 space-y-3 border-t border-border/50">
            <button
              onClick={runHealthCheck}
              disabled={runningHealth}
              className="mt-3 w-full py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 press disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #16a34a, #22c55e)' }}
            >
              {runningHealth ? <><Loader2 className="w-4 h-4 animate-spin" /> Testing All...</> : <><Activity className="w-4 h-4" /> Test All AI Features</>}
            </button>
            {healthResults.length > 0 && (
              <div className="space-y-2">
                {healthResults.map((r, i) => {
                  const isSlowOk = r.status === 'ok' && r.latency && r.latency > WARN_LATENCY_MS;
                  return (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl"
                      style={{
                        background: r.status === 'ok' ? (isSlowOk ? 'rgba(234,179,8,0.08)' : 'rgba(34,197,94,0.08)') : r.status === 'error' ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${r.status === 'ok' ? (isSlowOk ? 'rgba(234,179,8,0.2)' : 'rgba(34,197,94,0.2)') : r.status === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)'}`,
                      }}>
                      <div className="flex-shrink-0">
                        {r.status === 'testing' && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />}
                        {r.status === 'ok' && !isSlowOk && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                        {r.status === 'ok' && isSlowOk && <AlertTriangle className="w-4 h-4 text-yellow-400" />}
                        {r.status === 'error' && <XCircle className="w-4 h-4 text-red-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground">{r.feature}</p>
                        {r.status === 'error' && r.error && <p className="text-[10px] text-red-400 truncate">{r.error}</p>}
                        {r.status === 'ok' && isSlowOk && <p className="text-[10px] text-yellow-400">Slow — check quota</p>}
                        {r.status === 'testing' && <p className="text-[10px] text-muted-foreground">Testing...</p>}
                      </div>
                      {r.latency !== undefined && (
                        <span className={`text-[10px] font-bold flex-shrink-0 ${r.status === 'ok' ? (isSlowOk ? 'text-yellow-400' : 'text-green-400') : 'text-muted-foreground'}`}>
                          {r.latency}ms
                        </span>
                      )}
                    </div>
                  );
                })}
                <p className="text-[10px] text-muted-foreground text-center pt-1">
                  ⚡ &lt;3s = healthy · ⚠️ 5–8s = near limit · 🔴 &gt;8s = quota exhausted
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Custom / Other API Keys */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/15 flex items-center justify-center flex-shrink-0">
            <Key className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <p className="font-black text-foreground text-sm">Other API Keys</p>
            <p className="text-xs text-muted-foreground">Store any other API key securely (e.g. Firebase, Stripe)</p>
          </div>
        </div>
        <div className="space-y-2 mb-4">
          <input
            className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary"
            placeholder="Key name (e.g. Firebase Server Key)"
            value={customLabel}
            onChange={e => setCustomLabel(e.target.value)}
          />
          <div className="relative">
            <input
              className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary font-mono pr-10"
              placeholder="API key value"
              type={showCustomValue ? 'text' : 'password'}
              value={customValue}
              onChange={e => setCustomValue(e.target.value)}
            />
            <button onClick={() => setShowCustomValue(!showCustomValue)} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded press">
              {showCustomValue ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>
          </div>
          <button
            onClick={saveCustomKey}
            disabled={savingCustom || !customLabel.trim() || !customValue.trim()}
            className="w-full py-2.5 gradient-pink rounded-xl text-white text-sm font-bold press disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {savingCustom ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save Key</>}
          </button>
        </div>
        {savedCustomKeys.length > 0 && (
          <div className="space-y-2 border-t border-border/50 pt-3">
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wide mb-2">Saved Keys</p>
            {savedCustomKeys.map(ck => (
              <div key={ck.id} className="flex items-center gap-3 p-3 bg-muted/20 rounded-xl border border-border/50">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground capitalize">{ck.label}</p>
                  <p className="text-[10px] font-mono text-muted-foreground truncate">{ck.show ? ck.value : maskKey(ck.value)}</p>
                </div>
                <button onClick={() => setSavedCustomKeys(prev => prev.map(k => k.id === ck.id ? { ...k, show: !k.show } : k))} className="p-1.5 bg-muted rounded-lg press">
                  {ck.show ? <EyeOff className="w-3 h-3 text-muted-foreground" /> : <Eye className="w-3 h-3 text-muted-foreground" />}
                </button>
                <button onClick={() => deleteCustomKey(ck.id)} className="p-1.5 bg-red-500/10 rounded-lg press text-red-400 text-[10px] font-bold">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Provider quick links */}
      <div className="grid grid-cols-2 gap-3">
        <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer"
          className="block py-3 text-center rounded-xl text-white text-xs font-bold press"
          style={{ background: 'linear-gradient(135deg, #f97316, #eab308)' }}>
          ⚡ Get Groq Key →
        </a>
        <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer"
          className="block py-3 text-center rounded-xl text-white text-xs font-bold press"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
          🌐 Get OpenRouter Key →
        </a>
      </div>
    </div>
  );
}
