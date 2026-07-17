import { useState, useEffect, useRef } from 'react';
import {
  GraduationCap, ChevronDown, ChevronUp, Plus, Trash2, Edit2, Save,
  Video, File, Image, GripVertical, Check, X, Loader2, ArrowLeft,
  BookOpen, Play, FileText
} from 'lucide-react';
import { supabase, uploadFile } from '@/lib/supabase';
import { toast } from 'sonner';

interface Course {
  id: string;
  title: string;
  description?: string;
  thumbnail_url?: string;
  category: string;
  is_free: boolean;
  price_usd: number;
  is_published: boolean;
  order_index: number;
  total_lessons: number;
  created_at: string;
}

interface Lesson {
  id: string;
  course_id: string;
  title: string;
  content?: string;
  video_url?: string;
  file_url?: string;
  duration_minutes: number;
  order_index: number;
  is_free: boolean;
  created_at: string;
}

// ── uploadXHR — delegates to shared uploadFile from supabase.ts ──
async function uploadXHR(
  bucket: string,
  filePath: string,
  file: File,
  onProgress: (loaded: number, total: number) => void
): Promise<string> {
  return uploadFile(bucket, filePath, file, onProgress);
}

// ── Progress bar ──
function UploadBar({ loaded, total, label }: { loaded: number; total: number; label: string }) {
  if (!total) return null;
  const pct = Math.min(100, Math.round((loaded / total) * 100));
  const mb = (v: number) => (v / 1024 / 1024).toFixed(1);
  return (
    <div className="space-y-1 mt-1.5">
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span className="truncate max-w-[60%]">{label}</span>
        <span className="font-bold text-primary">{mb(loaded)}/{mb(total)} MB · {pct}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full gradient-pink rounded-full transition-all duration-200" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}



// ── Lesson Row ──
function LessonRow({
  lesson, idx, total, courseId,
  onDelete, onSave, onMoveUp, onMoveDown
}: {
  lesson: Lesson; idx: number; total: number; courseId: string;
  onDelete: () => void;
  onSave: (updated: Partial<Lesson>, newVideo?: File, newFile?: File) => Promise<void>;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: lesson.title, content: lesson.content || '', is_free: lesson.is_free, duration_minutes: lesson.duration_minutes });
  const [newVideo, setNewVideo] = useState<File | null>(null);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState({ loaded: 0, total: 0 });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave(form, newVideo || undefined, newFile || undefined);
    setEditing(false);
    setNewVideo(null);
    setNewFile(null);
    setUploadProgress({ loaded: 0, total: 0 });
    setSaving(false);
  }

  const mediaLabel =
    lesson.video_url ? '🎬 VIDEO' :
    lesson.file_url?.endsWith('.pdf') ? '📄 PDF' :
    lesson.file_url ? '🖼 IMAGE' : '';

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      {/* Compact row */}
      <div className="flex items-center gap-2 p-2.5">
        <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary text-[10px] font-black flex items-center justify-center flex-shrink-0">{idx + 1}</div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-foreground truncate">{lesson.title}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {lesson.is_free && <span className="text-[9px] px-1.5 py-0.5 bg-green-500/15 text-green-400 rounded font-bold">FREE</span>}
            {mediaLabel && <span className="text-[9px] px-1.5 py-0.5 bg-blue-500/15 text-blue-400 rounded">{mediaLabel}</span>}
            {lesson.duration_minutes > 0 && <span className="text-[9px] text-muted-foreground">{lesson.duration_minutes}min</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onMoveUp} disabled={idx === 0} className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center press disabled:opacity-30"><ChevronUp className="w-3.5 h-3.5 text-foreground" /></button>
          <button onClick={onMoveDown} disabled={idx === total - 1} className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center press disabled:opacity-30"><ChevronDown className="w-3.5 h-3.5 text-foreground" /></button>
          <button onClick={() => setEditing(!editing)} className={`w-6 h-6 rounded-lg flex items-center justify-center press ${editing ? 'bg-primary/20' : 'bg-blue-500/10'}`}>
            {editing ? <X className="w-3 h-3 text-primary" /> : <Edit2 className="w-3 h-3 text-blue-400" />}
          </button>
          <button onClick={onDelete} className="w-6 h-6 rounded-lg bg-red-500/10 flex items-center justify-center press"><Trash2 className="w-3 h-3 text-red-400" /></button>
        </div>
      </div>

      {/* Inline edit form */}
      {editing && (
        <div className="border-t border-border p-3 space-y-2.5 bg-blue-500/5 animate-slide-up">
          <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wide">✏️ Edit Lesson</p>
          <input
            className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary"
            value={form.title} placeholder="Lesson title"
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
          />
          <textarea
            className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary resize-none"
            rows={2} placeholder="Lesson content (optional)"
            value={form.content}
            onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
          />
          <div className="flex gap-2 items-center">
            <input
              type="number" min={0}
              className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary"
              placeholder="Duration (min)" value={form.duration_minutes}
              onChange={e => setForm(p => ({ ...p, duration_minutes: +e.target.value }))}
            />
            <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
              <input type="checkbox" checked={form.is_free} onChange={e => setForm(p => ({ ...p, is_free: e.target.checked }))} />
              <span className="text-sm text-foreground">Free</span>
            </label>
          </div>

          {/* Replace Video */}
          <label className="flex items-center gap-2 p-2.5 border border-dashed border-blue-500/30 rounded-xl cursor-pointer hover:bg-blue-500/5">
            <Video className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <span className="text-xs text-muted-foreground flex-1">
              {newVideo ? `✓ ${newVideo.name}` : lesson.video_url ? '↩️ Replace Video' : 'Upload Video (any size)'}
            </span>
            {newVideo && <button type="button" onClick={() => setNewVideo(null)} className="text-xs text-red-400">✕</button>}
            <input type="file" accept="video/*" className="hidden" onChange={e => setNewVideo(e.target.files?.[0] || null)} />
          </label>
          {newVideo && uploadProgress.total > 0 && (
            <UploadBar loaded={uploadProgress.loaded} total={uploadProgress.total} label={newVideo.name} />
          )}

          {/* Replace Image/PDF */}
          <label className="flex items-center gap-2 p-2.5 border border-dashed border-orange-500/30 rounded-xl cursor-pointer hover:bg-orange-500/5">
            <File className="w-4 h-4 text-orange-400 flex-shrink-0" />
            <span className="text-xs text-muted-foreground flex-1">
              {newFile ? `✓ ${newFile.name}` : lesson.file_url ? '↩️ Replace Image/PDF' : 'Upload Image/PDF'}
            </span>
            {newFile && <button type="button" onClick={() => setNewFile(null)} className="text-xs text-red-400">✕</button>}
            <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => setNewFile(e.target.files?.[0] || null)} />
          </label>
          {newFile && uploadProgress.total > 0 && (
            <UploadBar loaded={uploadProgress.loaded} total={uploadProgress.total} label={newFile.name} />
          )}

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || !form.title}
              className="flex-1 py-2 gradient-pink rounded-xl text-white text-xs font-bold press disabled:opacity-50 flex items-center justify-center gap-1.5">
              {saving ? <><Loader2 className="w-3 h-3 animate-spin" /> Saving...</> : <><Check className="w-3 h-3" /> Save Changes</>}
            </button>
            <button onClick={() => { setEditing(false); setNewVideo(null); setNewFile(null); }}
              className="px-3 py-2 bg-muted rounded-xl text-muted-foreground text-xs font-bold press">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Course Detail View ──
function CourseDetail({ course, onBack, onCourseUpdated }: {
  course: Course;
  onBack: () => void;
  onCourseUpdated: () => void;
}) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingLesson, setAddingLesson] = useState(false);
  const [newLesson, setNewLesson] = useState({ title: '', content: '', is_free: false, duration_minutes: 0 });
  const [newVideo, setNewVideo] = useState<File | null>(null);
  const [newImage, setNewImage] = useState<File | null>(null);
  const [newPDF, setNewPDF] = useState<File | null>(null);
  const [addProgress, setAddProgress] = useState({ loaded: 0, total: 0 });
  const [saving, setSaving] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [editingCourse, setEditingCourse] = useState(false);
  const [courseForm, setCourseForm] = useState({ title: course.title, description: course.description || '', category: course.category, is_free: course.is_free, price_usd: course.price_usd });
  const [courseThumb, setCourseThumb] = useState<File | null>(null);
  const [savingCourse, setSavingCourse] = useState(false);
  const dragging = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);

  useEffect(() => { fetchLessons(); }, []);

  async function fetchLessons() {
    setLoading(true);
    const { data } = await supabase.from('course_lessons').select('*').eq('course_id', course.id).order('order_index');
    if (data) setLessons(data as Lesson[]);
    setLoading(false);
  }

  async function addLesson() {
    if (!newLesson.title) return toast.error('Enter lesson title');
    setSaving(true);
    let video_url: string | undefined;
    let file_url: string | undefined;
    try {
      if (newVideo) {
        setAddProgress({ loaded: 0, total: newVideo.size });
        const path = `lesson_v_${Date.now()}_${newVideo.name.replace(/[^\w.-]/g, '_')}`;
        video_url = await uploadXHR('courses', path, newVideo, (l, t) => setAddProgress({ loaded: l, total: t }));
      }
      if (newImage) {
        setAddProgress({ loaded: 0, total: newImage.size });
        const path = `lesson_i_${Date.now()}_${newImage.name.replace(/[^\w.-]/g, '_')}`;
        file_url = await uploadXHR('courses', path, newImage, (l, t) => setAddProgress({ loaded: l, total: t }));
      }
      if (newPDF) {
        setAddProgress({ loaded: 0, total: newPDF.size });
        const path = `lesson_p_${Date.now()}_${newPDF.name.replace(/[^\w.-]/g, '_')}`;
        file_url = await uploadXHR('courses', path, newPDF, (l, t) => setAddProgress({ loaded: l, total: t }));
      }
      await supabase.from('course_lessons').insert({
        course_id: course.id, title: newLesson.title, content: newLesson.content || null,
        is_free: newLesson.is_free, duration_minutes: newLesson.duration_minutes,
        video_url: video_url || null, file_url: file_url || null,
        order_index: lessons.length + 1,
      });
      const { count } = await supabase.from('course_lessons').select('*', { count: 'exact', head: true }).eq('course_id', course.id);
      await supabase.from('courses').update({ total_lessons: count || 0 }).eq('id', course.id);
      toast.success('Lesson added!');
      setAddingLesson(false);
      setNewLesson({ title: '', content: '', is_free: false, duration_minutes: 0 });
      setNewVideo(null); setNewImage(null); setNewPDF(null);
      setAddProgress({ loaded: 0, total: 0 });
      fetchLessons();
      onCourseUpdated();
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`);
    }
    setSaving(false);
  }

  async function saveLesson(lesson: Lesson, updates: Partial<Lesson>, newVid?: File, newFil?: File) {
    let video_url = lesson.video_url;
    let file_url = lesson.file_url;
    if (newVid) {
      const path = `lesson_v_${Date.now()}_${newVid.name.replace(/[^\w.-]/g, '_')}`;
      video_url = await uploadXHR('courses', path, newVid, () => {});
    }
    if (newFil) {
      const path = `lesson_f_${Date.now()}_${newFil.name.replace(/[^\w.-]/g, '_')}`;
      file_url = await uploadXHR('courses', path, newFil, () => {});
    }
    await supabase.from('course_lessons').update({ ...updates, video_url: video_url || null, file_url: file_url || null }).eq('id', lesson.id);
    toast.success('Lesson updated!');
    fetchLessons();
  }

  async function deleteLesson(id: string) {
    if (!confirm('Delete this lesson?')) return;
    await supabase.from('course_lessons').delete().eq('id', id);
    const { count } = await supabase.from('course_lessons').select('*', { count: 'exact', head: true }).eq('course_id', course.id);
    await supabase.from('courses').update({ total_lessons: count || 0 }).eq('id', course.id);
    toast.success('Lesson deleted');
    fetchLessons();
    onCourseUpdated();
  }

  function moveLesson(idx: number, dir: -1 | 1) {
    const arr = [...lessons];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    setLessons(arr.map((l, i) => ({ ...l, order_index: i + 1 })));
  }

  async function saveOrder() {
    setSavingOrder(true);
    await Promise.all(lessons.map((l, i) => supabase.from('course_lessons').update({ order_index: i + 1 }).eq('id', l.id)));
    toast.success('Order saved!');
    setSavingOrder(false);
  }

  async function saveCourseInfo() {
    setSavingCourse(true);
    let thumbnail_url = course.thumbnail_url;
    try {
      if (courseThumb) {
        const ext = courseThumb.name.split('.').pop()?.toLowerCase() || 'jpg';
        const path = `thumb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        thumbnail_url = await uploadFile('courses', path, courseThumb);
      }
      await supabase.from('courses').update({ ...courseForm, thumbnail_url }).eq('id', course.id);
      toast.success('Course updated!');
      setEditingCourse(false);
      setCourseThumb(null);
      onCourseUpdated();
    } catch (err: any) {
      toast.error(`Save failed: ${err.message || 'Unknown error'}`);
    } finally {
      setSavingCourse(false);
    }
  }

  // Drag to reorder
  function onDragStart(idx: number) { dragging.current = idx; }
  function onDragEnter(idx: number) { dragOver.current = idx; }
  function onDragEnd() {
    if (dragging.current !== null && dragOver.current !== null && dragging.current !== dragOver.current) {
      const arr = [...lessons];
      const [moved] = arr.splice(dragging.current, 1);
      arr.splice(dragOver.current, 0, moved);
      setLessons(arr.map((l, i) => ({ ...l, order_index: i + 1 })));
    }
    dragging.current = null;
    dragOver.current = null;
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Back button + title */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onBack} className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center press flex-shrink-0">
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-black text-foreground truncate">{course.title}</p>
            <p className="text-xs text-muted-foreground">{course.category} · {lessons.length} lessons</p>
          </div>
          <button onClick={() => setEditingCourse(!editingCourse)} className="text-xs text-primary font-bold">
            {editingCourse ? 'Cancel' : 'Edit Info'}
          </button>
        </div>

        {/* Course thumbnail */}
        {course.thumbnail_url && !editingCourse && (
          <img
            src={course.thumbnail_url}
            alt=""
            className="w-full h-28 object-cover rounded-xl mb-2"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}

        {/* Edit course info form */}
        {editingCourse && (
          <div className="space-y-2.5 animate-slide-up">
            <label className="flex items-center gap-3 p-3 border border-dashed border-primary/30 rounded-xl cursor-pointer hover:bg-primary/5">
              <Image className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-xs text-muted-foreground flex-1">{courseThumb ? `✓ ${courseThumb.name}` : course.thumbnail_url ? '↩️ Replace Thumbnail' : 'Upload Thumbnail'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={e => setCourseThumb(e.target.files?.[0] || null)} />
            </label>
            <input className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary" value={courseForm.title} onChange={e => setCourseForm(p => ({ ...p, title: e.target.value }))} placeholder="Course title" />
            <textarea className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary resize-none" rows={2} value={courseForm.description} onChange={e => setCourseForm(p => ({ ...p, description: e.target.value }))} placeholder="Description" />
            <div className="flex gap-2">
              <select className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none" value={courseForm.category} onChange={e => setCourseForm(p => ({ ...p, category: e.target.value }))}>
                {['Basics', 'Technical', 'Advanced', 'Strategies', 'Psychology', 'Risk'].map(c => <option key={c}>{c}</option>)}
              </select>
              <input type="number" className="w-24 bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none" value={courseForm.price_usd} onChange={e => setCourseForm(p => ({ ...p, price_usd: +e.target.value }))} placeholder="$Price" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={courseForm.is_free} onChange={e => setCourseForm(p => ({ ...p, is_free: e.target.checked }))} />
              <span className="text-sm text-foreground">Free course</span>
            </label>
            <button onClick={saveCourseInfo} disabled={savingCourse}
              className="w-full py-2 gradient-pink rounded-xl text-white text-sm font-bold press disabled:opacity-50 flex items-center justify-center gap-2">
              {savingCourse ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {savingCourse ? 'Saving...' : 'Save Course Info'}
            </button>
          </div>
        )}
      </div>

      {/* Lessons list */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" /> Lessons ({lessons.length})
          </h3>
          <div className="flex items-center gap-2">
            <button onClick={saveOrder} disabled={savingOrder}
              className="px-2.5 py-1.5 bg-muted border border-border rounded-xl text-xs font-bold text-foreground press disabled:opacity-50 flex items-center gap-1">
              {savingOrder ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Save Order
            </button>
            <button onClick={() => setAddingLesson(!addingLesson)}
              className="px-2.5 py-1.5 gradient-pink rounded-xl text-white text-xs font-bold press flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-muted/30 rounded-xl animate-pulse" />)}</div>
        ) : (
          <div className="space-y-2">
            {lessons.map((lesson, idx) => (
              <div
                key={lesson.id}
                draggable
                onDragStart={() => onDragStart(idx)}
                onDragEnter={() => onDragEnter(idx)}
                onDragEnd={onDragEnd}
                onDragOver={e => e.preventDefault()}
              >
                <LessonRow
                  lesson={lesson} idx={idx} total={lessons.length} courseId={course.id}
                  onDelete={() => deleteLesson(lesson.id)}
                  onSave={(updates, vid, fil) => saveLesson(lesson, updates, vid, fil)}
                  onMoveUp={() => moveLesson(idx, -1)}
                  onMoveDown={() => moveLesson(idx, 1)}
                />
              </div>
            ))}
            {lessons.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Play className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No lessons yet. Add the first one!</p>
              </div>
            )}
          </div>
        )}

        {/* Add lesson form */}
        {addingLesson && (
          <div className="mt-3 p-3 bg-primary/5 border border-primary/20 rounded-xl space-y-2.5 animate-slide-up">
            <p className="text-[11px] font-bold text-primary uppercase tracking-wide">+ New Lesson</p>
            <input className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary" placeholder="Lesson title *" value={newLesson.title} onChange={e => setNewLesson(p => ({ ...p, title: e.target.value }))} />
            <textarea className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary resize-none" rows={2} placeholder="Content (optional)" value={newLesson.content} onChange={e => setNewLesson(p => ({ ...p, content: e.target.value }))} />
            <div className="flex gap-2 items-center">
              <input type="number" className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none" placeholder="Duration (min)" value={newLesson.duration_minutes} onChange={e => setNewLesson(p => ({ ...p, duration_minutes: +e.target.value }))} />
              <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
                <input type="checkbox" checked={newLesson.is_free} onChange={e => setNewLesson(p => ({ ...p, is_free: e.target.checked }))} />
                <span className="text-sm text-foreground">Free</span>
              </label>
            </div>
            {/* File inputs */}
            <label className="flex items-center gap-2 p-2.5 border border-dashed border-primary/30 rounded-xl cursor-pointer hover:bg-primary/5">
              <Video className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-xs text-muted-foreground flex-1">{newVideo ? `✓ ${newVideo.name}` : 'Upload Video (any size)'}</span>
              {newVideo && <button type="button" onClick={() => setNewVideo(null)} className="text-xs text-red-400">✕</button>}
              <input type="file" accept="video/*" className="hidden" onChange={e => { setNewVideo(e.target.files?.[0] || null); setNewImage(null); setNewPDF(null); }} />
            </label>
            {newVideo && addProgress.total > 0 && <UploadBar loaded={addProgress.loaded} total={addProgress.total} label={newVideo.name} />}
            <label className="flex items-center gap-2 p-2.5 border border-dashed border-blue-500/30 rounded-xl cursor-pointer hover:bg-blue-500/5">
              <Image className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <span className="text-xs text-muted-foreground flex-1">{newImage ? `✓ ${newImage.name}` : 'Upload Image'}</span>
              {newImage && <button type="button" onClick={() => setNewImage(null)} className="text-xs text-red-400">✕</button>}
              <input type="file" accept="image/*" className="hidden" onChange={e => { setNewImage(e.target.files?.[0] || null); setNewVideo(null); setNewPDF(null); }} />
            </label>
            <label className="flex items-center gap-2 p-2.5 border border-dashed border-orange-500/30 rounded-xl cursor-pointer hover:bg-orange-500/5">
              <FileText className="w-4 h-4 text-orange-400 flex-shrink-0" />
              <span className="text-xs text-muted-foreground flex-1">{newPDF ? `✓ ${newPDF.name}` : 'Upload PDF'}</span>
              {newPDF && <button type="button" onClick={() => setNewPDF(null)} className="text-xs text-red-400">✕</button>}
              <input type="file" accept=".pdf" className="hidden" onChange={e => { setNewPDF(e.target.files?.[0] || null); setNewVideo(null); setNewImage(null); }} />
            </label>
            <div className="flex gap-2">
              <button onClick={addLesson} disabled={saving || !newLesson.title}
                className="flex-1 py-2 gradient-pink rounded-xl text-white text-xs font-bold press disabled:opacity-50 flex items-center justify-center gap-1.5">
                {saving ? <><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</> : 'Add Lesson'}
              </button>
              <button onClick={() => setAddingLesson(false)} className="px-3 py-2 bg-muted rounded-xl text-muted-foreground text-xs font-bold press"><X className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main AdminCourses ──
export default function AdminCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newCourse, setNewCourse] = useState({ title: '', description: '', category: 'Technical', is_free: false, price_usd: 0 });
  const [adding, setAdding] = useState(false);

  useEffect(() => { fetchCourses(); }, []);

  async function fetchCourses() {
    setLoading(true);
    const { data } = await supabase.from('courses').select('*').order('order_index');
    if (data) setCourses(data as Course[]);
    setLoading(false);
  }

  async function addCourse() {
    if (!newCourse.title) return toast.error('Enter course title');
    setAdding(true);
    await supabase.from('courses').insert({ ...newCourse, order_index: courses.length + 1, total_lessons: 0 });
    toast.success('Course added!');
    setShowAdd(false);
    setNewCourse({ title: '', description: '', category: 'Technical', is_free: false, price_usd: 0 });
    setAdding(false);
    fetchCourses();
  }

  async function deleteCourse(id: string) {
    if (!confirm('Delete this course and ALL its lessons?')) return;
    await supabase.from('courses').delete().eq('id', id);
    toast.success('Course deleted');
    fetchCourses();
  }

  async function swapCourses(idx: number, dir: -1 | 1) {
    const arr = [...courses];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    const a = arr[idx], b = arr[target];
    await supabase.from('courses').update({ order_index: b.order_index }).eq('id', a.id);
    await supabase.from('courses').update({ order_index: a.order_index }).eq('id', b.id);
    fetchCourses();
  }

  // If a course is selected, show its detail view
  if (selectedCourse) {
    // Find updated course data
    const currentCourse = courses.find(c => c.id === selectedCourse.id) || selectedCourse;
    return (
      <CourseDetail
        course={currentCourse}
        onBack={() => setSelectedCourse(null)}
        onCourseUpdated={fetchCourses}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-foreground">Course Manager</h3>
            <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-bold">{courses.length}</span>
          </div>
          <button onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1.5 px-3 py-1.5 gradient-pink rounded-xl text-white text-xs font-bold press">
            <Plus className="w-3.5 h-3.5" /> New Course
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Tap a course to manage its lessons, videos, and media files.</p>
      </div>

      {/* Add course form */}
      {showAdd && (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3 animate-slide-up">
          <p className="font-bold text-foreground text-sm">New Course</p>
          <input className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary" placeholder="Course title *" value={newCourse.title} onChange={e => setNewCourse(p => ({ ...p, title: e.target.value }))} />
          <textarea className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary resize-none" rows={2} placeholder="Description" value={newCourse.description} onChange={e => setNewCourse(p => ({ ...p, description: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <select className="bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none" value={newCourse.category} onChange={e => setNewCourse(p => ({ ...p, category: e.target.value }))}>
              {['Basics', 'Technical', 'Advanced', 'Strategies', 'Psychology', 'Risk'].map(c => <option key={c}>{c}</option>)}
            </select>
            <input type="number" className="bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary" placeholder="Price USD" value={newCourse.price_usd} onChange={e => setNewCourse(p => ({ ...p, price_usd: +e.target.value }))} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={newCourse.is_free} onChange={e => setNewCourse(p => ({ ...p, is_free: e.target.checked }))} />
            <span className="text-sm text-foreground">Free course</span>
          </label>
          <div className="flex gap-2">
            <button onClick={addCourse} disabled={adding || !newCourse.title}
              className="flex-1 py-2.5 gradient-pink rounded-xl text-white text-sm font-bold press disabled:opacity-50">
              {adding ? 'Adding...' : 'Add Course'}
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2.5 bg-muted rounded-xl text-muted-foreground text-sm font-bold press"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Courses list */}
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted/30 rounded-2xl animate-pulse" />)}</div>
      ) : courses.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <GraduationCap className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground text-sm">No courses yet. Create your first one!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {courses.map((course, idx) => (
            <div key={course.id} className="bg-card border border-border rounded-2xl overflow-hidden">
              <button
                onClick={() => setSelectedCourse(course)}
                className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-all text-left press"
              >
                {/* Thumbnail */}
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted flex items-center justify-center flex-shrink-0 relative">
                  {course.thumbnail_url
                    ? <img
                        src={course.thumbnail_url}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    : <GraduationCap className="w-6 h-6 text-muted-foreground" />
                  }
                  {/* Always show icon as background in case image fails */}
                  <GraduationCap className="w-6 h-6 text-muted-foreground absolute" style={{ zIndex: 0 }} />
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground text-sm truncate">{course.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10px] px-2 py-0.5 bg-muted rounded-lg text-muted-foreground">{course.category}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-lg font-bold ${course.is_free ? 'bg-green-500/15 text-green-400' : 'bg-primary/10 text-primary'}`}>
                      {course.is_free ? 'FREE' : `$${course.price_usd}`}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{course.total_lessons} lessons</span>
                  </div>
                </div>
                {/* Controls */}
                <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  <button onClick={() => swapCourses(idx, -1)} disabled={idx === 0}
                    className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center press disabled:opacity-30">
                    <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={() => swapCourses(idx, 1)} disabled={idx === courses.length - 1}
                    className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center press disabled:opacity-30">
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={() => deleteCourse(course.id)}
                    className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center press hover:bg-red-500/20">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
