import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAgentStore } from '../../stores/agentStore';
import { Agent } from '../../types';
import {
  X,
  Trash2,
  AlertTriangle,
  Bot,
  Loader2,
  Network,
} from 'lucide-react';

export const DeleteAgentModal: React.FC = () => {
  const { agentToDelete, setAgentToDelete, deleteAgent } = useAgentStore();
  const [isDeleting, setIsDeleting] = useState(false);

  // Guarda referência do último agente para manter dados visuais durante a animação de saída
  const lastAgentRef = useRef<Agent | null>(null);
  if (agentToDelete) {
    lastAgentRef.current = agentToDelete;
  }
  const activeAgent = agentToDelete || lastAgentRef.current;

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && agentToDelete && !isDeleting) {
        setAgentToDelete(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [agentToDelete, isDeleting, setAgentToDelete]);

  const agentName = activeAgent?.name || 'Agente';
  const nodeCount = activeAgent?.nodes?.length || 0;

  const handleConfirmDelete = () => {
    if (!activeAgent || isDeleting) return;
    const agentId = activeAgent.id;
    setIsDeleting(true);
    // 1. Fecha o pop-up instantaneamente sem bloquear a interface
    setAgentToDelete(null);
    // 2. Remove o agente da interface de forma otimista e sincroniza em segundo plano
    deleteAgent(agentId).finally(() => {
      setIsDeleting(false);
    });
  };

  return (
    <AnimatePresence>
      {agentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-auto">
          {/* Backdrop animado */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={() => !isDeleting && setAgentToDelete(null)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Card do Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{
              duration: 0.22,
              ease: [0.16, 1, 0.3, 1],
            }}
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 w-full max-w-md bg-white dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700/80 rounded-2xl shadow-2xl overflow-hidden text-neutral-900 dark:text-[#F5F5F5]"
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/80 dark:bg-neutral-900/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-200/80 dark:border-red-900/50">
                  <Trash2 className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-sm sm:text-base text-neutral-900 dark:text-white">
                  Excluir agente
                </h3>
              </div>

              <button
                onClick={() => !isDeleting && setAgentToDelete(null)}
                disabled={isDeleting}
                title="Fechar (Esc)"
                className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                Deseja realmente excluir este agente de automação específico?
              </p>

              {/* Target Agent Preview Card */}
              <div className="p-3 rounded-xl bg-neutral-100/80 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/80 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white dark:bg-neutral-700/60 shadow-sm shrink-0 text-neutral-700 dark:text-neutral-200">
                  <Bot className="w-5 h-5 text-indigo-500 shrink-0" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-xs sm:text-sm text-neutral-900 dark:text-white truncate" title={agentName}>
                    {agentName}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300">
                      <Network className="w-3 h-3" />
                      {nodeCount} {nodeCount === 1 ? 'nó' : 'nós'} de fluxo
                    </span>
                  </div>
                </div>
              </div>

              {/* Warning Message Box */}
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div className="text-[11px] leading-relaxed">
                  Esta ação é permanente e não poderá ser desfeita. Todo o grafo de automações, nós e configurações deste agente serão removidos.
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-2 bg-neutral-50/80 dark:bg-neutral-900/60">
              <button
                type="button"
                onClick={() => !isDeleting && setAgentToDelete(null)}
                disabled={isDeleting}
                className="px-3.5 py-1.5 text-xs font-medium rounded-full border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-full bg-red-500/10 hover:bg-red-500/20 dark:bg-red-950/50 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 border border-red-500/50 dark:border-red-500/60 hover:border-red-500 dark:hover:border-red-400 shadow-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500 dark:text-red-400" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
                    <span>Excluir</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
