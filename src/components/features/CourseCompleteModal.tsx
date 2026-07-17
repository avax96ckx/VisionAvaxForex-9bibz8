import { useState } from 'react';
import { Trophy, X, Award, Star } from 'lucide-react';
import CourseCertificate from './CourseCertificate';

interface Props {
  userName: string;
  courseTitle: string;
  completionDate: Date;
  onClose: () => void;
}

export default function CourseCompleteModal({ userName, courseTitle, completionDate, onClose }: Props) {
  const [showCert, setShowCert] = useState(false);

  if (showCert) {
    return (
      <CourseCertificate
        userName={userName}
        courseTitle={courseTitle}
        completionDate={completionDate}
        onClose={onClose}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}>
      <div className="bg-card border border-border rounded-3xl w-full max-w-sm relative overflow-hidden animate-slide-up">
        <div className="h-1.5 gradient-pink" />

        {/* Confetti-style top glow */}
        <div className="absolute top-0 left-0 right-0 h-32 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 50% -10%, rgba(255,215,0,0.25) 0%, transparent 70%)' }} />

        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-muted flex items-center justify-center press z-10">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        <div className="p-7 pt-8 text-center">
          {/* Trophy icon */}
          <div className="relative mx-auto w-24 h-24 mb-5">
            <div className="w-24 h-24 rounded-3xl bg-yellow-500/20 border-2 border-yellow-500/40 flex items-center justify-center mx-auto"
              style={{ boxShadow: '0 0 40px rgba(255,215,0,0.3)' }}>
              <Trophy className="w-12 h-12 text-yellow-400" />
            </div>
            {/* Stars */}
            {['-top-2 -left-2', '-top-2 -right-2', 'top-1 -right-4'].map((pos, i) => (
              <Star key={i} className={`absolute ${pos} w-4 h-4 text-yellow-400 fill-yellow-400 animate-pulse`}
                style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>

          <h2 className="text-2xl font-black text-foreground mb-1">Congratulations! 🎉</h2>
          <p className="text-sm text-muted-foreground mb-1">You've completed</p>
          <p className="font-black text-base text-foreground mb-4 leading-tight">"{courseTitle}"</p>

          {/* Stars row */}
          <div className="flex justify-center gap-1 mb-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400"
                style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>

          <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
            You've mastered all lessons. Download your official certificate to showcase your achievement!
          </p>

          <div className="space-y-3">
            <button
              onClick={() => setShowCert(true)}
              className="w-full py-3.5 gradient-pink rounded-2xl text-white font-bold flex items-center justify-center gap-2 press pink-glow"
            >
              <Award className="w-4 h-4" /> Get My Certificate
            </button>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-2xl border border-border text-muted-foreground text-sm font-medium press hover:border-primary/30 transition-all"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
