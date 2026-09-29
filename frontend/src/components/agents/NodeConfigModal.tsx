import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAgentStore } from '../../stores/agentStore';
import { useDocStore } from '../../stores/docStore';
import { useThemeStore } from '../../stores/themeStore';
import {
  X,
  Trash2,
  Check,
  Zap,
  Sparkles,
  GitBranch,
  Send,
  Globe,
  FileSearch,
  FileText,
  Mail,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Copy,
  Plus,
  Sliders,
  HelpCircle,
  Code,
  Key,
  Database,
  ExternalLink,
  Link,
  Unlink,
  ArrowRight,
  ArrowLeft,
  Repeat,
  UserCheck,
  Layers,
  Clock,
} from 'lucide-react';
import { AgentNode } from '../../types';
import { NumberInput } from '../common/NumberInput';
import { ScheduleTimePicker } from './ScheduleTimePicker';

export const NodeConfigModal: React.FC = () => {
  const {
    agents,
    activeAgentId,
    selectedNodeId,
    setSelectedNodeId,
    updateNodeConfig,
    removeNode,
    disconnectHandle,
  } = useAgentStore();
  const { folders } = useDocStore();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const getSliderProgressStyle = (val: number, min: number, max: number) => {
    const pct = Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
    if (isDark) {
      return {
        background: `linear-gradient(to right, #FFFFFF 0%, #FFFFFF ${pct}%, #2E2E2E ${pct}%, #2E2E2E 100%)`,
      };
    }
    return {
      background: `linear-gradient(to right, #171717 0%, #171717 ${pct}%, #E5E5E5 ${pct}%, #E5E5E5 100%)`,
    };
  };

  const activeAgent = agents.find((a) => a.id === activeAgentId);
  const selectedNode = activeAgent?.nodes.find((n) => n.id === selectedNodeId);

  // Active handle connections (cables) to/from this node
  const incomingEdges = activeAgent?.edges?.filter((e) => e.target_node_id === selectedNodeId) || [];
  const outgoingEdges = activeAgent?.edges?.filter((e) => e.source_node_id === selectedNodeId) || [];

  // Local state for editing
  const [label, setLabel] = useState('');
  const [config, setConfig] = useState<Record<string, any>>({});
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showSmtpAdvanced, setShowSmtpAdvanced] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);

  // Sync state whenever selectedNode changes
  useEffect(() => {
    if (selectedNode) {
      setLabel(selectedNode.label || '');
      setConfig(selectedNode.config || {});
      setSaveSuccess(false);
    }
  }, [selectedNode]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedNodeId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSelectedNodeId]);

  const nodeType = selectedNode?.type || '';
  const nodeLabelLower = (selectedNode?.label || '').toLowerCase();

  // Detect exact node specialization
  const isScheduleTrigger =
    nodeType === 'trigger' && (nodeLabelLower.includes('cron') || nodeLabelLower.includes('agendad') || config.trigger_type === 'schedule');
  const isWebhookTrigger =
    nodeType === 'trigger' && !isScheduleTrigger && (nodeLabelLower.includes('webhook') || config.trigger_type === 'webhook');
  const isManualTrigger = nodeType === 'trigger' && !isWebhookTrigger && !isScheduleTrigger;
  const isAiModel = nodeType === 'ai_model';
  const isCondition = nodeType === 'condition';
  const isReportGenerator = nodeType === 'report_generator';
  const isEmailSender = nodeType === 'email_sender';
  const isRagAction =
    nodeType === 'rag' ||
    (nodeType === 'action' &&
      (nodeLabelLower.includes('document') || nodeLabelLower.includes('rag') || config.action_type === 'rag'));
  const isHttpRequest = nodeType === 'http_request';
  const isLoop = nodeType === 'loop';
  const isHumanApproval = nodeType === 'human_approval';
  const isSubAgent = nodeType === 'sub_agent';
  const isSlackNotification = nodeType === 'action' && !isRagAction && !isReportGenerator && !isEmailSender;

  const getConnectedSource = (targetHandle: string) => {
    const edge = incomingEdges.find(
      (e) => (e.target_handle || (isAiModel ? 'prompt' : isRagAction ? 'query' : isReportGenerator ? 'raw_data' : isEmailSender ? 'body' : isCondition ? 'value' : isHttpRequest ? 'body' : isLoop || isHumanApproval || isSubAgent ? 'input' : 'message')) === targetHandle
    );
    if (!edge) return null;
    const node = activeAgent?.nodes.find((n) => n.id === edge.source_node_id);
    return { edge, node };
  };

  const handleConfigChange = (key: string, value: any) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!selectedNodeId) return;
    const finalConfig = isAiModel ? { ...config, model: 'gemini-3.6-flash' } : config;
    await updateNodeConfig(selectedNodeId, finalConfig, label);
    setSaveSuccess(true);
    setTimeout(() => {
      setSelectedNodeId(null);
    }, 400);
  };

  const handleDelete = () => {
    if (!selectedNodeId) return;
    removeNode(selectedNodeId);
    setSelectedNodeId(null);
  };

  const getNodeIcon = () => {
    if (isLoop) return <Repeat className="w-5 h-5 text-emerald-400" />;
    if (isHumanApproval) return <UserCheck className="w-5 h-5 text-amber-400" />;
    if (isSubAgent) return <Layers className="w-5 h-5 text-violet-400" />;
    if (isScheduleTrigger) return <Clock className="w-5 h-5 text-cyan-400" />;
    if (isWebhookTrigger || isManualTrigger) return <Zap className="w-5 h-5 text-amber-400" />;
    if (isAiModel) return <Sparkles className="w-5 h-5 text-indigo-400" />;
    if (isCondition) return <GitBranch className="w-5 h-5 text-cyan-400" />;
    if (isReportGenerator) return <FileText className="w-5 h-5 text-emerald-400" />;
    if (isEmailSender) return <Mail className="w-5 h-5 text-sky-400" />;
    if (isHttpRequest) return <Globe className="w-5 h-5 text-blue-400" />;
    if (isRagAction) return <FileSearch className="w-5 h-5 text-purple-400" />;
    return <Send className="w-5 h-5 text-rose-400" />;
  };

  const getNodeTypeBadge = () => {
    if (isLoop) return 'Loop / Iterador';
    if (isHumanApproval) return 'Aprovação Humana';
    if (isSubAgent) return 'Sub-Agente Encapsulado';
    if (isScheduleTrigger) return 'Disparo Agendado (Cron)';
    if (isWebhookTrigger) return 'Disparador Webhook';
    if (isManualTrigger) return 'Disparador Manual';
    if (isAiModel) return 'Inteligência Artificial';
    if (isCondition) return 'Decisão & Condição';
    if (isReportGenerator) return 'Gerador de Relatórios';
    if (isEmailSender) return 'Disparador de E-mail (SMTP)';
    if (isHttpRequest) return 'Integração HTTP / REST';
    if (isRagAction) return 'Busca Semântica RAG';
    return 'Notificação Externa';
  };

  const insertVariable = (targetField: string, variableTag: string) => {
    const currentVal = config[targetField] || '';
    handleConfigChange(targetField, `${currentVal} ${variableTag}`.trim());
  };

  const webhookUrl = selectedNode ? `https://api.preci.company/api/v1/webhooks/${activeAgentId}/${selectedNode.id}` : '';

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <AnimatePresence>
      {selectedNode && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setSelectedNodeId(null)}
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
            className="w-full max-w-2xl max-h-[90vh] bg-white dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700/80 shadow-sm shrink-0">
              {getNodeIcon()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Nome do Nó..."
                  title="Clique para editar o nome do nó"
                  className="px-3.5 py-1.5 text-sm font-semibold rounded-xl bg-white dark:bg-neutral-800/90 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-[#F5F5F5] placeholder:text-neutral-400 dark:placeholder:text-neutral-500 outline-none focus:border-neutral-900 dark:focus:border-white focus:ring-2 focus:ring-neutral-900/20 dark:focus:ring-white/20 shadow-sm hover:border-neutral-400 dark:hover:border-neutral-600 transition-all w-60 sm:w-72"
                />
                <span className="text-[10px] px-2.5 py-1 rounded-xl font-medium bg-neutral-100 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700/80 shadow-sm whitespace-nowrap">
                  {getNodeTypeBadge()}
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 font-mono">
                ID: {selectedNode.id}
              </p>
            </div>
          </div>

          <button
            onClick={() => setSelectedNodeId(null)}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Specialized configuration forms */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-neutral-900 dark:text-[#F5F5F5]">
          {/* I/O CONNECTIONS & HANDLES BANNER */}
          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-semibold text-neutral-900 dark:text-white">
                  Conexões do Nó (Entradas & Saídas)
                </span>
              </div>
              <span className="text-[10px] text-neutral-400 font-mono">
                {incomingEdges.length} entrada(s) • {outgoingEdges.length} saída(s)
              </span>
            </div>

            {/* Incoming connections */}
            {!isWebhookTrigger && !isManualTrigger && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 block">
                  Cabos de Entrada Ativos:
                </span>
                {incomingEdges.length > 0 ? (
                  <div className="space-y-1.5">
                    {incomingEdges.map((edge) => {
                      const srcNode = activeAgent?.nodes.find((n) => n.id === edge.source_node_id);
                      const handleKey = edge.target_handle || (isAiModel ? 'prompt' : isRagAction ? 'query' : isReportGenerator ? 'raw_data' : isEmailSender ? 'body' : isCondition ? 'value' : 'default');
                      return (
                        <div
                          key={edge.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-neutral-800/90 border border-neutral-200 dark:border-neutral-700/80 text-xs shadow-sm"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="px-2 py-0.5 rounded-md font-mono text-[10px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0">
                              porta: {handleKey}
                            </span>
                            <ArrowLeft className="w-3 h-3 text-neutral-400 shrink-0" />
                            <span className="font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                              {srcNode?.label || 'Nó de Origem'}
                            </span>
                            <span className="text-[10px] text-neutral-400 font-mono shrink-0">
                              (out: {edge.source_handle || 'output'})
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => disconnectHandle(selectedNodeId!, handleKey)}
                            title="Desconectar cabo desta porta"
                            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200/60 dark:border-rose-900/50 transition-colors cursor-pointer shrink-0 ml-2"
                          >
                            <Unlink className="w-3 h-3" />
                            <span>Desconectar</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400 bg-white dark:bg-neutral-800/40 p-2.5 rounded-xl border border-neutral-200/60 dark:border-neutral-800/60">
                    Nenhum cabo conectado na entrada. O nó utilizará os valores manuais informados abaixo.
                  </div>
                )}
              </div>
            )}

            {/* Outgoing port info */}
            <div className="pt-2 border-t border-neutral-200/60 dark:border-neutral-800/60 flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 flex-wrap gap-2">
              <span className="flex items-center gap-1.5 font-mono text-[10px] text-neutral-700 dark:text-neutral-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Saída (output): {isCondition ? 'Booleano (true / false)' : isReportGenerator ? 'Documento HTML' : isAiModel ? 'Texto / JSON' : 'Payload'}
              </span>
              <span>
                {outgoingEdges.length > 0 ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    Conectado a {outgoingEdges.length} {outgoingEdges.length === 1 ? 'nó subsequente' : 'nós subsequentes'}
                  </span>
                ) : (
                  <span className="text-neutral-400">Nenhum nó conectado à saída</span>
                )}
              </span>
            </div>
          </div>

          {/* 1. WEBHOOK TRIGGER */}
          {isWebhookTrigger && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  URL de Entrada do Webhook
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={webhookUrl}
                    className="flex-1 px-3 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 font-mono text-neutral-800 dark:text-neutral-300 outline-none"
                  />
                  <button
                    onClick={copyWebhookUrl}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-neutral-900 dark:bg-neutral-200 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-white transition-all shrink-0"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedUrl ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                </div>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 block">
                  Envie requisições HTTP com payload JSON para disparar este fluxo.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Método HTTP Aceito
                  </label>
                  <select
                    value={config.http_method || 'POST'}
                    onChange={(e) => handleConfigChange('http_method', e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500"
                  >
                    <option value="POST">POST (Recomendado)</option>
                    <option value="GET">GET</option>
                    <option value="PUT">PUT</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Código de Resposta Imediata
                  </label>
                  <select
                    value={config.response_status || '200'}
                    onChange={(e) => handleConfigChange('response_status', e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500"
                  >
                    <option value="200">200 OK</option>
                    <option value="201">201 Created</option>
                    <option value="202">202 Accepted (Assíncrono)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Chave Secreta de Autenticação (Header X-Webhook-Secret)
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Key className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
                    <input
                      type="text"
                      value={config.secret_token || ''}
                      onChange={(e) => handleConfigChange('secret_token', e.target.value)}
                      placeholder="Ex: sec_preci_98f412a8..."
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 font-mono text-neutral-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500"
                    />
                  </div>
                  <button
                    onClick={() =>
                      handleConfigChange(
                        'secret_token',
                        'sec_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
                      )
                    }
                    className="px-3 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors shrink-0"
                  >
                    Gerar Segredo
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Exemplo de Payload de Teste (JSON)
                </label>
                <textarea
                  rows={3}
                  value={config.example_payload || '{\n  "lead_id": 1284,\n  "cliente": "Empresa Alfa",\n  "status": "novo"\n}'}
                  onChange={(e) => handleConfigChange('example_payload', e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-neutral-50 dark:bg-neutral-900/80 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500"
                />
              </div>
            </div>
          )}

          {/* 2. MANUAL TRIGGER */}
          {isManualTrigger && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Instruções para o Operador
                </label>
                <textarea
                  rows={2}
                  value={config.instructions || ''}
                  onChange={(e) => handleConfigChange('instructions', e.target.value)}
                  placeholder="Orientações que aparecem quando o operador disparar este workflow..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Parâmetros de Entrada Pré-definidos
                </label>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block mb-2">
                  Campos que podem ser inseridos antes de executar o teste:
                </span>

                <div className="space-y-2">
                  {(config.parameters || [
                    { name: 'cliente_id', default: '1001' },
                    { name: 'prioridade', default: 'alta' },
                  ]).map((param: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={param.name}
                        onChange={(e) => {
                          const newParams = [...(config.parameters || [{ name: 'cliente_id', default: '1001' }, { name: 'prioridade', default: 'alta' }])];
                          newParams[idx].name = e.target.value;
                          handleConfigChange('parameters', newParams);
                        }}
                        placeholder="Nome da variável"
                        className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 outline-none"
                      />
                      <input
                        type="text"
                        value={param.default}
                        onChange={(e) => {
                          const newParams = [...(config.parameters || [{ name: 'cliente_id', default: '1001' }, { name: 'prioridade', default: 'alta' }])];
                          newParams[idx].default = e.target.value;
                          handleConfigChange('parameters', newParams);
                        }}
                        placeholder="Valor padrão"
                        className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 outline-none"
                      />
                      <button
                        onClick={() => {
                          const newParams = (config.parameters || [{ name: 'cliente_id', default: '1001' }, { name: 'prioridade', default: 'alta' }]).filter((_: any, i: number) => i !== idx);
                          handleConfigChange('parameters', newParams);
                        }}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  <button
                    onClick={() => {
                      const newParams = [...(config.parameters || [{ name: 'cliente_id', default: '1001' }, { name: 'prioridade', default: 'alta' }]), { name: '', default: '' }];
                      handleConfigChange('parameters', newParams);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-neutral-900 dark:text-neutral-100 hover:text-neutral-600 dark:hover:text-neutral-300 font-medium hover:underline pt-1"
                  >
                    <Plus className="w-3 h-3" /> Adicionar parâmetro
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-neutral-800 dark:text-neutral-200">
                  <input
                    type="checkbox"
                    checked={Boolean(config.require_confirmation ?? true)}
                    onChange={(e) => handleConfigChange('require_confirmation', e.target.checked)}
                    className="w-4 h-4 rounded text-neutral-900 dark:text-neutral-100 accent-neutral-900 dark:accent-neutral-100 focus:ring-neutral-400 dark:focus:ring-neutral-500 border-neutral-300 dark:border-neutral-700 cursor-pointer"
                  />
                  <span>Exigir confirmação do operador antes do disparo</span>
                </label>
              </div>
            </div>
          )}

          {/* 3. GOOGLE GEMINI AI MODEL */}
          {isAiModel && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Formato da Saída
                </label>
                <select
                  value={config.output_format || 'markdown'}
                  onChange={(e) => handleConfigChange('output_format', e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500"
                >
                  <option value="markdown">Markdown Livre / Texto</option>
                  <option value="json">JSON Estruturado</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Instrução do Sistema (System Instruction / Persona)
                </label>
                <textarea
                  rows={2}
                  value={config.system_instruction || ''}
                  onChange={(e) => handleConfigChange('system_instruction', e.target.value)}
                  placeholder="Ex: Você é um analista executivo focado em extrair dados de clientes e sintetizar relatórios corporativos..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500"
                />
              </div>

              <div>
                {(() => {
                  const conn = getConnectedSource('prompt');
                  return conn ? (
                    <div className="mb-2 p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                        <span className="text-indigo-950 dark:text-indigo-200 font-medium">
                          Porta <strong>prompt</strong> alimentada por: <strong>{conn.node?.label || 'Nó de Origem'}</strong>
                        </span>
                      </div>
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono">Entrada direta</span>
                    </div>
                  ) : null;
                })()}

                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Instrução / Prompt do Modelo
                  </label>
                  <span className="text-[10px] text-neutral-400">
                    {getConnectedSource('prompt') ? 'Valor manual atuará como fallback' : 'Entrada manual'}
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={config.user_prompt || ''}
                  onChange={(e) => handleConfigChange('user_prompt', e.target.value)}
                  placeholder="Instrua o modelo sobre o que fazer com os dados recebidos. Quando o cabo estiver conectado, ele alimentará o prompt diretamente..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500 leading-relaxed font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      Temperatura: {config.temperature ?? 0.7}
                    </label>
                    <span className="text-[10px] text-neutral-500">
                      {(config.temperature ?? 0.7) < 0.4 ? 'Preciso' : (config.temperature ?? 0.7) > 0.7 ? 'Criativo' : 'Equilibrado'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={config.temperature ?? 0.7}
                    onChange={(e) => handleConfigChange('temperature', parseFloat(e.target.value))}
                    style={getSliderProgressStyle(config.temperature ?? 0.7, 0, 1)}
                    className="preci-slider"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Tokens Máximos de Resposta
                  </label>
                  <select
                    value={config.max_tokens || 2048}
                    onChange={(e) => handleConfigChange('max_tokens', parseInt(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500"
                  >
                    <option value={1024}>1024 tokens (~750 palavras)</option>
                    <option value={2048}>2048 tokens (~1500 palavras)</option>
                    <option value={4096}>4096 tokens (~3000 palavras)</option>
                    <option value={8192}>8192 tokens (Completo)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* 4. CONDITION IF/ELSE */}
          {isCondition && (
            <div className="space-y-4">
              <div>
                {(() => {
                  const conn = getConnectedSource('value');
                  return conn ? (
                    <div className="mb-2 p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/80 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></span>
                        <span className="text-cyan-950 dark:text-cyan-200 font-medium">
                          Porta <strong>value</strong> conectada a: <strong>{conn.node?.label || 'Nó de Origem'}</strong>
                        </span>
                      </div>
                      <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-mono">Entrada direta</span>
                    </div>
                  ) : null;
                })()}

                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Campo ou Valor de Entrada a Testar
                </label>
                <input
                  type="text"
                  value={config.field || config.value || ''}
                  onChange={(e) => {
                    handleConfigChange('field', e.target.value);
                    handleConfigChange('value', e.target.value);
                  }}
                  placeholder="Valor avaliado na condição (alimentado pelo cabo ou inserido manualmente)..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 font-mono text-neutral-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Operador de Comparação
                  </label>
                  <select
                    value={config.operator || 'equals'}
                    onChange={(e) => handleConfigChange('operator', e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500"
                  >
                    <option value="equals">Igual a (==)</option>
                    <option value="not_equals">Diferente de (!=)</option>
                    <option value="contains">Contém texto (contains)</option>
                    <option value="greater_than">Maior que (&gt;)</option>
                    <option value="less_than">Menor que (&lt;)</option>
                    <option value="is_not_empty">Está preenchido (não vazio)</option>
                    <option value="is_empty">Está vazio</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Valor Esperado
                  </label>
                  <input
                    type="text"
                    value={config.value || ''}
                    onChange={(e) => handleConfigChange('value', e.target.value)}
                    placeholder="Ex: aprovado ou 100"
                    disabled={config.operator === 'is_empty' || config.operator === 'is_not_empty'}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500 disabled:opacity-40"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 text-xs space-y-1.5">
                <div className="font-semibold text-neutral-700 dark:text-neutral-300">
                  Roteamento de Saída:
                </div>
                <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span>Se <strong>Verdadeiro</strong>: Segue pela porta de saída direita para o próximo bloco conectado.</span>
                </div>
                <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  <span>Se <strong>Falso</strong>: Finaliza ou segue para ramificação secundária.</span>
                </div>
              </div>
            </div>
          )}

          {/* 5. RAG / DOCUMENT SEARCH */}
          {isRagAction && (
            <div className="space-y-4">
              <div>
                {(() => {
                  const conn = getConnectedSource('query');
                  return conn ? (
                    <div className="mb-2 p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/80 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
                        <span className="text-purple-950 dark:text-purple-200 font-medium">
                          Porta <strong>query</strong> conectada a: <strong>{conn.node?.label || 'Nó de Origem'}</strong>
                        </span>
                      </div>
                      <span className="text-[10px] text-purple-600 dark:text-purple-400 font-mono">Entrada direta</span>
                    </div>
                  ) : null;
                })()}

                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Consulta de Busca Semântica (Query)
                  </label>
                  <span className="text-[10px] text-neutral-400">
                    {getConnectedSource('query') ? 'Valor manual atuará como fallback' : 'Entrada manual'}
                  </span>
                </div>
                <input
                  type="text"
                  value={config.search_query || ''}
                  onChange={(e) => handleConfigChange('search_query', e.target.value)}
                  placeholder="Termos de busca ou pergunta para pesquisa nos documentos..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 font-mono text-neutral-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Restringir à Pasta de Documentos
                  </label>
                  <select
                    value={config.folder_id || ''}
                    onChange={(e) => handleConfigChange('folder_id', e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500"
                  >
                    <option value="">Todas as Pastas (Geral)</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Quantidade de Chunks (Top K): {config.top_k || 4}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={config.top_k || 4}
                    onChange={(e) => handleConfigChange('top_k', parseInt(e.target.value))}
                    style={getSliderProgressStyle(config.top_k || 4, 1, 10)}
                    className="preci-slider"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Limiar Mínimo de Similaridade: {config.min_similarity || 60}%
                  </label>
                  <span className="text-[10px] text-neutral-400">pgvector cosine score</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="90"
                  step="5"
                  value={config.min_similarity || 60}
                  onChange={(e) => handleConfigChange('min_similarity', parseInt(e.target.value))}
                  style={getSliderProgressStyle(config.min_similarity || 60, 30, 90)}
                  className="preci-slider"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-neutral-800 dark:text-neutral-200">
                  <input
                    type="checkbox"
                    checked={Boolean(config.include_metadata ?? true)}
                    onChange={(e) => handleConfigChange('include_metadata', e.target.checked)}
                    className="w-4 h-4 rounded text-neutral-900 dark:text-neutral-100 accent-neutral-900 dark:accent-neutral-100 focus:ring-neutral-400 dark:focus:ring-neutral-500 border-neutral-300 dark:border-neutral-700 cursor-pointer"
                  />
                  <span>Incluir metadados (nome do arquivo de origem e data) no contexto</span>
                </label>
              </div>
            </div>
          )}

          {/* 6. HTTP REQUEST */}
          {isHttpRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-2">
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Método
                  </label>
                  <select
                    value={config.method || 'POST'}
                    onChange={(e) => handleConfigChange('method', e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500 font-semibold"
                  >
                    <option value="POST">POST</option>
                    <option value="GET">GET</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>

                <div className="col-span-3">
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    URL do Endpoint
                  </label>
                  <input
                    type="text"
                    value={config.url || ''}
                    onChange={(e) => handleConfigChange('url', e.target.value)}
                    placeholder="https://api.seusistema.com/v1/..."
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Headers Personalizados (JSON)
                </label>
                <textarea
                  rows={2}
                  value={config.headers || '{\n  "Content-Type": "application/json",\n  "Authorization": "Bearer {{token}}"\n}'}
                  onChange={(e) => handleConfigChange('headers', e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-neutral-50 dark:bg-neutral-900/80 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500"
                />
              </div>

              {config.method !== 'GET' && (
                <div>
                  {(() => {
                    const conn = getConnectedSource('body');
                    return conn ? (
                      <div className="mb-2 p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                          <span className="text-blue-950 dark:text-blue-200 font-medium">
                            Porta <strong>body</strong> alimentada por: <strong>{conn.node?.label || 'Nó de Origem'}</strong>
                          </span>
                        </div>
                        <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">Entrada direta</span>
                      </div>
                    ) : null;
                  })()}

                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      Corpo da Requisição (Payload JSON)
                    </label>
                    <span className="text-[10px] text-neutral-400">
                      {getConnectedSource('body') ? 'Valor manual atuará como fallback' : 'Entrada manual'}
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={config.body || '{\n  "status": "executado"\n}'}
                    onChange={(e) => handleConfigChange('body', e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-neutral-50 dark:bg-neutral-900/80 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500 leading-relaxed"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Timeout (segundos)
                  </label>
                  <NumberInput
                    min={1}
                    max={120}
                    value={config.timeout || 30}
                    onChange={(val) => handleConfigChange('timeout', val)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Política em caso de Erro
                  </label>
                  <select
                    value={config.on_error || 'stop'}
                    onChange={(e) => handleConfigChange('on_error', e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500"
                  >
                    <option value="stop">Interromper Workflow</option>
                    <option value="continue">Ignorar e Continuar Fluxo</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* 7. SLACK / EXTERNAL NOTIFICATION */}
          {isSlackNotification && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Destino da Notificação
                </label>
                <select
                  value={config.provider || 'slack'}
                  onChange={(e) => handleConfigChange('provider', e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500"
                >
                  <option value="slack">Slack Webhook</option>
                  <option value="discord">Discord Webhook</option>
                  <option value="custom">Webhook HTTP Genérico</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Webhook URL do Destinatário
                </label>
                <input
                  type="text"
                  value={config.webhook_url || ''}
                  onChange={(e) => handleConfigChange('webhook_url', e.target.value)}
                  placeholder="https://hooks.slack.com/services/T.../B.../X..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 font-mono text-neutral-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Canal / Tópico
                  </label>
                  <input
                    type="text"
                    value={config.channel || ''}
                    onChange={(e) => handleConfigChange('channel', e.target.value)}
                    placeholder="Ex: #alertas-vendas"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Nível de Urgência
                  </label>
                  <select
                    value={config.urgency || 'info'}
                    onChange={(e) => handleConfigChange('urgency', e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500"
                  >
                    <option value="info">Informativo (Neutro)</option>
                    <option value="warning">Aviso / Atenção</option>
                    <option value="critical">Crítico / Urgente</option>
                  </select>
                </div>
              </div>

              <div>
                {(() => {
                  const conn = getConnectedSource('message');
                  return conn ? (
                    <div className="mb-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                        <span className="text-rose-950 dark:text-rose-200 font-medium">
                          Porta <strong>message</strong> alimentada por: <strong>{conn.node?.label || 'Nó de Origem'}</strong>
                        </span>
                      </div>
                      <span className="text-[10px] text-rose-600 dark:text-rose-400 font-mono">Entrada direta</span>
                    </div>
                  ) : null;
                })()}

                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Mensagem do Alerta
                  </label>
                  <span className="text-[10px] text-neutral-400">
                    {getConnectedSource('message') ? 'Valor manual atuará como fallback' : 'Entrada manual'}
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={config.message || 'Novo evento processado com sucesso pelo ecossistema preci.'}
                  onChange={(e) => handleConfigChange('message', e.target.value)}
                  placeholder="Escreva a mensagem. Quando conectado via cabo, o texto será transmitido diretamente..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500"
                />
              </div>
            </div>
          )}

          {/* Form: Gerador de Relatórios */}
          {isReportGenerator && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                Formata dados gerados por nós de IA, busca documental RAG ou gatilhos em relatórios corporativos estruturados com o design monocromático da Preci.
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Título do Relatório
                </label>
                <input
                  type="text"
                  value={config.title || ''}
                  onChange={(e) => handleConfigChange('title', e.target.value)}
                  placeholder="Ex: Relatório Executivo Semanal ou Título Personalizado"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Estilo Visual do Documento
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleConfigChange('style', 'executive')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      (config.style || 'executive') === 'executive'
                        ? 'border-neutral-900 dark:border-white bg-neutral-100 dark:bg-neutral-800/90 shadow-sm'
                        : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
                    }`}
                  >
                    <div className="text-xs font-semibold text-neutral-900 dark:text-white">Executivo (Padrão)</div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                      Header escuro, badge de status, bordas refinadas e rodapé institucional.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleConfigChange('style', 'minimal')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      config.style === 'minimal'
                        ? 'border-neutral-900 dark:border-white bg-neutral-100 dark:bg-neutral-800/90 shadow-sm'
                        : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
                    }`}
                  >
                    <div className="text-xs font-semibold text-neutral-900 dark:text-white">Minimalista</div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                      Tipografia limpa de alta densidade, divisórias sutis e leitura direta.
                    </div>
                  </button>
                </div>
              </div>

              <div>
                {(() => {
                  const conn = getConnectedSource('raw_data');
                  return conn ? (
                    <div className="mb-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-emerald-950 dark:text-emerald-200 font-medium">
                          Porta <strong>raw_data</strong> alimentada por: <strong>{conn.node?.label || 'Nó de Origem'}</strong>
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">Entrada direta</span>
                    </div>
                  ) : null;
                })()}

                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Fonte de Dados / Conteúdo Base
                  </label>
                  <span className="text-[10px] text-neutral-400">
                    {getConnectedSource('raw_data') ? 'Valor manual atuará como fallback' : 'Entrada manual'}
                  </span>
                </div>
                <textarea
                  rows={5}
                  value={config.raw_data || ''}
                  onChange={(e) => handleConfigChange('raw_data', e.target.value)}
                  placeholder="Insira o texto base. Quando conectado via cabo na porta raw_data, o valor do nó anterior será consumido automaticamente..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500 font-mono"
                />
              </div>
            </div>
          )}

          {/* Form: Disparador de E-mail (SMTP) */}
          {isEmailSender && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                Envia relatórios e comunicados via SMTP corporativo. Se as credenciais não forem fornecidas, o disparo opera em <strong>Modo Sandbox</strong> seguro simulado.
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Destinatário (Para)
                  </label>
                  <input
                    type="text"
                    value={config.to || ''}
                    onChange={(e) => handleConfigChange('to', e.target.value)}
                    placeholder="diretor@empresa.com ou e-mail de destino"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Assunto do E-mail
                  </label>
                  <input
                    type="text"
                    value={config.subject || ''}
                    onChange={(e) => handleConfigChange('subject', e.target.value)}
                    placeholder="Ex: Relatório Semanal Preci"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500"
                  />
                </div>
              </div>

              <div>
                {(() => {
                  const conn = getConnectedSource('body');
                  return conn ? (
                    <div className="mb-2 p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/80 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></span>
                        <span className="text-sky-950 dark:text-sky-200 font-medium">
                          Porta <strong>body</strong> alimentada por: <strong>{conn.node?.label || 'Nó de Origem'}</strong>
                        </span>
                      </div>
                      <span className="text-[10px] text-sky-600 dark:text-sky-400 font-mono">Entrada direta</span>
                    </div>
                  ) : null;
                })()}

                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Corpo da Mensagem
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.is_html !== false}
                      onChange={(e) => handleConfigChange('is_html', e.target.checked)}
                      className="rounded border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white"
                    />
                    <span>Formatação HTML ativa</span>
                  </label>
                </div>
                <textarea
                  rows={5}
                  value={config.body || ''}
                  onChange={(e) => handleConfigChange('body', e.target.value)}
                  placeholder="Escreva a mensagem. Quando conectado a um nó anterior pelo cabo, o conteúdo fluirá diretamente aqui..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500 font-mono"
                />
              </div>

              {/* Collapsible Advanced SMTP Accordion */}
              <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowSmtpAdvanced(!showSmtpAdvanced)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 bg-neutral-50 dark:bg-neutral-900/60 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center gap-2">
                    <Key className="w-3.5 h-3.5 text-neutral-500" />
                    <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                      Configurações SMTP Avançadas
                    </span>
                  </div>
                  {showSmtpAdvanced ? (
                    <ChevronUp className="w-4 h-4 text-neutral-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-neutral-400" />
                  )}
                </button>

                {showSmtpAdvanced && (
                  <div className="p-3.5 space-y-3 bg-white dark:bg-[#1E1E1E] border-t border-neutral-200 dark:border-neutral-800 animate-in fade-in duration-150">
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Opcional. Se não configurado, o e-mail será simulado em modo sandbox sem erros de conexão.
                    </p>

                    <div className="grid grid-cols-3 gap-2.5">
                      <div className="col-span-2">
                        <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                          Servidor Host SMTP
                        </label>
                        <input
                          type="text"
                          value={config.smtp_host || ''}
                          onChange={(e) => handleConfigChange('smtp_host', e.target.value)}
                          placeholder="smtp.resend.com ou smtp.gmail.com"
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                          Porta
                        </label>
                        <NumberInput
                          size="sm"
                          min={1}
                          max={65535}
                          value={config.smtp_port || 587}
                          onChange={(val) => handleConfigChange('smtp_port', val)}
                          placeholder="587"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                          Usuário SMTP / Login
                        </label>
                        <input
                          type="text"
                          value={config.smtp_user || ''}
                          onChange={(e) => handleConfigChange('smtp_user', e.target.value)}
                          placeholder="apikey ou remetente@empresa.com"
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                          Senha / Token de Acesso
                        </label>
                        <div className="relative">
                          <input
                            type={showSmtpPass ? 'text' : 'password'}
                            value={config.smtp_pass || ''}
                            onChange={(e) => handleConfigChange('smtp_pass', e.target.value)}
                            placeholder="••••••••••••"
                            className="w-full px-2.5 py-1.5 pr-8 text-xs rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSmtpPass(!showSmtpPass)}
                            className="absolute right-2 top-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                          >
                            {showSmtpPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SCHEDULE (CRON) TRIGGER */}
          {isScheduleTrigger && (
            <div className="space-y-4">
              <ScheduleTimePicker
                cronExpression={config.cron_expression || '*/15 * * * *'}
                onChangeCron={(cron) => handleConfigChange('cron_expression', cron)}
                timezone={config.timezone || 'America/Sao_Paulo'}
                onChangeTimezone={(tz) => handleConfigChange('timezone', tz)}
              />

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Payload Inicial / Parâmetros do Agendamento (JSON opcional)
                </label>
                <textarea
                  rows={2}
                  value={config.input || ''}
                  onChange={(e) => handleConfigChange('input', e.target.value)}
                  placeholder='{"origem": "cron_automatico", "tarefa": "relatorio_diario"}'
                  className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 font-mono text-neutral-900 dark:text-neutral-100 outline-none focus:border-neutral-900 dark:focus:border-white transition-colors resize-none"
                />
              </div>
            </div>
          )}

          {/* LOOP NODE */}
          {isLoop && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Campo da Lista / Coleção de Iteração
                </label>
                <input
                  type="text"
                  value={config.input_array_field || ''}
                  onChange={(e) => handleConfigChange('input_array_field', e.target.value)}
                  placeholder="items ou {{rag.results}} ou {{input.lista}}"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 font-mono text-neutral-900 dark:text-neutral-100 outline-none focus:border-neutral-900 dark:focus:border-white transition-colors"
                />
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 block">
                  Identificador do array nos dados de entrada ou nó anterior.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Estratégia de Coleta (Resultados)
                  </label>
                  <select
                    value={config.collect_strategy || 'append'}
                    onChange={(e) => handleConfigChange('collect_strategy', e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none"
                  >
                    <option value="append">Append (Acumular array com todos os ciclos)</option>
                    <option value="last">Last (Manter apenas o resultado do último ciclo)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Limite de Iterações (Máx. 50)
                  </label>
                  <NumberInput
                    variant="stepper"
                    min={1}
                    max={50}
                    value={config.max_iterations || 50}
                    onChange={(val) => handleConfigChange('max_iterations', val)}
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 text-xs space-y-1.5">
                <span className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <Repeat className="w-3.5 h-3.5" />
                  Variáveis Injetadas Automaticamente
                </span>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-relaxed">
                  Dentro do corpo do loop, acesse o item atual com <code className="font-mono font-bold bg-emerald-100 dark:bg-emerald-900/60 px-1 py-0.5 rounded">{'{{loop.item}}'}</code> e o índice da repetição com <code className="font-mono font-bold bg-emerald-100 dark:bg-emerald-900/60 px-1 py-0.5 rounded">{'{{loop.index}}'}</code>. A conexão de retorno para o loop deve possuir o atributo <code className="font-mono">edge_type: 'loop_back'</code> para não violar o DAG.
                </p>
              </div>
            </div>
          )}

          {/* HUMAN APPROVAL NODE */}
          {isHumanApproval && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Mensagem / Instrução para o Revisor Humano
                </label>
                <textarea
                  rows={3}
                  value={config.approval_message || ''}
                  onChange={(e) => handleConfigChange('approval_message', e.target.value)}
                  placeholder="Por favor, revise o valor calculado e aprove o prosseguimento da execução..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none focus:border-neutral-900 dark:focus:border-white transition-colors resize-none"
                />
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 block">
                  Exibida na tela de logs e no painel de aprovação quando o fluxo suspender a execução.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Tempo Limite de Espera (Horas)
                  </label>
                  <NumberInput
                    variant="stepper"
                    min={1}
                    max={72}
                    value={config.timeout_hours || 24}
                    onChange={(val) => handleConfigChange('timeout_hours', val)}
                  />
                  <span className="text-[10px] text-neutral-400 mt-1 block">
                    Entre 1 e 72 horas (padrão: 24h)
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Ação ao Expirar Timeout
                  </label>
                  <select
                    value={config.on_timeout_action || 'auto_reject'}
                    onChange={(e) => handleConfigChange('on_timeout_action', e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none"
                  >
                    <option value="auto_reject">Auto-Rejeitar (Rejeição automática)</option>
                    <option value="auto_approve">Auto-Aprovar (Aprovação automática)</option>
                  </select>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-xs space-y-1.5">
                <span className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5" />
                  Controle de Acesso e Persistência
                </span>
                <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                  Apenas usuários com papéis <strong>admin</strong> ou <strong>owner</strong> podem aprovar ou rejeitar a execução pendente. O estado da execução é congelado no banco e retomado exatamente a partir do nó seguinte após a confirmação.
                </p>
              </div>
            </div>
          )}

          {/* SUB AGENT NODE */}
          {isSubAgent && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Agente Alvo da Mesma Empresa
                </label>
                <select
                  value={config.target_agent_id || ''}
                  onChange={(e) => handleConfigChange('target_agent_id', e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none"
                >
                  <option value="">Selecione o agente para execução aninhada...</option>
                  {(agents || [])
                    .filter((a) => a.id !== activeAgentId)
                    .map((ag) => (
                      <option key={ag.id} value={ag.id}>
                        {ag.name} ({ag.nodes?.length || 0} nós)
                      </option>
                    ))}
                </select>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 block">
                  O agente selecionado será executado de forma isolada, compartilhando o mesmo company_id.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Mapeamento de Parâmetros de Entrada (JSON opcional)
                </label>
                <textarea
                  rows={3}
                  value={config.input_mapping ? (typeof config.input_mapping === 'string' ? config.input_mapping : JSON.stringify(config.input_mapping, null, 2)) : ''}
                  onChange={(e) => handleConfigChange('input_mapping', e.target.value)}
                  placeholder='{"pergunta": "{{input.query}}", "contexto": "{{rag.results}}"}'
                  className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 font-mono text-neutral-900 dark:text-neutral-100 outline-none focus:border-neutral-900 dark:focus:border-white transition-colors resize-none"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-violet-50/60 dark:bg-violet-950/20 border border-violet-200/60 dark:border-violet-900/40 text-xs space-y-1.5">
                <span className="font-semibold text-violet-800 dark:text-violet-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  Prevenção de Recursão e Ciclos
                </span>
                <p className="text-[11px] text-violet-700 dark:text-violet-400 leading-relaxed">
                  O motor Preci Company verifica automaticamente ciclos inter-agentes no salvamento e aplica um limite de profundidade de 5 níveis de recursão para segurança de execução.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40">
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900/50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Excluir Nó</span>
          </button>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setSelectedNodeId(null)}
              className="px-4 py-2 text-xs font-medium rounded-xl text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              Cancelar
            </button>

            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-white shadow-sm active:scale-95 transition-all"
            >
              {saveSuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : null}
              <span>{saveSuccess ? 'Salvo!' : 'Salvar Configurações'}</span>
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
  );
};
