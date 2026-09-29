import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAgentStore } from '../../stores/agentStore';
import { useThemeStore } from '../../stores/themeStore';
import {
  Plus,
  Minus,
  Play,
  Trash2,
  Zap,
  Sparkles,
  GitBranch,
  Send,
  Globe,
  FileSearch,
  FileText,
  Mail,
  Loader2,
  Bot,
  Settings,
  RotateCcw,
  X,
  CheckCircle2,
  AlertTriangle,
  Undo2,
  Redo2,
  Repeat,
  UserCheck,
  Layers,
  Clock,
} from 'lucide-react';
import { AgentNode } from '../../types';
import { NodeConfigModal } from './NodeConfigModal';
import { WorkflowTestModal } from './WorkflowTestModal';
import { NumberInput } from '../common/NumberInput';
import { formatCronHumanReadable } from './ScheduleTimePicker';

export const WorkflowCanvas: React.FC = () => {
  const {
    agents,
    activeAgentId,
    selectedNodeId,
    selectedNodeIds,
    nodeStatuses,
    nodeResults,
    setSelectedNodeId,
    setSelectedNodeIds,
    setDrawerOpen,
    setAiDrawerOpen,
    aiToast,
    setAiToast,
    executeWorkflow,
    setTestModalOpen,
    isTestModalOpen,
    isExecuting,
    executingNodeId,
    removeNode,
    removeNodes,
    addEdge,
    removeEdge,
    disconnectHandle,
    updateNodeConfig,
    updateMultipleNodePositions,
    updateAgentName,
    undo,
    redo,
    recordHistory,
    history,
  } = useAgentStore();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const activeAgent = agents.find((a) => a.id === activeAgentId) || agents[0];
  const containerRef = useRef<HTMLDivElement>(null);

  const activeHistory = history[activeAgent?.id || ''] || { past: [], future: [] };
  const canUndo = activeHistory.past.length > 0;
  const canRedo = activeHistory.future.length > 0;

  const [connectingPort, setConnectingPort] = useState<{
    nodeId: string;
    handleId: string;
    isOutput: boolean;
  } | null>(null);
  const [connectingMousePos, setConnectingMousePos] = useState<{ x: number; y: number } | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const hasDraggedRef = useRef<boolean>(false);

  // Floating Selection Badge State (com retenção da contagem para animação suave de saída)
  const hasSelection = selectedNodeIds.length > 0;
  const [selectionDisplayCount, setSelectionDisplayCount] = useState(selectedNodeIds.length);

  useEffect(() => {
    if (selectedNodeIds.length > 0) {
      setSelectionDisplayCount(selectedNodeIds.length);
    }
  }, [selectedNodeIds.length]);

  // Auto-dismiss AI Toast após 6 segundos
  useEffect(() => {
    if (aiToast) {
      const timer = setTimeout(() => {
        setAiToast(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [aiToast, setAiToast]);

  // Marquee Selector Box State (Seleção em Bloco Estilo Área de Trabalho)
  const [selectionBox, setSelectionBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const isSelectingRef = useRef(false);
  const selectionStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Multi-Node Dragging State
  const dragNodesInitialRef = useRef<{ id: string; startX: number; startY: number }[]>([]);
  const dragMouseStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingNodesRef = useRef(false);

  // Canvas Zoom State (40% a 200%)
  const [zoom, setZoom] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('preci_canvas_zoom');
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 0.4 && val <= 2.0) {
          return val;
        }
      }
    } catch {}
    return 1.0;
  });

  const updateZoom = (newZoom: number) => {
    const clamped = Math.min(2.0, Math.max(0.4, Math.round(newZoom * 10) / 10));
    setZoom(clamped);
    try {
      localStorage.setItem('preci_canvas_zoom', clamped.toString());
    } catch {}
  };

  const zoomIn = () => updateZoom(zoom + 0.1);
  const zoomOut = () => updateZoom(zoom - 0.1);
  const resetZoom = () => updateZoom(1.0);

  // Keyboard Shortcuts (Delete/Backspace para nós selecionados e Zoom)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Se o modal de configuração estiver aberto, deixa o modal gerenciar seus próprios atalhos (como Escape)
      if (selectedNodeId) return;

      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable);

      if (isInput) return;

      // Delete selected nodes
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeIds.length > 0) {
          e.preventDefault();
          removeNodes(selectedNodeIds);
        }
      } else if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (selectedNodeIds.length === 1) {
          e.preventDefault();
          setSelectedNodeId(selectedNodeIds[0]);
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        if (activeAgent && activeAgent.nodes.length > 0) {
          e.preventDefault();
          setSelectedNodeIds(activeAgent.nodes.map((n) => n.id));
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        redo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        zoomIn();
      } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        zoomOut();
      } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        resetZoom();
      } else if (e.key === 'Escape') {
        setSelectedNodeIds([]);
        setSelectedNodeId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeIds, selectedNodeId, zoom, setSelectedNodeId, removeNodes, zoomIn, zoomOut, resetZoom, setSelectedNodeIds, undo, redo, activeAgent]);

  const handleSaveName = () => {
    if (activeAgent && nameValue.trim()) {
      updateAgentName(activeAgent.id, nameValue.trim());
    }
    setIsEditingName(false);
  };

  // Marquee Selection Drag (Iniciado no canvas vazio)
  const handleMouseDownCanvas = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // apenas clique esquerdo

    // Se o modal de configuração de nó ou de teste estiver aberto, não inicia seleção nem limpa
    if (selectedNodeId || isTestModalOpen) {
      return;
    }

    // Não inicia seleção nem desmarcação se o clique for em botões, inputs ou elementos de controle
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('textarea') ||
      target.closest('[data-no-canvas-select]')
    ) {
      return;
    }

    const isModifier = e.ctrlKey || e.metaKey || e.shiftKey;
    const initialSelection = isModifier ? [...selectedNodeIds] : [];
    const startX = e.clientX;
    const startY = e.clientY;
    selectionStartRef.current = { x: startX, y: startY };
    isSelectingRef.current = true;

    const onPointerMove = (ev: PointerEvent) => {
      if (!isSelectingRef.current) return;
      const dx = Math.abs(ev.clientX - startX);
      const dy = Math.abs(ev.clientY - startY);

      if (dx > 4 || dy > 4) {
        setSelectionBox({
          startX,
          startY,
          currentX: ev.clientX,
          currentY: ev.clientY,
        });

        if (!containerRef.current || !activeAgent) return;
        const rect = containerRef.current.getBoundingClientRect();

        const boxScreenLeft = Math.min(startX, ev.clientX);
        const boxScreenRight = Math.max(startX, ev.clientX);
        const boxScreenTop = Math.min(startY, ev.clientY);
        const boxScreenBottom = Math.max(startY, ev.clientY);

        const worldX1 = (boxScreenLeft - rect.left) / zoom;
        const worldX2 = (boxScreenRight - rect.left) / zoom;
        const worldY1 = (boxScreenTop - rect.top) / zoom;
        const worldY2 = (boxScreenBottom - rect.top) / zoom;

        const matchedIds = activeAgent.nodes
          .filter((n) => {
            const nodeLeft = n.position.x;
            const nodeRight = n.position.x + 220;
            const nodeTop = n.position.y;
            const nodeBottom = n.position.y + 90;
            return (
              nodeLeft < worldX2 &&
              nodeRight > worldX1 &&
              nodeTop < worldY2 &&
              nodeBottom > worldY1
            );
          })
          .map((n) => n.id);

        if (isModifier) {
          setSelectedNodeIds(Array.from(new Set([...initialSelection, ...matchedIds])));
        } else {
          setSelectedNodeIds(matchedIds);
        }
      }
    };

    const onPointerUp = (ev: PointerEvent) => {
      isSelectingRef.current = false;
      setSelectionBox(null);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      const dx = Math.abs(ev.clientX - startX);
      const dy = Math.abs(ev.clientY - startY);
      if (dx <= 4 && dy <= 4) {
        // Clique seco no fundo: limpa seleção apenas se não estiver segurando tecla modificadora
        if (!isModifier) {
          setSelectedNodeIds([]);
          setSelectedNodeId(null);
        }
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
  };

  // Node Dragging (Suporta arrastar um único nó ou todos os nós selecionados em conjunto)
  const handleMouseDownNode = (e: React.MouseEvent, node: AgentNode) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    e.preventDefault();

    hasDraggedRef.current = false;
    dragMouseStartRef.current = { x: e.clientX, y: e.clientY };
    isDraggingNodesRef.current = true;

    const isModifier = e.ctrlKey || e.metaKey || e.shiftKey;
    const wasSelected = selectedNodeIds.includes(node.id);

    // Determina quais nós serão movimentados caso ocorra arraste
    let targetSelection = selectedNodeIds;
    if (!wasSelected) {
      targetSelection = isModifier ? [...selectedNodeIds, node.id] : [node.id];
    }

    // Grava as posições iniciais de todos os nós que serão arrastados
    if (!activeAgent) return;
    const nodesToMove = activeAgent.nodes.filter((n) => targetSelection.includes(n.id) || n.id === node.id);
    dragNodesInitialRef.current = nodesToMove.map((n) => ({
      id: n.id,
      startX: n.position.x,
      startY: n.position.y,
    }));

    let rafId: number | null = null;
    let pendingPositions: { id: string; x: number; y: number }[] | null = null;

    const onPointerMove = (ev: PointerEvent) => {
      if (!isDraggingNodesRef.current) return;
      const dx = (ev.clientX - dragMouseStartRef.current.x) / zoom;
      const dy = (ev.clientY - dragMouseStartRef.current.y) / zoom;

      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        if (!hasDraggedRef.current) {
          hasDraggedRef.current = true;
          recordHistory();
          // Ao iniciar o arraste de um nó não selecionado previamente, atualiza a seleção visual
          if (!wasSelected) {
            setSelectedNodeIds(targetSelection);
          }
        }
      }

      pendingPositions = dragNodesInitialRef.current.map((item) => ({
        id: item.id,
        x: Math.round(item.startX + dx),
        y: Math.round(item.startY + dy),
      }));

      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          if (pendingPositions && isDraggingNodesRef.current) {
            updateMultipleNodePositions(pendingPositions);
          }
          rafId = null;
        });
      }
    };

    const onPointerUp = () => {
      isDraggingNodesRef.current = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (pendingPositions) {
        updateMultipleNodePositions(pendingPositions);
      }
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      // Se foi um clique simples sem arraste:
      if (!hasDraggedRef.current) {
        if (isModifier) {
          // Segurando Ctrl / Cmd / Shift: alterna a seleção do nó (liga/desliga)
          if (wasSelected) {
            setSelectedNodeIds(selectedNodeIds.filter((id) => id !== node.id));
          } else {
            setSelectedNodeIds([...selectedNodeIds, node.id]);
          }
        } else {
          // Clique normal sem Ctrl: seleciona exclusivamente este nó
          setSelectedNodeIds([node.id]);
        }
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
  };

  const handleWheelCanvas = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      updateZoom(zoom + delta);
    }
  };

  const CARD_WIDTH = 320;

  // Mapeamento declarativo de posições verticais (Y em pixels) das portas de cada nó
  const TARGET_HANDLE_Y_COORDS: Record<string, Record<string, number>> = {
    ai_model: { prompt: 126 },
    rag: { query: 96 },
    condition: { value: 96 },
    report_generator: { raw_data: 138 },
    email_sender: { to: 96, body: 198 },
    action: { message: 142 },
    http_request: { body: 142 },
    loop: { input: 88 },
    human_approval: { input: 88 },
    sub_agent: { input: 88 },
  };

  // Porta principal de cada nó usada como fallback para conexões legadas sem handle especificado
  const DEFAULT_TARGET_HANDLES: Record<string, string> = {
    ai_model: 'prompt',
    rag: 'query',
    condition: 'value',
    report_generator: 'raw_data',
    email_sender: 'body',
    action: 'message',
    http_request: 'body',
    loop: 'input',
    human_approval: 'input',
    sub_agent: 'input',
  };

  const getTargetHandleY = (node: AgentNode, handleId?: string): number => {
    const target = !handleId || handleId === 'input'
      ? DEFAULT_TARGET_HANDLES[node.type]
      : handleId;

    return TARGET_HANDLE_Y_COORDS[node.type]?.[target] ?? 22;
  };

  const SOURCE_HANDLE_Y_COORDS: Record<string, Record<string, number>> = {
    condition: { true: 120, false: 156 },
    loop: { loop_body: 120, loop_complete: 156 },
  };

  const getSourceHandleY = (node: AgentNode, handleId?: string): number => {
    if (!handleId) return 22;
    return SOURCE_HANDLE_Y_COORDS[node.type]?.[handleId] ?? 22;
  };

  const getConnectedSourceInfo = (targetNodeId: string, targetHandle: string) => {
    if (!activeAgent) return null;
    const edge = activeAgent.edges.find(
      (e) =>
        e.target_node_id === targetNodeId &&
        (e.target_handle === targetHandle ||
          (!e.target_handle && ['prompt', 'query', 'raw_data', 'message', 'body', 'value', 'input'].includes(targetHandle)) ||
          (e.target_handle === 'input' && ['prompt', 'query', 'raw_data', 'message', 'body', 'value', 'input'].includes(targetHandle)))
    );
    if (!edge) return null;
    const srcNode = activeAgent.nodes.find((n) => n.id === edge.source_node_id);
    return {
      edgeId: edge.id,
      sourceNodeId: edge.source_node_id,
      sourceLabel: srcNode?.label || getNodeTypeLabel(srcNode?.type || 'trigger'),
      sourceHandle: edge.source_handle || 'output',
    };
  };

  const handleHandleClick = (e: React.MouseEvent, nodeId: string, handleId: string, isOutput: boolean) => {
    e.stopPropagation();
    if (isOutput) {
      if (connectingPort && connectingPort.nodeId === nodeId && connectingPort.handleId === handleId) {
        setConnectingPort(null);
        setConnectingMousePos(null);
      } else {
        setConnectingPort({ nodeId, handleId, isOutput: true });
      }
    } else {
      if (connectingPort && connectingPort.isOutput && connectingPort.nodeId !== nodeId) {
        addEdge(connectingPort.nodeId, nodeId, connectingPort.handleId, handleId);
        setConnectingPort(null);
        setConnectingMousePos(null);
      }
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent) => {
    if (connectingPort && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const rawX = (e.clientX - rect.left) / zoom;
      const rawY = (e.clientY - rect.top) / zoom;
      setConnectingMousePos({ x: rawX, y: rawY });
    }
  };

  const getNodeIcon = (type: AgentNode['type']) => {
    switch (type) {
      case 'trigger':
        return <Zap className="w-4 h-4 text-amber-400" />;
      case 'ai_model':
        return <Sparkles className="w-4 h-4 text-indigo-400" />;
      case 'condition':
        return <GitBranch className="w-4 h-4 text-cyan-400" />;
      case 'report_generator':
        return <FileText className="w-4 h-4 text-emerald-400" />;
      case 'email_sender':
        return <Mail className="w-4 h-4 text-sky-400" />;
      case 'action':
        return <Send className="w-4 h-4 text-rose-400" />;
      case 'http_request':
        return <Globe className="w-4 h-4 text-blue-400" />;
      case 'loop':
        return <Repeat className="w-4 h-4 text-emerald-400" />;
      case 'human_approval':
        return <UserCheck className="w-4 h-4 text-amber-400" />;
      case 'sub_agent':
        return <Layers className="w-4 h-4 text-violet-400" />;
      default:
        return <FileSearch className="w-4 h-4 text-purple-400" />;
    }
  };

  const getNodeTypeLabel = (type: AgentNode['type']) => {
    switch (type) {
      case 'trigger':
        return 'Disparador';
      case 'ai_model':
        return 'Modelo IA';
      case 'condition':
        return 'Condicional';
      case 'report_generator':
        return 'Relatório';
      case 'email_sender':
        return 'Envio de E-mail';
      case 'action':
        return 'Ação';
      case 'http_request':
        return 'Requisição HTTP';
      case 'loop':
        return 'Loop / Iterador';
      case 'human_approval':
        return 'Aprovação Humana';
      case 'sub_agent':
        return 'Sub-Agente';
      default:
        return 'Ferramenta';
    }
  };

  // SVG Bezier Curves for edges
  const renderEdges = () => {
    if (!activeAgent) return null;
    return (
      <>
        {activeAgent.edges.map((edge) => {
          const sourceNode = activeAgent.nodes.find((n) => n.id === edge.source_node_id);
          const targetNode = activeAgent.nodes.find((n) => n.id === edge.target_node_id);
          if (!sourceNode || !targetNode) return null;

          const isLoopBack = edge.edge_type === 'loop_back';
          const sx = sourceNode.position.x + CARD_WIDTH;
          const sy = sourceNode.position.y + getSourceHandleY(sourceNode, edge.source_handle || 'output');
          const tx = targetNode.position.x;
          const ty = targetNode.position.y + getTargetHandleY(targetNode, edge.target_handle || 'input');

          const deltaX = Math.max(40, (tx - sx) * 0.5);
          const pathD = `M ${sx} ${sy} C ${sx + deltaX} ${sy}, ${tx - deltaX} ${ty}, ${tx} ${ty}`;

          return (
            <g key={edge.id} className="group cursor-pointer pointer-events-auto">
              <path
                d={pathD}
                fill="none"
                stroke={isLoopBack ? (isDark ? '#F59E0B' : '#D97706') : isDark ? '#525252' : '#A3A3A3'}
                strokeWidth={isLoopBack ? '2.5' : '2.5'}
                strokeDasharray={isLoopBack ? '6,4' : undefined}
                className="group-hover:stroke-neutral-500 dark:group-hover:stroke-neutral-300 transition-colors"
              />
              <path
                d={pathD}
                fill="none"
                stroke="transparent"
                strokeWidth="14"
                onClick={() => removeEdge(edge.id)}
              >
                <title>Clique para remover conexão{isLoopBack ? ' (Loop Back)' : ''}</title>
              </path>
            </g>
          );
        })}

        {/* Cabo dinâmico durante a conexão ativa */}
        {connectingPort && connectingMousePos && (() => {
          const sourceNode = activeAgent.nodes.find((n) => n.id === connectingPort.nodeId);
          if (!sourceNode) return null;

          const sx = sourceNode.position.x + CARD_WIDTH;
          const sy = sourceNode.position.y + getSourceHandleY(sourceNode, connectingPort.handleId);
          const tx = connectingMousePos.x;
          const ty = connectingMousePos.y;

          const deltaX = Math.max(40, Math.abs(tx - sx) * 0.5);
          const pathD = `M ${sx} ${sy} C ${sx + deltaX} ${sy}, ${tx - deltaX} ${ty}, ${tx} ${ty}`;

          return (
            <path
              d={pathD}
              fill="none"
              stroke={isDark ? '#FFFFFF' : '#171717'}
              strokeWidth="2.5"
              strokeDasharray="5,5"
              className="animate-pulse pointer-events-none"
            />
          );
        })()}
      </>
    );
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDownCanvas}
      onWheel={handleWheelCanvas}
      onPointerMove={handleCanvasPointerMove}
      onClick={() => {
        setConnectingPort(null);
        setConnectingMousePos(null);
      }}
      className="relative w-full h-full bg-[#F5F5F5] dark:bg-[#171717] overflow-hidden select-none transition-colors duration-200"
      style={{
        backgroundImage: isDark
          ? 'radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px)'
          : 'radial-gradient(rgba(0, 0, 0, 0.08) 1px, transparent 1px)',
        backgroundSize: `${Math.round(24 * zoom)}px ${Math.round(24 * zoom)}px`,
      }}
    >
      {/* Top Header Bar matching Sketch 3: Button [+] Adicionar */}
      <div
        onMouseDown={(e) => e.stopPropagation()}
        data-no-canvas-select
        className="absolute top-4 right-6 z-40 flex items-center gap-3 pointer-events-auto"
      >
        <button
          onClick={() => setAiDrawerOpen(true)}
          disabled={!activeAgent}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-lg transition-all group cursor-pointer"
          title="Criar ou estender fluxo de trabalho com Inteligência Artificial"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
          <span>Ajuda IA</span>
        </button>

        <button
          onClick={() => setTestModalOpen(true)}
          disabled={isExecuting || !activeAgent}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-lg transition-all"
        >
          {isExecuting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current" />
          )}
          <span>Testar Fluxo</span>
        </button>

        <button
          onClick={() => setDrawerOpen(true)}
          disabled={!activeAgent}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-neutral-900 dark:bg-neutral-200 text-white dark:text-[#171717] hover:bg-neutral-800 dark:hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed shadow-lg transition-all"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Adicionar</span>
        </button>
      </div>

      {/* Empty State when no agent is created/selected */}
      {!activeAgent && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-6 text-center z-10">
          <div className="w-12 h-12 rounded-2xl border border-neutral-300 dark:border-neutral-700 bg-white/80 dark:bg-neutral-800/80 flex items-center justify-center shadow-lg mb-3">
            <Bot className="w-6 h-6 text-neutral-400 dark:text-neutral-500" />
          </div>
          <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
            Nenhum agente ativo
          </h3>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1 max-w-xs leading-relaxed">
            A criação e configuração de fluxos automatizados de agentes estará disponível futuramente.
          </p>
        </div>
      )}

      {/* Helper notice if connecting */}
      {connectingPort ? (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          data-no-canvas-select
          className="absolute top-4 left-6 z-40 px-3.5 py-2 rounded-xl bg-white/95 dark:bg-neutral-800/95 border border-neutral-300 dark:border-neutral-700 text-xs text-neutral-900 dark:text-white shadow-lg flex items-center gap-2.5 backdrop-blur-md pointer-events-auto"
        >
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>Clique no ponto de entrada do campo desejado para conectar</span>
          <button
            onClick={() => {
              setConnectingPort(null);
              setConnectingMousePos(null);
            }}
            className="p-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition-colors cursor-pointer ml-1"
            title="Cancelar conexão (ou clique fora)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : activeAgent ? (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          data-no-canvas-select
          className="absolute top-4 left-6 z-40 flex items-center gap-2 pointer-events-auto"
        >
          {isEditingName ? (
            <input
              type="text"
              autoFocus
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName();
                if (e.key === 'Escape') setIsEditingName(false);
              }}
              onBlur={handleSaveName}
              onClick={(e) => e.stopPropagation()}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-neutral-800 border border-neutral-400 dark:border-neutral-600 text-neutral-900 dark:text-white outline-none ring-1 ring-neutral-400 dark:ring-neutral-500 shadow-md"
            />
          ) : (
            <div
              onDoubleClick={() => {
                setNameValue(activeAgent.name);
                setIsEditingName(true);
              }}
              title="Clique 2 vezes para renomear"
              className="px-3.5 py-1.5 rounded-xl bg-white/95 dark:bg-[#1E1E1E]/95 border border-neutral-300 dark:border-neutral-700 text-xs font-semibold text-neutral-800 dark:text-neutral-200 shadow-md backdrop-blur-md cursor-pointer hover:bg-white dark:hover:bg-[#252525] transition-all flex items-center gap-1.5"
            >
              <span>{activeAgent.name}</span>
            </div>
          )}
        </div>
      ) : null}

      {/* Floating Multi-Selection Action Badge (com animação suave de entrada e saída) */}
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        data-no-canvas-select
        className={`absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/95 dark:bg-[#1E1E1E]/95 border border-neutral-300/90 dark:border-neutral-700/90 shadow-2xl backdrop-blur-md badge-spring-transition ${
          hasSelection
            ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
            : 'opacity-0 -translate-y-2.5 scale-95 pointer-events-none'
        }`}
      >
        <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 select-none">
          {selectionDisplayCount === 1
            ? '1 nó selecionado'
            : `${selectionDisplayCount} nós selecionados`}
        </span>
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            const idsToRemove = [...selectedNodeIds];
            removeNodes(idsToRemove);
          }}
          title="Excluir nós selecionados (Delete)"
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 active:scale-95 rounded-xl transition-all cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Excluir</span>
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedNodeIds([]);
            setSelectedNodeId(null);
          }}
          title="Desmarcar seleção (Esc)"
          className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Canvas Viewport Plane (Escalado suavemente por zoom) */}
      <div
        className="absolute inset-0 w-full h-full pointer-events-none transition-transform duration-150 ease-out"
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {/* SVG Canvas for Bezier Edges */}
        <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none z-0">
          {renderEdges()}
        </svg>

        {/* Nodes Render matching Sketch 3 with Framer Motion Lifecycle */}
        <AnimatePresence>
          {activeAgent &&
            activeAgent.nodes.map((node) => {
              const isSelected = selectedNodeIds.includes(node.id) || selectedNodeId === node.id;
              const nodeStatus = nodeStatuses[node.id] || (executingNodeId === node.id ? 'running' : 'idle');
              const nodeResult = nodeResults[node.id];

              return (
                <motion.div
                  key={node.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{
                    opacity: 0,
                    transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
                  }}
                  style={{
                    transform: `translate3d(${node.position.x}px, ${node.position.y}px, 0)`,
                    pointerEvents: 'auto',
                    willChange: 'transform',
                  }}
                  className="absolute top-0 left-0"
                >
                  <motion.div
                    initial={{ scale: 0.94 }}
                    animate={{ scale: 1 }}
                    exit={{
                      scale: 0.88,
                      y: -6,
                      filter: 'blur(3px)',
                      transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
                    }}
                    transition={{ duration: 0.16, ease: 'easeOut' }}
                    onMouseDown={(e) => handleMouseDownNode(e, node)}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setSelectedNodeIds([node.id]);
                      setSelectedNodeId(node.id);
                    }}
                    className={`relative w-[320px] rounded-2xl border bg-white dark:bg-[#1E1E1E] shadow-xl p-3.5 z-10 cursor-grab active:cursor-grabbing select-none transition-[border-color,box-shadow,background-color] duration-150 ${
                      nodeStatus === 'running'
                        ? 'border-emerald-500 ring-4 ring-emerald-500/40 shadow-emerald-500/30 animate-pulse'
                        : nodeStatus === 'waiting_approval'
                        ? 'border-amber-500 ring-4 ring-amber-500/50 shadow-amber-500/40 animate-pulse'
                        : nodeStatus === 'success'
                        ? 'border-emerald-500/80 dark:border-emerald-400/80 ring-2 ring-emerald-500/20 shadow-emerald-500/10'
                        : nodeStatus === 'error'
                        ? 'border-red-500 ring-4 ring-red-500/30 shadow-red-500/20'
                        : isSelected
                        ? 'border-neutral-900 dark:border-white ring-2 ring-neutral-900/40 dark:ring-white/40 shadow-2xl scale-[1.01]'
                        : 'border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-500'
                    }`}
                  >
                {/* Header Input Port (Left) - Apenas para nós legados que NÃO possuem inputs dedicados nos campos */}
                {node.type !== 'trigger' &&
                  !['ai_model', 'rag', 'condition', 'report_generator', 'email_sender', 'http_request', 'action', 'loop', 'human_approval', 'sub_agent'].includes(node.type) && (
                  <div
                    onClick={(e) => handleHandleClick(e, node.id, 'input', false)}
                    onMouseDown={(e) => e.stopPropagation()}
                    title="Ponto de Entrada Geral — Conectar cabo aqui"
                    className={`absolute -left-2 top-[22px] -translate-y-1/2 w-4 h-4 rounded-full border-2 bg-white dark:bg-neutral-900 flex items-center justify-center cursor-pointer transition-all z-20 ${
                      connectingPort && connectingPort.isOutput && connectingPort.nodeId !== node.id
                        ? 'border-emerald-500 bg-emerald-500/20 scale-125 animate-pulse'
                        : 'border-neutral-400 dark:border-neutral-600 hover:border-neutral-900 dark:hover:border-white'
                    }`}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-neutral-500 dark:bg-neutral-400" />
                  </div>
                )}

                {/* Default Header Output Port (Right - except condition and loop) */}
                {node.type !== 'condition' && node.type !== 'loop' && (
                  <div
                    onClick={(e) => handleHandleClick(e, node.id, 'output', true)}
                    onMouseDown={(e) => e.stopPropagation()}
                    title="Ponto de Saída — Clique para conectar ao próximo nó"
                    className={`absolute -right-2 top-[22px] -translate-y-1/2 w-4 h-4 rounded-full border-2 bg-white dark:bg-neutral-900 flex items-center justify-center cursor-pointer transition-all z-20 ${
                      connectingPort?.nodeId === node.id && connectingPort?.handleId === 'output'
                        ? 'border-neutral-900 dark:border-white bg-neutral-900 dark:bg-white scale-125'
                        : 'border-neutral-400 dark:border-neutral-600 hover:border-neutral-900 dark:hover:border-white'
                    }`}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-neutral-500 dark:bg-neutral-400" />
                  </div>
                )}

                {/* Node Header */}
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-neutral-200 dark:border-neutral-800">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-md bg-neutral-100 dark:bg-neutral-800/80">{getNodeIcon(node.type)}</div>
                    <span className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      {getNodeTypeLabel(node.type)}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNodeIds([node.id]);
                        setSelectedNodeId(node.id);
                      }}
                      title="Configurações avançadas do nó"
                      className="p-1 rounded text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeNode(node.id);
                      }}
                      title="Remover nó"
                      className="p-1 rounded text-neutral-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Node Title & Status Row */}
                <div className="pt-2 pb-1 flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={node.label}
                    onMouseDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    onChange={(e) => updateNodeConfig(node.id, {}, e.target.value)}
                    className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 bg-transparent border-b border-transparent hover:border-neutral-300 dark:hover:border-neutral-700 focus:border-neutral-900 dark:focus:border-white focus:outline-none transition-colors w-full"
                    placeholder="Nome do nó"
                  />
                  <div className="shrink-0">
                    {nodeStatus === 'running' ? (
                      <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                      </span>
                    ) : nodeStatus === 'success' ? (
                      <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {nodeResult?.duration_ms !== undefined ? `${nodeResult.duration_ms}ms` : ''}
                      </span>
                    ) : nodeStatus === 'waiting_approval' ? (
                      <span className="text-amber-600 dark:text-amber-400 text-[10px] font-semibold flex items-center gap-1">
                        <Clock className="w-3 h-3 animate-pulse" />
                        Pendente
                      </span>
                    ) : nodeStatus === 'error' ? (
                      <span className="text-red-600 dark:text-red-400 text-[10px] font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* --- EMBEDDED NODE INPUTS --- */}

                {/* 1. TRIGGER NODE */}
                {node.type === 'trigger' && (
                  <div className="mt-1 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-neutral-500 dark:text-neutral-400 text-[10px]">Origem do Disparo:</span>
                      <select
                        value={node.config?.trigger_type || 'manual'}
                        onMouseDown={(e) => e.stopPropagation()}
                        onChange={(e) => updateNodeConfig(node.id, { trigger_type: e.target.value })}
                        className="text-[11px] font-medium py-0.5 px-2 rounded-md bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 focus:outline-none"
                      >
                        <option value="manual">Manual</option>
                        <option value="webhook">Webhook HTTP</option>
                        <option value="schedule">Agendado (Cron)</option>
                      </select>
                    </div>
                    {node.config?.trigger_type === 'schedule' ? (
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 flex items-center justify-between">
                          <span>Frequência Programada</span>
                          <span className="text-[9px] text-neutral-400">Mín. 5 min</span>
                        </div>
                        <div className="p-2 rounded-xl bg-neutral-100/90 dark:bg-neutral-900/90 border border-neutral-200 dark:border-neutral-800 flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="text-xs font-medium text-neutral-900 dark:text-neutral-100 truncate">
                            {formatCronHumanReadable(node.config?.cron_expression || '*/15 * * * *')}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <select
                            value={node.config?.cron_expression || '*/15 * * * *'}
                            onMouseDown={(e) => e.stopPropagation()}
                            onChange={(e) => updateNodeConfig(node.id, { cron_expression: e.target.value })}
                            className="flex-1 text-[11px] py-1 px-2 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 outline-none cursor-pointer"
                          >
                            <option value="*/15 * * * *">A cada 15 min</option>
                            <option value="*/30 * * * *">A cada 30 min</option>
                            <option value="0 * * * *">A cada 1 hora</option>
                            <option value="0 */2 * * *">A cada 2 horas</option>
                            <option value="0 9 * * *">Diário às 09:00</option>
                            <option value="0 18 * * *">Diário às 18:00</option>
                            <option value="0 8 * * 1-5">Dias úteis às 08:00</option>
                            <option value="0 9 1 * *">Mensal (dia 1º às 09:00)</option>
                          </select>
                          <button
                            type="button"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={() => setSelectedNodeId(node.id)}
                            className="px-2 py-1 text-[10px] rounded-lg bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-medium transition-colors cursor-pointer"
                            title="Abrir editor visual completo"
                          >
                            Personalizar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                          Solicitação / Entrada Inicial
                        </div>
                        <textarea
                          rows={2}
                          value={node.config?.pergunta || node.config?.input || ''}
                          onMouseDown={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          onChange={(e) => updateNodeConfig(node.id, { pergunta: e.target.value, input: e.target.value })}
                          placeholder="Ex: Como solicitar reembolso ou suporte?"
                          className="w-full text-xs p-2 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none focus:border-neutral-900 dark:focus:border-white resize-none"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* 2. AI MODEL NODE */}
                {node.type === 'ai_model' && (() => {
                  const conn = getConnectedSourceInfo(node.id, 'prompt');
                  return (
                    <div className="mt-1 space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-neutral-500 dark:text-neutral-400 text-[10px]">Modelo Cognitivo:</span>
                        <select
                          value={node.config?.model || 'gemini-3.6-flash'}
                          onMouseDown={(e) => e.stopPropagation()}
                          onChange={(e) => updateNodeConfig(node.id, { model: e.target.value })}
                          className="text-[11px] font-medium py-0.5 px-2 rounded-md bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 focus:outline-none"
                        >
                          <option value="gemini-3.6-flash">Gemini 3.6 Flash</option>
                          <option value="gemini-3.6-pro">Gemini 3.6 Pro</option>
                          <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                        </select>
                      </div>

                      <div className="relative">
                        {/* Port Handle on Left */}
                        <div
                          onClick={(e) => handleHandleClick(e, node.id, 'prompt', false)}
                          onMouseDown={(e) => e.stopPropagation()}
                          title="Entrada do Prompt — Conectar cabo aqui"
                          className={`absolute -left-[22px] top-[26px] -translate-y-1/2 w-4 h-4 rounded-full border-2 bg-white dark:bg-neutral-900 flex items-center justify-center cursor-pointer transition-all z-20 ${
                            connectingPort && connectingPort.isOutput && connectingPort.nodeId !== node.id
                              ? 'border-emerald-500 bg-emerald-500/20 scale-125 animate-pulse'
                              : 'border-neutral-400 dark:border-neutral-600 hover:border-neutral-900 dark:hover:border-white'
                          }`}
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-neutral-500 dark:bg-neutral-400" />
                        </div>

                        <div className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-1 flex items-center justify-between">
                          <span>Prompt / Entrada</span>
                          {conn && <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block mr-1" />Conectado</span>}
                        </div>

                        {conn ? (
                          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/90 border border-neutral-300 dark:border-neutral-700 text-[11px]">
                            <span className="truncate flex items-center gap-1.5">
                              <Zap className="w-3 h-3 text-amber-500 shrink-0" />
                              <span className="text-neutral-500 dark:text-neutral-400">Origem:</span>
                              <strong className="text-neutral-900 dark:text-white font-semibold">{conn.sourceLabel}</strong>
                            </span>
                            <button
                              type="button"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                disconnectHandle(node.id, 'prompt');
                              }}
                              title="Desconectar entrada"
                              className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 hover:text-red-500 transition-colors cursor-pointer shrink-0 ml-1"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <textarea
                            rows={3}
                            value={node.config?.prompt || node.config?.user_prompt || ''}
                            onMouseDown={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            onChange={(e) => updateNodeConfig(node.id, { prompt: e.target.value, user_prompt: e.target.value })}
                            placeholder="Digite as instruções ou conecte um nó anterior..."
                            className="w-full text-xs p-2 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none focus:border-neutral-900 dark:focus:border-white resize-none"
                          />
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* 3. RAG NODE */}
                {node.type === 'rag' && (() => {
                  const conn = getConnectedSourceInfo(node.id, 'query');
                  return (
                    <div className="mt-1 space-y-2">
                      <div className="relative">
                        <div
                          onClick={(e) => handleHandleClick(e, node.id, 'query', false)}
                          onMouseDown={(e) => e.stopPropagation()}
                          title="Entrada da Busca — Conectar cabo aqui"
                          className={`absolute -left-[22px] top-[26px] -translate-y-1/2 w-4 h-4 rounded-full border-2 bg-white dark:bg-neutral-900 flex items-center justify-center cursor-pointer transition-all z-20 ${
                            connectingPort && connectingPort.isOutput && connectingPort.nodeId !== node.id
                              ? 'border-emerald-500 bg-emerald-500/20 scale-125 animate-pulse'
                              : 'border-neutral-400 dark:border-neutral-600 hover:border-neutral-900 dark:hover:border-white'
                          }`}
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-neutral-500 dark:bg-neutral-400" />
                        </div>

                        <div className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-1 flex items-center justify-between">
                          <span>Consulta de Busca</span>
                          {conn && <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block mr-1" />Conectado</span>}
                        </div>

                        {conn ? (
                          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/90 border border-neutral-300 dark:border-neutral-700 text-[11px]">
                            <span className="truncate flex items-center gap-1.5">
                              <Zap className="w-3 h-3 text-amber-500 shrink-0" />
                              <span className="text-neutral-500 dark:text-neutral-400">Origem:</span>
                              <strong className="text-neutral-900 dark:text-white font-semibold">{conn.sourceLabel}</strong>
                            </span>
                            <button
                              type="button"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                disconnectHandle(node.id, 'query');
                              }}
                              title="Desconectar entrada"
                              className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 hover:text-red-500 transition-colors cursor-pointer shrink-0 ml-1"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={node.config?.query || node.config?.search_query || ''}
                            onMouseDown={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            onChange={(e) => updateNodeConfig(node.id, { query: e.target.value, search_query: e.target.value })}
                            placeholder="Ex: políticas de reembolso"
                            className="w-full text-xs p-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-900 dark:focus:border-white"
                          />
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <span className="text-neutral-500 dark:text-neutral-400 text-[10px]">Documentos (Top K):</span>
                        <NumberInput
                          variant="stepper"
                          min={1}
                          max={10}
                          value={node.config?.top_k || 4}
                          onChange={(val) => updateNodeConfig(node.id, { top_k: val })}
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* 4. CONDITION NODE */}
                {node.type === 'condition' && (() => {
                  const conn = getConnectedSourceInfo(node.id, 'value');
                  return (
                    <div className="mt-1 space-y-2">
                      <div className="relative">
                        <div
                          onClick={(e) => handleHandleClick(e, node.id, 'value', false)}
                          onMouseDown={(e) => e.stopPropagation()}
                          title="Valor a Avaliar — Conectar cabo aqui"
                          className={`absolute -left-[22px] top-[26px] -translate-y-1/2 w-4 h-4 rounded-full border-2 bg-white dark:bg-neutral-900 flex items-center justify-center cursor-pointer transition-all z-20 ${
                            connectingPort && connectingPort.isOutput && connectingPort.nodeId !== node.id
                              ? 'border-emerald-500 bg-emerald-500/20 scale-125 animate-pulse'
                              : 'border-neutral-400 dark:border-neutral-600 hover:border-neutral-900 dark:hover:border-white'
                          }`}
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-neutral-500 dark:bg-neutral-400" />
                        </div>

                        <div className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-1 flex items-center justify-between">
                          <span>Valor a Avaliar</span>
                          {conn && <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block mr-1" />Conectado</span>}
                        </div>

                        {conn ? (
                          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/90 border border-neutral-300 dark:border-neutral-700 text-[11px]">
                            <span className="truncate flex items-center gap-1.5">
                              <Zap className="w-3 h-3 text-amber-500 shrink-0" />
                              <span className="text-neutral-500 dark:text-neutral-400">Origem:</span>
                              <strong className="text-neutral-900 dark:text-white font-semibold">{conn.sourceLabel}</strong>
                            </span>
                            <button
                              type="button"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                disconnectHandle(node.id, 'value');
                              }}
                              title="Desconectar entrada"
                              className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 hover:text-red-500 transition-colors cursor-pointer shrink-0 ml-1"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={node.config?.value || node.config?.field || ''}
                            onMouseDown={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            onChange={(e) => updateNodeConfig(node.id, { value: e.target.value, field: e.target.value })}
                            placeholder="Ex: status, resultado..."
                            className="w-full text-xs p-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 focus:outline-none"
                          />
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <select
                          value={node.config?.operator || 'contains'}
                          onMouseDown={(e) => e.stopPropagation()}
                          onChange={(e) => updateNodeConfig(node.id, { operator: e.target.value })}
                          className="text-[11px] p-1.5 rounded-md bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 focus:outline-none"
                        >
                          <option value="contains">Contém</option>
                          <option value="==">Igual a (==)</option>
                          <option value="!=">Diferente de (!=)</option>
                          <option value=">">Maior que (&gt;)</option>
                          <option value="<">Menor que (&lt;)</option>
                          <option value="not_empty">Não vazio</option>
                        </select>
                        <input
                          type="text"
                          value={node.config?.expected || node.config?.target_value || ''}
                          onMouseDown={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          onChange={(e) => updateNodeConfig(node.id, { expected: e.target.value, target_value: e.target.value })}
                          placeholder="Esperado"
                          className="text-xs p-1.5 rounded-md bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 focus:outline-none"
                        />
                      </div>

                      {/* True / False Branch Handles on Right */}
                      <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[10px] flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Se Verdadeiro (True)
                          </span>
                          <div
                            onClick={(e) => handleHandleClick(e, node.id, 'true', true)}
                            onMouseDown={(e) => e.stopPropagation()}
                            title="Saída Verdadeiro — Conectar caminho afirmativo"
                            className={`w-4 h-4 rounded-full border-2 bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center cursor-pointer transition-all ${
                              connectingPort?.nodeId === node.id && connectingPort?.handleId === 'true'
                                ? 'border-emerald-500 bg-emerald-500 scale-125'
                                : 'border-emerald-500/70 hover:border-emerald-500 hover:scale-110'
                            }`}
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-neutral-500 dark:text-neutral-400 font-semibold text-[10px] flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                            Se Falso (False)
                          </span>
                          <div
                            onClick={(e) => handleHandleClick(e, node.id, 'false', true)}
                            onMouseDown={(e) => e.stopPropagation()}
                            title="Saída Falso — Conectar caminho alternativo"
                            className={`w-4 h-4 rounded-full border-2 bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center cursor-pointer transition-all ${
                              connectingPort?.nodeId === node.id && connectingPort?.handleId === 'false'
                                ? 'border-neutral-900 dark:border-white bg-neutral-900 dark:bg-white scale-125'
                                : 'border-neutral-400 dark:border-neutral-600 hover:border-neutral-900 dark:hover:border-white hover:scale-110'
                            }`}
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-neutral-500 dark:bg-neutral-400" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 5. REPORT GENERATOR NODE */}
                {node.type === 'report_generator' && (() => {
                  const conn = getConnectedSourceInfo(node.id, 'raw_data');
                  return (
                    <div className="mt-1 space-y-2">
                      <input
                        type="text"
                        value={node.config?.title || ''}
                        onMouseDown={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        onChange={(e) => updateNodeConfig(node.id, { title: e.target.value })}
                        placeholder="Título do Relatório"
                        className="w-full text-xs p-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 focus:outline-none"
                      />

                      <div className="relative">
                        <div
                          onClick={(e) => handleHandleClick(e, node.id, 'raw_data', false)}
                          onMouseDown={(e) => e.stopPropagation()}
                          title="Entrada de Dados — Conectar cabo aqui"
                          className={`absolute -left-[22px] top-[26px] -translate-y-1/2 w-4 h-4 rounded-full border-2 bg-white dark:bg-neutral-900 flex items-center justify-center cursor-pointer transition-all z-20 ${
                            connectingPort && connectingPort.isOutput && connectingPort.nodeId !== node.id
                              ? 'border-emerald-500 bg-emerald-500/20 scale-125 animate-pulse'
                              : 'border-neutral-400 dark:border-neutral-600 hover:border-neutral-900 dark:hover:border-white'
                          }`}
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-neutral-500 dark:bg-neutral-400" />
                        </div>

                        <div className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-1 flex items-center justify-between">
                          <span>Dados de Entrada</span>
                          {conn && <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block mr-1" />Conectado</span>}
                        </div>

                        {conn ? (
                          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/90 border border-neutral-300 dark:border-neutral-700 text-[11px]">
                            <span className="truncate flex items-center gap-1.5">
                              <Zap className="w-3 h-3 text-amber-500 shrink-0" />
                              <span className="text-neutral-500 dark:text-neutral-400">Origem:</span>
                              <strong className="text-neutral-900 dark:text-white font-semibold">{conn.sourceLabel}</strong>
                            </span>
                            <button
                              type="button"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                disconnectHandle(node.id, 'raw_data');
                              }}
                              title="Desconectar entrada"
                              className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 hover:text-red-500 transition-colors cursor-pointer shrink-0 ml-1"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <textarea
                            rows={2}
                            value={node.config?.raw_data || ''}
                            onMouseDown={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            onChange={(e) => updateNodeConfig(node.id, { raw_data: e.target.value })}
                            placeholder="Texto ou dados para o relatório..."
                            className="w-full text-xs p-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 focus:outline-none resize-none"
                          />
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-neutral-500 dark:text-neutral-400 text-[10px]">Estilo Visual:</span>
                        <select
                          value={node.config?.style || 'executive'}
                          onMouseDown={(e) => e.stopPropagation()}
                          onChange={(e) => updateNodeConfig(node.id, { style: e.target.value })}
                          className="text-[11px] font-medium py-0.5 px-2 rounded-md bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 focus:outline-none"
                        >
                          <option value="executive">Executivo Corporativo</option>
                          <option value="minimal">Minimalista Limpo</option>
                        </select>
                      </div>
                    </div>
                  );
                })()}

                {/* 6. EMAIL SENDER NODE */}
                {node.type === 'email_sender' && (() => {
                  const connTo = getConnectedSourceInfo(node.id, 'to');
                  const connBody = getConnectedSourceInfo(node.id, 'body');
                  return (
                    <div className="mt-1 space-y-2">
                      <div className="relative">
                        <div
                          onClick={(e) => handleHandleClick(e, node.id, 'to', false)}
                          onMouseDown={(e) => e.stopPropagation()}
                          title="Entrada Destinatário — Conectar cabo aqui"
                          className={`absolute -left-[22px] top-[26px] -translate-y-1/2 w-4 h-4 rounded-full border-2 bg-white dark:bg-neutral-900 flex items-center justify-center cursor-pointer transition-all z-20 ${
                            connectingPort && connectingPort.isOutput && connectingPort.nodeId !== node.id
                              ? 'border-emerald-500 bg-emerald-500/20 scale-125 animate-pulse'
                              : 'border-neutral-400 dark:border-neutral-600 hover:border-neutral-900 dark:hover:border-white'
                          }`}
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-neutral-500 dark:bg-neutral-400" />
                        </div>

                        <div className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-1 flex items-center justify-between">
                          <span>Destinatário (Para)</span>
                          {connTo && <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block mr-1" />Conectado</span>}
                        </div>

                        {connTo ? (
                          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/90 border border-neutral-300 dark:border-neutral-700 text-[11px]">
                            <span className="truncate flex items-center gap-1.5">
                              <Zap className="w-3 h-3 text-amber-500 shrink-0" />
                              <strong className="text-neutral-900 dark:text-white font-semibold">{connTo.sourceLabel}</strong>
                            </span>
                            <button
                              type="button"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                disconnectHandle(node.id, 'to');
                              }}
                              title="Desconectar entrada"
                              className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 hover:text-red-500 transition-colors cursor-pointer shrink-0 ml-1"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <input
                            type="email"
                            value={node.config?.to || ''}
                            onMouseDown={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            onChange={(e) => updateNodeConfig(node.id, { to: e.target.value })}
                            placeholder="diretoria@preci.company"
                            className="w-full text-xs p-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 focus:outline-none"
                          />
                        )}
                      </div>

                      <input
                        type="text"
                        value={node.config?.subject || ''}
                        onMouseDown={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        onChange={(e) => updateNodeConfig(node.id, { subject: e.target.value })}
                        placeholder="Assunto do e-mail"
                        className="w-full text-xs p-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 focus:outline-none"
                      />

                      <div className="relative">
                        <div
                          onClick={(e) => handleHandleClick(e, node.id, 'body', false)}
                          onMouseDown={(e) => e.stopPropagation()}
                          title="Entrada do Corpo do E-mail — Conectar cabo aqui"
                          className={`absolute -left-[22px] top-[26px] -translate-y-1/2 w-4 h-4 rounded-full border-2 bg-white dark:bg-neutral-900 flex items-center justify-center cursor-pointer transition-all z-20 ${
                            connectingPort && connectingPort.isOutput && connectingPort.nodeId !== node.id
                              ? 'border-emerald-500 bg-emerald-500/20 scale-125 animate-pulse'
                              : 'border-neutral-400 dark:border-neutral-600 hover:border-neutral-900 dark:hover:border-white'
                          }`}
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-neutral-500 dark:bg-neutral-400" />
                        </div>

                        <div className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-1 flex items-center justify-between">
                          <span>Corpo do E-mail</span>
                          {connBody && <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block mr-1" />Conectado</span>}
                        </div>

                        {connBody ? (
                          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/90 border border-neutral-300 dark:border-neutral-700 text-[11px]">
                            <span className="truncate flex items-center gap-1.5">
                              <Zap className="w-3 h-3 text-amber-500 shrink-0" />
                              <strong className="text-neutral-900 dark:text-white font-semibold">{connBody.sourceLabel}</strong>
                            </span>
                            <button
                              type="button"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                disconnectHandle(node.id, 'body');
                              }}
                              title="Desconectar entrada"
                              className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 hover:text-red-500 transition-colors cursor-pointer shrink-0 ml-1"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <textarea
                            rows={2}
                            value={node.config?.body || ''}
                            onMouseDown={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            onChange={(e) => updateNodeConfig(node.id, { body: e.target.value })}
                            placeholder="Mensagem ou HTML do e-mail..."
                            className="w-full text-xs p-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 focus:outline-none resize-none"
                          />
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* 7. HTTP REQUEST NODE */}
                {node.type === 'http_request' && (() => {
                  const conn = getConnectedSourceInfo(node.id, 'body');
                  return (
                    <div className="mt-1 space-y-2">
                      <div className="flex gap-1.5">
                        <select
                          value={node.config?.method || 'POST'}
                          onMouseDown={(e) => e.stopPropagation()}
                          onChange={(e) => updateNodeConfig(node.id, { method: e.target.value })}
                          className="text-[11px] font-medium p-1 rounded-md bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 focus:outline-none"
                        >
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                          <option value="PUT">PUT</option>
                          <option value="DELETE">DELETE</option>
                        </select>
                        <input
                          type="text"
                          value={node.config?.url || ''}
                          onMouseDown={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          onChange={(e) => updateNodeConfig(node.id, { url: e.target.value })}
                          placeholder="https://api..."
                          className="w-full text-xs p-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 focus:outline-none font-mono"
                        />
                      </div>

                      <div className="relative">
                        <div
                          onClick={(e) => handleHandleClick(e, node.id, 'body', false)}
                          onMouseDown={(e) => e.stopPropagation()}
                          title="Entrada do Body — Conectar cabo aqui"
                          className={`absolute -left-[22px] top-[26px] -translate-y-1/2 w-4 h-4 rounded-full border-2 bg-white dark:bg-neutral-900 flex items-center justify-center cursor-pointer transition-all z-20 ${
                            connectingPort && connectingPort.isOutput && connectingPort.nodeId !== node.id
                              ? 'border-emerald-500 bg-emerald-500/20 scale-125 animate-pulse'
                              : 'border-neutral-400 dark:border-neutral-600 hover:border-neutral-900 dark:hover:border-white'
                          }`}
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-neutral-500 dark:bg-neutral-400" />
                        </div>

                        <div className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-1 flex items-center justify-between">
                          <span>Body da Requisição</span>
                          {conn && <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block mr-1" />Conectado</span>}
                        </div>

                        {conn ? (
                          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/90 border border-neutral-300 dark:border-neutral-700 text-[11px]">
                            <span className="truncate flex items-center gap-1.5">
                              <Zap className="w-3 h-3 text-amber-500 shrink-0" />
                              <strong className="text-neutral-900 dark:text-white font-semibold">{conn.sourceLabel}</strong>
                            </span>
                            <button
                              type="button"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                disconnectHandle(node.id, 'body');
                              }}
                              title="Desconectar entrada"
                              className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 hover:text-red-500 transition-colors cursor-pointer shrink-0 ml-1"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <textarea
                            rows={2}
                            value={node.config?.body || ''}
                            onMouseDown={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            onChange={(e) => updateNodeConfig(node.id, { body: e.target.value })}
                            placeholder='{"chave": "valor"}'
                            className="w-full text-xs p-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 focus:outline-none resize-none font-mono"
                          />
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* 8. ACTION NOTIFICATION NODE */}
                {node.type === 'action' && (() => {
                  const conn = getConnectedSourceInfo(node.id, 'message');
                  return (
                    <div className="mt-1 space-y-2">
                      <div className="grid grid-cols-2 gap-1.5">
                        <select
                          value={node.config?.destination || node.config?.action_type || 'Slack'}
                          onMouseDown={(e) => e.stopPropagation()}
                          onChange={(e) => updateNodeConfig(node.id, { destination: e.target.value, action_type: e.target.value })}
                          className="text-[11px] font-medium p-1 rounded-md bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 focus:outline-none"
                        >
                          <option value="Slack">Slack</option>
                          <option value="Discord">Discord</option>
                          <option value="Webhook">Webhook</option>
                        </select>
                        <input
                          type="text"
                          value={node.config?.channel || ''}
                          onMouseDown={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          onChange={(e) => updateNodeConfig(node.id, { channel: e.target.value })}
                          placeholder="#canal"
                          className="text-xs p-1.5 rounded-md bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 focus:outline-none"
                        />
                      </div>

                      <div className="relative">
                        <div
                          onClick={(e) => handleHandleClick(e, node.id, 'message', false)}
                          onMouseDown={(e) => e.stopPropagation()}
                          title="Entrada da Mensagem — Conectar cabo aqui"
                          className={`absolute -left-[22px] top-[26px] -translate-y-1/2 w-4 h-4 rounded-full border-2 bg-white dark:bg-neutral-900 flex items-center justify-center cursor-pointer transition-all z-20 ${
                            connectingPort && connectingPort.isOutput && connectingPort.nodeId !== node.id
                              ? 'border-emerald-500 bg-emerald-500/20 scale-125 animate-pulse'
                              : 'border-neutral-400 dark:border-neutral-600 hover:border-neutral-900 dark:hover:border-white'
                          }`}
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-neutral-500 dark:bg-neutral-400" />
                        </div>

                        <div className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-1 flex items-center justify-between">
                          <span>Mensagem</span>
                          {conn && <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block mr-1" />Conectado</span>}
                        </div>

                        {conn ? (
                          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/90 border border-neutral-300 dark:border-neutral-700 text-[11px]">
                            <span className="truncate flex items-center gap-1.5">
                              <Zap className="w-3 h-3 text-amber-500 shrink-0" />
                              <strong className="text-neutral-900 dark:text-white font-semibold">{conn.sourceLabel}</strong>
                            </span>
                            <button
                              type="button"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                disconnectHandle(node.id, 'message');
                              }}
                              title="Desconectar entrada"
                              className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 hover:text-red-500 transition-colors cursor-pointer shrink-0 ml-1"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <textarea
                            rows={2}
                            value={node.config?.message || ''}
                            onMouseDown={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            onChange={(e) => updateNodeConfig(node.id, { message: e.target.value })}
                            placeholder="Texto do alerta ou mensagem..."
                            className="w-full text-xs p-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 focus:outline-none resize-none"
                          />
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* 9. LOOP NODE */}
                {node.type === 'loop' && (() => {
                  const conn = getConnectedSourceInfo(node.id, 'input');
                  return (
                    <div className="mt-1 space-y-2">
                      <div className="relative">
                        <div
                          onClick={(e) => handleHandleClick(e, node.id, 'input', false)}
                          onMouseDown={(e) => e.stopPropagation()}
                          title="Entrada da Coleção — Conectar cabo aqui"
                          className={`absolute -left-[22px] top-[26px] -translate-y-1/2 w-4 h-4 rounded-full border-2 bg-white dark:bg-neutral-900 flex items-center justify-center cursor-pointer transition-all z-20 ${
                            connectingPort && connectingPort.isOutput && connectingPort.nodeId !== node.id
                              ? 'border-emerald-500 bg-emerald-500/20 scale-125 animate-pulse'
                              : 'border-neutral-400 dark:border-neutral-600 hover:border-neutral-900 dark:hover:border-white'
                          }`}
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-neutral-500 dark:bg-neutral-400" />
                        </div>

                        <div className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-1 flex items-center justify-between">
                          <span>Lista / Array de Iteração</span>
                          {conn && <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block mr-1" />Conectado</span>}
                        </div>

                        {conn ? (
                          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/90 border border-neutral-300 dark:border-neutral-700 text-[11px]">
                            <span className="truncate flex items-center gap-1.5">
                              <Zap className="w-3 h-3 text-amber-500 shrink-0" />
                              <span className="text-neutral-500 dark:text-neutral-400">Origem:</span>
                              <strong className="text-neutral-900 dark:text-white font-semibold">{conn.sourceLabel}</strong>
                            </span>
                            <button
                              type="button"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                disconnectHandle(node.id, 'input');
                              }}
                              title="Desconectar entrada"
                              className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 hover:text-red-500 transition-colors cursor-pointer shrink-0 ml-1"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={node.config?.input_array_field || ''}
                            onMouseDown={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            onChange={(e) => updateNodeConfig(node.id, { input_array_field: e.target.value })}
                            placeholder="items ou {{rag.results}}"
                            className="w-full text-xs p-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 focus:outline-none font-mono"
                          />
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                        <div>
                          <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block mb-0.5">Coleta:</span>
                          <select
                            value={node.config?.collect_strategy || 'append'}
                            onMouseDown={(e) => e.stopPropagation()}
                            onChange={(e) => updateNodeConfig(node.id, { collect_strategy: e.target.value })}
                            className="w-full text-[11px] p-1.5 rounded-md bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 focus:outline-none"
                          >
                            <option value="append">Append (Lista)</option>
                            <option value="last">Last (Último)</option>
                          </select>
                        </div>
                        <div>
                          <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block mb-0.5">Máx:</span>
                          <NumberInput
                            variant="stepper"
                            min={1}
                            max={50}
                            value={node.config?.max_iterations || 50}
                            onChange={(val) => updateNodeConfig(node.id, { max_iterations: val })}
                          />
                        </div>
                      </div>

                      {/* Loop Body & Complete Handles on Right */}
                      <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[10px] flex items-center gap-1">
                            <Repeat className="w-3 h-3" />
                            Corpo do Loop (Iteração)
                          </span>
                          <div
                            onClick={(e) => handleHandleClick(e, node.id, 'loop_body', true)}
                            onMouseDown={(e) => e.stopPropagation()}
                            title="Saída para o corpo do loop"
                            className={`w-4 h-4 rounded-full border-2 bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center cursor-pointer transition-all ${
                              connectingPort?.nodeId === node.id && connectingPort?.handleId === 'loop_body'
                                ? 'border-emerald-500 bg-emerald-500 scale-125'
                                : 'border-emerald-500/70 hover:border-emerald-500 hover:scale-110'
                            }`}
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-neutral-500 dark:text-neutral-400 font-semibold text-[10px] flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                            Após Concluir Loop
                          </span>
                          <div
                            onClick={(e) => handleHandleClick(e, node.id, 'loop_complete', true)}
                            onMouseDown={(e) => e.stopPropagation()}
                            title="Saída após conclusão de todas as iterações"
                            className={`w-4 h-4 rounded-full border-2 bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center cursor-pointer transition-all ${
                              connectingPort?.nodeId === node.id && connectingPort?.handleId === 'loop_complete'
                                ? 'border-neutral-900 dark:border-white bg-neutral-900 dark:bg-white scale-125'
                                : 'border-neutral-400 dark:border-neutral-600 hover:border-neutral-900 dark:hover:border-white hover:scale-110'
                            }`}
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-neutral-500 dark:bg-neutral-400" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 10. HUMAN APPROVAL NODE */}
                {node.type === 'human_approval' && (() => {
                  const conn = getConnectedSourceInfo(node.id, 'input');
                  return (
                    <div className="mt-1 space-y-2">
                      <div className="relative">
                        <div
                          onClick={(e) => handleHandleClick(e, node.id, 'input', false)}
                          onMouseDown={(e) => e.stopPropagation()}
                          title="Entrada de Dados — Conectar cabo aqui"
                          className={`absolute -left-[22px] top-[26px] -translate-y-1/2 w-4 h-4 rounded-full border-2 bg-white dark:bg-neutral-900 flex items-center justify-center cursor-pointer transition-all z-20 ${
                            connectingPort && connectingPort.isOutput && connectingPort.nodeId !== node.id
                              ? 'border-emerald-500 bg-emerald-500/20 scale-125 animate-pulse'
                              : 'border-neutral-400 dark:border-neutral-600 hover:border-neutral-900 dark:hover:border-white'
                          }`}
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-neutral-500 dark:bg-neutral-400" />
                        </div>

                        <div className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-1 flex items-center justify-between">
                          <span>Instrução de Aprovação</span>
                          {conn && <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block mr-1" />Conectado</span>}
                        </div>

                        <textarea
                          rows={2}
                          value={node.config?.approval_message || ''}
                          onMouseDown={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          onChange={(e) => updateNodeConfig(node.id, { approval_message: e.target.value })}
                          placeholder="Mensagem para o operador humano revisar..."
                          className="w-full text-xs p-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 focus:outline-none resize-none"
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-neutral-500 dark:text-neutral-400 px-1">
                        <span className="flex items-center gap-1">
                          <UserCheck className="w-3 h-3 text-amber-500" />
                          Perfil: <strong>{node.config?.assigned_roles?.join(', ') || 'admin, owner'}</strong>
                        </span>
                        <span>Timeout: <strong>{node.config?.timeout_hours || 24}h</strong></span>
                      </div>
                    </div>
                  );
                })()}

                {/* 11. SUB AGENT NODE */}
                {node.type === 'sub_agent' && (() => {
                  const conn = getConnectedSourceInfo(node.id, 'input');
                  const eligibleAgents = (agents || []).filter((a) => a.id !== activeAgent?.id);
                  return (
                    <div className="mt-1 space-y-2">
                      <div className="relative">
                        <div
                          onClick={(e) => handleHandleClick(e, node.id, 'input', false)}
                          onMouseDown={(e) => e.stopPropagation()}
                          title="Entrada do Sub-Agente — Conectar cabo aqui"
                          className={`absolute -left-[22px] top-[26px] -translate-y-1/2 w-4 h-4 rounded-full border-2 bg-white dark:bg-neutral-900 flex items-center justify-center cursor-pointer transition-all z-20 ${
                            connectingPort && connectingPort.isOutput && connectingPort.nodeId !== node.id
                              ? 'border-emerald-500 bg-emerald-500/20 scale-125 animate-pulse'
                              : 'border-neutral-400 dark:border-neutral-600 hover:border-neutral-900 dark:hover:border-white'
                          }`}
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-neutral-500 dark:bg-neutral-400" />
                        </div>

                        <div className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 mb-1 flex items-center justify-between">
                          <span>Agente Alvo</span>
                          {conn && <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block mr-1" />Entrada Conectada</span>}
                        </div>

                        <select
                          value={node.config?.target_agent_id || ''}
                          onMouseDown={(e) => e.stopPropagation()}
                          onChange={(e) => updateNodeConfig(node.id, { target_agent_id: e.target.value })}
                          className="w-full text-xs p-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 focus:outline-none"
                        >
                          <option value="">Selecione um agente...</option>
                          {eligibleAgents.map((ag) => (
                            <option key={ag.id} value={ag.id}>
                              {ag.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-neutral-500 dark:text-neutral-400 px-1">
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3 text-violet-500" />
                          Recursão máx: <strong>5 níveis</strong>
                        </span>
                      </div>
                    </div>
                  );
                })()}
                  </motion.div>
                </motion.div>
              );
            })}
        </AnimatePresence>
      </div>

      {/* Marquee Selection Box (Desktop OS Selector) */}
      {selectionBox && containerRef.current && (
        <div
          className="absolute border border-neutral-400/90 dark:border-white/60 bg-neutral-500/10 dark:bg-white/10 rounded-lg pointer-events-none z-20 shadow-sm"
          style={{
            left: `${Math.min(selectionBox.startX, selectionBox.currentX) - containerRef.current.getBoundingClientRect().left}px`,
            top: `${Math.min(selectionBox.startY, selectionBox.currentY) - containerRef.current.getBoundingClientRect().top}px`,
            width: `${Math.abs(selectionBox.currentX - selectionBox.startX)}px`,
            height: `${Math.abs(selectionBox.currentY - selectionBox.startY)}px`,
          }}
        />
      )}

      {/* Floating Controls (Canto Inferior Esquerdo: Zoom e Histórico Desfazer/Refazer) */}
      <div
        onMouseDown={(e) => e.stopPropagation()}
        data-no-canvas-select
        className="absolute bottom-5 left-6 z-40 flex items-center gap-2 pointer-events-auto"
      >
        {/* Zoom Controls Pill */}
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/95 dark:bg-[#1E1E1E]/95 border border-neutral-300 dark:border-neutral-700 backdrop-blur-md shadow-lg">
          <button
            onClick={zoomOut}
            disabled={zoom <= 0.4}
            title="Diminuir Zoom (-)"
            className="w-7 h-7 rounded-xl flex items-center justify-center text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>

          <button
            onClick={resetZoom}
            title="Clique para redefinir para 100%"
            className="px-2.5 py-1 text-xs font-semibold text-neutral-800 dark:text-neutral-200 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-all min-w-[50px] text-center cursor-pointer"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            onClick={zoomIn}
            disabled={zoom >= 2.0}
            title="Aumentar Zoom (+)"
            className="w-7 h-7 rounded-xl flex items-center justify-center text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>

          {zoom !== 1.0 && (
            <button
              onClick={resetZoom}
              title="Redefinir para 100%"
              className="w-7 h-7 rounded-xl flex items-center justify-center text-neutral-400 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all border-l border-neutral-200 dark:border-neutral-800 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Undo / Redo Controls Pill (ao lado direito do Zoom) */}
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/95 dark:bg-[#1E1E1E]/95 border border-neutral-300 dark:border-neutral-700 backdrop-blur-md shadow-lg">
          <button
            onClick={undo}
            disabled={!canUndo}
            title="Voltar ação (Ctrl+Z)"
            className="w-7 h-7 rounded-xl flex items-center justify-center text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <div className="w-[1px] h-3.5 bg-neutral-200 dark:bg-neutral-800 my-auto" />
          <button
            onClick={redo}
            disabled={!canRedo}
            title="Avançar ação (Ctrl+Y ou Ctrl+Shift+Z)"
            className="w-7 h-7 rounded-xl flex items-center justify-center text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Modal Interativo de Teste de Fluxo */}
      <WorkflowTestModal />

      {/* Pop-up de Configurações Específicas do Nó */}
      <NodeConfigModal />

      {/* Toast Notificação de Criação com IA com Suporte a Ctrl + Z */}
      <AnimatePresence>
        {aiToast && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.94, x: '-50%' }}
            animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
            exit={{ opacity: 0, y: 12, scale: 0.96, x: '-50%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 320, mass: 0.8 }}
            onMouseDown={(e) => e.stopPropagation()}
            data-no-canvas-select
            className="absolute bottom-6 left-1/2 z-50 px-4 py-2.5 rounded-2xl bg-neutral-900/95 dark:bg-white/95 text-white dark:text-neutral-900 shadow-2xl border border-neutral-700/80 dark:border-neutral-200 flex items-center gap-3.5 backdrop-blur-md pointer-events-auto"
          >
            <div className="w-7 h-7 rounded-xl bg-indigo-500/20 dark:bg-indigo-500/20 text-indigo-400 dark:text-indigo-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold tracking-tight">{aiToast.message}</div>
              {aiToast.submessage && (
                <div className="text-[11px] text-neutral-300 dark:text-neutral-600 font-medium mt-0.5">
                  {aiToast.submessage}
                </div>
              )}
            </div>
            <button
              onClick={() => setAiToast(null)}
              className="p-1 rounded-lg hover:bg-white/10 dark:hover:bg-neutral-200 text-neutral-400 dark:text-neutral-500 transition-colors ml-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
