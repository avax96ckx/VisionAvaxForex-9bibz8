import { useState, useEffect, useRef } from 'react';
import {
  Upload, Image, FileText, Globe, Plus, Trash2, Edit2, Save,
  Video, File, GripVertical, ChevronDown, ChevronUp, Check, X, Loader2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Course, SiteSettings } from '@/types';
import { toast } from 'sonner';

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

function UploadProgressBar({ progress, total, label }: { progress: number; total: number; label: string }) {
  if (total === 0) return null;
  const pct = Math.min(100, Math.round((progress / total) * 100));
  const uploadedMB = (progress / (1024 * 1024)).toFixed(1);
  const totalMB = (total / (1024 * 1024)).toFixed(1);
  return (
    <div className="space-y-1 mt-1.5 animate-fade-in">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="truncate max-w-[60%]">{label}</span>
        <span className="font-bold text-primary">{uploadedMB} / {totalMB} MB · {pct}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full gradient-pink rounded-full transition-all duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// Upload with real XHR progress — works for files of ANY size
// Supabase Storage requires: POST /storage/v1/object/{bucket}/{path} with FormData OR raw body
async function uploadWithProgress(
  bucket: string,
  filePath: string,
  file: File,
  onProgress: (loaded: number, total: number) => void
): Promise<string> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(e.loaded, e.total);
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // Build public URL — filePath may contain special chars, encode properly
        const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
        const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodedPath}`;
        onProgress(file.size, file.size);
        resolve(publicUrl);
      } else {
        // Try to extract useful error from response
        let errMsg = `Upload failed (${xhr.status})`;
        try {
          const parsed = JSON.parse(xhr.responseText);
          errMsg += `: ${parsed.error || parsed.message || xhr.responseText}`;
        } catch {
          errMsg += `: ${xhr.responseText.slice(0, 200)}`;
        }
        reject(new Error(errMsg));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error — check your connection')));
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

    // Supabase Storage REST API: POST to create, PUT to update
    // Encode each path segment but keep slashes
    const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
    const url = `${supabaseUrl}/storage/v1/object/${bucket}/${encodedPath}`;
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${supabaseKey}`);
    xhr.setRequestHeader('x-upsert', 'true'); // overwrite if exists
    // IMPORTANT: Set Content-Type explicitly to the file's MIME type.
    // Without this, large video files (20MB+) fail after reaching 100%
    // because Supabase Storage can't determine the content type for big uploads.
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.send(file);
  });
}

