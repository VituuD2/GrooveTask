import React, { useState } from 'react';
import { Lock, Mail, Loader2, X, AlertCircle, UserPlus, LogIn } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (email: string) => void;
  themeColor: string;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLoginSuccess, themeColor }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Basic Validation
    if (isRegistering && password !== confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      // Success
      onLoginSuccess(data.user?.email || email);
      onClose();
      // Reset form after close
      setTimeout(() => {
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setIsRegistering(false);
      }, 300);
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setError(null);
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div 
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden transform scale-100 transition-all"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              {isRegistering ? (
                <>
                  <UserPlus size={20} style={{ color: themeColor }} />
                  New Artist Registration
                </>
              ) : (
                <>
                  <Lock size={20} style={{ color: themeColor }} />
                  Backstage Access
                </>
              )}
            </h2>
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-3">
                <AlertCircle className="text-red-500 shrink-0" size={18} />
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-zinc-600" size={18} />
                <input 
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900 placeholder:text-zinc-700"
                  style={{ '--tw-ring-color': themeColor } as React.CSSProperties}
                  placeholder="user@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-zinc-600" size={18} />
                <input 
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900 placeholder:text-zinc-700"
                  style={{ '--tw-ring-color': themeColor } as React.CSSProperties}
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
              </div>
            </div>

            {isRegistering && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 text-zinc-600" size={18} />
                  <input 
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className={`w-full bg-zinc-950 border rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900 placeholder:text-zinc-700 ${
                      confirmPassword && password !== confirmPassword ? 'border-red-500/50 focus:border-red-500' : 'border-zinc-800'
                    }`}
                    style={{ '--tw-ring-color': confirmPassword && password !== confirmPassword ? '#ef4444' : themeColor } as React.CSSProperties}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
            )}

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl font-bold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 mt-4"
              style={{ backgroundColor: themeColor }}
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {isRegistering ? 'Creating Account...' : 'Authenticating...'}
                </>
              ) : (
                <>
                   {isRegistering ? <UserPlus size={18}/> : <LogIn size={18}/>}
                   {isRegistering ? 'Join the Mix' : 'Log In'}
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-zinc-600">
            {isRegistering ? 'Already have an account? ' : "Don't have an account? "}
            <button 
              onClick={toggleMode}
              className="underline hover:text-zinc-400 cursor-pointer font-medium focus:outline-none"
            >
              {isRegistering ? 'Log In' : 'Register'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;