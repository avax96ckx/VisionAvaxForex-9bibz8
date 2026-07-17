import { useState, useEffect, useCallback } from 'react';
import {
  Trophy, Plus, Upload, Save, Trash2, Eye, EyeOff, Check,
  Gift, Clock, Users, Play, Square, RefreshCw, X, Zap,
  Bot, Sparkles, UserPlus, UserMinus, Search, Loader2,
  ChevronDown, ChevronUp, Star
} from 'lucide-react';
import { supabase, uploadFile } from '@/lib/supabase';
import { toast } from 'sonner';
import { FunctionsHttpError } from '@supabase/supabase-js';

// ── AI Auto-Challenge Generator ──
async function generateAIChallenge(): Promise<{ title: string; description: string; tasks: any[] }> {
  const challengeTypes = [
    'quiz', 'chart_analysis', 'market_knowledge', 'trading_concept', 'trading_psychology', 'risk_management',
  ];
  const chosenType = challengeTypes[Math.floor(Math.random() * challengeTypes.length)];

  const prompts: Record<string, string> = {
    quiz: 'Create a forex education quiz with 4 questions about candlestick patterns, technical analysis terms, or trading basics.',
    chart_analysis: 'Create a chart analysis challenge. Ask users to analyze forex setups and identify entry/exit points.',
    market_knowledge: 'Create a challenge with 4 questions about currency pairs, trading sessions, or economic indicators.',
    trading_concept: 'Create a challenge about trading concepts: support/resistance, trend lines, moving averages, or risk management.',
    trading_psychology: 'Create a challenge about trading psychology: emotions, discipline, common mistakes, mindset.',
    risk_management: 'Create a risk management challenge about lot sizes, stop losses, risk/reward ratios, position sizing.',
  };

  const { data, error } = await supabase.functions.invoke('avax-ai', {
    body: {
      aiId: 'forex_basics',
      messages: [{
        role: 'user',
        content: `${prompts[chosenType]}

Create a weekly challenge for a forex trading platform. Return ONLY this JSON with no other text:
{"title":"Challenge title here","description":"2-3 sentence description here","tasks":[{"task_type":"quiz","question":"Question text","description":"Instructions","example_answer":"Example answer","max_score":25},{"task_type":"quiz","question":"Question 2","description":"Instructions","example_answer":"Example","max_score":25},{"task_type":"analysis","question":"Analysis task","description":"What to do","example_answer":"Expected","max_score":25},{"task_type":"quiz","question":"Question 4","description":"Instructions","example_answer":"Example","max_score":25}]}`,
      }],
      customSystemPrompt: 'You are a forex challenge creator. Output ONLY valid JSON — no markdown, no code fences, no explanation. Start with { and end with }.',
      topicName: 'Challenge Creator',
    },
  });

  if (error) {
    let errMsg = error.message;
    try {
      if ((error as any).context) {
        const txt = await (error as any).context.text?.().catch(() => '');
        if (txt) errMsg = txt;
      }
    } catch {}
    throw new Error('AI error: ' + errMsg);
  }
  if (!data?.text) throw new Error('Empty AI response — please try again');

  try {
    let cleaned = data.text.trim();
    // Remove markdown code blocks
    cleaned = cleaned.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    // Extract JSON object boundaries
    const s = cleaned.indexOf('{');
    const e2 = cleaned.lastIndexOf('}');
    if (s !== -1 && e2 !== -1) cleaned = cleaned.slice(s, e2 + 1);
    const parsed = JSON.parse(cleaned);
    if (!parsed.title || !Array.isArray(parsed.tasks)) throw new Error('Invalid structure');
    // Ensure exactly 4 tasks with valid data
    const tasks = parsed.tasks.slice(0, 4).map((t: any, i: number) => ({
      task_type: t.task_type || 'quiz',
      question: t.question || `Forex Question ${i + 1}`,
      description: t.description || '',
      example_answer: t.example_answer || '',
      max_score: Number(t.max_score) || 25,
    }));
    return { title: parsed.title, description: parsed.description || '', tasks };
  } catch (parseErr: any) {
    console.error('AI parse error:', parseErr, 'Raw:', data.text?.slice(0, 500));
    throw new Error('AI returned invalid format — try again');
  }
}

