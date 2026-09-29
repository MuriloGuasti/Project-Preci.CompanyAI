import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../stores/authStore';
import { PreciLogo } from '../common/PreciLogo';

interface LoadingScreenProps {
  message?: string;
  onCovered?: () => void;
  onComplete?: () => void;
  durationMs?: number;
  fadeDuration?: number;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Iniciando ambiente seguro',
  onCovered,
  onComplete,
  durationMs = 1000,
  fadeDuration = 0.3,
}) => {
  const [isFadingOut, setIsFadingOut] = useState(false);
  const finishLoadingTransition = useAuthStore((s) => s.finishLoadingTransition);

  useEffect(() => {
    // 1. Once fade-in finishes (at fadeDuration + 50ms buffer), signal that screen is fully covered
    const coveredTimer = setTimeout(() => {
      if (onCovered) {
        onCovered();
      }
    }, Math.round((fadeDuration + 0.05) * 1000));

    // 2. Maintain visible for loading duration, then start fade-out
    const loadTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, durationMs);

    return () => {
      clearTimeout(coveredTimer);
      clearTimeout(loadTimer);
    };
  }, [durationMs, fadeDuration, onCovered]);

  useEffect(() => {
    if (!isFadingOut) return;

    // 3. Perform 0.3s fade-out animation before completion
    const fadeTimer = setTimeout(() => {
      if (onComplete) {
        onComplete();
      } else {
        finishLoadingTransition();
      }
    }, fadeDuration * 1000);

    return () => clearTimeout(fadeTimer);
  }, [isFadingOut, fadeDuration, onComplete, finishLoadingTransition]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: isFadingOut ? 0 : 1 }}
      transition={{ duration: fadeDuration, ease: 'easeInOut' }}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#EFEFEF] dark:bg-[#131313] text-neutral-900 dark:text-[#F5F5F5] transition-colors duration-200 select-none ${
        isFadingOut ? 'pointer-events-none' : 'pointer-events-auto'
      }`}
    >
      <div className="relative flex flex-col items-center gap-6">
        {/* Official Brand Logo */}
        <div className="flex items-center justify-center">
          <PreciLogo variant="logomarca" height={36} />
        </div>

        {/* Minimal circular spinner */}
        <div className="relative w-7 h-7">
          <div className="w-7 h-7 rounded-full border-2 border-neutral-300 dark:border-neutral-700 border-t-neutral-900 dark:border-t-[#F5F5F5] animate-spin" />
        </div>

        <span className="text-xs text-neutral-500 dark:text-neutral-400 tracking-widest uppercase font-medium">
          {message}
        </span>
      </div>
    </motion.div>
  );
};
