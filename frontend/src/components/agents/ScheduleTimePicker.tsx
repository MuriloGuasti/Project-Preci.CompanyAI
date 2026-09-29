import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Calendar,
  Code,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Info,
} from 'lucide-react';

export interface ScheduleTimePickerProps {
  cronExpression: string;
  onChangeCron: (cron: string) => void;
  timezone?: string;
  onChangeTimezone?: (tz: string) => void;
  compact?: boolean;
}

type FrequencyMode = 'interval' | 'daily' | 'weekdays' | 'monthly' | 'custom';

interface DayOption {
  value: number;
  short: string;
  name: string;
}

const DAYS_OF_WEEK: DayOption[] = [
  { value: 1, short: 'Seg', name: 'Segunda-feira' },
  { value: 2, short: 'Ter', name: 'Terça-feira' },
  { value: 3, short: 'Qua', name: 'Quarta-feira' },
  { value: 4, short: 'Qui', name: 'Quinta-feira' },
  { value: 5, short: 'Sex', name: 'Sexta-feira' },
  { value: 6, short: 'Sáb', name: 'Sábado' },
  { value: 0, short: 'Dom', name: 'Domingo' },
];

/**
 * Traduz expressões cron usuais em português claro e amigável para pessoas leigas.
 */
export function formatCronHumanReadable(cron: string): string {
  if (!cron) return 'Agendamento não configurado';
  const trimmed = cron.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length !== 5) return `Expressão personalizada: ${trimmed}`;

  const [min, hour, dom, mon, dow] = parts;

  // Intervalos em minutos
  if (min.startsWith('*/') && hour === '*' && dom === '*' && mon === '*' && dow === '*') {
    const interval = min.replace('*/', '');
    return `A cada ${interval} minutos, continuamente`;
  }

  // A cada 1 hora
  if (min === '0' && hour === '*' && dom === '*' && mon === '*' && dow === '*') {
    return 'A cada 1 hora (no minuto :00)';
  }

  // A cada X horas
  if (min === '0' && hour.startsWith('*/') && dom === '*' && mon === '*' && dow === '*') {
    const interval = hour.replace('*/', '');
    return `A cada ${interval} horas (no minuto :00)`;
  }

  const padTime = (h: string, m: string) => {
    const hh = h.padStart(2, '0');
    const mm = m.padStart(2, '0');
    return `${hh}:${mm}`;
  };

  // Diariamente num horário fixo
  if (dom === '*' && mon === '*' && (dow === '*' || dow === '?') && !min.includes('/') && !hour.includes('/')) {
    return `Todos os dias às ${padTime(hour, min)}`;
  }

  // Dias úteis (Seg a Sex)
  if (dom === '*' && mon === '*' && (dow === '1-5' || dow === '1,2,3,4,5') && !min.includes('/') && !hour.includes('/')) {
    return `De segunda a sexta-feira às ${padTime(hour, min)}`;
  }

  // Fins de semana
  if (dom === '*' && mon === '*' && (dow === '0,6' || dow === '6,0') && !min.includes('/') && !hour.includes('/')) {
    return `Aos sábados e domingos às ${padTime(hour, min)}`;
  }

  // Dias específicos da semana
  if (dom === '*' && mon === '*' && dow !== '*' && !min.includes('/') && !hour.includes('/')) {
    const rawDays = dow.split(',').map((d) => parseInt(d.trim(), 10));
    const dayNames = rawDays
      .map((d) => DAYS_OF_WEEK.find((item) => item.value === d)?.short)
      .filter(Boolean);
    if (dayNames.length > 0) {
      return `Toda semana (${dayNames.join(', ')}) às ${padTime(hour, min)}`;
    }
  }

  // Mensalmente
  if (dom !== '*' && mon === '*' && dow === '*' && !min.includes('/') && !hour.includes('/')) {
    return `Todo dia ${dom} do mês às ${padTime(hour, min)}`;
  }

  return `Personalizado: ${trimmed}`;
}

