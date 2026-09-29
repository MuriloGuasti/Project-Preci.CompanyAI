import React, { useRef, useEffect, useCallback } from 'react';
import { ChevronUp, ChevronDown, Minus, Plus } from 'lucide-react';

export interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  variant?: 'chevrons' | 'stepper';
  size?: 'sm' | 'md';
  suffix?: string;
  id?: string;
  name?: string;
  title?: string;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder,
  className = '',
  inputClassName = '',
  disabled = false,
  variant = 'chevrons',
  size = 'md',
  suffix,
  id,
  name,
  title,
}) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clamp = useCallback(
    (val: number) => {
      let clamped = val;
      if (min !== undefined) clamped = Math.max(min, clamped);
      if (max !== undefined) clamped = Math.min(max, clamped);
      return clamped;
    },
    [min, max]
  );

  const stepBy = useCallback(
    (delta: number) => {
      if (disabled) return;
      const current = typeof value === 'number' && !isNaN(value) ? value : min ?? 0;
      const next = clamp(current + delta * step);
      onChange(next);
    },
    [disabled, value, min, step, clamp, onChange]
  );

  const stopContinuous = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startContinuous = useCallback(
    (delta: number) => {
      if (disabled) return;
      stepBy(delta);
      stopContinuous();
      timerRef.current = setTimeout(() => {
        intervalRef.current = setInterval(() => {
          stepBy(delta);
        }, 75);
      }, 300);
    },
    [disabled, stepBy, stopContinuous]
  );

  useEffect(() => {
    return () => stopContinuous();
  }, [stopContinuous]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '' || raw === '-') {
      return;
    }
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed)) {
      onChange(clamp(parsed));
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '' || isNaN(parseInt(raw, 10))) {
      onChange(min ?? 0);
    } else {
      onChange(clamp(parseInt(raw, 10)));
    }
  };

  const isMinReached = min !== undefined && value <= min;
  const isMaxReached = max !== undefined && value >= max;

  if (variant === 'stepper') {
    return (
      <div
        className={`inline-flex items-center gap-1 select-none ${className}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled || isMinReached}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            startContinuous(-1);
          }}
          onMouseUp={stopContinuous}
          onMouseLeave={stopContinuous}
          className="w-5 h-5 rounded flex items-center justify-center text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer"
          title="Diminuir valor"
        >
          <Minus className="w-2.5 h-2.5 stroke-[2.5]" />
        </button>

        <input
          id={id}
          name={name}
          title={title}
          type="number"
          min={min}
          max={max}
          step={step}
          value={isNaN(value) ? '' : value}
          onChange={handleInputChange}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={placeholder}
          className={`w-9 text-xs p-1 rounded-md bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center font-medium text-neutral-900 dark:text-neutral-100 outline-none focus:border-neutral-900 dark:focus:border-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${inputClassName}`}
        />

        <button
          type="button"
          tabIndex={-1}
          disabled={disabled || isMaxReached}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            startContinuous(1);
          }}
          onMouseUp={stopContinuous}
          onMouseLeave={stopContinuous}
          className="w-5 h-5 rounded flex items-center justify-center text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer"
          title="Aumentar valor"
        >
          <Plus className="w-2.5 h-2.5 stroke-[2.5]" />
        </button>
      </div>
    );
  }

  // Default: 'chevrons' variant with integrated up/down buttons
  const isSm = size === 'sm';

  return (
    <div
      className={`relative flex items-center w-full group ${className}`}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <input
        id={id}
        name={name}
        title={title}
        type="number"
        min={min}
        max={max}
        step={step}
        value={isNaN(value) ? '' : value}
        onChange={handleInputChange}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder={placeholder}
        className={`w-full ${
          isSm ? 'px-2.5 py-1.5 pr-7 text-xs rounded-lg' : 'px-3 py-2 pr-8 text-xs rounded-xl'
        } bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none focus:border-neutral-900 dark:focus:border-white focus:ring-1 focus:ring-neutral-900/20 dark:focus:ring-white/20 transition-all font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${inputClassName}`}
      />

      {suffix && (
        <span className="absolute right-8 text-[11px] font-medium text-neutral-400 dark:text-neutral-500 pointer-events-none select-none">
          {suffix}
        </span>
      )}

      {/* Styled Stepper Buttons Container */}
      <div className="absolute right-1 inset-y-1 flex flex-col justify-center items-center gap-0.5 pr-0.5 select-none pointer-events-auto">
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled || isMaxReached}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            startContinuous(1);
          }}
          onMouseUp={stopContinuous}
          onMouseLeave={stopContinuous}
          className="h-3 w-4.5 flex items-center justify-center rounded text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 active:bg-neutral-200 dark:active:bg-neutral-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer"
          title="Aumentar"
        >
          <ChevronUp className="w-2.5 h-2.5 stroke-[2.5]" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled || isMinReached}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            startContinuous(-1);
          }}
          onMouseUp={stopContinuous}
          onMouseLeave={stopContinuous}
          className="h-3 w-4.5 flex items-center justify-center rounded text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 active:bg-neutral-200 dark:active:bg-neutral-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer"
          title="Diminuir"
        >
          <ChevronDown className="w-2.5 h-2.5 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
};