export default function AdminContent() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Record<string, Lesson[]>>({});
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [editHero, setEditHero] = useState(false);
  const [heroTitle, setHeroTitle] = useState('');
  const [heroSub, setHeroSub] = useState('');
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [newCourse, setNewCourse] = useState({ title: '', category: 'Technical', description: '', is_free: false, price_usd: 0 });
  const [saving, setSaving] = useState(false);
  const [addingLesson, setAddingLesson] = useState<string | null>(null);
  const [newLesson, setNewLesson] = useState({ title: '', is_free: false, duration_minutes: 0, content: '' });
  const [lessonVideo, setLessonVideo] = useState<File | null>(null);
  const [lessonImage, setLessonImage] = useState<File | null>(null);
  const [lessonPDF, setLessonPDF] = useState<File | null>(null);
  const [lessonUploadProgress, setLessonUploadProgress] = useState({ loaded: 0, total: 0 });
  const [draggingLesson, setDraggingLesson] = useState<string | null>(null);
  const [dragOverLesson, setDragOverLesson] = useState<string | null>(null);
  const [reorderingCourse, setReorderingCourse] = useState<string | null>(null);
  const [swappingCourses, setSwappingCourses] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  // Edit lesson state
  const [editingLesson, setEditingLesson] = useState<string | null>(null);
  const [editLessonData, setEditLessonData] = useState({ title: '', content: '', is_free: false, duration_minutes: 0 });
  const [editLessonVideo, setEditLessonVideo] = useState<File | null>(null);
  const [editLessonFile, setEditLessonFile] = useState<File | null>(null);
  const [editLessonProgress, setEditLessonProgress] = useState({ loaded: 0, total: 0 });
  const [savingLesson, setSavingLesson] = useState(false);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    const [s, c] = await Promise.all([
      supabase.from('site_settings').select('*').eq('id', 'main').single(),
      supabase.from('courses').select('*').order('order_index'),
    ]);
    if (s.data) { setSettings(s.data); setHeroTitle(s.data.hero_title); setHeroSub(s.data.hero_subtitle); }
    if (c.data) setCourses(c.data);
  }

  async function fetchLessons(courseId: string) {
    const { data } = await supabase.from('course_lessons').select('*').eq('course_id', courseId).order('order_index');
    if (data) setLessons(p => ({ ...p, [courseId]: data }));
  }

  function toggleCourseExpand(courseId: string) {
    if (expandedCourse === courseId) { setExpandedCourse(null); }
    else { setExpandedCourse(courseId); if (!lessons[courseId]) fetchLessons(courseId); }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(u => ({ ...u, logo: true }));
    const path = `logo_${Date.now()}`;
    const url = await uploadWithProgress('banners', path, file, () => {});
    await supabase.from('site_settings').update({ logo_url: url }).eq('id', 'main');
    toast.success('Logo updated!'); fetchData();
    setUploading(u => ({ ...u, logo: false }));
  }

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(u => ({ ...u, banner: true }));
    const path = `hero_${Date.now()}`;
    const url = await uploadWithProgress('banners', path, file, () => {});
    await supabase.from('site_settings').update({ hero_banner_url: url }).eq('id', 'main');
    toast.success('Hero banner updated!'); fetchData();
    setUploading(u => ({ ...u, banner: false }));
  }

  async function saveHeroText() {
    setSaving(true);
    const { error } = await supabase.from('site_settings').update({ hero_title: heroTitle, hero_subtitle: heroSub }).eq('id', 'main');
    if (error) { toast.error(`Save failed: ${error.message}`); } else { toast.success('Hero text saved!'); setEditHero(false); }
    setSaving(false);
  }

  async function addCourse() {
    if (!newCourse.title) return toast.error('Enter course title');
    setSaving(true);
    const { error } = await supabase.from('courses').insert({ ...newCourse, order_index: courses.length + 1 });
    if (error) { toast.error(`Failed to add course: ${error.message}`); }
    else { toast.success('Course added!'); setShowAddCourse(false); setNewCourse({ title: '', category: 'Technical', description: '', is_free: false, price_usd: 0 }); fetchData(); }
    setSaving(false);
  }

  async function deleteCourse(id: string) {
    if (!confirm('Delete this course and all its lessons?')) return;
    await supabase.from('courses').delete().eq('id', id);
    toast.success('Course deleted'); fetchData();
  }

  async function handleCourseThumb(e: React.ChangeEvent<HTMLInputElement>, courseId: string) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(u => ({ ...u, [courseId]: true }));
    const path = `thumb_${courseId}_${Date.now()}`;
    const url = await uploadWithProgress('courses', path, file, () => {});
    await supabase.from('courses').update({ thumbnail_url: url }).eq('id', courseId);
    toast.success('Thumbnail updated!'); fetchData();
    setUploading(u => ({ ...u, [courseId]: false }));
  }

  async function addLesson(courseId: string) {
    if (!newLesson.title) return toast.error('Enter lesson title');
    setSaving(true);
    let video_url: string | undefined;
    let file_url: string | undefined;

    try {
      if (lessonVideo) {
        setLessonUploadProgress({ loaded: 0, total: lessonVideo.size });
        const path = `lesson_video_${Date.now()}_${lessonVideo.name.replace(/[^\w.-]/g, '_')}`;
        video_url = await uploadWithProgress(
          'courses', path, lessonVideo,
          (loaded, total) => setLessonUploadProgress({ loaded, total })
        );
      }
      if (lessonImage) {
        setLessonUploadProgress({ loaded: 0, total: lessonImage.size });
        const path = `lesson_img_${Date.now()}_${lessonImage.name.replace(/[^\w.-]/g, '_')}`;
        file_url = await uploadWithProgress('courses', path, lessonImage, (l, t) => setLessonUploadProgress({ loaded: l, total: t }));
      }
      if (lessonPDF) {
        setLessonUploadProgress({ loaded: 0, total: lessonPDF.size });
        const path = `lesson_pdf_${Date.now()}_${lessonPDF.name.replace(/[^\w.-]/g, '_')}`;
        file_url = await uploadWithProgress('courses', path, lessonPDF, (l, t) => setLessonUploadProgress({ loaded: l, total: t }));
      }

      const existingLessons = lessons[courseId] || [];
      await supabase.from('course_lessons').insert({
        course_id: courseId, title: newLesson.title,
        content: newLesson.content || null, is_free: newLesson.is_free,
        duration_minutes: newLesson.duration_minutes,
        video_url: video_url || null, file_url: file_url || null,
        order_index: existingLessons.length + 1,
      });

      const { count } = await supabase.from('course_lessons').select('*', { count: 'exact', head: true }).eq('course_id', courseId);
      await supabase.from('courses').update({ total_lessons: count || 0 }).eq('id', courseId);
      toast.success('Lesson added!');
      setAddingLesson(null);
      setNewLesson({ title: '', is_free: false, duration_minutes: 0, content: '' });
      setLessonVideo(null); setLessonImage(null); setLessonPDF(null);
      setLessonUploadProgress({ loaded: 0, total: 0 });
      fetchData(); fetchLessons(courseId);
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`);
    }
    setSaving(false);
  }

  // ── Edit Lesson ──
  function startEditLesson(lesson: Lesson) {
    setEditingLesson(lesson.id);
    setEditLessonData({
      title: lesson.title, content: lesson.content || '',
      is_free: lesson.is_free, duration_minutes: lesson.duration_minutes,
    });
    setEditLessonVideo(null); setEditLessonFile(null);
    setEditLessonProgress({ loaded: 0, total: 0 });
  }

  async function saveEditLesson(lesson: Lesson) {
    setSavingLesson(true);
    let video_url = lesson.video_url;
    let file_url = lesson.file_url;

    try {
      if (editLessonVideo) {
        setEditLessonProgress({ loaded: 0, total: editLessonVideo.size });
        const path = `lesson_video_${Date.now()}_${editLessonVideo.name.replace(/[^\w.-]/g, '_')}`;
        video_url = await uploadWithProgress('courses', path, editLessonVideo, (l, t) => setEditLessonProgress({ loaded: l, total: t }));
      }
      if (editLessonFile) {
        setEditLessonProgress({ loaded: 0, total: editLessonFile.size });
        const path = `lesson_file_${Date.now()}_${editLessonFile.name.replace(/[^\w.-]/g, '_')}`;
        file_url = await uploadWithProgress('courses', path, editLessonFile, (l, t) => setEditLessonProgress({ loaded: l, total: t }));
      }

      await supabase.from('course_lessons').update({
        title: editLessonData.title, content: editLessonData.content || null,
        is_free: editLessonData.is_free, duration_minutes: editLessonData.duration_minutes,
        video_url: video_url || null, file_url: file_url || null,
      }).eq('id', lesson.id);

      toast.success('Lesson updated!');
      setEditingLesson(null);
      setEditLessonVideo(null); setEditLessonFile(null);
      setEditLessonProgress({ loaded: 0, total: 0 });
      fetchLessons(lesson.course_id);
    } catch (err: any) {
      toast.error(`Save failed: ${err.message}`);
    }
    setSavingLesson(false);
  }

  async function deleteLesson(lessonId: string, courseId: string) {
    if (!confirm('Delete this lesson?')) return;
    await supabase.from('course_lessons').delete().eq('id', lessonId);
    toast.success('Lesson deleted');
    fetchLessons(courseId);
    const { count } = await supabase.from('course_lessons').select('*', { count: 'exact', head: true }).eq('course_id', courseId);
    await supabase.from('courses').update({ total_lessons: count || 0 }).eq('id', courseId);
    fetchData();
  }

  // ── Drag & Drop ──
  function handleDragStart(lessonId: string, courseId: string) {
    setDraggingLesson(lessonId); setReorderingCourse(courseId);
  }
  function handleDragOver(e: React.DragEvent, lessonId: string) {
    e.preventDefault(); setDragOverLesson(lessonId);
  }
  function handleDrop(e: React.DragEvent, targetLessonId: string, courseId: string) {
    e.preventDefault();
    if (!draggingLesson || draggingLesson === targetLessonId) return;
    const courseLessons = [...(lessons[courseId] || [])];
    const fromIdx = courseLessons.findIndex(l => l.id === draggingLesson);
    const toIdx = courseLessons.findIndex(l => l.id === targetLessonId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = courseLessons.splice(fromIdx, 1);
    courseLessons.splice(toIdx, 0, moved);
    setLessons(p => ({ ...p, [courseId]: courseLessons.map((l, i) => ({ ...l, order_index: i + 1 })) }));
    setDraggingLesson(null); setDragOverLesson(null); setReorderingCourse(courseId);
  }

  async function swapCourses(idx: number, dir: -1 | 1) {
    const arr = [...courses]; const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    setSwappingCourses(true);
    const a = arr[idx], b = arr[target];
    await supabase.from('courses').update({ order_index: b.order_index }).eq('id', a.id);
    await supabase.from('courses').update({ order_index: a.order_index }).eq('id', b.id);
    fetchData(); setSwappingCourses(false);
    toast.success('Course order updated!');
  }

  async function saveOrder(courseId: string) {
    setSavingOrder(true);
    const courseLessons = lessons[courseId] || [];
    await Promise.all(courseLessons.map((l, i) => supabase.from('course_lessons').update({ order_index: i + 1 }).eq('id', l.id)));
    toast.success('Lesson order saved!'); setSavingOrder(false); setReorderingCourse(null);
  }

  return (
    <div className="space-y-5">
      {/* Brand Assets */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" /> Brand Assets
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <label className="cursor-pointer">
            <div className="border border-dashed border-primary/35 rounded-xl p-4 text-center hover:bg-primary/5 transition-all">
              {uploading.logo ? <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /> : <Image className="w-6 h-6 text-primary mx-auto mb-1" />}
              <p className="text-xs text-foreground font-medium">Upload Logo</p>
              {settings?.logo_url && <p className="text-[10px] text-green-400 mt-0.5">✓ Set</p>}
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          </label>
          <label className="cursor-pointer">
            <div className="border border-dashed border-primary/35 rounded-xl p-4 text-center hover:bg-primary/5 transition-all">
              {uploading.banner ? <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /> : <Image className="w-6 h-6 text-primary mx-auto mb-1" />}
              <p className="text-xs text-foreground font-medium">Hero Banner</p>
              {settings?.hero_banner_url && <p className="text-[10px] text-green-400 mt-0.5">✓ Set</p>}
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
          </label>
        </div>
      </div>

      {/* Hero Text */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <Edit2 className="w-4 h-4 text-primary" /> Homepage Text
          </h3>
          <button onClick={() => setEditHero(!editHero)} className="text-xs text-primary font-bold">{editHero ? 'Cancel' : 'Edit'}</button>
        </div>
        {editHero ? (
          <div className="space-y-3">
            <input className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary" value={heroTitle} onChange={e => setHeroTitle(e.target.value)} placeholder="Hero title" />
            <input className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-foreground text-sm outline-none focus:border-primary" value={heroSub} onChange={e => setHeroSub(e.target.value)} placeholder="Hero subtitle" />
            <button onClick={saveHeroText} disabled={saving} className="w-full py-2.5 gradient-pink rounded-xl text-white text-sm font-bold disabled:opacity-50 press">Save Text</button>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm text-foreground font-medium">{settings?.hero_title}</p>
            <p className="text-xs text-muted-foreground">{settings?.hero_subtitle}</p>
          </div>
        )}
      </div>

      {/* Courses */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> Courses ({courses.length})
          </h3>
          <button onClick={() => setShowAddCourse(!showAddCourse)} className="flex items-center gap-1.5 px-3 py-1.5 gradient-pink rounded-xl text-white text-xs font-bold press">
            <Plus className="w-3.5 h-3.5" /> Add Course
          </button>
        </div>

        {showAddCourse && (
          <div className="mb-4 p-4 bg-muted/30 rounded-xl space-y-3 animate-slide-up">
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
            <button onClick={addCourse} disabled={!newCourse.title || saving} className="w-full py-2.5 gradient-pink rounded-xl text-white text-sm font-bold disabled:opacity-50 press">Add Course</button>
          </div>
        )}

        <div className="space-y-3">
          {courses.map(c => (
            <div key={c.id} className="border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 p-3">
                <label className="cursor-pointer flex-shrink-0">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-muted flex items-center justify-center relative">
                    {c.thumbnail_url ? <img src={c.thumbnail_url} alt="" className="w-full h-full object-cover" /> : <Upload className="w-4 h-4 text-muted-foreground" />}
                    {uploading[c.id] && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={e => handleCourseThumb(e, c.id)} />
                </label>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{c.title}</p>
                  <p className="text-xs text-muted-foreground">{c.category} · {c.is_free ? 'FREE' : `$${c.price_usd}`} · {c.total_lessons} lessons</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => swapCourses(courses.findIndex(x => x.id === c.id), -1)} disabled={courses.findIndex(x => x.id === c.id) === 0 || swappingCourses} className="p-1.5 rounded-lg bg-muted press disabled:opacity-30" title="Move up">
                    <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={() => swapCourses(courses.findIndex(x => x.id === c.id), 1)} disabled={courses.findIndex(x => x.id === c.id) === courses.length - 1 || swappingCourses} className="p-1.5 rounded-lg bg-muted press disabled:opacity-30" title="Move down">
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={() => toggleCourseExpand(c.id)} className="p-1.5 rounded-lg bg-muted press">
                    {expandedCourse === c.id ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                  </button>
                  <button onClick={() => setAddingLesson(addingLesson === c.id ? null : c.id)} className="p-1.5 rounded-lg bg-primary/10 press">
                    <Plus className="w-3.5 h-3.5 text-primary" />
                  </button>
                  <button onClick={() => deleteCourse(c.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 press">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              </div>

              {/* Lesson list with drag + edit */}
              {expandedCourse === c.id && (
                <div className="border-t border-border bg-muted/10 p-3 space-y-1.5 animate-slide-up">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Lessons ({(lessons[c.id] || []).length})</p>
                    {reorderingCourse === c.id && (
                      <button onClick={() => saveOrder(c.id)} disabled={savingOrder} className="px-2.5 py-1 gradient-pink rounded-lg text-white text-[10px] font-bold press disabled:opacity-50">
                        {savingOrder ? 'Saving...' : 'Save Order'}
                      </button>
                    )}
                  </div>
                  {(lessons[c.id] || []).map((lesson) => (
                    <div key={lesson.id}>
                      <div
                        draggable
                        onDragStart={() => handleDragStart(lesson.id, c.id)}
                        onDragOver={e => handleDragOver(e, lesson.id)}
                        onDrop={e => handleDrop(e, lesson.id, c.id)}
                        className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${dragOverLesson === lesson.id ? 'border-primary bg-primary/5' : 'border-border bg-card'} ${draggingLesson === lesson.id ? 'opacity-50' : ''}`}
                      >
                        <div className="cursor-grab text-muted-foreground hover:text-foreground">
                          <GripVertical className="w-4 h-4" />
                        </div>
                        <div className="w-5 h-5 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 text-[10px] font-black text-primary">
                          {lesson.order_index}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">{lesson.title}</p>
                          <div className="flex items-center gap-2">
                            {lesson.is_free && <span className="text-[9px] px-1.5 py-0.5 bg-green-500/15 text-green-400 rounded">FREE</span>}
                            {lesson.video_url && <span className="text-[9px] px-1.5 py-0.5 bg-blue-500/15 text-blue-400 rounded">VIDEO</span>}
                            {lesson.file_url && <span className="text-[9px] px-1.5 py-0.5 bg-orange-500/15 text-orange-400 rounded">FILE</span>}
                            <span className="text-[9px] text-muted-foreground">{lesson.duration_minutes}min</span>
                          </div>
                        </div>
                        <button onClick={() => editingLesson === lesson.id ? setEditingLesson(null) : startEditLesson(lesson)} className="p-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 press flex-shrink-0">
                          <Edit2 className="w-3 h-3 text-blue-400" />
                        </button>
                        <button onClick={() => deleteLesson(lesson.id, c.id)} className="p-1 rounded-lg hover:bg-red-500/10 press flex-shrink-0">
                          <Trash2 className="w-3 h-3 text-red-400" />
                        </button>
                      </div>

                      {/* Inline edit form */}
                      {editingLesson === lesson.id && (
                        <div className="mt-1 p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl space-y-2.5 animate-slide-up">
                          <p className="text-[11px] font-bold text-blue-400 uppercase tracking-wide">✏️ Edit Lesson</p>
                          <input
                            className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary"
                            value={editLessonData.title}
                            onChange={e => setEditLessonData(p => ({ ...p, title: e.target.value }))}
                            placeholder="Lesson title"
                          />
                          <textarea
                            className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary resize-none"
                            rows={2} placeholder="Lesson content (optional)"
                            value={editLessonData.content}
                            onChange={e => setEditLessonData(p => ({ ...p, content: e.target.value }))}
                          />
                          <div className="flex gap-2">
                            <input
                              type="number" className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary"
                              placeholder="Duration (min)"
                              value={editLessonData.duration_minutes}
                              onChange={e => setEditLessonData(p => ({ ...p, duration_minutes: +e.target.value }))}
                            />
                            <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
                              <input type="checkbox" checked={editLessonData.is_free} onChange={e => setEditLessonData(p => ({ ...p, is_free: e.target.checked }))} />
                              <span className="text-sm text-foreground">Free</span>
                            </label>
                          </div>
                          {/* Replace video */}
                          <label className="flex items-center gap-2 p-2.5 border border-dashed border-blue-500/30 rounded-xl cursor-pointer hover:bg-blue-500/5">
                            <Video className="w-4 h-4 text-blue-400 flex-shrink-0" />
                            <span className="text-xs text-muted-foreground flex-1">{editLessonVideo ? `✓ ${editLessonVideo.name}` : lesson.video_url ? '↩️ Replace Video' : 'Upload Video'}</span>
                            {editLessonVideo && <button type="button" onClick={() => setEditLessonVideo(null)} className="text-xs text-red-400">✕</button>}
                            <input type="file" accept="video/*" className="hidden" onChange={e => setEditLessonVideo(e.target.files?.[0] || null)} />
                          </label>
                          {/* Replace image/PDF */}
                          <label className="flex items-center gap-2 p-2.5 border border-dashed border-orange-500/30 rounded-xl cursor-pointer hover:bg-orange-500/5">
                            <File className="w-4 h-4 text-orange-400 flex-shrink-0" />
                            <span className="text-xs text-muted-foreground flex-1">{editLessonFile ? `✓ ${editLessonFile.name}` : lesson.file_url ? '↩️ Replace Image/PDF' : 'Upload Image/PDF'}</span>
                            {editLessonFile && <button type="button" onClick={() => setEditLessonFile(null)} className="text-xs text-red-400">✕</button>}
                            <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => setEditLessonFile(e.target.files?.[0] || null)} />
                          </label>
                          {(editLessonProgress.total > 0) && (
                            <UploadProgressBar progress={editLessonProgress.loaded} total={editLessonProgress.total} label="Uploading..." />
                          )}
                          <div className="flex gap-2">
                            <button onClick={() => saveEditLesson(lesson)} disabled={savingLesson || !editLessonData.title} className="flex-1 py-2 gradient-pink rounded-xl text-white text-xs font-bold press disabled:opacity-50 flex items-center justify-center gap-1.5">
                              {savingLesson ? <><Loader2 className="w-3 h-3 animate-spin" /> Saving...</> : <><Check className="w-3 h-3" /> Save Changes</>}
                            </button>
                            <button onClick={() => setEditingLesson(null)} className="px-3 py-2 bg-muted rounded-xl text-muted-foreground text-xs font-bold press">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {(lessons[c.id] || []).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-3">No lessons yet.</p>
                  )}
                </div>
              )}

              {/* Add lesson form */}
              {addingLesson === c.id && (
                <div className="border-t border-border p-3 bg-muted/20 space-y-2.5 animate-slide-up">
                  <p className="text-xs font-bold text-primary uppercase tracking-wide">+ Add Lesson</p>
                  <input className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary" placeholder="Lesson title *" value={newLesson.title} onChange={e => setNewLesson(p => ({ ...p, title: e.target.value }))} />
                  <textarea className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary resize-none" placeholder="Lesson text content (optional)" rows={2} value={newLesson.content} onChange={e => setNewLesson(p => ({ ...p, content: e.target.value }))} />
                  <div className="flex gap-2">
                    <input type="number" className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-foreground text-sm outline-none focus:border-primary" placeholder="Duration (min)" value={newLesson.duration_minutes} onChange={e => setNewLesson(p => ({ ...p, duration_minutes: +e.target.value }))} />
                    <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
                      <input type="checkbox" checked={newLesson.is_free} onChange={e => setNewLesson(p => ({ ...p, is_free: e.target.checked }))} />
                      <span className="text-sm text-foreground whitespace-nowrap">Free preview</span>
                    </label>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 p-2.5 border border-dashed border-primary/30 rounded-xl cursor-pointer hover:bg-primary/5">
                      <Video className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="text-xs text-muted-foreground flex-1">{lessonVideo ? `✓ ${lessonVideo.name}` : 'Upload Video (any size)'}</span>
                      {lessonVideo && <button type="button" onClick={() => setLessonVideo(null)} className="text-xs text-red-400">✕</button>}
                      <input type="file" accept="video/*" className="hidden" onChange={e => { setLessonVideo(e.target.files?.[0] || null); setLessonImage(null); setLessonPDF(null); }} />
                    </label>
                    {lessonVideo && lessonUploadProgress.total > 0 && (
                      <UploadProgressBar progress={lessonUploadProgress.loaded} total={lessonUploadProgress.total} label={lessonVideo.name} />
                    )}
                    <label className="flex items-center gap-2 p-2.5 border border-dashed border-blue-500/30 rounded-xl cursor-pointer hover:bg-blue-500/5">
                      <Image className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <span className="text-xs text-muted-foreground flex-1">{lessonImage ? `✓ ${lessonImage.name}` : 'Upload Image'}</span>
                      {lessonImage && <button type="button" onClick={() => setLessonImage(null)} className="text-xs text-red-400">✕</button>}
                      <input type="file" accept="image/*" className="hidden" onChange={e => { setLessonImage(e.target.files?.[0] || null); setLessonVideo(null); setLessonPDF(null); }} />
                    </label>
                    <label className="flex items-center gap-2 p-2.5 border border-dashed border-orange-500/30 rounded-xl cursor-pointer hover:bg-orange-500/5">
                      <File className="w-4 h-4 text-orange-400 flex-shrink-0" />
                      <span className="text-xs text-muted-foreground flex-1">{lessonPDF ? `✓ ${lessonPDF.name}` : 'Upload PDF Document'}</span>
                      {lessonPDF && <button type="button" onClick={() => setLessonPDF(null)} className="text-xs text-red-400">✕</button>}
                      <input type="file" accept=".pdf,application/pdf" className="hidden" onChange={e => { setLessonPDF(e.target.files?.[0] || null); setLessonVideo(null); setLessonImage(null); }} />
                    </label>
                  </div>
                  <button onClick={() => addLesson(c.id)} disabled={!newLesson.title || saving} className="w-full py-2 gradient-pink rounded-xl text-white text-xs font-bold disabled:opacity-50 press">
                    {saving ? 'Uploading...' : 'Add Lesson'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
