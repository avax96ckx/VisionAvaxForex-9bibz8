import { useState, useEffect, useRef } from 'react';
import { Star, Plus, Trash2, Save, GripVertical, ChevronUp, ChevronDown, Upload, Edit2, X } from 'lucide-react';
import { supabase, uploadFile } from '@/lib/supabase';
import { toast } from 'sonner';

interface Testimonial {
  id: string;
  name: string;
  avatar_url?: string;
  content: string;
  rating: number;
  is_published: boolean;
  order_index: number;
}

export default function AdminTestimonials() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', content: '', rating: 5, is_published: true });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [orderChanged, setOrderChanged] = useState(false);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  useEffect(() => { fetchTestimonials(); }, []);

  async function fetchTestimonials() {
    setLoading(true);
    const { data } = await supabase.from('testimonials').select('*').order('order_index');
    if (data) setTestimonials(data);
    setLoading(false);
  }

  async function saveTestimonial() {
    if (!form.name || !form.content) return toast.error('Name and content are required');
    setSaving(true);
    let avatar_url: string | undefined;
    if (avatarFile) {
      setUploading(true);
      try {
        avatar_url = await uploadFile('avatars', `testimonial_${Date.now()}`, avatarFile);
      } catch (err: any) {
        toast.error(`Avatar upload failed: ${err.message}`);
        setUploading(false);
        setSaving(false);
        return;
      }
      setUploading(false);
    }

    if (editId) {
      await supabase.from('testimonials').update({
        name: form.name, content: form.content, rating: form.rating,
        is_published: form.is_published, ...(avatar_url ? { avatar_url } : {}),
      }).eq('id', editId);
      toast.success('Testimonial updated!');
    } else {
      await supabase.from('testimonials').insert({
        name: form.name, content: form.content, rating: form.rating,
        is_published: form.is_published,
        avatar_url: avatar_url || null,
        order_index: testimonials.length + 1,
      });
      toast.success('Testimonial added!');
    }
    setForm({ name: '', content: '', rating: 5, is_published: true });
    setAvatarFile(null);
    setEditId(null);
    setShowAdd(false);
    fetchTestimonials();
    setSaving(false);
  }

  async function deleteTestimonial(id: string) {
    if (!confirm('Delete this testimonial?')) return;
    await supabase.from('testimonials').delete().eq('id', id);
    toast.success('Deleted');
    fetchTestimonials();
  }

  async function togglePublish(t: Testimonial) {
    await supabase.from('testimonials').update({ is_published: !t.is_published }).eq('id', t.id);
    fetchTestimonials();
  }

  function startEdit(t: Testimonial) {
    setEditId(t.id);
    setForm({ name: t.name, content: t.content, rating: t.rating, is_published: t.is_published });
    setAvatarFile(null);
    setShowAdd(true);
  }

  // Drag handlers
  function onDragStart(idx: number) { dragItem.current = idx; setDragging(idx); }
  function onDragEnter(idx: number) { dragOverItem.current = idx; setDragOver(idx); }
  function onDragEnd() {
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      const arr = [...testimonials];
      const [removed] = arr.splice(dragItem.current, 1);
      arr.splice(dragOverItem.current, 0, removed);
      setTestimonials(arr);
      setOrderChanged(true);
    }
    setDragging(null); setDragOver(null);
    dragItem.current = null; dragOverItem.current = null;
  }

  async function saveOrder() {
    setSaving(true);
    await Promise.all(testimonials.map((t, i) => supabase.from('testimonials').update({ order_index: i + 1 }).eq('id', t.id)));
    toast.success('Order saved!');
    setOrderChanged(false);
    setSaving(false);
  }

  function move(idx: number, dir: -1 | 1) {
    const arr = [...testimonials];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    setTestimonials(arr);
    setOrderChanged(true);
  }

  if (loading) return <div className="h-32 bg-muted/30 rounded-2xl animate-pulse" />;

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" /> Testimonials ({testimonials.length})
          </h3>
          <div className="flex gap-2">
            {orderChanged && (
              <button onClick={saveOrder} disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 gradient-pink rounded-xl text-white text-xs font-bold press disabled:opacity-50">
                <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save Order'}
              </button>
            )}
            <button onClick={() => { setShowAdd(!showAdd); setEditId(null); setForm({ name: '', content: '', rating: 5, is_published: true }); setAvatarFile(null); }}
              className="flex items-center gap-1.5 px-3 py-1.5 gradient-pink rounded-xl text-white text-xs font-bold press">
              {showAdd ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {showAdd ? 'Cancel' : 'Add'}
            </button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Drag to reorder, toggle publish status. Shown on homepage in display order.</p>
      </div>

      {/* Add / Edit form */}
      {showAdd && (
        <div className="bg-card border border-primary/30 rounded-2xl p-4 space-y-3 animate-slide-up">
          <h3 className="font-bold text-foreground text-sm">{editId ? 'Edit Testimonial' : 'New Testimonial'}</h3>
          <input
            className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary"
            placeholder="Customer name *"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          />
          <textarea
            className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary resize-none"
            placeholder="Testimonial content *"
            rows={3}
            value={form.content}
            onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
          />
          {/* Rating */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block font-medium">Rating:</label>
            <div className="flex gap-1.5">
              {[1,2,3,4,5].map(r => (
                <button key={r} onClick={() => setForm(p => ({ ...p, rating: r }))}
                  className="w-9 h-9 rounded-xl transition-all press flex items-center justify-center"
                  style={{ background: r <= form.rating ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.05)' }}>
                  <Star className={`w-5 h-5 ${r <= form.rating ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground'}`} />
                </button>
              ))}
            </div>
          </div>
          {/* Avatar upload */}
          <label className="flex items-center gap-2 p-3 border border-dashed border-primary/35 rounded-xl cursor-pointer hover:bg-primary/5 transition-all">
            {uploading
              ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              : <Upload className="w-4 h-4 text-primary" />
            }
            <span className="text-sm text-muted-foreground flex-1">
              {avatarFile ? `✓ ${avatarFile.name}` : 'Upload customer photo (optional)'}
            </span>
            {avatarFile && <button type="button" onClick={() => setAvatarFile(null)} className="text-xs text-red-400">✕</button>}
            <input type="file" accept="image/*" className="hidden" onChange={e => setAvatarFile(e.target.files?.[0] || null)} />
          </label>
          {/* Published toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_published} onChange={e => setForm(p => ({ ...p, is_published: e.target.checked }))} className="rounded" />
            <span className="text-sm text-foreground">Published (visible on homepage)</span>
          </label>
          <button onClick={saveTestimonial} disabled={!form.name || !form.content || saving}
            className="w-full py-2.5 gradient-pink rounded-xl text-white text-sm font-bold disabled:opacity-50 press">
            {saving ? 'Saving...' : editId ? 'Update Testimonial' : 'Add Testimonial'}
          </button>
        </div>
      )}

      {/* Testimonials list */}
      <div className="space-y-2">
        {testimonials.map((t, idx) => (
          <div
            key={t.id}
            draggable
            onDragStart={() => onDragStart(idx)}
            onDragEnter={() => onDragEnter(idx)}
            onDragEnd={onDragEnd}
            onDragOver={e => e.preventDefault()}
            className={`flex items-start gap-3 p-3 rounded-2xl border transition-all select-none ${
              dragging === idx ? 'opacity-40' : dragOver === idx ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border bg-card'
            } ${!t.is_published ? 'opacity-60' : ''}`}
            style={{ cursor: 'grab' }}
          >
            <div className="text-muted-foreground flex-shrink-0 pt-1">
              <GripVertical className="w-4 h-4" />
            </div>
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full overflow-hidden bg-muted gradient-pink flex items-center justify-center flex-shrink-0">
              {t.avatar_url
                ? <img src={t.avatar_url} alt={t.name} className="w-full h-full object-cover" />
                : <span className="text-white font-black text-sm">{t.name[0]?.toUpperCase()}</span>
              }
            </div>
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-bold text-foreground">{t.name}</p>
                {!t.is_published && <span className="text-[9px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded font-medium">Hidden</span>}
              </div>
              <div className="flex gap-0.5 mb-1">
                {Array.from({ length: t.rating }).map((_, i) => <Star key={i} className="w-3 h-3 text-yellow-400 fill-yellow-400" />)}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">"{t.content}"</p>
            </div>
            {/* Actions */}
            <div className="flex flex-col gap-1 flex-shrink-0">
              <div className="flex gap-1">
                <button onClick={() => move(idx, -1)} disabled={idx === 0} className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center disabled:opacity-30 press">
                  <ChevronUp className="w-3.5 h-3.5 text-foreground" />
                </button>
                <button onClick={() => move(idx, 1)} disabled={idx === testimonials.length - 1} className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center disabled:opacity-30 press">
                  <ChevronDown className="w-3.5 h-3.5 text-foreground" />
                </button>
              </div>
              <div className="flex gap-1">
                <button onClick={() => startEdit(t)} className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center press">
                  <Edit2 className="w-3 h-3 text-primary" />
                </button>
                <button onClick={() => togglePublish(t)}
                  className={`w-6 h-6 rounded-lg flex items-center justify-center press ${t.is_published ? 'bg-green-500/15' : 'bg-muted'}`}>
                  <span className="text-[10px]">{t.is_published ? '👁' : '🙈'}</span>
                </button>
                <button onClick={() => deleteTestimonial(t.id)} className="w-6 h-6 rounded-lg bg-red-500/10 flex items-center justify-center press">
                  <Trash2 className="w-3 h-3 text-red-400" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {testimonials.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No testimonials yet. Add your first one above.
          </div>
        )}
      </div>
    </div>
  );
}
