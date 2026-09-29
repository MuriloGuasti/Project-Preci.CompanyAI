import React from 'react';
import { useThemeStore } from '../../stores/themeStore';
import { Sun, Moon } from 'lucide-react';

export const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <button
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
      aria-label="Alternar tema"
      className={`p-2 rounded-lg transition-colors duration-200 border border-transparent hover:border-neutral-700/50 hover:bg-neutral-500/10 focus:outline-none ${className}`}
    >
      {theme === 'dark' ? (
        <Sun className="w-5 h-5 text-neutral-300 hover:text-white transition-colors" />
      ) : (
        <Moon className="w-5 h-5 text-neutral-700 hover:text-black transition-colors" />
      )}
    </button>
  );
};
