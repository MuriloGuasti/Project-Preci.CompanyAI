import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAgentStore } from '../../stores/agentStore';
import {
  X,
  Sparkles,
  Loader2,
  Send,
  Zap,
  FileText,
  FileSearch,
  Globe,
  Plus,
  RefreshCw,
  AlertCircle,
  Undo2,
} from 'lucide-react';

const SUGGESTED_PROMPTS = [
  {
    icon: <FileText className="w-3.5 h-3.5 text-emerald-400" />,
    label: 'Relatório Executivo & E-mail',
    prompt: 'Crie um fluxo que recebe dados no gatilho, conecta a saída ao Gemini Flash via handle prompt, encaminha a resposta sintetizada para o Gerador de Relatórios (handle raw_data) e dispara o e-mail corporativo (handle body).',
  },
  {
    icon: <FileSearch className="w-3.5 h-3.5 text-purple-400" />,
    label: 'Atendimento RAG & Notificação',
    prompt: 'Crie um fluxo onde recebo a pergunta de um cliente no gatilho, conecto ao nó de Busca em Documentos (RAG via query), entrego o contexto semântico ao Gemini Flash (prompt) e envio o resultado para uma notificação no Slack.',
  },
  {
    icon: <Zap className="w-3.5 h-3.5 text-amber-400" />,
    label: 'Webhook com Triagem Condicional',
    prompt: 'Crie um fluxo com gatilho Webhook para chamados, análise de sentimento com IA, uma Condição Se/Senão conectada ao resultado e envio de alerta corporativo para casos urgentes.',
  },
  {
    icon: <Globe className="w-3.5 h-3.5 text-blue-400" />,
    label: 'Integração HTTP & Síntese IA',
    prompt: 'Inicie um fluxo manual que consulta uma API externa via requisição HTTP, passa o payload recebido diretamente para o nó de IA do Gemini Flash e gera um relatório corporativo com os insights.',
  },
];

export const AiWorkflowDrawer: React.FC = () => {
  const { isAiDrawerOpen, setAiDrawerOpen, generateWorkflowWithAi, activeAgentId, agents } = useAgentStore();

  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<'replace' | 'append'>('replace');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeAgent = agents.find((a) => a.id === activeAgentId) || agents[0];
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isAiDrawerOpen) {
      setErrorMessage(null);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isAiDrawerOpen]);

  // Handle ESC shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isAiDrawerOpen) return;
      if (e.key === 'Escape') {
        setAiDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAiDrawerOpen, setAiDrawerOpen]);

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const res = await generateWorkflowWithAi(prompt.trim(), mode);
      if (!res.ok) {
        setErrorMessage(res.message || 'Erro ao gerar workflow. Tente novamente.');
      } else {
        setPrompt('');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha inesperada na geração do fluxo.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <AnimatePresence>
      {isAiDrawerOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          onClick={() => !isGenerating && setAiDrawerOpen(false)}
          className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ x: '100%', opacity: 0.7 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.7 }}
            transition={{ type: 'spring', damping: 32, stiffness: 280, mass: 0.85 }}
            onClick={(e) => e.stopPropagation()}
            className="w-[440px] max-w-[92vw] h-full bg-white dark:bg-[#1A1A1A] border-l border-neutral-200 dark:border-neutral-800 p-6 flex flex-col shadow-2xl text-neutral-900 dark:text-[#F5F5F5] transition-colors duration-200 overflow-hidden"
          >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm tracking-tight text-neutral-900 dark:text-white">
                Ajuda IA
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Crie fluxos completos e funcionais com IA
              </p>
            </div>
          </div>
          <button
            onClick={() => setAiDrawerOpen(false)}
            disabled={isGenerating}
            className="p-1.5 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-30 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Scrollable Area with subtle entrance */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1 overflow-y-auto py-5 space-y-5 px-0.5 pr-2"
        >
          {/* Active Agent Info */}
          <div className="px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800/80 bg-neutral-50 dark:bg-neutral-900/40 flex items-center justify-between text-xs">
            <span className="text-neutral-500 dark:text-neutral-400">Agente Alvo:</span>
            <span className="font-semibold text-neutral-800 dark:text-neutral-200 truncate max-w-[200px]">
              {activeAgent?.name || 'Nenhum'}
            </span>
          </div>

          {/* Mode Selector */}
          <div>
            <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
              Modo de Aplicação no Canvas
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-neutral-100 dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setMode('replace')}
                disabled={isGenerating}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  mode === 'replace'
                    ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm border border-neutral-300/60 dark:border-neutral-700'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Substituir Fluxo</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('append')}
                disabled={isGenerating}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  mode === 'append'
                    ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm border border-neutral-300/60 dark:border-neutral-700'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar ao Fluxo</span>
              </button>
            </div>
            <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1.5 px-0.5">
              {mode === 'replace'
                ? 'Substitui todos os nós atuais pelo novo grafo gerado.'
                : 'Insere os novos nós à direita dos nós atuais com espaçamento automático.'}
            </p>
          </div>


          {/* Prompt Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Instrução do Fluxo
              </label>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                Pressione Ctrl + Enter para gerar
              </span>
            </div>
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isGenerating}
              rows={4}
              placeholder="Ex: Crie um fluxo onde recebo um chamado de cliente via webhook, consulto a documentação da empresa com RAG, elaboro a resposta com IA, gero um relatório HTML executivo e envio por e-mail..."
              className="w-full text-xs rounded-xl border border-neutral-300 dark:border-white bg-white dark:bg-neutral-900/95 text-neutral-900 dark:text-neutral-100 p-3.5 outline-none focus:outline-none focus:border-neutral-900 dark:focus:border-white transition-colors resize-none disabled:opacity-50"
              style={{ outline: 'none', boxShadow: 'none' }}
            />
          </div>

          {/* Quick Suggestions / Preset Pills */}
          <div>
            <div className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2.5">
              Sugestões Rápidas de Automação
            </div>
            <div className="space-y-2">
              {SUGGESTED_PROMPTS.map((item, idx) => (
                <motion.button
                  key={idx}
                  type="button"
                  whileTap={{ scale: 0.985 }}
                  transition={{ duration: 0.12 }}
                  onClick={() => setPrompt(item.prompt)}
                  disabled={isGenerating}
                  className="w-full text-left p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 hover:border-neutral-400 dark:hover:border-neutral-600 hover:shadow-sm transition-all group flex items-start gap-2.5 cursor-pointer disabled:opacity-40"
                >
                  <div className="p-1.5 rounded-lg bg-neutral-200/80 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 shrink-0 group-hover:scale-105 transition-transform">
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-neutral-800 dark:text-neutral-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {item.label}
                    </div>
                    <div className="text-[11px] text-neutral-400 dark:text-neutral-500 line-clamp-2 mt-0.5 leading-relaxed">
                      {item.prompt}
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}
        </motion.div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 space-y-2 shrink-0">
          <motion.button
            type="button"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.985 }}
            transition={{ duration: 0.12 }}
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400 dark:text-indigo-600" />
                <span>Desenhando fluxo...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-indigo-400 dark:text-indigo-600" />
                <span>Gerar Workflow com IA</span>
              </>
            )}
          </motion.button>

          <div className="flex items-center justify-between text-[11px] text-neutral-400 dark:text-neutral-500 px-1 pt-1">
            <span className="flex items-center gap-1">
              <Undo2 className="w-3 h-3" />
              Desfazer com Ctrl + Z
            </span>
            <button
              type="button"
              onClick={() => setAiDrawerOpen(false)}
              disabled={isGenerating}
              className="hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
  );
};
