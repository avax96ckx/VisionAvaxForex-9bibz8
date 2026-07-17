import { useState, useEffect } from 'react';
import {
  BookOpen, Search, Trash2, Eye, TrendingUp, TrendingDown,
  RefreshCw, ChevronDown, ChevronUp, AlertTriangle, Loader2,
  Calendar, Filter, X, User
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface TradeEntry {
  id: string;
  user_id: string;
  pair: string;
  direction: 'BUY' | 'SELL';
  entry: string;
  stop_loss: string;
  take_profit: string;
  result: 'WIN' | 'LOSS' | 'BREAKEVEN' | '';
  pips: string;
  emotion_before: string;
  emotion_after: string;
  setup_image_url: string;
  result_image_url: string;
  notes: string;
  session: string;
  trade_date: string;
  created_at: string;
  ai_mode: boolean;
  user_profiles?: {
    username: string;
    email: string;
    avatar_url: string;
  };
}

interface Filters {
  userId: string;
  pair: string;
  result: string;
  dateFrom: string;
  dateTo: string;
}

function JournalStats({ entries }: { entries: TradeEntry[] }) {
  const wins = entries.filter(e => e.result === 'WIN').length;
  const losses = entries.filter(e => e.result === 'LOSS').length;
  const total = entries.length;
  const winRate = (wins + losses) > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
  const netPips = entries.reduce((sum, e) => {
    if (e.result === 'WIN') return sum + (parseFloat(e.pips) || 0);
    if (e.result === 'LOSS') return sum - (parseFloat(e.pips) || 0);
    return sum;
  }, 0);

  return (
    <div className="grid grid-cols-4 gap-1.5 mb-3">
      {[
        { label: 'Total', value: total, color: 'text-blue-400' },
        { label: 'Win%', value: `${winRate}%`, color: 'text-green-400' },
        { label: 'Wins', value: wins, color: 'text-green-400' },
        { label: 'Net Pips', value: `${netPips >= 0 ? '+' : ''}${netPips.toFixed(0)}`, color: netPips >= 0 ? 'text-green-400' : 'text-red-400' },
      ].map(s => (
        <div key={s.label} className="text-center py-2 rounded-xl bg-muted/30 border border-border">
          <p className={`font-black text-sm ${s.color}`}>{s.value}</p>
          <p className="text-[10px] text-muted-foreground">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

function EntryRow({ entry, onDelete }: { entry: TradeEntry; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-muted/10 overflow-hidden mb-1.5">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left press">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${entry.direction === 'BUY' ? 'bg-green-500/15' : 'bg-red-500/15'}`}>
          {entry.direction === 'BUY'
            ? <TrendingUp className="w-3.5 h-3.5 text-green-400" />
            : <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-foreground font-bold text-sm">{entry.pair}</p>
            {entry.result && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${entry.result === 'WIN' ? 'bg-green-500/20 text-green-400' : entry.result === 'LOSS' ? 'bg-red-500/20 text-red-400' : 'bg-muted text-muted-foreground'}`}>
                {entry.result} {entry.pips ? `${entry.pips}p` : ''}
              </span>
            )}
            {entry.ai_mode && <span className="text-[9px] bg-primary/20 text-primary px-1 rounded font-bold">AI</span>}
          </div>
          <p className="text-muted-foreground text-[10px]">
            {entry.user_profiles?.username || 'Unknown'} · {entry.session} · {entry.trade_date || entry.created_at?.split('T')[0]}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {entry.setup_image_url && (
            <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
              <img src={entry.setup_image_url} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-border space-y-2">
          {/* User info */}
          {entry.user_profiles && (
            <div className="flex items-center gap-2 py-1">
              <User className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {entry.user_profiles.username} · {entry.user_profiles.email}
              </span>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div><p className="text-muted-foreground">Entry</p><p className="text-foreground font-bold">{entry.entry || '—'}</p></div>
            <div><p className="text-muted-foreground">Stop Loss</p><p className="text-red-400 font-bold">{entry.stop_loss || '—'}</p></div>
            <div><p className="text-muted-foreground">Take Profit</p><p className="text-green-400 font-bold">{entry.take_profit || '—'}</p></div>
          </div>
          {(entry.emotion_before || entry.emotion_after) && (
            <div className="flex gap-3 text-xs">
              {entry.emotion_before && <span className="text-muted-foreground">Before: <span className="text-foreground">{entry.emotion_before}</span></span>}
              {entry.emotion_after && <span className="text-muted-foreground">After: <span className="text-foreground">{entry.emotion_after}</span></span>}
            </div>
          )}
          {entry.notes && <p className="text-xs text-muted-foreground italic">"{entry.notes}"</p>}
          <div className="flex gap-2">
            {entry.setup_image_url && (
              <div className="flex-1">
                <p className="text-muted-foreground text-[10px] mb-1">Setup Chart</p>
                <img src={entry.setup_image_url} alt="Setup" className="w-full h-24 object-cover rounded-lg" />
              </div>
            )}
            {entry.result_image_url && (
              <div className="flex-1">
                <p className="text-muted-foreground text-[10px] mb-1">Result Chart</p>
                <img src={entry.result_image_url} alt="Result" className="w-full h-24 object-cover rounded-lg" />
              </div>
            )}
          </div>
          {/* Delete button */}
          {!confirmDel ? (
            <button onClick={() => setConfirmDel(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs font-bold press">
              <Trash2 className="w-3 h-3" /> Delete Entry
            </button>
          ) : (
            <div className="flex gap-2 items-center">
              <p className="text-xs text-red-400 flex-1">Delete this entry?</p>
              <button onClick={() => { onDelete(entry.id); setConfirmDel(false); }}
                className="px-3 py-1.5 bg-red-500 rounded-lg text-white text-xs font-bold press">Yes, Delete</button>
              <button onClick={() => setConfirmDel(false)}
                className="px-3 py-1.5 bg-muted rounded-lg text-muted-foreground text-xs font-bold press">Cancel</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminTradingJournal() {
  const [entries, setEntries] = useState<TradeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({ userId: '', pair: '', result: '', dateFrom: '', dateTo: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [searchUser, setSearchUser] = useState('');
  const [users, setUsers] = useState<{ id: string; username: string; email: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkDeleteCount, setBulkDeleteCount] = useState(0);

  useEffect(() => { fetchEntries(); fetchUsers(); }, []);

  async function fetchUsers() {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, username, email')
      .order('username');
    if (data) setUsers(data);
  }

  async function fetchEntries(overrideFilters?: Partial<Filters>) {
    setLoading(true);
    const f = { ...filters, ...overrideFilters };

    let query = supabase
      .from('trade_journal_entries')
      .select('*, user_profiles(username, email, avatar_url)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(200);

    if (f.userId) query = query.eq('user_id', f.userId);
    if (f.pair) query = query.ilike('pair', `%${f.pair}%`);
    if (f.result) query = query.eq('result', f.result);
    if (f.dateFrom) query = query.gte('trade_date', f.dateFrom);
    if (f.dateTo) query = query.lte('trade_date', f.dateTo);

    const { data, count } = await query;
    if (data) setEntries(data as TradeEntry[]);
    setTotalCount(count || 0);
    setLoading(false);
  }

  async function deleteEntry(id: string) {
    const { error } = await supabase.from('trade_journal_entries').delete().eq('id', id);
    if (error) { toast.error('Failed to delete: ' + error.message); return; }
    setEntries(prev => prev.filter(e => e.id !== id));
    setTotalCount(prev => prev - 1);
    toast.success('Entry deleted');
  }

  async function deleteUserJournal(userId: string) {
    const { error } = await supabase.from('trade_journal_entries').delete().eq('user_id', userId);
    if (error) { toast.error('Failed to delete journal: ' + error.message); return; }
    toast.success('User journal cleared');
    fetchEntries();
  }

  async function getCountInRange(): Promise<number> {
    if (!filters.dateFrom && !filters.dateTo) {
      return entries.length;
    }
    let query = supabase.from('trade_journal_entries').select('id', { count: 'exact', head: true });
    if (filters.userId) query = query.eq('user_id', filters.userId);
    if (filters.dateFrom) query = query.gte('trade_date', filters.dateFrom);
    if (filters.dateTo) query = query.lte('trade_date', filters.dateTo);
    if (filters.pair) query = query.ilike('pair', `%${filters.pair}%`);
    if (filters.result) query = query.eq('result', filters.result);
    const { count } = await query;
    return count || 0;
  }

  async function handleBulkDeleteConfirm() {
    setBulkDeleting(true);
    setShowBulkConfirm(false);
    let query = supabase.from('trade_journal_entries').delete();
    if (filters.userId) query = query.eq('user_id', filters.userId);
    if (filters.dateFrom) query = query.gte('trade_date', filters.dateFrom);
    if (filters.dateTo) query = query.lte('trade_date', filters.dateTo);
    if (filters.pair) query = query.ilike('pair', `%${filters.pair}%`);
    if (filters.result) query = query.eq('result', filters.result);
    // Must have at least one filter to prevent deleting everything
    if (!filters.userId && !filters.dateFrom && !filters.dateTo && !filters.pair && !filters.result) {
      toast.error('Please set at least one filter before bulk deleting');
      setBulkDeleting(false);
      return;
    }
    const { error } = await query;
    if (error) { toast.error('Bulk delete failed: ' + error.message); }
    else { toast.success(`Deleted ${bulkDeleteCount} entries successfully`); }
    setBulkDeleting(false);
    fetchEntries();
  }

  function applyFilters() {
    fetchEntries();
    setShowFilters(false);
  }

  function clearFilters() {
    const empty = { userId: '', pair: '', result: '', dateFrom: '', dateTo: '' };
    setFilters(empty);
    fetchEntries(empty);
  }

  const hasActiveFilters = filters.userId || filters.pair || filters.result || filters.dateFrom || filters.dateTo;

  // Group entries by user for overview
  const byUser: Record<string, { username: string; email: string; count: number; wins: number; losses: number }> = {};
  entries.forEach(e => {
    if (!byUser[e.user_id]) {
      byUser[e.user_id] = {
        username: e.user_profiles?.username || 'Unknown',
        email: e.user_profiles?.email || '',
        count: 0, wins: 0, losses: 0,
      };
    }
    byUser[e.user_id].count++;
    if (e.result === 'WIN') byUser[e.user_id].wins++;
    if (e.result === 'LOSS') byUser[e.user_id].losses++;
  });

  const uniqueUsers = Object.keys(byUser);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500/10 to-primary/10 border border-blue-500/25 rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/20 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <p className="font-black text-foreground text-sm">Trading Journals</p>
            <p className="text-xs text-muted-foreground">View & manage all member journals from database</p>
          </div>
          <button onClick={() => fetchEntries()} className="ml-auto p-2 rounded-xl bg-muted press">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-card rounded-xl p-2 text-center">
            <p className="text-lg font-black text-blue-400">{uniqueUsers.length}</p>
            <p className="text-[10px] text-muted-foreground">Members</p>
          </div>
          <div className="bg-card rounded-xl p-2 text-center">
            <p className="text-lg font-black text-primary">{totalCount}</p>
            <p className="text-[10px] text-muted-foreground">Total Trades</p>
          </div>
          <div className="bg-card rounded-xl p-2 text-center">
            <p className="text-lg font-black text-green-400">{entries.filter(e => e.result === 'WIN').length}</p>
            <p className="text-[10px] text-muted-foreground">Wins</p>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold press transition-all ${hasActiveFilters ? 'bg-primary/20 border border-primary/40 text-primary' : 'bg-muted border border-border text-muted-foreground'}`}>
          <Filter className="w-3.5 h-3.5" />
          Filters {hasActiveFilters && '●'}
        </button>
        {hasActiveFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1 px-2 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold press">
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
        <div className="flex-1 flex items-center gap-2 bg-muted border border-border rounded-xl px-3 py-2">
          <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <input
            value={searchUser}
            onChange={e => setSearchUser(e.target.value)}
            placeholder="Search user..."
            className="flex-1 bg-transparent text-foreground text-sm outline-none placeholder-muted-foreground"
          />
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <p className="font-bold text-foreground text-sm flex items-center gap-2"><Filter className="w-4 h-4 text-primary" /> Filter Journals</p>

          {/* User select */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Member</p>
            <select
              value={filters.userId}
              onChange={e => setFilters(p => ({ ...p, userId: e.target.value }))}
              className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary">
              <option value="">All Members</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.username} ({u.email})</option>
              ))}
            </select>
          </div>

          {/* Pair */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Pair</p>
            <input
              value={filters.pair}
              onChange={e => setFilters(p => ({ ...p, pair: e.target.value }))}
              placeholder="e.g. EURUSD, XAU"
              className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary"
            />
          </div>

          {/* Result */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Result</p>
            <div className="grid grid-cols-4 gap-1.5">
              {['', 'WIN', 'LOSS', 'BREAKEVEN'].map(r => (
                <button key={r || 'all'}
                  onClick={() => setFilters(p => ({ ...p, result: r }))}
                  className={`py-2 rounded-xl text-xs font-bold press transition-all ${filters.result === r
                    ? r === 'WIN' ? 'bg-green-500 text-white' : r === 'LOSS' ? 'bg-red-500 text-white' : r === 'BREAKEVEN' ? 'bg-gray-500 text-white' : 'bg-primary text-white'
                    : 'bg-muted text-muted-foreground'}`}>
                  {r || 'All'}
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">From</p>
              <input type="date"
                value={filters.dateFrom}
                onChange={e => setFilters(p => ({ ...p, dateFrom: e.target.value }))}
                className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">To</p>
              <input type="date"
                value={filters.dateTo}
                onChange={e => setFilters(p => ({ ...p, dateTo: e.target.value }))}
                className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={applyFilters} className="flex-1 py-2.5 rounded-xl gradient-pink text-white text-sm font-bold press">
              Apply Filters
            </button>
            {(filters.dateFrom || filters.dateTo || filters.userId || filters.pair || filters.result) && (
              <button
                onClick={async () => {
                  const count = await getCountInRange();
                  setBulkDeleteCount(count);
                  if (count === 0) { toast.error('No entries match current filters'); return; }
                  setShowBulkConfirm(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-red-500/15 border border-red-500/30 rounded-xl text-red-400 text-sm font-bold press">
                <Trash2 className="w-3.5 h-3.5" />
                Delete Range
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Dialog */}
      {showBulkConfirm && (
        <div className="fixed inset-0 z-[600] bg-black/70 flex items-center justify-center px-4 animate-fade-in">
          <div className="w-full max-w-sm bg-card border border-border rounded-3xl p-5 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="font-black text-foreground mb-1">Bulk Delete Entries</h3>
                <p className="text-sm text-muted-foreground">
                  This will permanently delete <strong className="text-red-400">{bulkDeleteCount} entries</strong> matching your current filters.
                  {filters.dateFrom && filters.dateTo && (
                    <span className="block mt-1 text-xs">
                      Period: {filters.dateFrom} → {filters.dateTo}
                    </span>
                  )}
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowBulkConfirm(false)} className="flex-1 py-2.5 bg-muted border border-border rounded-xl text-foreground text-sm font-bold press">Cancel</button>
              <button onClick={handleBulkDeleteConfirm} disabled={bulkDeleting}
                className="flex-1 py-2.5 bg-red-500 rounded-xl text-white text-sm font-bold press disabled:opacity-50 flex items-center justify-center gap-1.5">
                {bulkDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {bulkDeleting ? 'Deleting...' : 'Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12 gap-3">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
          <p className="text-muted-foreground text-sm">Loading journals...</p>
        </div>
      )}

      {/* Per-user summary (when no user filter) */}
      {!loading && !filters.userId && uniqueUsers.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-2">Members Overview</p>
          <div className="space-y-2 mb-4">
            {uniqueUsers
              .filter(uid => {
                const u = byUser[uid];
                return !searchUser || u.username.toLowerCase().includes(searchUser.toLowerCase()) || u.email.toLowerCase().includes(searchUser.toLowerCase());
              })
              .map(uid => {
                const u = byUser[uid];
                const winRate = (u.wins + u.losses) > 0 ? Math.round((u.wins / (u.wins + u.losses)) * 100) : 0;
                return (
                  <div key={uid} className="bg-card border border-border rounded-2xl p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full gradient-pink flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-black text-sm">{u.username[0]?.toUpperCase() || '?'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground text-sm truncate">{u.username}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setFilters(p => ({ ...p, userId: uid })); fetchEntries({ userId: uid }); }}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-primary/10 border border-primary/25 rounded-xl text-primary text-xs font-bold press">
                          <Eye className="w-3 h-3" /> View
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete all ${u.count} trades for ${u.username}?`)) deleteUserJournal(uid);
                          }}
                          className="w-8 h-8 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center press">
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-1">
                      {[
                        { label: 'Trades', val: u.count, color: 'text-foreground' },
                        { label: 'Wins', val: u.wins, color: 'text-green-400' },
                        { label: 'Losses', val: u.losses, color: 'text-red-400' },
                        { label: 'Win%', val: `${winRate}%`, color: 'text-yellow-400' },
                      ].map(s => (
                        <div key={s.label} className="text-center py-1 rounded-lg bg-muted/40">
                          <p className={`text-xs font-black ${s.color}`}>{s.val}</p>
                          <p className="text-[9px] text-muted-foreground">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Entries list */}
      {!loading && entries.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">
              {filters.userId ? `${byUser[filters.userId]?.username || 'User'}'s Trades` : 'All Trades'} ({entries.length})
            </p>
            {filters.userId && (
              <button onClick={clearFilters} className="text-xs text-primary press hover:underline">← All Members</button>
            )}
          </div>
          {filters.userId && <JournalStats entries={entries} />}
          <div className="space-y-1">
            {entries
              .filter(e => !searchUser || (e.user_profiles?.username || '').toLowerCase().includes(searchUser.toLowerCase()))
              .map(entry => (
                <EntryRow key={entry.id} entry={entry} onDelete={deleteEntry} />
              ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && entries.length === 0 && (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground text-sm">No journal entries found</p>
          <p className="text-muted-foreground text-xs mt-1">
            {hasActiveFilters ? 'Try adjusting your filters' : 'Journal entries will appear here when members log trades'}
          </p>
        </div>
      )}
    </div>
  );
}
