import React from 'react';
import { useThemeStore } from '../../stores/themeStore';

interface PreciLogoProps {
  variant?: 'logomarca' | 'icon';
  className?: string;
  height?: number;
  alt?: string;
  forceTheme?: 'dark' | 'light';
}

export const PreciLogo: React.FC<PreciLogoProps> = ({
  variant = 'logomarca',
  className = '',
  height = 24,
  alt = 'preci.',
  forceTheme,
}) => {
  const { theme: storeTheme } = useThemeStore();
  const activeTheme = forceTheme || storeTheme;
  const isDark = activeTheme === 'dark';

  // Ícones oficiais sincronizados com assets/:
  // IconLight.png (logo branca #F5F5F5) para o tema Dark
  // IconDark.png (logo escura #171717) para o tema Light
  const iconSrc = isDark ? '/assets/IconLight.png' : '/assets/IconDark.png';

  // Logomarcas oficiais (Logo + Nome):
  // PreciLogomarcaLightPNG.png para Dark Theme
  // PreciLogomarcaBlackPNG.png para Light Theme
  const logomarcaSrc = isDark
    ? '/assets/PreciLogomarcaLightPNG.png'
    : '/assets/PreciLogomarcaBlackPNG.png';

  if (variant === 'icon') {
    return (
      <img
        src={iconSrc}
        alt={alt}
        style={{ height: `${height}px`, width: `${height}px` }}
        className={`object-contain transition-opacity duration-200 select-none ${className}`}
      />
    );
  }

  // variant === 'logomarca'
  // Substitui a combinação de ícone e texto pela imagem oficial da logomarca
  return (
    <img
      src={logomarcaSrc}
      alt={alt}
      style={{ height: `${height}px`, width: 'auto' }}
      className={`object-contain transition-opacity duration-200 select-none ${className}`}
    />
  );
};
