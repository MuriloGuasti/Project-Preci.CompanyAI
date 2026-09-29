import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAgentStore } from '../../stores/agentStore';
import { X, Play, Sparkles, HelpCircle, ArrowRight, CornerDownRight } from 'lucide-react';

export const WorkflowTestModal: React.FC = () => {
  const { isTestModalOpen, setTestModalOpen, executeWorkflow, isExecuting, agents, activeAgentId } =
    useAgentStore();

  const activeAgent = agents.find((a) => a.id === activeAgentId);

  // Trace connected pipeline route starting from trigger
  const triggerNode = activeAgent?.nodes.find((n) => n.type === 'trigger');
  const connectedRoute: Array<{ node: (typeof activeAgent.nodes)[0]; targetHandle?: string }> = [];
  if (triggerNode) {
    connectedRoute.push({ node: triggerNode });
    let currId = triggerNode.id;
    const visited = new Set<string>([currId]);
    while (currId) {
      const edge = activeAgent?.edges.find((e) => e.source_node_id === currId);
      if (edge && edge.target_node_id && !visited.has(edge.target_node_id)) {
        visited.add(edge.target_node_id);
        const nextNode = activeAgent?.nodes.find((n) => n.id === edge.target_node_id);
        if (nextNode) {
          connectedRoute.push({ node: nextNode, targetHandle: edge.target_handle });
          currId = nextNode.id;
          continue;
        }
      }
      break;
    }
  }

  // Default test variables
  const [variables, setVariables] = useState<Record<string, string>>({
    pergunta: 'Como solicitar reembolso ou cancelamento do serviço contratado?',
    cliente: 'Empresa Alfa Ltda',
    prioridade: 'alta',
  });

  // Check if trigger node defined custom parameters
  useEffect(() => {
    if (activeAgent) {
      const triggerNode = activeAgent.nodes.find((n) => n.type === 'trigger');
      if (triggerNode?.config?.parameters && Array.isArray(triggerNode.config.parameters)) {
        const initialVars: Record<string, string> = {};
        triggerNode.config.parameters.forEach((p: any) => {
          if (p.name) initialVars[p.name] = p.default || '';
        });
        if (Object.keys(initialVars).length > 0) {
          setVariables(initialVars);
        }
      }
    }
  }, [activeAgent]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTestModalOpen) {
        setTestModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTestModalOpen, setTestModalOpen]);

  const handleInputChange = (key: string, value: string) => {
    setVariables((prev) => ({ ...prev, [key]: value }));
  };

  const handleRun = () => {
    executeWorkflow(variables);
  };

  const samplePresets = [
    {
      title: 'Dúvida sobre Garantia e Reembolso',
      query: 'Qual o prazo e regras para solicitar garantia ou reembolso de faturamento?',
    },
    {
      title: 'Segunda Via de Contrato / Fatura',
      query: 'Como emitir a segunda via do contrato corporativo e atualizar os dados cadastrais?',
    },
    {
      title: 'SLA e Suporte Técnico Especializado',
      query: 'Quais os canais e prazos de resposta garantidos para incidentes de prioridade crítica?',
    },
  ];

  return (
    <AnimatePresence>
      {isTestModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setTestModalOpen(false)}
          data-no-canvas-select
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280, mass: 0.85 }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-neutral-900 dark:text-[#F5F5F5]"
          >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700/80 text-neutral-900 dark:text-white">
              <Play className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                Testar Fluxo de Trabalho
              </h3>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                {activeAgent?.name || 'Agente Ativo'} • Modo Local Inteligente (Zero Custo)
              </p>
            </div>
          </div>
          <button
            onClick={() => setTestModalOpen(false)}
            className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Quick Info Box */}
          <div className="p-3 rounded-xl bg-neutral-100/70 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-neutral-700 dark:text-neutral-300 shrink-0 mt-0.5" />
            <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
              Insira os dados de teste. As informações são transmitidas pela saída do Gatilho e alimentam diretamente as portas de entrada de cada nó conectado por cabo.
            </p>
          </div>

          {/* Pipeline Route Preview */}
          {connectedRoute.length > 1 && (
            <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-2">
              <span className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 block">
                Rota de Execução Conectada (Cabos):
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {connectedRoute.map((step, idx) => (
                  <React.Fragment key={step.node.id}>
                    {idx > 0 && (
                      <div className="flex items-center text-neutral-400 shrink-0">
                        <ArrowRight className="w-3 h-3 text-neutral-400" />
                      </div>
                    )}
                    <div className="px-2.5 py-1 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700/80 shadow-xs flex items-center gap-1.5 shrink-0">
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200 text-xs">
                        {step.node.label}
                      </span>
                      {step.targetHandle && (
                        <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                          in:{step.targetHandle}
                        </span>
                      )}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* Variables Form */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Variáveis do Disparo (Gatilho)
              </label>
              <span className="text-[10px] text-neutral-400 font-mono">
                Alimenta a porta: output
              </span>
            </div>

            {Object.keys(variables).map((key) => (
              <div key={key}>
                <span className="block text-[11px] font-mono text-neutral-500 dark:text-neutral-400 mb-1">
                  {`{{trigger.${key}}}`}
                </span>
                {key === 'pergunta' || key === 'mensagem' || key === 'query' ? (
                  <textarea
                    rows={3}
                    value={variables[key]}
                    onChange={(e) => handleInputChange(key, e.target.value)}
                    placeholder={`Valor para ${key}...`}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500 leading-relaxed font-sans"
                  />
                ) : (
                  <input
                    type="text"
                    value={variables[key]}
                    onChange={(e) => handleInputChange(key, e.target.value)}
                    placeholder={`Valor para ${key}...`}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500 font-sans"
                  />
                )}
              </div>
            ))}
          </div>

          {/* Quick Presets */}
          <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800">
            <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 block mb-2">
              Exemplos Rápidos de Perguntas:
            </span>
            <div className="space-y-1.5">
              {samplePresets.map((preset, idx) => (
                <motion.button
                  key={idx}
                  type="button"
                  whileTap={{ scale: 0.985 }}
                  transition={{ duration: 0.12 }}
                  onClick={() => handleInputChange('pergunta', preset.query)}
                  className="w-full text-left p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 hover:shadow-sm transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="pr-2">
                    <div className="text-xs font-medium text-neutral-800 dark:text-neutral-200 group-hover:text-neutral-900 dark:group-hover:text-white">
                      {preset.title}
                    </div>
                    <div className="text-[10px] text-neutral-500 truncate max-w-[340px]">
                      {preset.query}
                    </div>
                  </div>
                  <CornerDownRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-white shrink-0" />
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40">
          <button
            type="button"
            onClick={() => setTestModalOpen(false)}
            className="px-4 py-2 text-xs font-semibold rounded-xl text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.12 }}
            onClick={handleRun}
            disabled={isExecuting}
            className="flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 disabled:opacity-40 transition-all shadow-md cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Iniciar Execução</span>
          </motion.button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
  );
};
