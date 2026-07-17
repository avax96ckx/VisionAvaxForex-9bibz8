import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Lock, Play, BookOpen, ChevronDown, ChevronUp, Video, FileText, Crown, CheckCircle, TrendingUp, ArrowRight } from 'lucide-react';
import { supabase, isVIPActive } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Course, CourseLesson } from '@/types';
import VIPPlanSelector from '@/components/features/VIPPlanSelector';
import CoursePaymentModal from '@/components/features/CoursePaymentModal';

export default function Courses() {
  const { user, profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Record<string, CourseLesson[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showVIPSelector, setShowVIPSelector] = useState(false);
  const [selectedCourseForPayment, setSelectedCourseForPayment] = useState<Course | null>(null);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [courseProgress, setCourseProgress] = useState<Record<string, number>>({});

  const hasVIP = isAdmin || (profile ? isVIPActive(profile) : false);

  useEffect(() => {
    supabase.from('courses').select('*').eq('is_published', true).order('order_index').then(({ data }) => {
      if (data) setCourses(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from('course_progress').select('lesson_id, course_id').eq('user_id', user.id).then(({ data }) => {
      if (data) setCompletedLessons(new Set(data.map((d: any) => d.lesson_id as string)));
    });
  }, [user]);

  useEffect(() => {
    const prog: Record<string, number> = {};
    for (const courseId in lessons) {
      const total = lessons[courseId].length;
      if (total === 0) { prog[courseId] = 0; continue; }
      const done = lessons[courseId].filter(l => completedLessons.has(l.id)).length;
      prog[courseId] = Math.round((done / total) * 100);
    }
    setCourseProgress(prog);
  }, [lessons, completedLessons]);

  async function loadLessons(courseId: string) {
    if (lessons[courseId]) { setExpanded(expanded === courseId ? null : courseId); return; }
    const { data } = await supabase.from('course_lessons').select('*').eq('course_id', courseId).order('order_index');
    if (data) setLessons(prev => ({ ...prev, [courseId]: data }));
    setExpanded(courseId);
  }

  async function markLessonComplete(lessonId: string, courseId: string) {
    if (!user || completedLessons.has(lessonId)) return;
    await supabase.from('course_progress').upsert({ user_id: user.id, lesson_id: lessonId, course_id: courseId }, { onConflict: 'user_id,lesson_id' });
    setCompletedLessons(prev => new Set([...prev, lessonId]));
  }

  // Check if user has paid for a specific course
  const [paidCourses, setPaidCourses] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!user) return;
    supabase.from('course_payments').select('course_id').eq('user_id', user.id).eq('status', 'approved').then(({ data }) => {
      if (data) setPaidCourses(new Set(data.map((d: any) => d.course_id as string)));
    });
  }, [user]);

  const categoryEmoji: Record<string, string> = { Basics: '📚', Technical: '📊', Advanced: '🚀', Strategies: '⚡', Psychology: '🧠', Risk: '🛡️' };
  const categoryColor: Record<string, string> = {
    Basics: 'text-blue-400 bg-blue-500/10', Technical: 'text-purple-400 bg-purple-500/10',
    Advanced: 'text-orange-400 bg-orange-500/10', Strategies: 'text-yellow-400 bg-yellow-500/10',
    Psychology: 'text-green-400 bg-green-500/10', Risk: 'text-red-400 bg-red-500/10',
  };

  return (
    <div className="min-h-screen pb-24 animate-fade-in" style={{ paddingTop: '70px' }}>
      {showVIPSelector && <VIPPlanSelector onClose={() => setShowVIPSelector(false)} title="Join VIP — Unlock All Courses" subtitle="Get access to every course + signals + community" />}
      {selectedCourseForPayment && <CoursePaymentModal course={selectedCourseForPayment} onClose={() => setSelectedCourseForPayment(null)} />}

      <div className="px-3 py-4 mb-2">
        <div className="flex items-center gap-2 mb-0.5">
          <GraduationCap className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-black text-foreground">Trading Courses</h1>
        </div>
        <p className="text-xs text-muted-foreground">From beginner to professional trader</p>
      </div>

      {/* Progress Overview Card */}
      {user && (() => {
        const enrolledCourses = courses.filter(c => {
          const progress = courseProgress[c.id];
          return progress !== null && progress !== undefined && progress > 0 && progress < 100;
        });
        if (enrolledCourses.length === 0) return null;
        return (
          <div className="mx-3 mb-4 bg-card border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
              <TrendingUp className="w-4 h-4 text-primary" />
              <p className="text-sm font-black text-foreground">Continue Learning</p>
            </div>
            <div className="divide-y divide-border/30">
              {enrolledCourses.slice(0, 3).map(course => {
                const progress = courseProgress[course.id] || 0;
                const courseLessons = lessons[course.id] || [];
                const completedCount = courseLessons.filter(l => completedLessons.has(l.id)).length;
                return (
                  <div key={course.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center">
                      {course.thumbnail_url ? <img src={course.thumbnail_url} alt="" className="w-full h-full object-cover" /> : <span className="text-lg">{categoryEmoji[course.category] || '📚'}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground truncate mb-1">{course.title}</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-primary flex-shrink-0">{progress}%</span>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`/courses/${course.id}`)}
                      className="flex items-center gap-1 px-2.5 py-1.5 gradient-pink rounded-xl text-white text-[10px] font-bold press flex-shrink-0"
                    >
                      Continue <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {!hasVIP && (
        <div className="mx-3 mb-4 gradient-pink-dark rounded-2xl p-4 pink-glow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-black text-white text-sm">Unlock All Premium Courses</p>
              <p className="text-xs text-white/70 mt-0.5">Get VIP access for full lesson library</p>
            </div>
            <button onClick={() => setShowVIPSelector(true)} className="px-3 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-white text-xs font-bold flex-shrink-0 press">Get VIP</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="px-3 space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}</div>
      ) : (
        <div className="px-3 space-y-3">
          {courses.map(course => {
            const canAccess = hasVIP || paidCourses.has(course.id);
            const isExpanded = expanded === course.id;
            const courseLessons = lessons[course.id] || [];
            const progress = courseProgress[course.id] ?? null;
            const completedCount = courseLessons.filter(l => completedLessons.has(l.id)).length;

            return (
              <div key={course.id} className="bg-card border border-border rounded-2xl overflow-hidden card-hover transition-all">
                <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => loadLessons(course.id)}>
                  <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center relative">
                    {course.thumbnail_url
                      ? <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
                      : <span className="text-2xl">{categoryEmoji[course.category] || '📖'}</span>
                    }
                    {progress === 100 && (
                      <div className="absolute inset-0 bg-green-500/80 flex items-center justify-center rounded-xl">
                        <CheckCircle className="w-6 h-6 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-bold text-foreground text-sm leading-tight">{course.title}</p>
                      <span className={`text-xs font-black flex-shrink-0 ${course.is_free ? 'text-green-400' : 'text-primary'}`}>
                        {course.is_free ? 'FREE' : `$${course.price_usd}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${categoryColor[course.category] || 'text-muted-foreground bg-muted'}`}>
                        {categoryEmoji[course.category]} {course.category}
                      </span>
                      {course.total_lessons > 0 && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <BookOpen className="w-3 h-3" /> {course.total_lessons} lessons
                        </span>
                      )}
                    </div>
                    {canAccess && progress !== null && courseLessons.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-muted-foreground">{completedCount}/{courseLessons.length} done</span>
                          <span className="text-[10px] font-bold text-primary">{progress}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    )}
                    {!isExpanded && <p className="text-[11px] text-muted-foreground line-clamp-1 mt-1">{course.description}</p>}
                  </div>
                  <div className="flex-shrink-0 ml-1">
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                <div className="px-4 pb-3 flex gap-2">
                  {canAccess ? (
                    <button onClick={() => navigate(`/courses/${course.id}`)} className="px-4 py-2 gradient-pink rounded-xl text-white text-xs font-bold flex items-center gap-1.5 press pink-glow-xs">
                      <Play className="w-3.5 h-3.5 fill-white" />
                      {progress === 100 ? 'Review Course' : progress && progress > 0 ? 'Continue' : 'Start Learning'}
                    </button>
                  ) : (
                    <button
                      onClick={() => course.is_free ? navigate(`/courses/${course.id}`) : setSelectedCourseForPayment(course)}
                      className="px-4 py-2 bg-primary/10 border border-primary/30 rounded-xl text-primary text-xs font-bold flex items-center gap-1.5 press hover:bg-primary/20 transition-all"
                    >
                      <Lock className="w-3.5 h-3.5" /> Unlock with VIP
                    </button>
                  )}
                </div>

                {isExpanded && (
                  <div className="border-t border-border animate-slide-up">
                    {courseLessons.length === 0 ? (
                      <div className="px-4 py-4 text-center"><p className="text-xs text-muted-foreground">No lessons added yet</p></div>
                    ) : (
                      <div className="divide-y divide-border/50">
                        {courseLessons.map((lesson, idx) => {
                          const lessonAccess = lesson.is_free || canAccess;
                          const isDone = completedLessons.has(lesson.id);
                          return (
                            <div key={lesson.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-all">
                              <button className="flex items-center gap-3 flex-1 text-left press"
                                onClick={() => {
                                  if (!lessonAccess) { setSelectedCourseForPayment(course); return; }
                                  markLessonComplete(lesson.id, course.id);
                                  navigate(`/courses/${course.id}`);
                                }}>
                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${isDone ? 'bg-green-500/20' : 'bg-muted'}`}>
                                  {isDone ? <CheckCircle className="w-4 h-4 text-green-400" />
                                    : lesson.video_url ? <Video className="w-3 h-3 text-primary" />
                                    : lesson.file_url ? <FileText className="w-3 h-3 text-blue-400" />
                                    : <span className="text-[10px] font-bold text-muted-foreground">{idx + 1}</span>
                                  }
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-xs font-medium truncate ${isDone ? 'text-green-400' : lessonAccess ? 'text-foreground' : 'text-muted-foreground'}`}>{lesson.title}</p>
                                  {lesson.duration_minutes > 0 && <p className="text-[10px] text-muted-foreground">{lesson.duration_minutes} min</p>}
                                </div>
                              </button>
                              <div className="flex-shrink-0 flex items-center gap-1">
                                {!lessonAccess && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
                                {lesson.is_free && <span className="text-[9px] px-1.5 py-0.5 bg-green-500/15 text-green-400 rounded font-bold">FREE</span>}
                                {isDone && canAccess && <span className="text-[9px] px-1.5 py-0.5 bg-green-500/15 text-green-400 rounded font-bold">✓</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
