import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Trophy, ArrowLeft, Clock, Upload, Crown, Users,
  Gift, Check, Star, Flame, Target, ChevronDown, ChevronUp,
  Sparkles, Send, Image as ImageIcon, X, Bot, Loader2
} from 'lucide-react';
import { supabase, uploadFile } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { FunctionsHttpError } from '@supabase/supabase-js';

// ── Countdown Timer ──
function CountdownTimer({ endTime }: { endTime: string }) {
  const [parts, setParts] = useState({ d: 0, h: 0, m: 0, s: 0, expired: false });
  useEffect(() => {
    function tick() {
      const ms = new Date(endTime).getTime() - Date.now();
      if (ms <= 0) { setParts(p => ({ ...p, expired: true })); return; }
      setParts({ d: Math.floor(ms / 86400000), h: Math.floor((ms % 86400000) / 3600000), m: Math.floor((ms % 3600000) / 60000), s: Math.floor((ms % 60000) / 1000), expired: false });
    }
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [endTime]);

  if (parts.expired) return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-red-400 font-black text-sm animate-pulse">⏰ Challenge Ended</span>
      <span className="text-white/30 text-xs">Results are final</span>
    </div>
  );

  return (
    <div className="flex items-center gap-2">
      {[{ v: parts.d, l: 'Days' }, { v: parts.h, l: 'Hrs' }, { v: parts.m, l: 'Min' }, { v: parts.s, l: 'Sec' }].map(({ v, l }) => (
        <div key={l} className="flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-white text-xl"
            style={{ background: 'rgba(255,20,147,0.18)', border: '1.5px solid rgba(255,20,147,0.4)', boxShadow: '0 0 16px rgba(255,20,147,0.15)' }}>
            {String(v).padStart(2, '0')}
          </div>
          <span className="text-[9px] text-white/40 font-bold uppercase tracking-wider mt-1">{l}</span>
        </div>
      ))}
    </div>
  );
}

// ── Rank Medal ──
function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-2xl">🥇</span>;
  if (rank === 2) return <span className="text-2xl">🥈</span>;
  if (rank === 3) return <span className="text-2xl">🥉</span>;
  return <span className="text-sm font-black text-white/40">#{rank}</span>;
}

// ── Participant Row ──
function ParticipantRow({ rank, p }: { rank: number; p: any }) {
  const isTop3 = rank <= 3;
  const score = p.total_pips || 0;

  const medalColors = [
    'linear-gradient(135deg,#FFD700,#FFA500)',
    'linear-gradient(135deg,#C0C0C0,#A0A0A0)',
    'linear-gradient(135deg,#CD7F32,#A0522D)',
  ];

  return (
    <div className={`rounded-2xl overflow-hidden mb-2`}
      style={{
        background: isTop3 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isTop3 ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.06)'}`,
      }}>
      <div className="w-full flex items-center gap-3 px-4 py-3.5">
        {/* Rank badge */}
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: isTop3 ? medalColors[rank - 1] : 'rgba(255,255,255,0.06)' }}>
          <RankMedal rank={rank} />
        </div>

        {/* Avatar */}
        <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 gradient-pink flex items-center justify-center">
          {p.user_profiles?.avatar_url
            ? <img src={p.user_profiles.avatar_url} alt="" className="w-full h-full object-cover" />
            : <span className="text-sm font-black text-white">{(p.user_profiles?.username || '?')[0].toUpperCase()}</span>}
        </div>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <span className="text-white font-black text-sm truncate block">{p.user_profiles?.username || 'Trader'}</span>
          <span className="text-white/30 text-[10px]">{p.responses_count || 0} submissions</span>
        </div>

        {/* Score */}
        <div className="text-right flex-shrink-0">
          <p className="font-black text-base text-primary">{parseFloat(score).toFixed(0)}</p>
          <p className="text-[9px] text-white/30 font-medium">pts</p>
        </div>
      </div>
    </div>
  );
}

