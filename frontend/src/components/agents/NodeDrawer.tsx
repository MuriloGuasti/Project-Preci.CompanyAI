import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAgentStore } from '../../stores/agentStore';
import {
  X,
  Zap,
  Sparkles,
  GitBranch,
  Send,
  Globe,
  FileSearch,
  FileText,
  Mail,
  ArrowRight,
  Repeat,
  UserCheck,
  Layers,
  Clock,
} from 'lucide-react';
import { AgentNode } from '../../types';

interface NodeHandleInfo {
  handle: string;
  label: string;
  type: string;
}

interface NodeItem {
  type: AgentNode['type'];
  label: string;
  category: string;
  description: string;
  icon: React.ReactNode;
  inputs?: NodeHandleInfo[];
  output: NodeHandleInfo;
}

const AVAILABLE_NODES: NodeItem[] = [
  // Disparadores
  {
    type: 'trigger',
    label: 'Webhook / Requisição Externa',
    category: 'Disparadores',
    description: 'Inicia o fluxo ao receber um payload HTTP externo',
    icon: <Zap className="w-4 h-4 text-amber-500 dark:text-amber-400" />,
    output: { handle: 'output', label: 'payload', type: 'JSON' },
  },
  {
    type: 'trigger',
    label: 'Disparador Manual',
    category: 'Disparadores',
    description: 'Inicia a execução via clique ou teste do operador',
    icon: <Zap className="w-4 h-4 text-amber-500 dark:text-amber-400" />,
    output: { handle: 'output', label: 'payload', type: 'JSON' },
  },
  {
    type: 'trigger',
    label: 'Disparo Agendado (Cron)',
    category: 'Disparadores',
    description: 'Dispara a execução recorrente com base em expressão cron (ex: a cada 15 min)',
    icon: <Clock className="w-4 h-4 text-amber-500 dark:text-amber-400" />,
    output: { handle: 'output', label: 'payload', type: 'JSON' },
  },
  // Modelos de IA & Agentes
  {
    type: 'ai_model',
    label: 'Google Gemini Flash',
    category: 'Modelos de IA',
    description: 'Processamento multimodal avançado, raciocínio e síntese de respostas',
    icon: <Sparkles className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />,
    inputs: [{ handle: 'prompt', label: 'prompt', type: 'Texto' }],
    output: { handle: 'output', label: 'output', type: 'Texto' },
  },
  {
    type: 'sub_agent',
    label: 'Sub-Agente (Composição)',
    category: 'Modelos de IA',
    description: 'Executa outro agente corporativo como sub-rotina reutilizável',
    icon: <Layers className="w-4 h-4 text-violet-500 dark:text-violet-400" />,
    inputs: [{ handle: 'input', label: 'parâmetros', type: 'JSON' }],
    output: { handle: 'output', label: 'resultado', type: 'JSON' },
  },
  // Documentos & RAG
  {
    type: 'rag',
    label: 'Buscar em Documentos (RAG)',
    category: 'Base de Conhecimento',
    description: 'Recupera trechos contextuais da base vetorial preci.',
    icon: <FileSearch className="w-4 h-4 text-purple-500 dark:text-purple-400" />,
    inputs: [{ handle: 'query', label: 'query', type: 'Texto' }],
    output: { handle: 'output', label: 'output', type: 'Contexto' },
  },
  // Lógica & Decisão
  {
    type: 'condition',
    label: 'Condição Se / Senão',
    category: 'Lógica & Decisão',
    description: 'Avalia o valor de entrada e bifurca a rota em Verdadeiro ou Falso',
    icon: <GitBranch className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />,
    inputs: [{ handle: 'value', label: 'value', type: 'Qualquer' }],
    output: { handle: 'output', label: 'true / false', type: 'Booleano' },
  },
  {
    type: 'loop',
    label: 'Loop / Iterador',
    category: 'Lógica & Decisão',
    description: 'Itera sobre um array executando sub-fluxo com teto seguro de 50 iterações',
    icon: <Repeat className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />,
    inputs: [{ handle: 'input', label: 'lista / array', type: 'Array' }],
    output: { handle: 'loop_complete', label: 'concluído', type: 'Array' },
  },
  {
    type: 'human_approval',
    label: 'Aprovação Humana',
    category: 'Lógica & Decisão',
    description: 'Pausa o workflow e aguarda aprovação manual de um operador ou administrador',
    icon: <UserCheck className="w-4 h-4 text-amber-500 dark:text-amber-400" />,
    inputs: [{ handle: 'input', label: 'dados', type: 'Qualquer' }],
    output: { handle: 'output', label: 'aprovado', type: 'Qualquer' },
  },
  // Comunicação & Relatórios
  {
    type: 'report_generator',
    label: 'Gerador de Relatórios Corporativos',
    category: 'Comunicação & Relatórios',
    description: 'Formata dados de IA ou RAG em relatórios HTML estruturados',
    icon: <FileText className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />,
    inputs: [{ handle: 'raw_data', label: 'raw_data', type: 'Texto' }],
    output: { handle: 'output', label: 'output', type: 'HTML' },
  },
  {
    type: 'email_sender',
    label: 'Disparador de E-mail (SMTP)',
    category: 'Comunicação & Relatórios',
    description: 'Envia e-mails corporativos via SMTP com suporte a HTML e modo sandbox',
    icon: <Mail className="w-4 h-4 text-sky-500 dark:text-sky-400" />,
    inputs: [{ handle: 'body', label: 'body', type: 'HTML' }],
    output: { handle: 'output', label: 'output', type: 'JSON' },
  },
  // Integrações & Ações
  {
    type: 'http_request',
    label: 'Requisição HTTP / API',
    category: 'Integrações & Ações',
    description: 'Envia dados via GET/POST para sistemas e endpoints externos',
    icon: <Globe className="w-4 h-4 text-blue-500 dark:text-blue-400" />,
    inputs: [{ handle: 'body', label: 'body', type: 'JSON' }],
    output: { handle: 'output', label: 'output', type: 'JSON' },
  },
  {
    type: 'action',
    label: 'Enviar Alerta Slack / Notificação',
    category: 'Integrações & Ações',
    description: 'Dispara aviso para canal ou equipe interna',
    icon: <Send className="w-4 h-4 text-rose-500 dark:text-rose-400" />,
    inputs: [{ handle: 'message', label: 'message', type: 'Texto' }],
    output: { handle: 'output', label: 'output', type: 'JSON' },
  },
];

