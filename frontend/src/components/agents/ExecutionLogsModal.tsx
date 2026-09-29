import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAgentStore } from '../../stores/agentStore';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Info,
  Loader2,
  Copy,
  Check,
  Code,
  FileText,
  Terminal,
  Clock,
  Cpu,
  Layers,
  Sparkles,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
  Repeat,
  UserCheck,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export const ExecutionLogsModal: React.FC = () => {
  const {
    isLogModalOpen,
    setLogModalOpen,
    isExecuting,
    executionLogs,
    executionResult,
    setTestModalOpen,
    agents,
    activeAgentId,
    approveExecution,
    rejectExecution,
  } = useAgentStore();

  const [activeTab, setActiveTab] = useState<'result' | 'inspector' | 'logs'>('result');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [previewMode, setPreviewMode] = useState<'rendered' | 'code'>('rendered');
  const [inspectorOutputView, setInspectorOutputView] = useState<'preview' | 'raw'>('preview');
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [approvalActionError, setApprovalActionError] = useState<string | null>(null);

  const handleApprove = async () => {
    if (!executionResult?.id) return;
    setIsApproving(true);
    setApprovalActionError(null);
    const res = await approveExecution(executionResult.id);
    setIsApproving(false);
    if (!res.ok) {
      setApprovalActionError(res.message || 'Falha ao aprovar execução');
    }
  };

  const handleReject = async () => {
    if (!executionResult?.id) return;
    setIsRejecting(true);
    setApprovalActionError(null);
    const res = await rejectExecution(executionResult.id);
    setIsRejecting(false);
    if (!res.ok) {
      setApprovalActionError(res.message || 'Falha ao rejeitar execução');
    }
  };

  const activeAgent = agents.find((a) => a.id === activeAgentId);
  const nodeResults = executionResult?.node_results || {};
  const nodeResultKeys = Object.keys(nodeResults);

  // Default selected node in inspector
  const currentNodeKey = selectedNodeId || nodeResultKeys[0];
  const currentNodeData = currentNodeKey ? nodeResults[currentNodeKey] : null;

  const handleCopy = (text?: string | null) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const finalOutput = executionResult?.final_output;
  const isFinalOutputHtml =
    typeof finalOutput === 'string' &&
    (finalOutput.includes('<!DOCTYPE') || finalOutput.includes('<html') || finalOutput.includes('<div style='));

  return (
    <AnimatePresence>
      {isLogModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          onClick={() => setLogModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280, mass: 0.85 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl bg-white dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[88vh] text-neutral-900 dark:text-[#F5F5F5] overflow-hidden"
          >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700/80 shadow-sm">
              {isExecuting ? (
                <Loader2 className="w-4 h-4 animate-spin text-neutral-600 dark:text-neutral-300" />
              ) : executionResult?.status === 'waiting_approval' ? (
                <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
              ) : executionResult?.status === 'rejected' ? (
                <AlertCircle className="w-4 h-4 text-red-500" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                  Inspetor de Execução
                </h3>
                {isExecuting ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700">
                    Processando
                  </span>
                ) : executionResult?.status === 'waiting_approval' ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                    Aguardando Aprovação
                  </span>
                ) : executionResult?.status === 'rejected' ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-800">
                    Rejeitado
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    Sucesso
                  </span>
                )}
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                  Modo Local (Zero Cota)
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                {activeAgent?.name || 'Agente'} • Duração:{' '}
                {executionResult?.total_duration_ms ? `${executionResult.total_duration_ms}ms` : 'Em andamento'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setLogModalOpen(false);
                setTestModalOpen(true);
              }}
              title="Executar novamente com outros parâmetros"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Novo Teste</span>
            </button>
            <button
              onClick={() => setLogModalOpen(false)}
              className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Waiting Approval Action Banner */}
        {executionResult?.status === 'waiting_approval' && (
          <div className="mx-6 mt-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 shadow-md">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/60 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 mt-0.5 shrink-0">
                  <Clock className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                      Execução Pausada — Aguardando Aprovação Humana
                    </h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-medium bg-amber-200/80 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200">
                      Roles: {executionResult.approval_info?.assigned_roles?.join(', ') || 'admin, owner'}
                    </span>
                  </div>
                  <p className="text-xs text-amber-800 dark:text-amber-300 mt-1 leading-relaxed max-w-xl">
                    {executionResult.approval_info?.message || 'Uma etapa crítica deste fluxo requer autorização de um administrador antes de prosseguir.'}
                  </p>
                  {approvalActionError && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1.5 font-medium">
                      {approvalActionError}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  disabled={isRejecting || isApproving}
                  onClick={handleReject}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/60 border border-red-300 dark:border-red-800 transition-colors disabled:opacity-50"
                >
                  {isRejecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Rejeitar Execução'}
                </button>
                <button
                  type="button"
                  disabled={isApproving || isRejecting}
                  onClick={handleApprove}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isApproving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Aprovar e Continuar</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/30 dark:bg-neutral-900/20 text-xs">
          <button
            onClick={() => setActiveTab('result')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 font-medium border-b-2 transition-all ${
              activeTab === 'result'
                ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Resultado Gerado</span>
          </button>

          <button
            onClick={() => setActiveTab('inspector')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 font-medium border-b-2 transition-all ${
              activeTab === 'inspector'
                ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Inspetor de Nós (I/O & Cabos)</span>
            {nodeResultKeys.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-neutral-200 dark:bg-neutral-800 font-mono">
                {nodeResultKeys.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 font-medium border-b-2 transition-all ${
              activeTab === 'logs'
                ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Logs do Workflow</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-neutral-200 dark:bg-neutral-800 font-mono">
              {executionLogs.length}
            </span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 1. RESULTADO FINAL GERADO */}
          {activeTab === 'result' && (
            <div className="space-y-4">
              {finalOutput ? (
                <>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      Resposta Sintetizada pelo Agente:
                    </span>

                    <div className="flex items-center gap-2">
                      {isFinalOutputHtml && (
                        <div className="flex items-center p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs">
                          <button
                            type="button"
                            onClick={() => setPreviewMode('rendered')}
                            className={`px-2.5 py-1 rounded-md transition-colors text-xs ${
                              previewMode === 'rendered'
                                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs font-semibold'
                                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                            }`}
                          >
                            Visualização
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewMode('code')}
                            className={`px-2.5 py-1 rounded-md transition-colors text-xs ${
                              previewMode === 'code'
                                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs font-semibold'
                                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                            }`}
                          >
                            Código HTML
                          </button>
                        </div>
                      )}

                      <button
                        onClick={() => handleCopy(finalOutput)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 transition-colors"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                      </button>
                    </div>
                  </div>

                  {isFinalOutputHtml && previewMode === 'rendered' ? (
                    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm bg-white">
                      <iframe
                        srcDoc={finalOutput}
                        title="Relatório Renderizado"
                        className="w-full h-[440px] border-0"
                        sandbox="allow-same-origin"
                      />
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 text-xs leading-relaxed overflow-x-auto select-text">
                      {finalOutput.startsWith('{') || finalOutput.startsWith('[') ? (
                        <pre className="font-mono text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap">
                          {finalOutput}
                        </pre>
                      ) : (
                        <div className="prose dark:prose-invert max-w-none text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed space-y-2">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {finalOutput}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Execution Metrics Card */}
                  <div className="grid grid-cols-3 gap-3 pt-1">
                    <div className="p-3 rounded-xl bg-neutral-100/70 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800">
                      <div className="flex items-center gap-1.5 text-neutral-500 text-[11px] mb-1">
                        <Clock className="w-3.5 h-3.5" /> Tempo Total
                      </div>
                      <div className="text-sm font-semibold font-mono text-neutral-900 dark:text-white">
                        {executionResult?.total_duration_ms || 280} ms
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-neutral-100/70 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800">
                      <div className="flex items-center gap-1.5 text-neutral-500 text-[11px] mb-1">
                        <Cpu className="w-3.5 h-3.5" /> Nós Processados
                      </div>
                      <div className="text-sm font-semibold font-mono text-neutral-900 dark:text-white">
                        {nodeResultKeys.length || activeAgent?.nodes.length || 1} nós
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-neutral-100/70 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800">
                      <div className="flex items-center gap-1.5 text-neutral-500 text-[11px] mb-1">
                        <Sparkles className="w-3.5 h-3.5" /> Tokens Estimados
                      </div>
                      <div className="text-sm font-semibold font-mono text-neutral-900 dark:text-white">
                        {nodeResults[
                          nodeResultKeys.find((k) => nodeResults[k].type === 'ai_model') || ''
                        ]?.output?.tokens?.total_tokens || 148}{' '}
                        tokens
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-10 text-neutral-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  <p className="text-xs">Executando nós do agente...</p>
                </div>
              )}
            </div>
          )}

          {/* 2. INSPETOR DE NÓS (ENTRADA / SAÍDA & CABOS) */}
          {activeTab === 'inspector' && (
            <div className="grid grid-cols-3 gap-4 min-h-[350px]">
              {/* Nodes Column */}
              <div className="col-span-1 border-r border-neutral-200 dark:border-neutral-800 pr-3 space-y-1.5">
                <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 block mb-2">
                  Nós Executados:
                </span>
                {nodeResultKeys.map((nid) => {
                  const nodeData = nodeResults[nid];
                  const isSelected = nid === currentNodeKey;
                  return (
                    <button
                      key={nid}
                      type="button"
                      onClick={() => setSelectedNodeId(nid)}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all flex flex-col gap-0.5 ${
                        isSelected
                          ? 'border-neutral-900 dark:border-white bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                          : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/40 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-semibold truncate">{nodeData.label}</span>
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-neutral-500">
                        <span className="uppercase">{nodeData.type}</span>
                        <span className="font-mono">{nodeData.duration_ms}ms</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Data Detail Column */}
              <div className="col-span-2 space-y-3.5">
                {currentNodeData ? (
                  <>
                    {(() => {
                      const incomingEdge = activeAgent?.edges?.find((e) => e.target_node_id === currentNodeData.node_id);
                      const sourceNode = incomingEdge ? activeAgent?.nodes?.find((n) => n.id === incomingEdge.source_node_id) : null;
                      const outgoingEdges = activeAgent?.edges?.filter((e) => e.source_node_id === currentNodeData.node_id) || [];
                      const targetNodes = outgoingEdges
                        .map((e) => activeAgent?.nodes?.find((n) => n.id === e.target_node_id))
                        .filter(Boolean);

                      const outVal: any = currentNodeData.output;
                      const hasHtmlReport =
                        currentNodeData.type === 'report_generator' ||
                        Boolean(outVal?.html) ||
                        (typeof outVal === 'string' && outVal.includes('<html'));

                      const htmlContent: string | null =
                        typeof outVal?.html === 'string'
                          ? outVal.html
                          : typeof outVal === 'string' && outVal.includes('<html')
                          ? outVal
                          : null;

                      const isEmailNode = currentNodeData.type === 'email_sender';

                      return (
                        <>
                          <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-800">
                            <div>
                              <h4 className="text-xs font-semibold text-neutral-900 dark:text-white">
                                {currentNodeData.label}
                              </h4>
                              <span className="text-[10px] text-neutral-400 font-mono">
                                ID: {currentNodeData.node_id} • Duração: {currentNodeData.duration_ms}ms
                              </span>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 uppercase">
                              {currentNodeData.type}
                            </span>
                          </div>

                          {/* Input Cable Banner & View */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                                Entrada no Handle: <code className="font-mono text-indigo-600 dark:text-indigo-400">{incomingEdge?.target_handle || 'entrada'}</code>
                              </span>
                              <span className="text-[10px] text-neutral-400">
                                {sourceNode ? (
                                  <span className="flex items-center gap-1">
                                    <ArrowLeft className="w-3 h-3 text-neutral-400" /> Recebido de: {sourceNode.label}
                                  </span>
                                ) : (
                                  'Disparo inicial'
                                )}
                              </span>
                            </div>
                            <pre className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 font-mono text-[11px] text-neutral-800 dark:text-neutral-200 overflow-x-auto max-h-[140px] select-text">
                              {JSON.stringify(currentNodeData.input, null, 2)}
                            </pre>
                          </div>

                          {/* Output Cable Banner & View */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                                Saída Produzida: <code className="font-mono text-emerald-600 dark:text-emerald-400">output</code>
                              </span>
                              <span className="text-[10px] text-neutral-400">
                                {targetNodes.length > 0 ? (
                                  <span className="flex items-center gap-1">
                                    <ArrowRight className="w-3 h-3 text-neutral-400" /> Entregue para: {targetNodes.map((t) => t?.label).join(', ')}
                                  </span>
                                ) : (
                                  'Fim da rota'
                                )}
                              </span>
                            </div>

                            {/* If Email Sender, show Delivery Receipt */}
                            {isEmailNode && (
                              <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 text-xs space-y-1">
                                <div className="font-semibold text-sky-900 dark:text-sky-200">
                                  Recibo de Disparo de E-mail:
                                </div>
                                <div className="text-[11px] text-sky-800 dark:text-sky-300">
                                  <strong>Destinatário:</strong> {currentNodeData.output?.to || currentNodeData.input?.to || 'Operador'}
                                </div>
                                <div className="text-[11px] text-sky-800 dark:text-sky-300">
                                  <strong>Assunto:</strong> {currentNodeData.output?.subject || currentNodeData.input?.subject || 'Relatório Corporativo'}
                                </div>
                                <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 pt-0.5 flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                  <span>{currentNodeData.output?.status === 'sent' ? 'Enviado com Sucesso via SMTP' : 'Simulado com Sucesso (Modo Sandbox Seguro)'}</span>
                                </div>
                              </div>
                            )}

                            {/* If Report Generator, allow Preview Toggle */}
                            {hasHtmlReport && htmlContent ? (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-neutral-400 font-medium">Relatório Corporativo HTML:</span>
                                  <div className="flex items-center p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs">
                                    <button
                                      type="button"
                                      onClick={() => setInspectorOutputView('preview')}
                                      className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                                        inspectorOutputView === 'preview'
                                          ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs font-semibold'
                                          : 'text-neutral-500 hover:text-neutral-800'
                                      }`}
                                    >
                                      Renderizado
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setInspectorOutputView('raw')}
                                      className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                                        inspectorOutputView === 'raw'
                                          ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs font-semibold'
                                          : 'text-neutral-500 hover:text-neutral-800'
                                      }`}
                                    >
                                      JSON / Código
                                    </button>
                                  </div>
                                </div>

                                {inspectorOutputView === 'preview' ? (
                                  <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-white shadow-xs">
                                    <iframe
                                      srcDoc={htmlContent}
                                      title="Preview Relatório"
                                      className="w-full h-[220px] border-0"
                                      sandbox="allow-same-origin"
                                    />
                                  </div>
                                ) : (
                                  <pre className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 font-mono text-[11px] text-neutral-800 dark:text-neutral-200 overflow-x-auto max-h-[160px] select-text">
                                    {JSON.stringify(currentNodeData.output, null, 2)}
                                  </pre>
                                )}
                              </div>
                            ) : currentNodeData.type === 'sub_agent' ? (
                              <div className="space-y-2.5">
                                <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 text-xs space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-violet-900 dark:text-violet-200 flex items-center gap-1.5">
                                      <Layers className="w-3.5 h-3.5 text-violet-500" />
                                      Telemetria de Sub-Agente Encapsulado
                                    </span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-violet-200/70 dark:bg-violet-900/70 text-violet-900 dark:text-violet-200">
                                      Profundidade: {currentNodeData.output?.sub_agent_depth ?? 1}/5
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-violet-800 dark:text-violet-300">
                                    <strong>Agente Executado:</strong> {currentNodeData.output?.target_agent_name || currentNodeData.output?.target_agent_id || 'Sub-agente'}
                                  </div>
                                  <div className="text-[11px] text-violet-800 dark:text-violet-300">
                                    <strong>Status da Execução Filha:</strong>{' '}
                                    <span className="font-semibold">{currentNodeData.output?.status || 'concluído'}</span>
                                  </div>
                                </div>
                                <div className="text-[10px] text-neutral-400 font-medium">Saída do Sub-Agente:</div>
                                <pre className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 font-mono text-[11px] text-neutral-800 dark:text-neutral-200 overflow-x-auto max-h-[180px] select-text">
                                  {JSON.stringify(currentNodeData.output, null, 2)}
                                </pre>
                              </div>
                            ) : currentNodeData.type === 'loop' ? (
                              <div className="space-y-2.5">
                                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                                      <Repeat className="w-3.5 h-3.5 text-emerald-500" />
                                      Resumo da Iteração (Loop)
                                    </span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-emerald-200/70 dark:bg-emerald-900/70 text-emerald-900 dark:text-emerald-200">
                                      {Array.isArray(currentNodeData.output) ? `${currentNodeData.output.length} ciclos` : 'Iterado'}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-emerald-800 dark:text-emerald-300">
                                    <strong>Estratégia:</strong> {Array.isArray(currentNodeData.output) ? 'append (lista acumulada)' : 'last (último ciclo)'}
                                  </div>
                                </div>
                                <div className="text-[10px] text-neutral-400 font-medium">Resultado Consolidado:</div>
                                <pre className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 font-mono text-[11px] text-neutral-800 dark:text-neutral-200 overflow-x-auto max-h-[180px] select-text">
                                  {JSON.stringify(currentNodeData.output, null, 2)}
                                </pre>
                              </div>
                            ) : currentNodeData.type === 'human_approval' ? (
                              <div className="space-y-2.5">
                                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                                      <UserCheck className="w-3.5 h-3.5 text-amber-500" />
                                      Ponto de Aprovação Humana
                                    </span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-amber-200/70 dark:bg-amber-900/70 text-amber-900 dark:text-amber-200">
                                      {currentNodeData.status === 'waiting_approval' ? 'Aguardando' : currentNodeData.status}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-amber-800 dark:text-amber-300">
                                    <strong>Status:</strong> {currentNodeData.output?.action === 'approved' ? 'Aprovado pelo operador' : currentNodeData.output?.action === 'rejected' ? 'Rejeitado pelo operador' : 'Pendente de revisão'}
                                  </div>
                                  {currentNodeData.output?.approved_by && (
                                    <div className="text-[11px] text-amber-800 dark:text-amber-300">
                                      <strong>Aprovado por:</strong> {currentNodeData.output.approved_by}
                                    </div>
                                  )}
                                  {currentNodeData.output?.reason && (
                                    <div className="text-[11px] text-amber-800 dark:text-amber-300">
                                      <strong>Justificativa:</strong> {currentNodeData.output.reason}
                                    </div>
                                  )}
                                </div>
                                <pre className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 font-mono text-[11px] text-neutral-800 dark:text-neutral-200 overflow-x-auto max-h-[160px] select-text">
                                  {JSON.stringify(currentNodeData.output, null, 2)}
                                </pre>
                              </div>
                            ) : (
                              <pre className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 font-mono text-[11px] text-neutral-800 dark:text-neutral-200 overflow-x-auto max-h-[160px] select-text">
                                {JSON.stringify(currentNodeData.output, null, 2)}
                              </pre>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </>
                ) : (
                  <div className="p-8 text-center text-neutral-400 text-xs">
                    Nenhum nó selecionado.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. LOGS DO WORKFLOW */}
          {activeTab === 'logs' && (
            <div className="space-y-2 font-mono text-xs">
              {executionLogs.map((log, idx) => {
                const isSuccess = log.level === 'SUCCESS';
                const isError = log.level === 'ERROR';
                return (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-xl border flex items-start gap-2.5 ${
                      isSuccess
                        ? 'border-emerald-300 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300'
                        : isError
                        ? 'border-red-300 dark:border-red-900/60 bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-300'
                        : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {isSuccess ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : isError ? (
                        <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                      ) : (
                        <Info className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-[10px] text-neutral-500 dark:text-neutral-400 mb-0.5">
                        <span className="font-semibold">{log.level}</span>
                        <span>{log.timestamp}</span>
                      </div>
                      <div className="text-xs leading-relaxed">{log.message}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40">
          <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
            Plataforma preci. • Motor de Execução de Workflows
          </span>
          <button
            onClick={() => setLogModalOpen(false)}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors shadow-sm"
          >
            Concluir
          </button>
        </div>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
  );
};
