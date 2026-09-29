import React, { useState } from 'react';
import { HalftoneCanvas } from '../components/auth/HalftoneCanvas';
import { ForgotPasswordModal } from '../components/auth/ForgotPasswordModal';
import { Header } from '../components/layout/Header';
import { useAuthStore } from '../stores/authStore';
import { PreciLogo } from '../components/common/PreciLogo';
import { Loader2, Eye, EyeOff } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remember, setRemember] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;
    setError('');
    setIsSubmitting(true);

    const success = await login(username, password);
    if (!success) {
      setError('Credenciais inválidas. Verifique os dados e tente novamente.');
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 bg-[#F5F5F5] dark:bg-[#171717] text-[#171717] dark:text-[#F5F5F5] overflow-hidden select-none transition-colors duration-200">
      {/* Interactive Halftone Background Canvas with mouse repulsion */}
      <HalftoneCanvas />

      {/* Header Glass with Logomarca and Theme Toggle */}
      <Header />

      {/* Login Card matching Sketch 1 */}
      <div className="relative z-10 w-full max-w-[340px] rounded-3xl border border-neutral-300/90 dark:border-neutral-700/80 bg-white/95 dark:bg-[#1E1E1E]/90 backdrop-blur-md shadow-2xl p-8 flex flex-col items-center text-neutral-900 dark:text-[#F5F5F5] transition-colors duration-200">
        {/* Brand Logo Icon */}
        <div className="mb-4">
          <PreciLogo variant="icon" height={38} />
        </div>

        {/* Title "Entrar" */}
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-3xl font-medium tracking-tight text-neutral-900 dark:text-white">Entrar</h1>
        </div>

        {error && (
          <div className="w-full mb-4 p-2.5 rounded-xl bg-red-100 dark:bg-red-950/40 border border-red-300 dark:border-red-800/60 text-red-700 dark:text-red-300 text-xs text-center">
            {error}
          </div>
        )}

        <div className="w-full space-y-4">
          {/* Username input */}
          <div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Usuário"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-form-type="other"
              data-lpignore="true"
              className="w-full px-4 py-3 text-sm rounded-2xl bg-neutral-100 dark:bg-neutral-900/80 border border-neutral-300 dark:border-neutral-700 focus:border-neutral-500 dark:focus:border-neutral-400 outline-none text-neutral-900 dark:text-[#F5F5F5] placeholder:text-neutral-400 dark:placeholder:text-neutral-500 transition-colors"
            />
          </div>

          {/* Password input (masked as text to prevent browser 'Compromised Password' / 'Mude sua senha' alert) */}
          <div className="relative">
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Senha"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-form-type="other"
              data-lpignore="true"
              style={{
                WebkitTextSecurity: showPassword ? 'none' : 'disc',
              } as React.CSSProperties}
              className="w-full pl-4 pr-11 py-3 text-sm rounded-2xl bg-neutral-100 dark:bg-neutral-900/80 border border-neutral-300 dark:border-neutral-700 focus:border-neutral-500 dark:focus:border-neutral-400 outline-none text-neutral-900 dark:text-[#F5F5F5] placeholder:text-neutral-400 dark:placeholder:text-neutral-500 transition-colors"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword(!showPassword)}
              title={showPassword ? 'Ocultar senha' : 'Ver senha'}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors p-1"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Remember Password / Esqueci minha senha as in Sketch 1 */}
          <div className="flex items-center justify-between pt-1 px-1 text-xs text-neutral-600 dark:text-neutral-400">
            <label className="flex items-center gap-1.5 cursor-pointer hover:text-neutral-900 dark:hover:text-neutral-200">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900 accent-neutral-900 dark:accent-neutral-200 cursor-pointer"
              />
              <span>Lembrar login</span>
            </label>

            <button
              type="button"
              onClick={() => setIsForgotPasswordOpen(true)}
              className="hover:text-neutral-900 dark:hover:text-white transition-colors"
            >
              Esqueci minha senha
            </button>
          </div>

          {/* Login Button matching Sketch 1 */}
          <div className="pt-3">
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={isSubmitting}
              className="w-full py-3 px-6 rounded-2xl bg-neutral-900 dark:bg-neutral-200 text-white dark:text-[#171717] hover:bg-neutral-800 dark:hover:bg-white font-semibold text-sm transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Entrar</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
      />
    </div>
  );
};