export const NodeDrawer: React.FC = () => {
  const { isDrawerOpen, setDrawerOpen, addNode } = useAgentStore();

  const categories = Array.from(new Set(AVAILABLE_NODES.map((n) => n.category)));

  return (
    <AnimatePresence>
      {isDrawerOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm"
        >
          <motion.div
            initial={{ x: '100%', opacity: 0.7 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.7 }}
            transition={{ type: 'spring', damping: 32, stiffness: 280, mass: 0.85 }}
            onClick={(e) => e.stopPropagation()}
            className="w-[400px] sm:w-[420px] max-w-[95vw] h-full bg-white dark:bg-[#1A1A1A] border-l border-neutral-200 dark:border-neutral-800 p-5 flex flex-col shadow-2xl text-neutral-900 dark:text-[#F5F5F5] transition-colors duration-200 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
              <div>
                <h3 className="font-semibold text-sm tracking-tight text-neutral-900 dark:text-white">Catálogo de Nós</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Conexão direta por cabos entre portas de entrada e saída
                </p>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Categorized List with subtle entrance animation */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.26, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 overflow-y-auto py-4 space-y-5 pr-2.5 pl-0.5"
            >
              {categories.map((cat) => (
                <div key={cat}>
                  <div className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
                    {cat}
                  </div>
                  <div className="space-y-2">
                    {AVAILABLE_NODES.filter((n) => n.category === cat).map((node, idx) => (
                      <motion.button
                        key={idx}
                        whileTap={{ scale: 0.985 }}
                        transition={{ duration: 0.12 }}
                        onClick={() => addNode(node.type, node.label)}
                        className="w-full text-left p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800/80 bg-neutral-50 dark:bg-neutral-900/60 hover:bg-neutral-100 dark:hover:bg-neutral-800/90 hover:border-neutral-400 dark:hover:border-neutral-600 hover:shadow-sm transition-all flex flex-col gap-2 group cursor-pointer"
                      >
                        <div className="flex items-start gap-3 w-full">
                          <div className="p-2 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700/80 group-hover:border-neutral-300 dark:group-hover:border-neutral-600 shrink-0 transition-colors shadow-sm">
                            {node.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-black dark:group-hover:text-white transition-colors">
                              {node.label}
                            </div>
                            <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-snug">
                              {node.description}
                            </div>
                          </div>
                        </div>

                        {/* I/O Handles Specs Pill */}
                        <div className="flex items-center gap-1.5 pt-1 border-t border-neutral-200/60 dark:border-neutral-800/60 text-[10px] flex-wrap">
                          {node.inputs && node.inputs.length > 0 ? (
                            node.inputs.map((inp, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-neutral-200/80 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-mono"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                in:{inp.handle}
                              </span>
                            ))
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-neutral-200/60 dark:bg-neutral-800/60 text-neutral-500 dark:text-neutral-400">
                              Disparo inicial
                            </span>
                          )}

                          <ArrowRight className="w-2.5 h-2.5 text-neutral-400 shrink-0" />

                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-neutral-200/80 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-mono">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            out:{node.output.handle}
                          </span>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