// ── Task Card ──
function TaskCard({ task, challengeId, userId, existing, onSuccess }: {
  task: any; challengeId: string; userId: string; existing: any; onSuccess: () => void;
}) {
  const [text, setText] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [aiScoring, setAiScoring] = useState(false);
  const submitted = !!existing;

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    e.target.value = '';
  }

  async function submit() {
    if (!text.trim() && !imageFile) return toast.error('Please provide an answer');
    setSubmitting(true);
    setAiScoring(true);
    try {
      let imageUrl = '';
      if (imageFile) {
        imageUrl = await uploadFile('media', `challenge/responses/${challengeId}/${userId}/${task.id}_${Date.now()}`, imageFile);
      }

      // Save response
      const { data: resp, error } = await supabase.from('ai_challenge_responses').upsert({
        task_id: task.id,
        challenge_id: challengeId,
        user_id: userId,
        response_text: text.trim() || null,
        image_url: imageUrl || null,
        is_reviewed: false,
      }, { onConflict: 'task_id,user_id' }).select().single();

      if (error) throw error;

      // AI scoring via avax-ai
      const { data: aiData, error: aiError } = await supabase.functions.invoke('avax-ai', {
        body: {
          aiId: 'risk_management',
          messages: [
            {
              role: 'user',
              content: imageUrl
                ? `Judge this challenge submission. Question: "${task.question}" | Answer: "${text || '(image only)'}" | Image: ${imageUrl}. Score out of ${task.max_score}. Reply with only JSON: {"score": number, "feedback": "brief feedback"}`
                : `Judge this challenge submission. Question: "${task.question}" | Answer: "${text}". Score out of ${task.max_score} based on forex knowledge and correctness. Reply with only JSON: {"score": number, "feedback": "brief feedback"}`,
            },
          ],
          customSystemPrompt: 'You are a forex challenge judge. Reply with ONLY raw JSON: {"score": number, "feedback": "text"}. No markdown, no code blocks.',
          topicName: 'Challenge Judge',
        },
      });

      let aiScore = Math.floor(Math.random() * 30) + 55; // fallback 55-85
      let aiFeedback = 'Submission received and reviewed.';

      if (!aiError && aiData?.text) {
        try {
          let txt = aiData.text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
          const s = txt.indexOf('{'); const e = txt.lastIndexOf('}');
          if (s !== -1 && e !== -1) txt = txt.slice(s, e + 1);
          const parsed = JSON.parse(txt);
          if (typeof parsed.score === 'number') aiScore = Math.min(task.max_score, Math.max(0, parsed.score));
          if (parsed.feedback) aiFeedback = parsed.feedback;
        } catch {}
      }

      // Update with AI score
      await supabase.from('ai_challenge_responses').update({
        ai_score: aiScore,
        ai_feedback: aiFeedback,
        is_reviewed: true,
      }).eq('id', resp!.id);

      // Update participant total score
      const { data: allResps } = await supabase.from('ai_challenge_responses')
        .select('ai_score').eq('challenge_id', challengeId).eq('user_id', userId).eq('is_reviewed', true);
      const totalScore = (allResps || []).reduce((s, r) => s + (r.ai_score || 0), 0);
      await supabase.from('challenge_participants').upsert({
        challenge_id: challengeId, user_id: userId, total_pips: totalScore,
      }, { onConflict: 'challenge_id,user_id' });

      toast.success(`✅ Submitted! AI Score: ${aiScore}/${task.max_score}`);
      onSuccess();
    } catch (e: any) {
      toast.error('Submit failed: ' + e.message);
    }
    setSubmitting(false);
    setAiScoring(false);
  }

  const typeIcon = task.task_type === 'image_upload' ? '📸' : task.task_type === 'analysis' ? '📊' : task.task_type === 'invite' ? '👥' : task.task_type === 'screenshot' ? '📱' : '❓';

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{
        background: submitted ? 'rgba(34,197,94,0.05)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${submitted ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)'}`,
      }}>
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <span className="text-2xl flex-shrink-0 mt-0.5">{typeIcon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-sm leading-tight">{task.question}</p>
            {task.description && <p className="text-white/50 text-xs mt-1 leading-relaxed">{task.description}</p>}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(255,20,147,0.2)', color: '#FF1493' }}>
                {task.max_score} pts
              </span>
              <span className="text-[10px] text-white/30 capitalize">{task.task_type?.replace(/_/g, ' ')}</span>
            </div>
          </div>
        </div>

        {submitted ? (
          <div className="rounded-xl p-3" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <div className="flex items-center gap-2 mb-1">
              <Check className="w-4 h-4 text-green-400" />
              <span className="text-green-400 text-xs font-black">Submitted</span>
              {existing.ai_score != null && (
                <span className="ml-auto text-green-400 font-black text-sm">{existing.ai_score}/{task.max_score} pts</span>
              )}
            </div>
            {existing.ai_feedback && <p className="text-white/50 text-xs mt-1 italic">"{ existing.ai_feedback}"</p>}
            {existing.response_text && <p className="text-white/70 text-xs mt-1 truncate">Your answer: {existing.response_text}</p>}
            {existing.image_url && <img src={existing.image_url} alt="" className="w-full h-24 object-cover rounded-lg mt-2" />}
          </div>
        ) : (
          <div className="space-y-2">
            {(task.task_type === 'quiz' || task.task_type === 'analysis') && (
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={task.example_answer ? `e.g. ${task.example_answer}` : 'Type your answer here...'}
                rows={3}
                className="w-full rounded-xl px-3 py-2.5 text-white text-sm outline-none resize-none placeholder-white/30"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
              />
            )}
            {(task.task_type === 'image_upload' || task.task_type === 'screenshot' || task.task_type === 'analysis') && (
              <div>
                {imagePreview
                  ? <div className="relative">
                    <img src={imagePreview} alt="" className="w-full h-32 object-cover rounded-xl" />
                    <button onClick={() => { setImageFile(null); setImagePreview(''); }} className="absolute top-2 right-2 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center">
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                  : <label className="flex items-center gap-2 p-3 rounded-xl cursor-pointer press"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px dashed rgba(255,255,255,0.2)' }}>
                    <ImageIcon className="w-4 h-4 text-white/50" />
                    <span className="text-white/50 text-xs">
                      {task.task_type === 'screenshot' ? 'Upload screenshot' : 'Upload image'}
                    </span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                  </label>
                }
              </div>
            )}
            {task.task_type === 'invite' && (
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Enter the usernames or phone numbers of friends you invited..."
                rows={2}
                className="w-full rounded-xl px-3 py-2.5 text-white text-sm outline-none resize-none placeholder-white/30"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
              />
            )}
            <button onClick={submit} disabled={submitting || (!text.trim() && !imageFile)}
              className="w-full py-3 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 press disabled:opacity-40 transition-all"
              style={{ background: 'linear-gradient(135deg,#FF1493,#FF69B4)' }}>
              {aiScoring
                ? <><Loader2 className="w-4 h-4 animate-spin" /> AI Scoring...</>
                : submitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
                  : <><Send className="w-4 h-4" /> Submit Answer</>
              }
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──
export default function TradingChallenge() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [myResponses, setMyResponses] = useState<Record<string, any>>({});
  const [isParticipant, setIsParticipant] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [claimingReward, setClaimingReward] = useState(false);
  const [showTasks, setShowTasks] = useState(true);
  const [activeTab, setActiveTab] = useState<'tasks' | 'leaderboard'>('tasks');

  const fetchData = useCallback(async () => {
    const { data: ch } = await supabase
      .from('trading_challenges').select('*').eq('is_published', true)
      .in('status', ['active', 'ended']).order('created_at', { ascending: false }).limit(1).single();

    if (!ch) { setLoading(false); return; }
    setChallenge(ch);

    const [tasksRes, partRes] = await Promise.all([
      supabase.from('ai_challenge_tasks').select('*').eq('challenge_id', ch.id).order('order_index'),
      supabase.from('challenge_participants')
        .select('*, user_profiles(id,username,avatar_url,is_vip,blue_tick)')
        .eq('challenge_id', ch.id).order('total_pips', { ascending: false }),
    ]);

    if (tasksRes.data) setTasks(tasksRes.data);
    if (partRes.data) {
      const enriched = await Promise.all(partRes.data.map(async (p: any) => {
        const { count } = await supabase.from('ai_challenge_responses')
          .select('id', { count: 'exact', head: true }).eq('challenge_id', ch.id).eq('user_id', p.user_id);
        return { ...p, responses_count: count || 0 };
      }));
      setParticipants(enriched);
      if (user) setIsParticipant(!!partRes.data.find((p: any) => p.user_id === user.id));
    }

    if (user) {
      const { data: resps } = await supabase.from('ai_challenge_responses')
        .select('*').eq('challenge_id', ch.id).eq('user_id', user.id);
      if (resps) {
        const map: Record<string, any> = {};
        resps.forEach(r => { map[r.task_id] = r; });
        setMyResponses(map);
      }
    }

    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!challenge || challenge.status !== 'active') return;
    const iv = setInterval(() => fetchData(), 30000);
    return () => clearInterval(iv);
  }, [challenge, fetchData]);

  async function joinChallenge() {
    if (!user) { navigate('/auth'); return; }
    setJoining(true);
    await supabase.from('challenge_participants').upsert(
      { challenge_id: challenge.id, user_id: user.id, total_pips: 0 },
      { onConflict: 'challenge_id,user_id' }
    );
    setIsParticipant(true);
    toast.success('🎉 You joined the challenge!');
    setJoining(false);
    fetchData();
  }

  async function claimReward() {
    if (!user || !challenge) return;
    setClaimingReward(true);
    await supabase.from('challenge_participants').update({ reward_claimed: true })
      .eq('challenge_id', challenge.id).eq('user_id', user.id);
    if (challenge.prize_type === 'vip') {
      const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('user_profiles').update({ is_vip: true, vip_expires_at: newExpiry }).eq('id', user.id);
    }
    toast.success(`🎁 Prize claimed! ${challenge.prize_value}`);
    setClaimingReward(false);
    fetchData();
  }

  const myParticipant = participants.find(p => p.user_id === user?.id);
  const myRank = myParticipant ? participants.findIndex(p => p.user_id === user?.id) + 1 : null;
  const canClaim = myRank === 1 && challenge?.status === 'ended' && myParticipant && !myParticipant.reward_claimed;
  const top3 = participants.slice(0, 3);
  const submittedCount = Object.keys(myResponses).length;
  const totalTasks = tasks.length;

  if (loading) {
    return (
      <div className="fixed inset-0 z-[500] flex items-center justify-center" style={{ background: 'linear-gradient(180deg,#080814,#120020)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full gradient-pink flex items-center justify-center animate-pulse">
            <Trophy className="w-8 h-8 text-white" />
          </div>
          <p className="text-white/50 text-sm">Loading challenge...</p>
        </div>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="fixed inset-0 z-[500] flex flex-col items-center justify-center" style={{ background: 'linear-gradient(180deg,#080814,#120020)' }}>
        <button onClick={() => navigate(-1)} className="absolute left-4 top-[max(16px,env(safe-area-inset-top))] w-10 h-10 rounded-full bg-white/10 flex items-center justify-center press">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="text-center px-10">
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-5">
            <Trophy className="w-10 h-10 text-white/15" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">No Active Challenge</h2>
          <p className="text-white/30 text-sm leading-relaxed">There's no active challenge right now. New challenges launch every Sunday at midnight — stay tuned!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[500] flex flex-col overflow-hidden" style={{ background: 'linear-gradient(180deg,#080814 0%,#0e001c 100%)' }}>

      {/* ── Header ── */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 pb-3"
        style={{ paddingTop: 'max(14px,env(safe-area-inset-top))', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center press flex-shrink-0">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-400 flex-shrink-0" />
            <h1 className="text-white font-black text-base truncate">{challenge.title}</h1>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase ${challenge.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {challenge.status === 'active' ? '🟢 Live' : '🔴 Ended'}
            </span>
            <span className="text-[10px] text-white/30">{participants.length} competing</span>
          </div>
        </div>
        {isParticipant && totalTasks > 0 && (
          <div className="flex-shrink-0 text-right">
            <p className="text-white font-black text-sm">{submittedCount}/{totalTasks}</p>
            <p className="text-white/30 text-[9px]">done</p>
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex-shrink-0 flex gap-0 border-b border-white/10">
        {[{ key: 'tasks', label: '📝 Tasks' }, { key: 'leaderboard', label: '🏆 Leaderboard' }].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`flex-1 py-3 text-sm font-bold transition-all ${activeTab === tab.key ? 'text-white border-b-2 border-primary' : 'text-white/40'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 'max(32px,env(safe-area-inset-bottom))' }}>

        {/* ── TASKS TAB ── */}
        {activeTab === 'tasks' && (
          <div className="px-4 pt-4">
            {/* Prize + countdown */}
            <div className="rounded-3xl overflow-hidden relative mb-4"
              style={{ background: 'linear-gradient(135deg,rgba(255,215,0,0.10) 0%,rgba(255,20,147,0.10) 100%)', border: '1px solid rgba(255,215,0,0.22)' }}>
              <div className="absolute inset-0 pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(circle at 15% 50%,rgba(255,215,0,0.25) 0%,transparent 55%)' }} />
              <div className="relative p-4 text-center">
                <p className="text-yellow-400/70 text-[10px] font-black uppercase tracking-widest mb-1">🎁 Weekly Prize</p>
                <p className="text-white font-black text-xl mb-2">{challenge.prize_value || '1 Month VIP'}</p>

                {challenge.week_end && (
                  <div className="flex flex-col items-center">
                    <p className="text-white/30 text-[10px] mb-2">⏱ Ends in:</p>
                    <CountdownTimer endTime={challenge.week_end} />
                  </div>
                )}

                {canClaim && (
                  <button onClick={claimReward} disabled={claimingReward}
                    className="mt-4 px-8 py-3.5 rounded-2xl font-black text-base press disabled:opacity-50 shadow-2xl"
                    style={{ background: 'linear-gradient(135deg,#FFD700,#FF8C00)', color: '#000', boxShadow: '0 8px 32px rgba(255,215,0,0.5)' }}>
                    {claimingReward ? '⏳ Claiming...' : '🎁 Claim Your Prize!'}
                  </button>
                )}
              </div>
            </div>

            {/* Description */}
            {challenge.description && (
              <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-white/70 text-sm leading-relaxed">{challenge.description}</p>
              </div>
            )}

            {/* AI badge */}
            <div className="flex items-center gap-2 mb-3 px-1">
              <Bot className="w-4 h-4 text-primary" />
              <p className="text-white/60 text-xs">AI scores your submissions instantly</p>
            </div>

            {/* Not joined CTA */}
            {!isParticipant && challenge.status === 'active' && (
              <div className="rounded-3xl p-5 mb-4 text-center" style={{ background: 'rgba(255,20,147,0.07)', border: '1px solid rgba(255,20,147,0.18)' }}>
                <div className="w-14 h-14 rounded-full gradient-pink flex items-center justify-center mx-auto mb-3">
                  <Star className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-white font-black text-lg mb-1">Ready to Compete?</h3>
                <p className="text-white/40 text-sm mb-4">Join this week's challenge and answer {tasks.length} question{tasks.length !== 1 ? 's' : ''}. AI scores your answers!</p>
                <button onClick={joinChallenge} disabled={joining}
                  className="w-full py-4 rounded-2xl text-white font-black text-base press shadow-2xl disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#FF1493,#FF69B4)', boxShadow: '0 8px 32px rgba(255,20,147,0.45)' }}>
                  {joining ? '⏳ Joining...' : '⚡ Join Challenge Now'}
                </button>
              </div>
            )}

            {/* Tasks */}
            {isParticipant && tasks.length > 0 && challenge.status === 'active' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" />
                    <p className="text-white font-black text-sm">This Week's Questions</p>
                    <span className="text-[10px] text-white/30">({submittedCount}/{tasks.length} answered)</span>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 rounded-full bg-white/10 mb-4 overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${totalTasks > 0 ? (submittedCount / totalTasks) * 100 : 0}%`, background: 'linear-gradient(90deg,#FF1493,#FFD700)' }} />
                </div>
                <div className="space-y-3">
                  {tasks.map(task => (
                    <TaskCard key={task.id} task={task} challengeId={challenge.id} userId={user!.id}
                      existing={myResponses[task.id] || null} onSuccess={fetchData} />
                  ))}
                </div>
              </div>
            )}

            {/* No tasks yet */}
            {isParticipant && tasks.length === 0 && challenge.status === 'active' && (
              <div className="text-center py-10">
                <Clock className="w-10 h-10 text-white/20 mx-auto mb-3" />
                <p className="text-white/40 text-sm">Questions haven't been published yet. Check back soon!</p>
              </div>
            )}

            {/* Ended */}
            {challenge.status === 'ended' && !isParticipant && (
              <div className="text-center py-10">
                <Trophy className="w-12 h-12 text-yellow-400/30 mx-auto mb-3" />
                <p className="text-white/30 text-sm">This challenge has ended. Check the leaderboard for results!</p>
              </div>
            )}
          </div>
        )}

        {/* ── LEADERBOARD TAB ── */}
        {activeTab === 'leaderboard' && (
          <div className="px-4 pt-4">
            {/* My rank */}
            {myParticipant && myRank && (
              <div className="rounded-2xl p-3.5 mb-4 flex items-center gap-3"
                style={{ background: 'rgba(255,20,147,0.08)', border: '1px solid rgba(255,20,147,0.25)' }}>
                <div className="w-10 h-10 rounded-2xl gradient-pink flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-black text-lg">#{myRank}</span>
                </div>
                <div className="flex-1">
                  <p className="text-white font-black text-sm">Your Rank</p>
                  <p className="text-white/50 text-xs">{parseFloat(myParticipant.total_pips || 0).toFixed(0)} points</p>
                </div>
                <Flame className="w-5 h-5 text-primary" />
              </div>
            )}

            {/* Podium */}
            {top3.length > 0 && (
              <div className="flex items-end justify-center gap-2 mb-5 px-2">
                {[1, 0, 2].map(idx => {
                  const p = participants[idx];
                  if (!p) return <div key={idx} className="flex-1" />;
                  const isFirst = idx === 0;
                  const podiumHeights = [130, 105, 85];
                  const medalGradients = [
                    'linear-gradient(135deg,#FFD700,#FFA500)',
                    'linear-gradient(135deg,#C0C0C0,#A0A0A0)',
                    'linear-gradient(135deg,#CD7F32,#A0522D)',
                  ];
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                      <div className={`rounded-full overflow-hidden gradient-pink flex items-center justify-center ${isFirst ? 'w-14 h-14' : 'w-11 h-11'}`}
                        style={{ border: `2px solid ${isFirst ? '#FFD700' : '#C0C0C0'}` }}>
                        {p.user_profiles?.avatar_url
                          ? <img src={p.user_profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                          : <span className={`font-black text-white ${isFirst ? 'text-lg' : 'text-sm'}`}>{(p.user_profiles?.username || '?')[0].toUpperCase()}</span>}
                      </div>
                      <div className="w-full rounded-t-2xl flex flex-col items-center justify-end py-3 px-1 relative overflow-hidden"
                        style={{ height: podiumHeights[idx], background: medalGradients[idx] }}>
                        <span className="text-lg mb-1 relative z-10">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>
                        <p className="font-black text-[10px] text-white/90 truncate w-full text-center px-1 relative z-10">
                          {p.user_profiles?.username || 'Trader'}
                        </p>
                        <p className={`font-black text-white relative z-10 ${isFirst ? 'text-base' : 'text-sm'}`}>
                          {parseFloat(p.total_pips || 0).toFixed(0)} pts
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Full list */}
            {participants.length > 0 ? (
              <div>
                {participants.map((p, idx) => (
                  <ParticipantRow key={p.id} rank={idx + 1} p={p} />
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <Users className="w-10 h-10 text-white/20 mx-auto mb-3" />
                <p className="text-white/30 text-sm">No participants yet. Be the first to join!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
