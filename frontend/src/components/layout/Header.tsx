import React from 'react';
import { ThemeToggle } from './ThemeToggle';
import { PreciLogo } from '../common/PreciLogo';

export const Header: React.FC = () => {
  return (
    <header className="fixed top-0 left-0 right-0 h-14 z-30 flex items-center justify-between px-6 header-glass">
      <div className="flex items-center gap-2">
        <PreciLogo variant="logomarca" height={22} className="cursor-pointer" />
      </div>
      <div className="flex items-center gap-3">
        <ThemeToggle />
      </div>
    </header>
  );
};
