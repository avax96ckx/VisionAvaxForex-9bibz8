import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { User } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { Eye, EyeOff, Mail, Lock, ArrowLeft, TrendingUp, Shield } from 'lucide-react';

type Step = 'choice' | 'login' | 'register-email' | 'register-otp' | 'register-pass' | 'forgot-email' | 'forgot-sent' | 'reset-password';

function mapUser(user: User) {
  return {
    id: user.id,
    email: user.email!,
    username: user.user_metadata?.username || user.email!.split('@')[0],
    avatar: user.user_metadata?.avatar_url,
    is_admin: user.email === 'visionavaxforex@gmail.com',
  };
}

export default function Auth() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('choice');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [authBgUrl, setAuthBgUrl] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) localStorage.setItem('vaf_ref', ref);
    // Detect password reset token in URL hash (Supabase sends #access_token=...&type=recovery)
    const hash = window.location.hash;
    if (hash.includes('type=recovery') || params.get('reset')) {
      // Supabase auto-sets session from hash — just show reset form
      setStep('reset-password');
    }
    // Load auth bg from settings
    supabase.from('site_settings').select('auth_bg_url').eq('id', 'main').single().then(({ data }) => {
      if (data && (data as any).auth_bg_url) setAuthBgUrl((data as any).auth_bg_url);
    });
  }, []);

  async function handleSendOTP() {
    if (!email) return toast.error('Enter your email');
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) { toast.error(error.message); setLoading(false); return; }
    toast.success('Verification code sent!');
    setStep('register-otp');
    setLoading(false);
  }

  async function handleVerifyOTP() {
    if (!otp) return toast.error('Enter the verification code');
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' });
    if (error) { toast.error(error.message); setLoading(false); return; }
    setStep('register-pass');
    setLoading(false);
  }

  async function handleSetPassword() {
    if (password.length < 6) return toast.error('Password must be at least 6 characters');
    setLoading(true);
    const username = email.split('@')[0];
    const { data, error } = await supabase.auth.updateUser({ password, data: { username } });
    if (error) { toast.error(error.message); setLoading(false); return; }
    if (data.user) {
      login(mapUser(data.user));
      // Track referral registration
      const ref = localStorage.getItem('vaf_ref');
      if (ref) {
        await supabase.from('referral_events').insert({ referral_code: ref, user_id: data.user.id, event_type: 'register', user_email: email });
        await supabase.rpc('increment_referral_registrations', { code: ref }).catch(() => {});
        localStorage.removeItem('vaf_ref');
      }
      navigate('/');
    }
    setLoading(false);
  }

  async function handleLogin() {
    if (!email || !password) return toast.error('Enter email and password');
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { toast.error(error.message); setLoading(false); return; }
    if (data.user) { login(mapUser(data.user)); navigate('/'); }
    else { setLoading(false); }
  }

  async function handleGoogleLogin() {
  setLoading(true);

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/`,
    },
  });

  if (error) {
    toast.error(error.message);
    setLoading(false);
  }
  }

  async function handleResetPassword() {
    if (newPassword.length < 6) return toast.error('Password must be at least 6 characters');
    setLoading(true);
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { toast.error(error.message); setLoading(false); return; }
    if (data.user) {
      toast.success('Password updated successfully!');
      login(mapUser(data.user));
      navigate('/');
    }
    setLoading(false);
  }

  async function handleForgotPassword() {
    if (!email) return toast.error('Enter your email address');
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/auth?reset=1',
    });
    if (error) { toast.error(error.message); setLoading(false); return; }
    toast.success('Password reset link sent! Check your email.');
    setStep('forgot-sent');
    setLoading(false);
  }

  const inputClass = "w-full bg-muted border border-border rounded-xl px-4 py-3.5 text-foreground placeholder-muted-foreground text-sm focus:border-primary outline-none transition-all";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero top */}
      <div className="gradient-pink-dark px-6 pt-16 pb-14 relative overflow-hidden" style={authBgUrl ? { backgroundImage: `url(${authBgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
        <div className="absolute inset-0">
          <div className="absolute top-6 right-6 w-36 h-36 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 left-8 w-24 h-24 rounded-full bg-white/8 blur-2xl" />
        </div>
        <div className="relative">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="text-white/75 text-xs font-black tracking-widest uppercase">Vision Avax Forex</span>
          </div>
          <h1 className="text-3xl font-black text-white mb-1.5 leading-tight">
            {step === 'choice' && 'Welcome Back'}
            {step === 'login' && 'Sign In'}
            {step === 'register-email' && 'Create Account'}
            {step === 'register-otp' && 'Verify Email'}
            {step === 'register-pass' && 'Set Password'}
            {step === 'forgot-email' && 'Reset Password'}
            {step === 'forgot-sent' && 'Email Sent'}
            {step === 'reset-password' && 'New Password'}
          </h1>
          <p className="text-white/60 text-sm">
            {step === 'choice' && 'Premium forex trading community'}
            {step === 'login' && 'Enter your credentials to continue'}
            {step === 'register-email' && "We'll send a 4-digit code to verify your email"}
            {step === 'register-otp' && `Code sent to ${email}`}
            {step === 'register-pass' && 'Choose a secure password to protect your account'}
            {step === 'forgot-email' && 'Enter your email to receive a reset link'}
            {step === 'forgot-sent' && `Reset link sent to ${email}`}
            {step === 'reset-password' && 'Enter your new password below'}
          </p>
        </div>
      </div>

      {/* Form card */}
      <div className="flex-1 px-4 -mt-6 relative z-10">
        <div className="bg-card border border-border/60 rounded-3xl p-6 shadow-2xl animate-slide-up">

          {step === 'choice' && (
            <div className="space-y-3">
              <button onClick={() => setStep('login')} className="w-full py-4 gradient-pink rounded-2xl text-white font-bold text-base pink-glow hover:opacity-90 transition-all press">
                Login to Account
              </button>
              <button onClick={() => setStep('register-email')} className="w-full py-4 border border-primary/35 rounded-2xl text-primary font-bold text-base hover:bg-primary/5 transition-all press">
                Create New Account
              </button>
              <button
  onClick={handleGoogleLogin}
  className="w-full py-4 border border-border rounded-2xl bg-white text-black font-bold flex items-center justify-center gap-3 hover:bg-gray-100 transition-all press"
>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    className="w-5 h-5"
  >
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.6 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12S17.4 12 24 12c3 0 5.7 1.1 7.8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15 18.9 12 24 12c3 0 5.7 1.1 7.8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.3l-6.3-5.2C29.3 35 26.8 36 24 36c-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.6 39.5 16.3 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.1-3.4 5.5-6.6 6.8l6.3 5.2C38.7 36.5 44 31 44 24c0-1.3-.1-2.3-.4-3.5z"/>
  </svg>
  Continue with Google
</button>
              <div className="flex items-center gap-2 mt-4 p-3 bg-muted/50 rounded-2xl">
                <Shield className="w-4 h-4 text-primary flex-shrink-0" />
                <p className="text-xs text-muted-foreground">Secured with end-to-end encryption</p>
              </div>
            </div>
          )}

          {step === 'login' && (
            <div className="space-y-4">
              <button onClick={() => setStep('choice')} className="flex items-center gap-2 text-muted-foreground text-sm mb-1 press">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-muted-foreground" />
                <input className={`${inputClass} pl-10`} type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-muted-foreground" />
                <input className={`${inputClass} pl-10 pr-11`} type={showPass ? 'text' : 'password'} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
                <button onClick={() => setShowPass(!showPass)} className="absolute right-3.5 top-3.5 press">
                  {showPass ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                </button>
              </div>
              <button onClick={handleLogin} disabled={loading} className="w-full py-4 gradient-pink rounded-2xl text-white font-bold text-base pink-glow disabled:opacity-50 press">
                {loading ? 'Signing in...' : 'Login'}
              </button>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  No account? <button onClick={() => setStep('register-email')} className="text-primary font-bold press">Register</button>
                </p>
                <button onClick={() => { setStep('forgot-email'); }} className="text-xs text-muted-foreground hover:text-primary transition-colors press">
                  Forgot password?
                </button>
              </div>
            </div>
          )}

          {step === 'forgot-email' && (
            <div className="space-y-4">
              <button onClick={() => setStep('login')} className="flex items-center gap-2 text-muted-foreground text-sm mb-1 press">
                <ArrowLeft className="w-4 h-4" /> Back to Login
              </button>
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl">
                <p className="text-xs text-muted-foreground">We'll send a password reset link to your email address.</p>
              </div>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-muted-foreground" />
                <input className={`${inputClass} pl-10`} type="email" placeholder="Your email address" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleForgotPassword()} />
              </div>
              <button onClick={handleForgotPassword} disabled={loading} className="w-full py-4 gradient-pink rounded-2xl text-white font-bold text-base pink-glow disabled:opacity-50 press">
                {loading ? 'Sending...' : 'Send Reset Link →'}
              </button>
            </div>
          )}

          {step === 'forgot-sent' && (
            <div className="space-y-4 text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/15 border-2 border-green-500/30 flex items-center justify-center mx-auto">
                <Mail className="w-7 h-7 text-green-400" />
              </div>
              <div>
                <h3 className="font-black text-foreground text-lg mb-1">Check Your Email</h3>
                <p className="text-sm text-muted-foreground">Reset link sent to <span className="text-foreground font-bold">{email}</span></p>
                <p className="text-xs text-muted-foreground mt-2">Click the link in the email to reset your password, then come back and login.</p>
              </div>
              <button onClick={() => setStep('login')} className="w-full py-4 gradient-pink rounded-2xl text-white font-bold press pink-glow">
                Back to Login
              </button>
              <button onClick={handleForgotPassword} disabled={loading} className="w-full text-sm text-muted-foreground hover:text-primary press">
                {loading ? 'Resending...' : 'Resend email'}
              </button>
            </div>
          )}

          {step === 'register-email' && (
            <div className="space-y-4">
              <button onClick={() => setStep('choice')} className="flex items-center gap-2 text-muted-foreground text-sm mb-1 press">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-muted-foreground" />
                <input className={`${inputClass} pl-10`} type="email" placeholder="Your email address" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendOTP()} />
              </div>
              <button onClick={handleSendOTP} disabled={loading} className="w-full py-4 gradient-pink rounded-2xl text-white font-bold text-base pink-glow disabled:opacity-50 press">
                {loading ? 'Sending Code...' : 'Send Verification Code →'}
              </button>
              <p className="text-center text-sm text-muted-foreground">
                Already registered? <button onClick={() => setStep('login')} className="text-primary font-bold press">Login</button>
              </p>
            </div>
          )}

          {step === 'register-otp' && (
            <div className="space-y-4">
              <button onClick={() => setStep('register-email')} className="flex items-center gap-2 text-muted-foreground text-sm mb-1 press">
                <ArrowLeft className="w-4 h-4" /> Change email
              </button>
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl">
                <p className="text-xs text-muted-foreground">Code sent to <span className="text-foreground font-bold">{email}</span></p>
              </div>
              <input
                className="w-full bg-muted border border-border rounded-xl px-4 py-5 text-foreground text-center text-4xl tracking-[0.7em] font-black focus:border-primary outline-none transition-all"
                type="text"
                inputMode="numeric"
                placeholder="0000"
                maxLength={4}
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
              />
              <button onClick={handleVerifyOTP} disabled={loading || otp.length < 4} className="w-full py-4 gradient-pink rounded-2xl text-white font-bold text-base pink-glow disabled:opacity-50 press">
                {loading ? 'Verifying...' : 'Verify Code →'}
              </button>
              <button onClick={handleSendOTP} className="w-full text-sm text-muted-foreground hover:text-primary transition-colors press">Resend code</button>
            </div>
          )}

          {step === 'reset-password' && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <p className="text-xs text-blue-400">Choose a new secure password for your account.</p>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-muted-foreground" />
                <input
                  className={`${inputClass} pl-10 pr-11`}
                  type={showNewPass ? 'text' : 'password'}
                  placeholder="New password (min 6 characters)"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleResetPassword()}
                  autoFocus
                />
                <button onClick={() => setShowNewPass(!showNewPass)} className="absolute right-3.5 top-3.5 press">
                  {showNewPass ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                </button>
              </div>
              <button onClick={handleResetPassword} disabled={loading} className="w-full py-4 gradient-pink rounded-2xl text-white font-bold text-base pink-glow disabled:opacity-50 press">
                {loading ? 'Updating...' : 'Set New Password ✓'}
              </button>
            </div>
          )}

          {step === 'register-pass' && (
            <div className="space-y-4">
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-[8px] font-black">✓</span>
                </div>
                <p className="text-xs text-green-400 font-medium">Email verified successfully!</p>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-muted-foreground" />
                <input
                  className={`${inputClass} pl-10 pr-11`}
                  type={showPass ? 'text' : 'password'}
                  placeholder="Create password (min 6 characters)"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSetPassword()}
                />
                <button onClick={() => setShowPass(!showPass)} className="absolute right-3.5 top-3.5 press">
                  {showPass ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                </button>
              </div>
              <button onClick={handleSetPassword} disabled={loading} className="w-full py-4 gradient-pink rounded-2xl text-white font-bold text-base pink-glow disabled:opacity-50 press">
                {loading ? 'Creating Account...' : 'Create Account ✓'}
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6 pb-10">
          By continuing you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
}
