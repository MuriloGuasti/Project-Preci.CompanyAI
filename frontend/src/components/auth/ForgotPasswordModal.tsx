import React, { useEffect } from 'react';
import { KeyRound, Headset, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleContactSupport = () => {
    window.location.href = 'mailto:suporte@preci.company?subject=Solicita%C3%A7%C3%A3o%20de%20Redefini%C3%A7%C3%A3o%20de%20Senha';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-sm rounded-3xl border border-neutral-300/90 dark:border-neutral-700/80 bg-white/95 dark:bg-[#1E1E1E]/95 backdrop-blur-md shadow-2xl p-6 flex flex-col items-center text-center text-neutral-900 dark:text-[#F5F5F5]"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              title="Fechar"
              className="absolute top-4 right-4 p-1.5 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Password Key Icon Badge */}
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-900 dark:text-white mb-4 shadow-sm">
              <KeyRound className="w-6 h-6" />
            </div>

            {/* Title */}
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
              Redefinição de Senha
            </h3>

            {/* Message */}
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6 leading-relaxed">
              Para reset de senha, é necessário entrar em contato com a equipe de suporte.
            </p>

            {/* Actions */}
            <div className="w-full space-y-2.5">
              <button
                type="button"
                onClick={handleContactSupport}
                className="w-full py-2.5 px-4 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-white font-medium text-sm transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Headset className="w-4 h-4" />
                <span>Entrar em contato</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 px-4 rounded-xl text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800/60 font-medium text-xs transition-colors"
              >
                Voltar ao login
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