export const ScheduleTimePicker: React.FC<ScheduleTimePickerProps> = ({
  cronExpression,
  onChangeCron,
  timezone = 'America/Sao_Paulo',
  onChangeTimezone,
  compact = false,
}) => {
  const currentCron = cronExpression || '*/15 * * * *';
  const humanReadableText = useMemo(() => formatCronHumanReadable(currentCron), [currentCron]);

  // Modo ativo da interface (Intervalo, Diário, Dias úteis, Mensal, Manual)
  const initialMode = useMemo<FrequencyMode>(() => {
    const trimmed = currentCron.trim();
    const parts = trimmed.split(/\s+/);
    if (parts.length !== 5) return 'custom';
    const [min, hour, dom, mon, dow] = parts;

    if (min.startsWith('*/') || (hour.startsWith('*/') && min === '0') || (hour === '*' && min === '0')) {
      return 'interval';
    }
    if (dom === '*' && mon === '*' && (dow === '*' || dow === '?')) {
      return 'daily';
    }
    if (dom === '*' && mon === '*' && (dow === '1-5' || dow.includes(','))) {
      return 'weekdays';
    }
    if (dom !== '*' && mon === '*' && dow === '*') {
      return 'monthly';
    }
    return 'custom';
  }, [currentCron]);

  const [activeMode, setActiveMode] = useState<FrequencyMode>(initialMode);
  const [showAdvanced, setShowAdvanced] = useState(initialMode === 'custom');

  // Estado dos seletores
  const [selectedInterval, setSelectedInterval] = useState<string>('*/15 * * * *');
  const [selectedHour, setSelectedHour] = useState<number>(9);
  const [selectedMinute, setSelectedMinute] = useState<number>(0);
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Seg a Sex padrão
  const [selectedMonthDay, setSelectedMonthDay] = useState<number>(1);

  // Sincronizar estado a partir do cron existente
  useEffect(() => {
    const trimmed = currentCron.trim();
    const parts = trimmed.split(/\s+/);
    if (parts.length === 5) {
      const [m, h, dom, , dow] = parts;
      if (m.startsWith('*/') || h.startsWith('*/') || h === '*') {
        setSelectedInterval(trimmed);
      } else {
        const parsedH = parseInt(h, 10);
        const parsedM = parseInt(m, 10);
        if (!isNaN(parsedH)) setSelectedHour(parsedH);
        if (!isNaN(parsedM)) setSelectedMinute(parsedM);
      }

      if (dow === '1-5') {
        setSelectedDays([1, 2, 3, 4, 5]);
      } else if (dow.includes(',')) {
        const dList = dow.split(',').map((x) => parseInt(x, 10)).filter((x) => !isNaN(x));
        if (dList.length > 0) setSelectedDays(dList);
      }

      const parsedDom = parseInt(dom, 10);
      if (!isNaN(parsedDom)) setSelectedMonthDay(parsedDom);
    }
  }, [currentCron]);

  // Atualiza o cron ao mudar o modo ou campos
  const applyInterval = (cronPreset: string) => {
    setSelectedInterval(cronPreset);
    onChangeCron(cronPreset);
  };

  const applyDaily = (h: number, m: number) => {
    setSelectedHour(h);
    setSelectedMinute(m);
    onChangeCron(`${m} ${h} * * *`);
  };

  const applyWeekdays = (days: number[], h: number, m: number) => {
    setSelectedDays(days);
    setSelectedHour(h);
    setSelectedMinute(m);
    const dowStr = days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))
      ? '1-5'
      : days.sort((a, b) => a - b).join(',');
    onChangeCron(`${m} ${h} * * ${dowStr || '*'}`);
  };

  const applyMonthly = (day: number, h: number, m: number) => {
    setSelectedMonthDay(day);
    setSelectedHour(h);
    setSelectedMinute(m);
    onChangeCron(`${m} ${h} ${day} * *`);
  };

  const toggleDay = (dayValue: number) => {
    let updated: number[];
    if (selectedDays.includes(dayValue)) {
      if (selectedDays.length === 1) return; // Mantém pelo menos um
      updated = selectedDays.filter((d) => d !== dayValue);
    } else {
      updated = [...selectedDays, dayValue];
    }
    applyWeekdays(updated, selectedHour, selectedMinute);
  };

  const handleModeChange = (mode: FrequencyMode) => {
    setActiveMode(mode);
    if (mode === 'interval') {
      applyInterval(selectedInterval || '*/15 * * * *');
    } else if (mode === 'daily') {
      applyDaily(selectedHour, selectedMinute);
    } else if (mode === 'weekdays') {
      applyWeekdays(selectedDays, selectedHour, selectedMinute);
    } else if (mode === 'monthly') {
      applyMonthly(selectedMonthDay, selectedHour, selectedMinute);
    }
  };

  return (
    <div className="space-y-3.5 select-none">
      {/* 1. Destaque Visual em Linguagem Natural */}
      <div className="p-3.5 rounded-2xl bg-neutral-100/90 dark:bg-neutral-800/90 border border-neutral-300 dark:border-neutral-700/80 shadow-sm transition-all">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700/80 shadow-xs text-amber-500 shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block">
              Como este fluxo será disparado:
            </span>
            <div className="text-xs font-semibold text-neutral-900 dark:text-white truncate">
              {humanReadableText}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Seleção de Tipo de Frequência (Tabs Amigáveis) */}
      <div>
        <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
          Escolha a Frequência de Execução:
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
          <button
            type="button"
            onClick={() => handleModeChange('interval')}
            className={`py-2 px-2.5 rounded-lg text-xs font-medium transition-all text-center cursor-pointer ${
              activeMode === 'interval'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs font-semibold'
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            Intervalo Frequente
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('daily')}
            className={`py-2 px-2.5 rounded-lg text-xs font-medium transition-all text-center cursor-pointer ${
              activeMode === 'daily'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs font-semibold'
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            Diariamente
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('weekdays')}
            className={`py-2 px-2.5 rounded-lg text-xs font-medium transition-all text-center cursor-pointer ${
              activeMode === 'weekdays'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs font-semibold'
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            Dias da Semana
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('monthly')}
            className={`py-2 px-2.5 rounded-lg text-xs font-medium transition-all text-center cursor-pointer ${
              activeMode === 'monthly'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs font-semibold'
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            Mensalmente
          </button>
        </div>
      </div>

      {/* 3. Painéis de Configuração Conforme o Modo */}

      {/* MODO INTERVALO */}
      {activeMode === 'interval' && (
        <div className="space-y-2 p-3.5 rounded-xl bg-neutral-50/70 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800">
          <span className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 block">
            Repetir a cada:
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: '15 minutos', cron: '*/15 * * * *', sub: '4x por hora' },
              { label: '30 minutos', cron: '*/30 * * * *', sub: '2x por hora' },
              { label: '1 hora', cron: '0 * * * *', sub: 'Todo minuto :00' },
              { label: '2 horas', cron: '0 */2 * * *', sub: 'A cada 2h' },
              { label: '4 horas', cron: '0 */4 * * *', sub: '6x ao dia' },
              { label: '6 horas', cron: '0 */6 * * *', sub: '4x ao dia' },
              { label: '12 horas', cron: '0 */12 * * *', sub: '2x ao dia' },
              { label: '24 horas', cron: '0 0 * * *', sub: 'Meia-noite' },
            ].map((item) => (
              <button
                key={item.cron}
                type="button"
                onClick={() => applyInterval(item.cron)}
                className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                  currentCron === item.cron
                    ? 'border-neutral-900 dark:border-white bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-semibold shadow-xs ring-1 ring-neutral-900/10 dark:ring-white/20'
                    : 'border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/40 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400'
                }`}
              >
                <div className="text-xs font-semibold">{item.label}</div>
                <div className="text-[10px] text-neutral-400 mt-0.5">{item.sub}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* MODO DIÁRIO */}
      {activeMode === 'daily' && (
        <div className="space-y-3 p-3.5 rounded-xl bg-neutral-50/70 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800">
          <span className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 block">
            Defina o Horário do Disparo Diário:
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white dark:bg-neutral-800 p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-xs">
              <Clock className="w-4 h-4 text-neutral-400 shrink-0" />
              <div className="flex items-center gap-1.5">
                <select
                  value={selectedHour}
                  onChange={(e) => applyDaily(parseInt(e.target.value, 10), selectedMinute)}
                  className="px-2 py-1 text-xs font-bold font-mono rounded-lg bg-neutral-100 dark:bg-neutral-900 border-0 text-neutral-900 dark:text-white outline-none cursor-pointer"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {String(i).padStart(2, '0')}h
                    </option>
                  ))}
                </select>
                <span className="font-bold text-neutral-400">:</span>
                <select
                  value={selectedMinute}
                  onChange={(e) => applyDaily(selectedHour, parseInt(e.target.value, 10))}
                  className="px-2 py-1 text-xs font-bold font-mono rounded-lg bg-neutral-100 dark:bg-neutral-900 border-0 text-neutral-900 dark:text-white outline-none cursor-pointer"
                >
                  {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                    <option key={m} value={m}>
                      {String(m).padStart(2, '0')}min
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Sugestões Rápidas de Horários Comerciais */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { label: '08:00', h: 8, m: 0 },
                { label: '09:00', h: 9, m: 0 },
                { label: '12:00', h: 12, m: 0 },
                { label: '18:00', h: 18, m: 0 },
                { label: '23:00', h: 23, m: 0 },
              ].map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => applyDaily(t.h, t.m)}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-all cursor-pointer ${
                    selectedHour === t.h && selectedMinute === t.m
                      ? 'border-neutral-900 dark:border-white bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold'
                      : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:border-neutral-400'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODO DIAS DA SEMANA */}
      {activeMode === 'weekdays' && (
        <div className="space-y-3 p-3.5 rounded-xl bg-neutral-50/70 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
              Selecione os Dias da Semana:
            </span>
            <div className="flex items-center gap-1.5 text-[10px]">
              <button
                type="button"
                onClick={() => applyWeekdays([1, 2, 3, 4, 5], selectedHour, selectedMinute)}
                className="px-2 py-0.5 rounded-md bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-700 font-medium transition-colors cursor-pointer"
              >
                Seg a Sex
              </button>
              <button
                type="button"
                onClick={() => applyWeekdays([0, 1, 2, 3, 4, 5, 6], selectedHour, selectedMinute)}
                className="px-2 py-0.5 rounded-md bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-700 font-medium transition-colors cursor-pointer"
              >
                Todos
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {DAYS_OF_WEEK.map((day) => {
              const isSelected = selectedDays.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  className={`py-2 px-1 rounded-xl text-center border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-neutral-900 dark:border-white bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold shadow-xs'
                      : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400'
                  }`}
                >
                  <div className="text-xs">{day.short}</div>
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-neutral-200/80 dark:border-neutral-800 flex items-center gap-3">
            <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
              No horário:
            </span>
            <div className="flex items-center gap-1.5 bg-white dark:bg-neutral-800 p-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-xs">
              <select
                value={selectedHour}
                onChange={(e) => applyWeekdays(selectedDays, parseInt(e.target.value, 10), selectedMinute)}
                className="px-2 py-0.5 text-xs font-bold font-mono rounded bg-neutral-100 dark:bg-neutral-900 border-0 text-neutral-900 dark:text-white outline-none cursor-pointer"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {String(i).padStart(2, '0')}h
                  </option>
                ))}
              </select>
              <span className="font-bold text-neutral-400">:</span>
              <select
                value={selectedMinute}
                onChange={(e) => applyWeekdays(selectedDays, selectedHour, parseInt(e.target.value, 10))}
                className="px-2 py-0.5 text-xs font-bold font-mono rounded bg-neutral-100 dark:bg-neutral-900 border-0 text-neutral-900 dark:text-white outline-none cursor-pointer"
              >
                {[0, 15, 30, 45].map((m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, '0')}min
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* MODO MENSAL */}
      {activeMode === 'monthly' && (
        <div className="space-y-3 p-3.5 rounded-xl bg-neutral-50/70 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800">
          <span className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 block">
            Executar Todo Mês No Dia:
          </span>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-white dark:bg-neutral-800 p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-xs">
              <Calendar className="w-4 h-4 text-neutral-400 shrink-0" />
              <span className="text-xs text-neutral-500">Dia</span>
              <select
                value={selectedMonthDay}
                onChange={(e) => applyMonthly(parseInt(e.target.value, 10), selectedHour, selectedMinute)}
                className="px-2.5 py-1 text-xs font-bold font-mono rounded-lg bg-neutral-100 dark:bg-neutral-900 border-0 text-neutral-900 dark:text-white outline-none cursor-pointer"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}º
                  </option>
                ))}
              </select>
              <span className="text-xs text-neutral-500">às</span>
              <select
                value={selectedHour}
                onChange={(e) => applyMonthly(selectedMonthDay, parseInt(e.target.value, 10), selectedMinute)}
                className="px-2.5 py-0.5 text-xs font-bold font-mono rounded bg-neutral-100 dark:bg-neutral-900 border-0 text-neutral-900 dark:text-white outline-none cursor-pointer"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {String(i).padStart(2, '0')}h
                  </option>
                ))}
              </select>
              <span className="font-bold text-neutral-400">:</span>
              <select
                value={selectedMinute}
                onChange={(e) => applyMonthly(selectedMonthDay, selectedHour, parseInt(e.target.value, 10))}
                className="px-2.5 py-0.5 text-xs font-bold font-mono rounded bg-neutral-100 dark:bg-neutral-900 border-0 text-neutral-900 dark:text-white outline-none cursor-pointer"
              >
                {[0, 15, 30, 45].map((m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, '0')}min
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 4. Fuso Horário e Informação de Segurança */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div>
          <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Fuso Horário (Região)
          </label>
          <select
            value={timezone}
            onChange={(e) => onChangeTimezone && onChangeTimezone(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none cursor-pointer"
          >
            <option value="America/Sao_Paulo">Brasília (BRT, UTC-3)</option>
            <option value="UTC">UTC (Tempo Universal)</option>
            <option value="America/New_York">Nova York (EST, UTC-5)</option>
            <option value="Europe/London">Londres (GMT, UTC+0)</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Proteção do Sistema
          </label>
          <div className="px-3 py-2 text-xs rounded-xl bg-neutral-100/90 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <span>Intervalo mínimo de 5 min garantido</span>
          </div>
        </div>
      </div>

      {/* 5. Alternador para Desenvolvedores (Expressão Cron Manual) */}
      <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-[11px] text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 font-medium transition-colors cursor-pointer"
        >
          <Code className="w-3.5 h-3.5" />
          <span>{showAdvanced ? 'Ocultar código Cron avançado' : 'Exibir código Cron avançado (para desenvolvedores)'}</span>
          {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showAdvanced && (
          <div className="mt-2.5 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-semibold text-neutral-600 dark:text-neutral-400">
                Expressão Cron (5 campos unix):
              </span>
              <span className="text-[9px] font-mono text-neutral-400">
                min hora dia mês semana
              </span>
            </div>
            <input
              type="text"
              value={currentCron}
              onChange={(e) => onChangeCron(e.target.value)}
              placeholder="*/15 * * * *"
              className="w-full px-3 py-1.5 text-xs font-mono rounded-lg bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 text-neutral-900 dark:text-white outline-none focus:border-neutral-900 dark:focus:border-white"
            />
          </div>
        )}
      </div>
    </div>
  );
};