export default function AdminTradingChallenge() {
  const [challenges, setChallenges] = useState<any[]>([]);
  const [activeCh, setActiveCh] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewChallenge, setShowNewChallenge] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [publishingResults, setPublishingResults] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [searchUser, setSearchUser] = useState('');
  const [addingUser, setAddingUser] = useState<string | null>(null);
  const [removingUser, setRemovingUser] = useState<string | null>(null);
  const [insertingTasks, setInsertingTasks] = useState(false);
  const [autoCheckMsg, setAutoCheckMsg] = useState('');

  const CHALLENGE_TYPES = [
    { key: 'weekly', label: '📅 Weekly Challenge' },
    { key: 'quiz', label: '❓ Quiz Challenge' },
    { key: 'analysis', label: '📊 Chart Analysis' },
    { key: 'invite', label: '👥 Invite Challenge' },
    { key: 'feature', label: '📱 Feature Challenge' },
    { key: 'knowledge', label: '🧠 Knowledge Test' },
    { key: 'psychology', label: '🧘 Psychology Challenge' },
    { key: 'risk', label: '⚖️ Risk Management' },
  ];

  const [chForm, setChForm] = useState({
    title: 'Weekly Trading Challenge',
    challenge_type: 'weekly',
    description: '',
    prize_type: 'vip',
    prize_value: '1 Month VIP',
    prize_description: '',
    week_start: '',
    week_end: '',
    xp_reward: 100,
  });

  const [taskForm, setTaskForm] = useState({
    task_type: 'quiz',
    question: '',
    description: '',
    example_answer: '',
    max_score: 25,
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [chsRes, usersRes] = await Promise.all([
      supabase.from('trading_challenges').select('*').order('created_at', { ascending: false }),
      supabase.from('user_profiles').select('id,username,email,avatar_url').order('username').limit(200),
    ]);

    if (chsRes.data) {
      setChallenges(chsRes.data);
      const active = chsRes.data.find(c => c.status !== 'inactive') || chsRes.data[0];
      if (active) {
        setActiveCh(active);
        const [tasksRes, partRes] = await Promise.all([
          supabase.from('ai_challenge_tasks').select('*').eq('challenge_id', active.id).order('order_index'),
          supabase.from('challenge_participants')
            .select('*, user_profiles(username, avatar_url)')
            .eq('challenge_id', active.id).order('total_pips', { ascending: false }),
        ]);
        if (tasksRes.data) setTasks(tasksRes.data);
        if (partRes.data) setParticipants(partRes.data);
      }
    }
    if (usersRes.data) setAllUsers(usersRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Check if auto-challenge should run
  useEffect(() => {
    checkAutoChallenge();
  }, []);

  async function checkAutoChallenge() {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 5=Fri
    const hour = now.getHours();

    // Sunday 00:00 (saa sita usiku = midnight UTC+3 = 21:00 UTC)
    // Friday 00:00 = market opens Friday midnight EAT
    const isAutoTime = dayOfWeek === 0 && hour >= 0 && hour < 1; // Sunday midnight EAT

    if (!isAutoTime) {
      setAutoCheckMsg(`Auto-challenge runs on Sunday at midnight EAT. Today: ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dayOfWeek]} ${hour}:00`);
      return;
    }

    // Check if there's already an active challenge this week
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
    const { data: existing } = await supabase.from('trading_challenges')
      .select('id').eq('status', 'active')
      .gte('created_at', weekStart.toISOString()).limit(1).maybeSingle();

    if (existing) {
      setAutoCheckMsg('✅ Auto-challenge already running this week');
      return;
    }

    setAutoCheckMsg('⚡ Auto-challenge triggered! Generating...');
    await runAutoChallenge();
  }

  async function runAutoChallenge() {
    setGeneratingAI(true);
    try {
      const generated = await generateAIChallenge();

      // Calculate this week's dates (Sunday midnight to Friday midnight EAT = UTC+3)
      const now = new Date();
      const sunday = new Date(now);
      sunday.setDate(sunday.getDate() - sunday.getDay());
      sunday.setHours(0, 0, 0, 0);

      const friday = new Date(sunday);
      friday.setDate(friday.getDate() + 5); // Friday
      friday.setHours(21, 0, 0, 0); // Friday 00:00 EAT = Thursday 21:00 UTC

      const { data: ch, error } = await supabase.from('trading_challenges').insert({
        title: generated.title,
        description: generated.description,
        challenge_type: 'weekly',
        prize_type: 'vip',
        prize_value: '1 Month VIP',
        status: 'active',
        is_published: true,
        week_start: sunday.toISOString(),
        week_end: friday.toISOString(),
        xp_reward: 100,
      } as any).select().single();

      if (error || !ch) throw new Error(error?.message || 'Failed to create challenge');

      // Insert tasks
      for (let i = 0; i < generated.tasks.length; i++) {
        const t = generated.tasks[i];
        await supabase.from('ai_challenge_tasks').insert({
          challenge_id: ch.id,
          task_type: t.task_type || 'quiz',
          question: t.question,
          description: t.description || '',
          example_answer: t.example_answer || '',
          max_score: t.max_score || 25,
          order_index: i,
        });
      }

      // Notify all users
      await supabase.from('notifications').insert({
        title: '🏆 New Weekly Challenge!',
        body: `${generated.title} — Answer questions, earn points, win prizes!`,
        type: 'general',
        target_user_id: null,
      });

      toast.success(`✅ AI Challenge created: "${generated.title}"`);
      fetchAll();
    } catch (e: any) {
      toast.error('AI challenge generation failed: ' + e.message);
    }
    setGeneratingAI(false);
  }

  async function generateAIChallengeManual() {
    setGeneratingAI(true);
    try {
      const generated = await generateAIChallenge();

      const now = new Date();
      const sunday = new Date(now);
      sunday.setDate(sunday.getDate() - sunday.getDay());
      sunday.setHours(0, 0, 0, 0);
      const friday = new Date(sunday);
      friday.setDate(friday.getDate() + 5);
      friday.setHours(21, 0, 0, 0);

      const { data: ch, error } = await supabase.from('trading_challenges').insert({
        title: generated.title,
        description: generated.description,
        challenge_type: 'weekly',
        prize_type: 'vip',
        prize_value: '1 Month VIP',
        status: 'inactive',
        is_published: false,
        week_start: sunday.toISOString(),
        week_end: friday.toISOString(),
        xp_reward: 100,
      } as any).select().single();

      if (error || !ch) throw new Error(error?.message || 'Failed to create challenge — check API key in Admin → API Keys');

      // Immediately set as activeCh so tasks show under it
      setActiveCh(ch);
      setTasks([]);
      setParticipants([]);
      setGeneratingAI(false);

      // Insert tasks progressively, updating UI after each one
      setInsertingTasks(true);
      const insertedTasks: any[] = [];
      for (let i = 0; i < generated.tasks.length; i++) {
        const t = generated.tasks[i];
        const { data: taskRow, error: taskErr } = await supabase.from('ai_challenge_tasks').insert({
          challenge_id: ch.id,
          task_type: t.task_type || 'quiz',
          question: t.question,
          description: t.description || '',
          example_answer: t.example_answer || '',
          max_score: t.max_score || 25,
          order_index: i,
        }).select().single();
        if (!taskErr && taskRow) {
          insertedTasks.push(taskRow);
          setTasks([...insertedTasks]);
        }
      }
      setInsertingTasks(false);

      // Final full refresh to sync challenges list
      await fetchAll();
      toast.success(`✅ AI Challenge "${generated.title}" created with ${insertedTasks.length} tasks — Review & publish when ready`);
      return; // already set generatingAI false above
    } catch (e: any) {
      toast.error('AI generation failed: ' + e.message);
      setInsertingTasks(false);
    }
    setGeneratingAI(false);
  }

  async function createChallenge() {
    if (!chForm.title) return toast.error('Enter challenge title');
    const { data, error } = await supabase.from('trading_challenges').insert({
      title: chForm.title,
      challenge_type: chForm.challenge_type,
      description: chForm.description,
      prize_type: chForm.prize_type,
      prize_value: chForm.prize_value,
      prize_description: chForm.prize_description,
      xp_reward: chForm.xp_reward || 100,
      status: 'inactive',
      is_published: false,
      week_start: chForm.week_start ? new Date(chForm.week_start).toISOString() : null,
      week_end: chForm.week_end ? new Date(chForm.week_end).toISOString() : null,
    } as any).select().single();
    if (error) { toast.error(error.message); return; }
    toast.success('Challenge created!');
    setShowNewChallenge(false);
    setActiveCh(data);
    fetchAll();
  }

  async function addTask() {
    if (!activeCh || !taskForm.question) return toast.error('Enter question');
    await supabase.from('ai_challenge_tasks').insert({
      challenge_id: activeCh.id,
      task_type: taskForm.task_type,
      question: taskForm.question,
      description: taskForm.description,
      example_answer: taskForm.example_answer,
      max_score: taskForm.max_score,
      order_index: tasks.length,
    });
    toast.success('Task added!');
    setTaskForm({ task_type: 'quiz', question: '', description: '', example_answer: '', max_score: 25 });
    setShowNewTask(false);
    fetchAll();
  }

  async function deleteTask(taskId: string) {
    await supabase.from('ai_challenge_tasks').delete().eq('id', taskId);
    fetchAll();
  }

  async function toggleChallengePublish() {
    if (!activeCh) return;
    setPublishing(true);
    const newPublished = !activeCh.is_published;
    const newStatus = newPublished ? 'active' : 'inactive';
    await supabase.from('trading_challenges').update({ is_published: newPublished, status: newStatus }).eq('id', activeCh.id);
    if (newPublished) {
      await supabase.from('notifications').insert({
        title: '🏆 New Challenge Started!',
        body: `${activeCh.title} is live! Join and win ${activeCh.prize_value}`,
        type: 'general', target_user_id: null,
      });
    }
    toast.success(newPublished ? '🟢 Challenge published!' : 'Challenge hidden');
    setPublishing(false);
    fetchAll();
  }

  async function endChallenge() {
    if (!activeCh) return;
    if (!confirm('End this challenge? Results will be final.')) return;
    await supabase.from('trading_challenges').update({ status: 'ended', is_published: true }).eq('id', activeCh.id);
    await supabase.from('notifications').insert({
      title: '🏆 Challenge Results Are In!',
      body: `${activeCh.title} has ended! Check the leaderboard for winners.`,
      type: 'general', target_user_id: null,
    });
    toast.success('Challenge ended!');
    fetchAll();
  }

  async function publishResults() {
    if (!activeCh) return;
    setPublishingResults(true);

    // Recalculate all participant scores from responses
    const { data: allResps } = await supabase.from('ai_challenge_responses')
      .select('user_id, ai_score').eq('challenge_id', activeCh.id).eq('is_reviewed', true);

    if (allResps) {
      const userScores: Record<string, number> = {};
      allResps.forEach(r => {
        userScores[r.user_id] = (userScores[r.user_id] || 0) + (r.ai_score || 0);
      });

      // Update each participant
      for (const [userId, score] of Object.entries(userScores)) {
        await supabase.from('challenge_participants')
          .update({ total_pips: score } as any)
          .eq('challenge_id', activeCh.id).eq('user_id', userId);
      }

      // Rank participants
      const ranked = Object.entries(userScores).sort(([, a], [, b]) => b - a);
      for (let i = 0; i < ranked.length; i++) {
        await supabase.from('challenge_participants')
          .update({ rank: i + 1 } as any)
          .eq('challenge_id', activeCh.id).eq('user_id', ranked[i][0]);
      }

      // Award XP and notify
      const xpReward = activeCh.xp_reward || 100;
      for (let i = 0; i < ranked.length; i++) {
        const [userId] = ranked[i];
        const rank = i + 1;
        const bonusXP = rank === 1 ? xpReward * 3 : rank === 2 ? xpReward * 2 : rank === 3 ? Math.round(xpReward * 1.5) : xpReward;
        const { data: prof } = await supabase.from('user_profiles').select('xp_points').eq('id', userId).single();
        const newXP = ((prof as any)?.xp_points || 0) + bonusXP;
        const level = newXP >= 5000 ? 'diamond' : newXP >= 2000 ? 'gold' : newXP >= 500 ? 'silver' : 'bronze';
        await supabase.from('user_profiles').update({ xp_points: newXP, trader_level: level } as any).eq('id', userId);

        if (rank <= 3) {
          await supabase.from('notifications').insert({
            title: rank === 1 ? '🥇 You Won!' : rank === 2 ? '🥈 2nd Place!' : '🥉 3rd Place!',
            body: `You ranked #${rank} in ${activeCh.title}! +${bonusXP} XP earned.`,
            type: 'general', target_user_id: userId,
          });
        }
      }
    }

    toast.success('✅ Results published and XP awarded!');
    setPublishingResults(false);
    fetchAll();
  }

  // ── Participant Management ──
  async function addParticipant(userId: string) {
    if (!activeCh) return;
    setAddingUser(userId);
    const { error } = await supabase.from('challenge_participants').upsert({
      challenge_id: activeCh.id, user_id: userId, total_pips: 0,
    }, { onConflict: 'challenge_id,user_id' });
    if (error) toast.error('Failed: ' + error.message);
    else toast.success('User added to challenge!');
    setAddingUser(null);
    fetchAll();
  }

  async function removeParticipant(participantId: string, username: string) {
    if (!confirm(`Remove ${username} from challenge?`)) return;
    setRemovingUser(participantId);
    await supabase.from('challenge_participants').delete().eq('id', participantId);
    toast.success('User removed from challenge');
    setRemovingUser(null);
    fetchAll();
  }

  const participantUserIds = new Set(participants.map(p => p.user_id));
  const filteredUsers = allUsers.filter(u =>
    !participantUserIds.has(u.id) &&
    (!searchUser || (u.username || u.email || '').toLowerCase().includes(searchUser.toLowerCase()))
  );

  if (loading) return <div className="h-40 bg-muted/30 rounded-2xl animate-pulse" />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-500/10 to-primary/10 border border-yellow-500/25 rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
            <Trophy className="w-5 h-5 text-yellow-400" />
          </div>
          <div className="flex-1">
            <p className="font-black text-foreground text-sm">Challenge Manager</p>
            <p className="text-xs text-muted-foreground">AI-powered quiz & knowledge challenges</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { val: challenges.length, label: 'Challenges', color: 'text-primary' },
            { val: tasks.length, label: 'Tasks', color: 'text-yellow-400' },
            { val: participants.length, label: 'Participants', color: 'text-green-400' },
          ].map(s => (
            <div key={s.label} className="bg-card rounded-xl p-2 text-center">
              <p className={`text-lg font-black ${s.color}`}>{s.val}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* AI Auto-Challenge */}
      <div className="bg-gradient-to-r from-blue-500/10 to-primary/10 border border-blue-500/25 rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Bot className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1">
            <p className="font-black text-foreground text-sm">AI Auto-Challenge</p>
            <p className="text-xs text-muted-foreground">Auto-generates weekly challenges every Sunday midnight</p>
          </div>
        </div>
        {autoCheckMsg && (
          <p className="text-xs text-muted-foreground mb-3 px-1">{autoCheckMsg}</p>
        )}
        <div className="p-3 bg-blue-500/10 rounded-xl mb-3">
          <p className="text-xs text-blue-400 leading-relaxed">
            🔄 Schedule: Sunday 00:00 EAT → Friday 00:00 EAT (market hours)<br/>
            🤖 AI generates diverse challenges: quizzes, chart analysis, feature promos, invite challenges<br/>
            🏆 Winners auto-ranked, XP awarded, notifications sent
          </p>
        </div>
        <button onClick={generateAIChallengeManual} disabled={generatingAI || insertingTasks}
          className="w-full py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 press disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg,#1565C0,#1E88E5)' }}>
          {generatingAI
            ? <><Loader2 className="w-4 h-4 animate-spin" /> AI Generating Challenge...</>
            : insertingTasks
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving Tasks ({tasks.length}/4)...</>
              : <><Sparkles className="w-4 h-4" /> Generate AI Challenge Now</>
          }
        </button>
        {insertingTasks && (
          <div className="mt-2 space-y-1.5">
            <p className="text-xs text-blue-400 text-center animate-pulse">📝 Saving tasks to database... ({tasks.length}/4)</p>
            {[1,2,3,4].map(i => (
              <div key={i} className={`h-12 rounded-xl ${i <= tasks.length ? 'bg-green-500/10 border border-green-500/20' : 'bg-muted/20 animate-pulse'}`}>
                {i <= tasks.length && tasks[i-1] && (
                  <div className="p-3 flex items-center gap-2">
                    <span className="text-green-400 text-xs">✓</span>
                    <p className="text-xs text-foreground truncate">{tasks[i-1].question}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create manual challenge */}
      <button onClick={() => setShowNewChallenge(!showNewChallenge)}
        className="w-full flex items-center justify-center gap-2 py-3 bg-card border border-border rounded-2xl text-foreground text-sm font-bold press">
        <Plus className="w-4 h-4" /> Create Manual Challenge
      </button>

      {showNewChallenge && (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3 animate-slide-up">
          <div className="grid grid-cols-2 gap-1.5">
            {CHALLENGE_TYPES.map(ct => (
              <button key={ct.key} onClick={() => setChForm(p => ({ ...p, challenge_type: ct.key }))}
                className={`p-2.5 rounded-xl border text-left transition-all press ${chForm.challenge_type === ct.key ? 'border-primary bg-primary/10' : 'border-border bg-muted/20'}`}>
                <p className="text-xs font-bold text-foreground">{ct.label}</p>
              </button>
            ))}
          </div>
          <input className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary"
            placeholder="Challenge title" value={chForm.title} onChange={e => setChForm(p => ({ ...p, title: e.target.value }))} />
          <textarea className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary resize-none"
            rows={2} placeholder="Challenge description" value={chForm.description} onChange={e => setChForm(p => ({ ...p, description: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <input className="bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none"
              placeholder="Prize (e.g. 1 Month VIP)" value={chForm.prize_value} onChange={e => setChForm(p => ({ ...p, prize_value: e.target.value }))} />
            <input type="number" className="bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none"
              placeholder="XP Reward" value={chForm.xp_reward} onChange={e => setChForm(p => ({ ...p, xp_reward: parseInt(e.target.value) || 100 }))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Start</label>
              <input type="datetime-local" className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none"
                value={chForm.week_start} onChange={e => setChForm(p => ({ ...p, week_start: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">End</label>
              <input type="datetime-local" className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none"
                value={chForm.week_end} onChange={e => setChForm(p => ({ ...p, week_end: e.target.value }))} />
            </div>
          </div>
          <button onClick={createChallenge} className="w-full py-3 gradient-pink rounded-xl text-white font-bold text-sm press">
            Create Challenge
          </button>
        </div>
      )}

      {/* Active challenge management */}
      {activeCh && (
        <div className="space-y-4">
          {/* Status card */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <Trophy className="w-5 h-5 text-yellow-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-black text-foreground truncate">{activeCh.title}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    activeCh.status === 'active' ? 'bg-green-500/20 text-green-400' :
                    activeCh.status === 'ended' ? 'bg-red-500/20 text-red-400' : 'bg-muted text-muted-foreground'
                  }`}>{activeCh.status?.toUpperCase()}</span>
                  {activeCh.week_end && (
                    <span className="text-[10px] text-muted-foreground">
                      Ends: {new Date(activeCh.week_end).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={toggleChallengePublish} disabled={publishing}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold press flex-1 justify-center ${activeCh.is_published ? 'bg-muted text-muted-foreground' : 'gradient-pink text-white'}`}>
                {activeCh.is_published ? <><EyeOff className="w-3.5 h-3.5" /> Hide</> : <><Eye className="w-3.5 h-3.5" /> Publish</>}
              </button>
              {activeCh.status === 'active' && (
                <button onClick={endChallenge}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold press bg-red-500/10 text-red-400 border border-red-500/25 flex-1 justify-center">
                  <Square className="w-3.5 h-3.5" /> End Challenge
                </button>
              )}
              <button onClick={fetchAll} className="p-2 rounded-xl bg-muted press">
                <RefreshCw className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Tasks management */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <Star className="w-4 h-4 text-primary" /> Questions/Tasks ({tasks.length})
              </h3>
              <button onClick={() => setShowNewTask(!showNewTask)}
                className="flex items-center gap-1 px-3 py-1.5 gradient-pink rounded-xl text-white text-xs font-bold press">
                <Plus className="w-3.5 h-3.5" /> Add Task
              </button>
            </div>

            {showNewTask && (
              <div className="mb-3 p-3 bg-muted/30 rounded-xl space-y-2 animate-slide-up">
                <select className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none"
                  value={taskForm.task_type} onChange={e => setTaskForm(p => ({ ...p, task_type: e.target.value }))}>
                  {[
                    { val: 'quiz', label: '❓ Quiz / Text Answer' },
                    { val: 'image_upload', label: '📸 Image Upload' },
                    { val: 'screenshot', label: '📱 Screenshot' },
                    { val: 'analysis', label: '📊 Chart Analysis' },
                    { val: 'invite', label: '👥 Invite Friends' },
                  ].map(t => <option key={t.val} value={t.val}>{t.label}</option>)}
                </select>
                <textarea className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary resize-none"
                  rows={2} placeholder="Question or task prompt" value={taskForm.question}
                  onChange={e => setTaskForm(p => ({ ...p, question: e.target.value }))} />
                <textarea className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary resize-none"
                  rows={2} placeholder="Detailed instructions (optional)" value={taskForm.description}
                  onChange={e => setTaskForm(p => ({ ...p, description: e.target.value }))} />
                <div className="grid grid-cols-2 gap-2">
                  <input className="bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none"
                    placeholder="Example answer" value={taskForm.example_answer}
                    onChange={e => setTaskForm(p => ({ ...p, example_answer: e.target.value }))} />
                  <input type="number" className="bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none"
                    placeholder="Max score" value={taskForm.max_score}
                    onChange={e => setTaskForm(p => ({ ...p, max_score: parseInt(e.target.value) || 25 }))} />
                </div>
                <button onClick={addTask} className="w-full py-2.5 gradient-pink rounded-xl text-white text-sm font-bold press">Add Task</button>
              </div>
            )}

            <div className="space-y-2">
              {tasks.map((task, idx) => (
                <div key={task.id} className="p-3 bg-muted/20 rounded-xl border border-border/50">
                  <div className="flex items-start gap-2">
                    <span className="text-white/40 text-xs font-bold w-5 flex-shrink-0 mt-0.5">#{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground text-xs leading-tight">{task.question}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[9px] px-1.5 py-0.5 bg-primary/20 text-primary rounded font-bold capitalize">{task.task_type?.replace(/_/g, ' ')}</span>
                        <span className="text-[9px] text-muted-foreground">{task.max_score} pts</span>
                      </div>
                    </div>
                    <button onClick={() => deleteTask(task.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 press flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
              {tasks.length === 0 && !insertingTasks && (
                <p className="text-center text-muted-foreground text-sm py-4">No tasks yet — add manually or use AI generate</p>
              )}
              {insertingTasks && tasks.length === 0 && (
                <div className="space-y-1.5">{[1,2,3,4].map(i => <div key={i} className="h-12 rounded-xl animate-pulse bg-muted/30" />)}</div>
              )}
            </div>
          </div>

          {/* Publish Results */}
          <div className="bg-gradient-to-r from-green-500/10 to-green-500/5 border border-green-500/25 rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <Zap className="w-5 h-5 text-green-400" />
              <div>
                <p className="font-black text-foreground text-sm">Publish Results</p>
                <p className="text-xs text-muted-foreground">Recalculate scores, rank participants, award XP</p>
              </div>
            </div>
            <button onClick={publishResults} disabled={publishingResults}
              className="w-full py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 press disabled:opacity-50"
              style={{ background: publishingResults ? 'rgba(34,197,94,0.4)' : 'linear-gradient(135deg,#16a34a,#22c55e)' }}>
              {publishingResults
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Publishing...</>
                : <><Zap className="w-4 h-4" /> Publish Results & Award XP</>}
            </button>
          </div>

          {/* Participant Management */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <button onClick={() => setShowParticipants(!showParticipants)}
              className="w-full flex items-center justify-between press mb-1">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Participants ({participants.length})
              </h3>
              {showParticipants ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            {showParticipants && (
              <div className="mt-3 space-y-3">
                {/* Current participants */}
                {participants.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground font-bold mb-2 uppercase tracking-wide">Current Participants</p>
                    <div className="space-y-1.5">
                      {participants.map((p, idx) => (
                        <div key={p.id} className="flex items-center gap-3 p-2.5 bg-muted/20 rounded-xl">
                          <span className="text-xs text-muted-foreground w-5 text-center font-bold">#{idx + 1}</span>
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-muted gradient-pink flex items-center justify-center flex-shrink-0">
                            {p.user_profiles?.avatar_url ? <img src={p.user_profiles.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xs font-black text-white">{(p.user_profiles?.username || '?')[0].toUpperCase()}</span>}
                          </div>
                          <p className="flex-1 text-sm font-bold text-foreground truncate">{p.user_profiles?.username || 'Member'}</p>
                          <span className="text-xs font-black text-primary">{parseFloat(p.total_pips || 0).toFixed(0)} pts</span>
                          <button onClick={() => removeParticipant(p.id, p.user_profiles?.username || 'User')}
                            disabled={removingUser === p.id}
                            className="w-7 h-7 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-center press disabled:opacity-50">
                            {removingUser === p.id ? <Loader2 className="w-3 h-3 text-red-400 animate-spin" /> : <UserMinus className="w-3 h-3 text-red-400" />}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add users */}
                <div>
                  <p className="text-xs text-muted-foreground font-bold mb-2 uppercase tracking-wide">Add User to Challenge</p>
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                    <input value={searchUser} onChange={e => setSearchUser(e.target.value)}
                      placeholder="Search users..."
                      className="w-full bg-muted border border-border rounded-xl pl-9 pr-3 py-2 text-foreground text-sm outline-none focus:border-primary" />
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {filteredUsers.slice(0, 20).map(u => (
                      <div key={u.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-muted/50 transition-all">
                        <div className="w-8 h-8 rounded-full bg-muted gradient-pink flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xs font-black text-white">{(u.username || '?')[0].toUpperCase()}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">{u.username || 'Member'}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                        </div>
                        <button onClick={() => addParticipant(u.id)} disabled={addingUser === u.id}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-primary/15 border border-primary/25 rounded-xl text-primary text-xs font-bold press disabled:opacity-50">
                          {addingUser === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                          Add
                        </button>
                      </div>
                    ))}
                    {filteredUsers.length === 0 && <p className="text-center text-muted-foreground text-xs py-3">All users already added</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
