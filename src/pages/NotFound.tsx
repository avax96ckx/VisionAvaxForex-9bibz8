import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center">
      <p className="text-7xl font-black text-gradient-pink mb-4">404</p>
      <h1 className="text-xl font-black text-white mb-2">Page Not Found</h1>
      <p className="text-muted-foreground text-sm mb-6">The page you are looking for does not exist.</p>
      <button onClick={() => navigate('/')} className="px-6 py-3 gradient-pink rounded-2xl text-white font-bold pink-glow">
        Go Home
      </button>
    </div>
  );
}
