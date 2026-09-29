import React, { useEffect, useRef } from 'react';
import { useThemeStore } from '../../stores/themeStore';

export const HalftoneCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { theme } = useThemeStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = window.innerWidth;
    let height = window.innerHeight;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const mouse = {
      x: -99999,
      y: -99999,
      radius: 130,
      active: false,
    };

    const handleResize = () => {
      if (!canvas) return;
      width = window.innerWidth;
      height = window.innerHeight;
      const currentDpr = window.devicePixelRatio || 1;
      canvas.width = width * currentDpr;
      canvas.height = height * currentDpr;
      ctx.setTransform(currentDpr, 0, 0, currentDpr, 0, 0);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    };

    const handleMouseEnter = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    };

    const handleMouseLeave = () => {
      mouse.active = false;
      mouse.x = -99999;
      mouse.y = -99999;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseenter', handleMouseEnter);
    document.addEventListener('mouseleave', handleMouseLeave);

    // Spacing between dots
    const spacing = 24;
    const baseRadius = 1.5;

    let tick = 0;

    const render = () => {
      // Gentle speed for smooth, ambient wave movement
      tick += 0.018;

      ctx.clearRect(0, 0, width, height);

      const isDark = theme === 'dark';
      const dotColor = isDark ? 'rgba(245, 245, 245, ' : 'rgba(23, 23, 23, ';

      const cols = Math.ceil(width / spacing);
      const rows = Math.ceil(height / spacing);

      for (let i = 0; i <= cols; i++) {
        for (let j = 0; j <= rows; j++) {
          const originX = i * spacing;
          const originY = j * spacing;

          // Projection along diagonal vector from bottom-left (0, height) to top-right (width, 0)
          const diag = originX + (height - originY);
          const diagSecondary = originX * 0.85 + (height - originY) * 1.15;

          // Waves travelling smoothly from bottom-left towards top-right
          const wave1 = Math.sin(diag * 0.008 - tick * 1.4);
          const wave2 = Math.sin(diagSecondary * 0.014 - tick * 1.8 + 0.8);
          const combinedWave = wave1 * 0.7 + wave2 * 0.3; // [-1, 1]

          // Normalized wave factor [0, 1]
          const waveFactor = (combinedWave + 1) * 0.5;

          // Halftone wave dot sizing: creates rolling wave crests of expanded dots
          let currentRadius = 0.9 + waveFactor * 1.8;

          // Ambient opacity breathing with wave
          const minAlpha = isDark ? 0.10 : 0.08;
          const maxAlpha = isDark ? 0.28 : 0.24;
          let alpha = minAlpha + waveFactor * (maxAlpha - minAlpha);

          // Subtle physical displacement undulating in the direction of the wave
          const disp = combinedWave * 2.2;
          let posX = originX + disp * 0.707;
          let posY = originY - disp * 0.707;

          // Halftone repulsion effect: dots repel directly away from the real mouse pointer
          if (mouse.active) {
            const dx = mouse.x - posX;
            const dy = mouse.y - posY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < mouse.radius) {
              const force = 1 - dist / mouse.radius;
              const angle = Math.atan2(dy, dx);
              const pushDistance = force * 26;
              posX -= Math.cos(angle) * pushDistance;
              posY -= Math.sin(angle) * pushDistance;
              alpha = Math.min(0.85, alpha + force * 0.4);
              currentRadius = currentRadius + force * 1.6;
            }
          }

          ctx.beginPath();
          ctx.arc(posX, posY, Math.max(0.6, currentRadius), 0, Math.PI * 2);
          ctx.fillStyle = `${dotColor}${alpha})`;
          ctx.fill();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseenter', handleMouseEnter);
      document.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100vw', height: '100vh' }}
      className="fixed inset-0 pointer-events-none z-0"
    />
  );
};
