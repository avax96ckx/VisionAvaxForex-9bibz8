import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircle, X } from 'lucide-react';
import { openWhatsApp, WHATSAPP_NUMBER } from '@/lib/supabase';
import LiveAgentChat from '@/components/features/LiveAgentChat';

export default function WhatsAppButton() {
  const location = useLocation();
  const [showMenu, setShowMenu] = useState(false);
  const [showLiveChat, setShowLiveChat] = useState(false);

  // Hide in VIP Room, Messenger, course player, and auth page
  if (
    location.pathname === '/vip' ||
    location.pathname === '/messenger' ||
    location.pathname.startsWith('/courses/') ||
    location.pathname === '/auth'
  ) return null;

  if (showLiveChat) {
    return <LiveAgentChat onClose={() => setShowLiveChat(false)} />;
  }

  return (
    <>
      {/* Option menu */}
      {showMenu && (
        <div className="fixed left-4 bottom-24 z-50 animate-slide-up space-y-2">
          {/* Live agent */}
          <button
            onClick={() => { setShowMenu(false); setShowLiveChat(true); }}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-white text-sm font-bold shadow-xl press"
            style={{ background: 'linear-gradient(135deg,#FF1493,#CC006A)', boxShadow: '0 4px 18px rgba(255,20,147,0.45)' }}
          >
            <MessageCircle className="w-4 h-4" />
            <span>Live Agent Chat</span>
          </button>
          {/* WhatsApp */}
          <button
            onClick={() => { setShowMenu(false); openWhatsApp(WHATSAPP_NUMBER, 'Hello Admin, I need help.'); }}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-white text-sm font-bold shadow-xl press"
            style={{ background: 'linear-gradient(135deg,#25D366,#128C7E)', boxShadow: '0 4px 18px rgba(37,211,102,0.4)' }}
          >
            <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.558 4.112 1.534 5.836L.057 23.786l6.063-1.59A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.851 0-3.594-.473-5.115-1.306l-.366-.217-3.598.945.962-3.513-.24-.372A9.944 9.944 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
            </svg>
            <span>WhatsApp Help</span>
          </button>
        </div>
      )}

      {/* Main button */}
      <button
        onClick={() => setShowMenu(v => !v)}
        className="fixed left-4 bottom-20 z-50 transition-all hover:scale-110 active:scale-95 press"
        style={{
          width: 50, height: 50, borderRadius: '50%',
          background: showMenu
            ? 'linear-gradient(135deg,#FF1493,#CC006A)'
            : 'linear-gradient(135deg,#25D366,#128C7E)',
          boxShadow: showMenu
            ? '0 4px 22px rgba(255,20,147,0.5),0 2px 8px rgba(0,0,0,0.35)'
            : '0 4px 22px rgba(37,211,102,0.5),0 2px 8px rgba(0,0,0,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        aria-label="Contact Support"
      >
        {showMenu ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 28, height: 28 }}>
            <path fillRule="evenodd" clipRule="evenodd" d="M24 4C12.954 4 4 12.954 4 24c0 3.737 1.013 7.236 2.784 10.238L4 44l10.044-2.734A19.89 19.89 0 0 0 24 44c11.046 0 20-8.954 20-20S35.046 4 24 4z" fill="white" fillOpacity="0.18" />
            <path d="M34.57 28.36c-.49-.25-2.9-1.43-3.35-1.59-.45-.17-.77-.25-1.1.24-.32.49-1.26 1.59-1.54 1.91-.28.32-.57.36-1.06.12-.49-.24-2.07-.76-3.94-2.43-1.46-1.3-2.44-2.9-2.73-3.39-.28-.49-.03-.75.21-.99.22-.22.49-.57.73-.86.24-.28.32-.49.49-.81.16-.33.08-.62-.04-.87-.12-.24-1.1-2.64-1.5-3.62-.4-.96-.8-.83-1.1-.85-.28-.01-.61-.02-.93-.02-.32 0-.85.12-1.29.62-.45.49-1.7 1.66-1.7 4.05 0 2.38 1.74 4.69 1.98 5.01.24.33 3.42 5.22 8.29 7.32 1.16.5 2.06.8 2.77 1.02 1.16.37 2.22.32 3.06.19.93-.14 2.9-1.19 3.31-2.33.41-1.14.41-2.12.29-2.33-.12-.2-.45-.32-.93-.57z" fill="white" />
          </svg>
        )}
      </button>
    </>
  );
}
