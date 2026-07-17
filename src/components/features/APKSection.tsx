import { useState, useEffect } from 'react';
import { Download, RefreshCw, X, Smartphone, AlertCircle, ChevronDown, ChevronUp, Clock, Tag, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { AppVersion } from '@/types';
import { toast } from 'sonner';

interface Props {
  minimal?: boolean;
}

function VersionHistoryModal({ versions, onClose }: { versions: AppVersion[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[400] bg-black/70 flex items-end justify-center animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-md bg-card border border-border rounded-t-3xl overflow-hidden animate-slide-up"
        style={{ maxHeight: '80vh', paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-primary" />
            <h3 className="font-black text-foreground">Version History</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl bg-muted press">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(80vh - 80px)' }}>
          {versions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <FileText className="w-10 h-10 text-muted-foreground opacity-30 mb-2" />
              <p className="text-sm text-muted-foreground">No version history yet</p>
            </div>
          ) : (
            <div className="px-5 py-4 space-y-4">
              {versions.map((v, idx) => (
                <div key={v.id} className={`relative pl-5 ${idx < versions.length - 1 ? 'pb-4' : ''}`}>
                  {/* Timeline line */}
                  {idx < versions.length - 1 && (
                    <div className="absolute left-[7px] top-4 bottom-0 w-0.5 bg-border" />
                  )}
                  {/* Timeline dot */}
                  <div className={`absolute left-0 top-1 w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${v.is_latest ? 'border-primary bg-primary/30' : 'border-border bg-muted'}`} />

                  <div className="bg-muted/30 border border-border/50 rounded-2xl p-3.5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-primary" />
                          <span className="font-black text-foreground text-sm">v{v.version_name}</span>
                        </div>
                        {v.is_latest && (
                          <span className="text-[9px] px-1.5 py-0.5 gradient-pink rounded-full text-white font-bold">LATEST</span>
                        )}
                        {v.force_update && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded-full font-bold">REQUIRED</span>
                        )}
                      </div>
                      {v.apk_url && (
                        <a
                          href={v.apk_url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="flex items-center gap-1 px-2 py-1 gradient-pink rounded-lg text-white text-[10px] font-bold press flex-shrink-0"
                        >
                          <Download className="w-2.5 h-2.5" /> APK
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-2">
                      <Clock className="w-3 h-3" />
                      {new Date(v.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      {v.version_code > 0 && <span className="ml-1 opacity-60">· Build {v.version_code}</span>}
                    </div>

                    {v.release_notes ? (
                      <div className="space-y-1">
                        {v.release_notes.split('\n').filter(Boolean).map((line, i) => {
                          const isItem = line.trim().startsWith('-') || line.trim().startsWith('•') || line.trim().startsWith('*');
                          const text = line.replace(/^[-•*]\s*/, '').trim();
                          return isItem ? (
                            <div key={i} className="flex items-start gap-1.5">
                              <span className="text-primary text-xs mt-0.5 flex-shrink-0">•</span>
                              <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
                            </div>
                          ) : (
                            <p key={i} className="text-xs text-muted-foreground leading-relaxed">{text}</p>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No changelog available</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function APKSection({ minimal = false }: Props) {
  const [version, setVersion] = useState<AppVersion | null>(null);
  const [allVersions, setAllVersions] = useState<AppVersion[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    // Load latest version
    supabase
      .from('app_versions')
      .select('*')
      .eq('is_latest', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data?.[0]) setVersion(data[0]);
      });

    // Load all versions for history
    supabase
      .from('app_versions')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setAllVersions(data);
      });

    const key = localStorage.getItem('vaf_dismissed_version');
    if (key) setDismissed(true);
  }, []);

  function handleDownload() {
    if (!version?.apk_url) {
      toast.info('APK not available yet. Contact admin on WhatsApp.');
      return;
    }
    window.open(version.apk_url, '_blank');
    toast.success('APK download started!');
  }

  function handleUpdate() {
    if (!version?.apk_url) {
      toast.info('No update available yet.');
      return;
    }
    window.open(version.apk_url, '_blank');
    toast.success('Downloading latest version...');
  }

  function dismiss() {
    if (version) localStorage.setItem('vaf_dismissed_version', version.id);
    setDismissed(true);
  }

  if (minimal) {
    return (
      <>
        {showHistory && (
          <VersionHistoryModal versions={allVersions} onClose={() => setShowHistory(false)} />
        )}
        <div className="space-y-2.5">
          <button
            onClick={handleDownload}
            className="w-full flex items-center gap-3 bg-card border border-border rounded-2xl p-4 hover:border-primary/30 transition-all press"
          >
            <div className="w-9 h-9 rounded-xl gradient-pink flex items-center justify-center flex-shrink-0 pink-glow-xs">
              <Download className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-bold text-foreground text-sm">Download APK</p>
              <p className="text-xs text-muted-foreground">
                {version ? `v${version.version_name}` : 'Install the mobile app'}
              </p>
            </div>
            <Smartphone className="w-4 h-4 text-muted-foreground" />
          </button>

          <button
            onClick={handleUpdate}
            className="w-full flex items-center gap-3 bg-card border border-border rounded-2xl p-4 hover:border-primary/30 transition-all press"
          >
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <RefreshCw className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-bold text-foreground text-sm">Update New Vision</p>
              <p className="text-xs text-muted-foreground">
                {version ? `Latest: v${version.version_name}` : 'Check for updates'}
              </p>
            </div>
            {version && (
              <span className="text-[10px] px-2 py-0.5 gradient-pink rounded-full text-white font-bold">NEW</span>
            )}
          </button>

          {/* Version History Button */}
          {allVersions.length > 0 && (
            <button
              onClick={() => setShowHistory(true)}
              className="w-full flex items-center gap-3 bg-card border border-border/50 rounded-2xl p-3.5 hover:border-primary/20 transition-all press"
            >
              <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-bold text-foreground text-sm">Version History</p>
                <p className="text-xs text-muted-foreground">{allVersions.length} release{allVersions.length !== 1 ? 's' : ''} · Tap to view changelog</p>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </>
    );
  }

  // Banner for home page
  if (!version || dismissed) return null;

  return (
    <>
      {showHistory && (
        <VersionHistoryModal versions={allVersions} onClose={() => setShowHistory(false)} />
      )}
      <div className="update-banner rounded-2xl p-4 animate-slide-down">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl gradient-pink flex items-center justify-center flex-shrink-0 pink-glow-xs">
            <Smartphone className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <AlertCircle className="w-3.5 h-3.5 text-primary" />
              <p className="text-xs font-black text-primary uppercase tracking-wide">App Available</p>
            </div>
            <p className="text-sm font-bold text-foreground">Vision Avax Forex v{version.version_name}</p>
            {version.release_notes && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{version.release_notes}</p>
            )}
            <div className="flex gap-2 mt-3 flex-wrap">
              <button
                onClick={handleDownload}
                className="flex-1 py-2 gradient-pink rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1.5 pink-glow-xs press"
              >
                <Download className="w-3.5 h-3.5" /> Download APK
              </button>
              {allVersions.length > 1 && (
                <button
                  onClick={() => setShowHistory(true)}
                  className="px-3 py-2 bg-muted/60 border border-border/50 rounded-xl text-muted-foreground text-xs font-bold flex items-center gap-1 press hover:border-primary/30 transition-all"
                >
                  <FileText className="w-3 h-3" /> Changelog
                </button>
              )}
              <button
                onClick={dismiss}
                className="px-3 py-2 bg-muted rounded-xl text-muted-foreground text-xs font-bold press"
              >
                Later
              </button>
            </div>
          </div>
          <button onClick={dismiss} className="p-1 rounded-lg hover:bg-muted transition-all flex-shrink-0">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </>
  );
}
