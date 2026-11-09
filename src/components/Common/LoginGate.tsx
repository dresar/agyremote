import React, { useState } from 'react';
import { Shield, Key, Eye, EyeOff, Loader2 } from 'lucide-react';
import { setAuthToken, validateAuthToken } from '../../services/api.ts';

interface LoginGateProps {
  onAuthenticated: () => void;
}

export const LoginGate: React.FC<LoginGateProps> = ({ onAuthenticated }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const value = password.trim();
    if (!value || checking) return;
    setChecking(true);
    setError(null);
    const valid = await validateAuthToken(value);
    if (valid) {
      setAuthToken(value);
      onAuthenticated();
      return;
    }
    setChecking(false);
    setError('Password salah');
  };

  return (
    <div className="min-h-screen bg-[#0c0d0e] text-[#f4f4f5] flex flex-col items-center justify-center p-4">
      <div className="card w-full max-w-xs rounded-2xl border-[#252736] bg-[#161720] shadow-2xl p-5 space-y-4">
        <div className="flex flex-col items-center gap-2.5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <Shield className="w-5 h-5 text-emerald-400" />
          </div>
          <h1 className="text-sm font-semibold text-zinc-100 tracking-tight">Akses Remote</h1>
          <p className="text-xs text-zinc-500">Masukkan sandi untuk masuk</p>
        </div>

        <div className="space-y-1.5">
          <label className="simpel-text text-xs text-zinc-400">Password</label>
          <div className="relative">
            <Key className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
              autoFocus
              placeholder="••••••••"
              className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-[#0c0d0e] border border-[#252736] text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
              title={showPassword ? 'Sembunyikan' : 'Tampilkan'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <button
          onClick={submit}
          disabled={checking || !password.trim()}
          className="btn-deep-primary w-full px-4 py-2.5 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          {checking ? 'Memeriksa' : 'Masuk'}
        </button>
      </div>
    </div>
  );
};
