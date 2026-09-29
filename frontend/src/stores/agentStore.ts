import { create } from 'zustand';
import {
  Agent,
  AgentNode,
  AgentEdge,
  ExecutionLog,
  AgentExecutionResult,
  NodeExecutionStatus,
  NodeExecutionResult,
} from '../types';

interface AgentState {
  agents: Agent[];
  activeAgentId: string;
  isDrawerOpen: boolean;
  isAiDrawerOpen: boolean;
  aiToast: { message: string; submessage?: string } | null;
  isLogModalOpen: boolean;
  isTestModalOpen: boolean;
  isExecuting: boolean;
  executingNodeId: string | null;
  nodeStatuses: Record<string, NodeExecutionStatus>;
  nodeResults: Record<string, NodeExecutionResult>;
  executionLogs: ExecutionLog[];
  executionResult: AgentExecutionResult | null;
  selectedNodeId: string | null;
  selectedNodeIds: string[];
  history: Record<string, AgentHistory>;

  undo: () => void;
  redo: () => void;
  recordHistory: () => void;

  setDrawerOpen: (open: boolean) => void;
  setAiDrawerOpen: (open: boolean) => void;
  setAiToast: (toast: { message: string; submessage?: string } | null) => void;
  setLogModalOpen: (open: boolean) => void;
  setTestModalOpen: (open: boolean) => void;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedNodeIds: (ids: string[]) => void;
  setNodeStatus: (nodeId: string, status: NodeExecutionStatus) => void;
  resetNodeStatuses: () => void;
  selectAgent: (id: string) => void;
  fetchAgents: () => Promise<void>;
  createNewAgent: () => Promise<void>;
  updateAgentName: (id: string, newName: string) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  addNode: (type: AgentNode['type'], label: string) => void;
  removeNode: (nodeId: string) => void;
  removeNodes: (nodeIds: string[]) => void;
  addEdge: (sourceId: string, targetId: string, sourceHandle?: string, targetHandle?: string) => void;
  disconnectHandle: (nodeId: string, targetHandle: string) => void;
  removeEdge: (edgeId: string) => void;
  updateNodePosition: (nodeId: string, x: number, y: number) => void;
  updateMultipleNodePositions: (positions: { id: string; x: number; y: number }[]) => void;
  updateNodeConfig: (nodeId: string, config: Record<string, any>, label?: string) => Promise<void>;
  executeWorkflow: (inputVariables?: Record<string, any>) => Promise<void>;
  approveExecution: (executionId: string, note?: string) => Promise<{ ok: boolean; message?: string }>;
  rejectExecution: (executionId: string, reason?: string) => Promise<{ ok: boolean; message?: string }>;
  generateWorkflowWithAi: (prompt: string, mode?: 'replace' | 'append') => Promise<{ ok: boolean; message: string; count?: number }>;
  agentToDelete: Agent | null;
  setAgentToDelete: (agent: Agent | null) => void;
  resetAgents: () => void;
}

export interface WorkflowSnapshot {
  nodes: AgentNode[];
  edges: AgentEdge[];
}

export interface AgentHistory {
  past: WorkflowSnapshot[];
  future: WorkflowSnapshot[];
}

function cloneWorkflowSnapshot(agent: Agent): WorkflowSnapshot {
  return {
    nodes: agent.nodes.map((n) => ({
      ...n,
      position: { ...n.position },
      config: { ...n.config },
    })),
    edges: agent.edges.map((e) => ({ ...e })),
  };
}

function recordSnapshot(
  history: Record<string, AgentHistory>,
  agent: Agent | undefined
): Record<string, AgentHistory> {
  if (!agent) return history;
  const current = history[agent.id] || { past: [], future: [] };
  const snapshot = cloneWorkflowSnapshot(agent);

  return {
    ...history,
    [agent.id]: {
      past: [...current.past, snapshot].slice(-50),
      future: [],
    },
  };
}

const getApiEndpoints = (path: string): string[] => {
  const envUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
  return Array.from(
    new Set([
      `${envUrl}${path}`,
      `http://127.0.0.1:8000${path}`,
      `http://localhost:8000${path}`,
    ])
  );
};

const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('preci_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const syncAgentToBackend = (agent: Agent) => {
  const endpoints = getApiEndpoints(`/api/v1/agents/${agent.id}`);
  const headers = getAuthHeaders();
  for (const url of endpoints) {
    fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        name: agent.name,
        description: agent.description,
        nodes: agent.nodes,
        edges: agent.edges,
      }),
    }).catch(() => {});
  }
};

function getCurrentUserId(): string {
  try {
    const raw = localStorage.getItem('preci_user');
    if (raw) {
      const u = JSON.parse(raw);
      if (u && u.id) return u.id;
    }
  } catch {}
  return 'guest';
}

function loadStoredAgents(): Agent[] {
  try {
    const userId = getCurrentUserId();
    const raw = localStorage.getItem(`preci_agents_${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((a: Agent) => a.id !== 'agent-default-1')
          .map((a: Agent) => ({
            ...a,
            nodes: (a.nodes || []).map((n: AgentNode, idx: number) => {
              if (!n.position || (n.position.x <= 30 && n.position.y <= 30)) {
                return {
                  ...n,
                  position: {
                    x: 100 + (idx % 3) * 260,
                    y: 150 + Math.floor(idx / 3) * 160,
                  },
                };
              }
              return n;
            }),
          }))
          .sort(
            (a, b) =>
              new Date(b.updated_at || b.created_at).getTime() -
              new Date(a.updated_at || a.created_at).getTime()
          );
      }
    }
  } catch {}
  return [];
}

function saveStoredAgents(agents: Agent[]) {
  try {
    const userId = getCurrentUserId();
    localStorage.setItem(`preci_agents_${userId}`, JSON.stringify(agents));
  } catch {}
}

let positionDebounceTimer: any = null;

const initialAgents = loadStoredAgents();

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: initialAgents,
  activeAgentId: initialAgents[0]?.id || '',
  isDrawerOpen: false,
  isAiDrawerOpen: false,
  aiToast: null,
  isLogModalOpen: false,
  isTestModalOpen: false,
  isExecuting: false,
  executingNodeId: null,
  nodeStatuses: {},
  nodeResults: {},
  executionLogs: [],
  executionResult: null,
  selectedNodeId: null,
  selectedNodeIds: [],
  history: {},
  agentToDelete: null,

  setAgentToDelete: (agent) => set({ agentToDelete: agent }),

  undo: () => {
    const activeAgentId = get().activeAgentId || get().agents[0]?.id;
    if (!activeAgentId) return;
    const activeAgent = get().agents.find((a) => a.id === activeAgentId);
    if (!activeAgent) return;

    const currentHistory = get().history[activeAgentId] || { past: [], future: [] };
    if (currentHistory.past.length === 0) return;

    const previousSnapshot = currentHistory.past[currentHistory.past.length - 1];
    const newPast = currentHistory.past.slice(0, -1);
    const currentSnapshot = cloneWorkflowSnapshot(activeAgent);

    const updatedAgent: Agent = {
      ...activeAgent,
      nodes: previousSnapshot.nodes,
      edges: previousSnapshot.edges,
      updated_at: new Date().toISOString(),
    };

    const updatedAgents = get().agents.map((a) => (a.id === activeAgentId ? updatedAgent : a));

    set((state) => ({
      agents: updatedAgents,
      history: {
        ...state.history,
        [activeAgentId]: {
          past: newPast,
          future: [currentSnapshot, ...currentHistory.future].slice(0, 50),
        },
      },
      selectedNodeIds: state.selectedNodeIds.filter((id) =>
        previousSnapshot.nodes.some((n) => n.id === id)
      ),
    }));

    saveStoredAgents(updatedAgents);
    syncAgentToBackend(updatedAgent);
  },

  redo: () => {
    const activeAgentId = get().activeAgentId || get().agents[0]?.id;
    if (!activeAgentId) return;
    const activeAgent = get().agents.find((a) => a.id === activeAgentId);
    if (!activeAgent) return;

    const currentHistory = get().history[activeAgentId] || { past: [], future: [] };
    if (currentHistory.future.length === 0) return;

    const nextSnapshot = currentHistory.future[0];
    const newFuture = currentHistory.future.slice(1);
    const currentSnapshot = cloneWorkflowSnapshot(activeAgent);

    const updatedAgent: Agent = {
      ...activeAgent,
      nodes: nextSnapshot.nodes,
      edges: nextSnapshot.edges,
      updated_at: new Date().toISOString(),
    };

    const updatedAgents = get().agents.map((a) => (a.id === activeAgentId ? updatedAgent : a));

    set((state) => ({
      agents: updatedAgents,
      history: {
        ...state.history,
        [activeAgentId]: {
          past: [...currentHistory.past, currentSnapshot].slice(-50),
          future: newFuture,
        },
      },
      selectedNodeIds: state.selectedNodeIds.filter((id) =>
        nextSnapshot.nodes.some((n) => n.id === id)
      ),
    }));

    saveStoredAgents(updatedAgents);
    syncAgentToBackend(updatedAgent);
  },

  recordHistory: () => {
    const activeAgentId = get().activeAgentId || get().agents[0]?.id;
    if (!activeAgentId) return;
    const activeAgent = get().agents.find((a) => a.id === activeAgentId);
    if (!activeAgent) return;

    set((state) => ({
      history: recordSnapshot(state.history, activeAgent),
    }));
  },

  setDrawerOpen: (open) => set({ isDrawerOpen: open }),
  setAiDrawerOpen: (open) => set({ isAiDrawerOpen: open }),
  setAiToast: (toast) => set({ aiToast: toast }),
  setLogModalOpen: (open) => set({ isLogModalOpen: open }),
  setTestModalOpen: (open) => set({ isTestModalOpen: open }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id, selectedNodeIds: id ? [id] : [] }),
  setSelectedNodeIds: (ids) =>
    set((state) => ({
      selectedNodeIds: ids,
      selectedNodeId:
        state.selectedNodeId && ids.includes(state.selectedNodeId) ? state.selectedNodeId : null,
    })),
  setNodeStatus: (nodeId, status) =>
    set((state) => ({
      nodeStatuses: { ...state.nodeStatuses, [nodeId]: status },
    })),
  resetNodeStatuses: () => set({ nodeStatuses: {}, nodeResults: {} }),

  selectAgent: (id) => set({ activeAgentId: id }),

  resetAgents: () => {
    const loaded = loadStoredAgents();
    set({
      agents: loaded,
      activeAgentId: loaded[0]?.id || '',
      agentToDelete: null,
      executionLogs: [],
      executionResult: null,
      executingNodeId: null,
      selectedNodeId: null,
      selectedNodeIds: [],
      history: {},
      isDrawerOpen: false,
      isLogModalOpen: false,
      isTestModalOpen: false,
    });
  },

  fetchAgents: async () => {
    const endpoints = getApiEndpoints('/api/v1/agents');
    const headers = getAuthHeaders();

    for (const url of endpoints) {
      try {
        const resp = await fetch(url, { headers });
        if (resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data)) {
            const sorted = [...data].sort(
              (a, b) =>
                new Date(b.updated_at || b.created_at).getTime() -
                new Date(a.updated_at || a.created_at).getTime()
            );
            set({
              agents: sorted,
              activeAgentId: sorted.some((a: Agent) => a.id === get().activeAgentId)
                ? get().activeAgentId
                : sorted[0]?.id || '',
            });
            saveStoredAgents(sorted);
            return;
          }
        }
      } catch {
        // Try next endpoint
      }
    }
  },

  createNewAgent: async () => {
    const newId = `agent-${Date.now()}`;
    const initialNodes: AgentNode[] = [
      {
        id: `node-trig-${Date.now()}`,
        type: 'trigger',
        label: 'Disparador Manual',
        position: { x: 100, y: 160 },
      },
    ];

    const newAgent: Agent = {
      id: newId,
      name: `Novo Agente ${get().agents.length + 1}`,
      description: 'Workflow configurável com nós',
      status: 'draft',
      nodes: initialNodes,
      edges: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const updated = [newAgent, ...get().agents];
    set({
      agents: updated,
      activeAgentId: newId,
    });
    saveStoredAgents(updated);

    const endpoints = getApiEndpoints('/api/v1/agents');
    const headers = getAuthHeaders();
    for (const url of endpoints) {
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: newAgent.name,
            description: newAgent.description,
            nodes: newAgent.nodes,
            edges: newAgent.edges,
          }),
        });
        if (resp.ok) {
          const created: Agent = await resp.json();
          set((state) => ({
            agents: state.agents.map((a) => (a.id === newId ? created : a)),
            activeAgentId: created.id,
          }));
          saveStoredAgents(get().agents);
          break;
        }
      } catch {}
    }
  },

  updateAgentName: async (id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const target = get().agents.find((a) => a.id === id);
    if (!target) return;
    const updatedAgent: Agent = { ...target, name: trimmed, updated_at: new Date().toISOString() };
    const updated = [updatedAgent, ...get().agents.filter((a) => a.id !== id)];
    set({ agents: updated });
    saveStoredAgents(updated);

    const endpoints = getApiEndpoints(`/api/v1/agents/${id}`);
    const headers = getAuthHeaders();
    for (const url of endpoints) {
      try {
        const resp = await fetch(url, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ name: trimmed }),
        });
        if (resp.ok) break;
      } catch {}
    }
  },

  deleteAgent: async (id: string) => {
    const remaining = get().agents.filter((a) => a.id !== id);
    const currentActiveId = get().activeAgentId;
    const nextActiveId = currentActiveId === id ? (remaining[0]?.id || '') : currentActiveId;

    set({
      agents: remaining,
      activeAgentId: nextActiveId,
      selectedNodeId: null,
    });
    saveStoredAgents(remaining);

    const endpoints = getApiEndpoints(`/api/v1/agents/${id}`);
    const headers = getAuthHeaders();
    for (const url of endpoints) {
      try {
        const resp = await fetch(url, {
          method: 'DELETE',
          headers,
        });
        if (resp.ok) break;
      } catch {}
    }
  },

  addNode: (type, label) => {
    const activeAgent = get().agents.find((a) => a.id === get().activeAgentId);
    if (!activeAgent) return;

    const newHistory = recordSnapshot(get().history, activeAgent);

    // Calculate a nice staggered position
    const nodeCount = activeAgent.nodes.length;
    const x = 120 + (nodeCount % 3) * 260;
    const y = 140 + Math.floor(nodeCount / 3) * 160;

    const newNode: AgentNode = {
      id: `node-${Date.now()}`,
      type,
      label,
      position: { x, y },
      config: {},
    };

    // Auto-link to last node if applicable
    const lastNode = activeAgent.nodes[activeAgent.nodes.length - 1];
    const newEdges = [...activeAgent.edges];
    if (lastNode) {
      newEdges.push({
        id: `edge-${Date.now()}`,
        source_node_id: lastNode.id,
        target_node_id: newNode.id,
      });
    }

    const updatedAgent: Agent = {
      ...activeAgent,
      nodes: [...activeAgent.nodes, newNode],
      edges: newEdges,
      updated_at: new Date().toISOString(),
    };

    const updated = [updatedAgent, ...get().agents.filter((a) => a.id !== activeAgent.id)];
    set({
      agents: updated,
      history: newHistory,
      isDrawerOpen: false,
    });
    saveStoredAgents(updated);
    syncAgentToBackend(updatedAgent);
  },

  removeNode: (nodeId) => {
    const targetAgentId = get().activeAgentId || get().agents[0]?.id;
    const activeAgent = get().agents.find((a) => a.id === targetAgentId);
    if (!activeAgent) return;

    const newHistory = recordSnapshot(get().history, activeAgent);

    const updatedAgent: Agent = {
      ...activeAgent,
      nodes: activeAgent.nodes.filter((n) => n.id !== nodeId),
      edges: activeAgent.edges.filter(
        (e) => e.source_node_id !== nodeId && e.target_node_id !== nodeId
      ),
      updated_at: new Date().toISOString(),
    };

    const updated = [updatedAgent, ...get().agents.filter((a) => a.id !== activeAgent.id)];
    set({
      agents: updated,
      history: newHistory,
      activeAgentId: activeAgent.id,
      selectedNodeId: get().selectedNodeId === nodeId ? null : get().selectedNodeId,
      selectedNodeIds: get().selectedNodeIds.filter((id) => id !== nodeId),
    });
    saveStoredAgents(updated);
    syncAgentToBackend(updatedAgent);
  },

  addEdge: (sourceId, targetId, sourceHandle, targetHandle) => {
    const activeAgent = get().agents.find((a) => a.id === get().activeAgentId);
    if (!activeAgent || sourceId === targetId) return;

    let filteredEdges = activeAgent.edges;
    if (targetHandle) {
      // An input handle can only have one incoming connection
      filteredEdges = filteredEdges.filter(
        (e) => !(e.target_node_id === targetId && e.target_handle === targetHandle)
      );
    } else {
      const exists = filteredEdges.some(
        (e) =>
          e.source_node_id === sourceId &&
          e.target_node_id === targetId &&
          (e.source_handle || 'output') === (sourceHandle || 'output')
      );
      if (exists) return;
    }

    const newHistory = recordSnapshot(get().history, activeAgent);

    const newEdge: AgentEdge = {
      id: `edge-${Date.now()}`,
      source_node_id: sourceId,
      target_node_id: targetId,
      source_handle: sourceHandle || 'output',
      target_handle: targetHandle,
    };

    const updatedAgent: Agent = {
      ...activeAgent,
      edges: [...filteredEdges, newEdge],
      updated_at: new Date().toISOString(),
    };

    const updated = [updatedAgent, ...get().agents.filter((a) => a.id !== activeAgent.id)];
    set({ agents: updated, history: newHistory });
    saveStoredAgents(updated);
    syncAgentToBackend(updatedAgent);
  },

  disconnectHandle: (nodeId, targetHandle) => {
    const activeAgent = get().agents.find((a) => a.id === get().activeAgentId);
    if (!activeAgent) return;

    const newHistory = recordSnapshot(get().history, activeAgent);

    const updatedAgent: Agent = {
      ...activeAgent,
      edges: activeAgent.edges.filter(
        (e) => !(e.target_node_id === nodeId && e.target_handle === targetHandle)
      ),
      updated_at: new Date().toISOString(),
    };

    const updated = [updatedAgent, ...get().agents.filter((a) => a.id !== activeAgent.id)];
    set({ agents: updated, history: newHistory });
    saveStoredAgents(updated);
    syncAgentToBackend(updatedAgent);
  },

  removeEdge: (edgeId) => {
    const activeAgent = get().agents.find((a) => a.id === get().activeAgentId);
    if (!activeAgent) return;

    const newHistory = recordSnapshot(get().history, activeAgent);

    const updatedAgent: Agent = {
      ...activeAgent,
      edges: activeAgent.edges.filter((e) => e.id !== edgeId),
      updated_at: new Date().toISOString(),
    };

    const updated = [updatedAgent, ...get().agents.filter((a) => a.id !== activeAgent.id)];
    set({ agents: updated, history: newHistory });
    saveStoredAgents(updated);
    syncAgentToBackend(updatedAgent);
  },

  updateNodePosition: (nodeId, x, y) => {
    const activeAgent = get().agents.find((a) => a.id === get().activeAgentId);
    if (!activeAgent) return;

    const updatedAgent: Agent = {
      ...activeAgent,
      nodes: activeAgent.nodes.map((n) => (n.id === nodeId ? { ...n, position: { x, y } } : n)),
    };

    const updated = get().agents.map((a) => (a.id === activeAgent.id ? updatedAgent : a));
    set({ agents: updated });

    if (positionDebounceTimer) clearTimeout(positionDebounceTimer);
    positionDebounceTimer = setTimeout(() => {
      const current = get().agents;
      const target = current.find((a) => a.id === activeAgent.id);
      if (target) {
        const bumped: Agent = {
          ...target,
          updated_at: new Date().toISOString(),
        };
        const reordered = [bumped, ...current.filter((a) => a.id !== activeAgent.id)];
        set({ agents: reordered });
        saveStoredAgents(reordered);
        syncAgentToBackend(bumped);
      }
    }, 200);
  },

  updateMultipleNodePositions: (positions) => {
    const activeAgent = get().agents.find((a) => a.id === get().activeAgentId);
    if (!activeAgent || !positions.length) return;

    const posMap = new Map(positions.map((p) => [p.id, p]));
    const updatedAgent: Agent = {
      ...activeAgent,
      nodes: activeAgent.nodes.map((n) => {
        const found = posMap.get(n.id);
        return found ? { ...n, position: { x: found.x, y: found.y } } : n;
      }),
    };

    const updated = get().agents.map((a) => (a.id === activeAgent.id ? updatedAgent : a));
    set({ agents: updated });

    if (positionDebounceTimer) clearTimeout(positionDebounceTimer);
    positionDebounceTimer = setTimeout(() => {
      const current = get().agents;
      const target = current.find((a) => a.id === activeAgent.id);
      if (target) {
        const bumped: Agent = {
          ...target,
          updated_at: new Date().toISOString(),
        };
        const reordered = [bumped, ...current.filter((a) => a.id !== activeAgent.id)];
        set({ agents: reordered });
        saveStoredAgents(reordered);
        syncAgentToBackend(bumped);
      }
    }, 200);
  },

  removeNodes: (nodeIds) => {
    const targetAgentId = get().activeAgentId || get().agents[0]?.id;
    const activeAgent = get().agents.find((a) => a.id === targetAgentId);
    if (!activeAgent || !nodeIds || !nodeIds.length) return;

    const newHistory = recordSnapshot(get().history, activeAgent);

    const idSet = new Set(nodeIds);
    const updatedAgent: Agent = {
      ...activeAgent,
      nodes: activeAgent.nodes.filter((n) => !idSet.has(n.id)),
      edges: activeAgent.edges.filter(
        (e) => !idSet.has(e.source_node_id) && !idSet.has(e.target_node_id)
      ),
      updated_at: new Date().toISOString(),
    };

    const updated = [updatedAgent, ...get().agents.filter((a) => a.id !== activeAgent.id)];
    set({
      agents: updated,
      history: newHistory,
      activeAgentId: activeAgent.id,
      selectedNodeId: null,
      selectedNodeIds: [],
    });
    saveStoredAgents(updated);
    syncAgentToBackend(updatedAgent);
  },

  updateNodeConfig: async (nodeId, config, label) => {
    const activeAgent = get().agents.find((a) => a.id === get().activeAgentId);
    if (!activeAgent) return;

    const newHistory = recordSnapshot(get().history, activeAgent);

    const updatedAgent: Agent = {
      ...activeAgent,
      nodes: activeAgent.nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              config: { ...n.config, ...config },
              ...(label && label.trim() ? { label: label.trim() } : {}),
            }
          : n
      ),
      updated_at: new Date().toISOString(),
    };

    const updated = [updatedAgent, ...get().agents.filter((a) => a.id !== activeAgent.id)];
    set({ agents: updated, history: newHistory });
    saveStoredAgents(updated);
    syncAgentToBackend(updatedAgent);
  },

  executeWorkflow: async (inputVariables) => {
    const activeAgent = get().agents.find((a) => a.id === get().activeAgentId);
    if (!activeAgent) return;

    // Reset and initialize all nodes to 'idle'
    const initialStatuses: Record<string, NodeExecutionStatus> = {};
    activeAgent.nodes.forEach((n) => {
      initialStatuses[n.id] = 'idle';
    });

    set({
      isExecuting: true,
      executingNodeId: activeAgent.nodes[0]?.id || null,
      nodeStatuses: initialStatuses,
      nodeResults: {},
      isTestModalOpen: false,
      isLogModalOpen: false,
      executionLogs: [],
      executionResult: null,
    });

    const endpoints = getApiEndpoints(`/api/v1/agents/${activeAgent.id}/execute`);
    const headers = getAuthHeaders();

    let execData: any = null;

    for (const url of endpoints) {
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ input_variables: inputVariables || {} }),
        });
        if (resp && resp.ok) {
          execData = await resp.json();
          break;
        }
      } catch {}
    }

    if (execData) {
      const nodeResults: Record<string, NodeExecutionResult> = execData.node_results || {};
      const nodeKeys = Object.keys(nodeResults);
      const animNodes = nodeKeys.length > 0 ? nodeKeys : activeAgent.nodes.map((n) => n.id);

      for (const nid of animNodes) {
        // Step 1: Running
        set((state) => ({
          executingNodeId: nid,
          nodeStatuses: { ...state.nodeStatuses, [nid]: 'running' },
        }));
        await new Promise((r) => setTimeout(r, 350));

        // Step 2: Final state for this node
        const nodeRes = nodeResults[nid];
        const status: NodeExecutionStatus = nodeRes?.status === 'waiting_approval'
          ? 'waiting_approval'
          : nodeRes?.status === 'error'
          ? 'error'
          : 'success';
        set((state) => ({
          nodeStatuses: { ...state.nodeStatuses, [nid]: status },
          nodeResults: { ...state.nodeResults, [nid]: nodeRes },
        }));
      }

      set({
        executionLogs: execData.logs || [],
        executionResult: {
          ...execData,
          node_statuses: get().nodeStatuses,
        },
        executingNodeId: null,
        isExecuting: false,
        isLogModalOpen: true,
      });
      return;
    }

    // Offline simulation fallback
    const logs: ExecutionLog[] = [
      {
        timestamp: new Date().toLocaleTimeString(),
        level: 'INFO',
        message: `Iniciando execução do agente '${activeAgent.name}' (Modo Offline)`,
      },
    ];
    set({ executionLogs: [...logs] });

    for (const node of activeAgent.nodes) {
      set((state) => ({
        executingNodeId: node.id,
        nodeStatuses: { ...state.nodeStatuses, [node.id]: 'running' },
      }));
      await new Promise((r) => setTimeout(r, 350));

      set((state) => ({
        nodeStatuses: { ...state.nodeStatuses, [node.id]: 'success' },
      }));

      logs.push({
        timestamp: new Date().toLocaleTimeString(),
        level: 'SUCCESS',
        message: `Nó [${node.type}]: '${node.label}' executado com sucesso.`,
        node_id: node.id,
      });
      set({ executionLogs: [...logs] });
    }

    set({
      executingNodeId: null,
      isExecuting: false,
      isLogModalOpen: true,
    });
  },

  approveExecution: async (executionId: string, note?: string) => {
    const endpoints = getApiEndpoints(`/api/v1/executions/${executionId}/approve`);
    const headers = getAuthHeaders();
    let updatedData: any = null;
    let lastError = '';

    for (const url of endpoints) {
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ note: note || 'Aprovado via painel de controle' }),
        });
        if (resp && resp.ok) {
          updatedData = await resp.json();
          break;
        } else {
          const errData = await resp.json().catch(() => ({}));
          lastError = errData.detail || `Erro HTTP ${resp.status}`;
        }
      } catch (err: any) {
        lastError = err.message || 'Erro de conexão';
      }
    }

    if (updatedData) {
      const nodeResults: Record<string, NodeExecutionResult> = updatedData.node_results || {};
      const newStatuses: Record<string, NodeExecutionStatus> = { ...get().nodeStatuses };
      for (const [nid, res] of Object.entries(nodeResults)) {
        newStatuses[nid] = res.status === 'waiting_approval' ? 'waiting_approval' : res.status === 'error' ? 'error' : 'success';
      }

      set({
        executionLogs: updatedData.logs || get().executionLogs,
        nodeStatuses: newStatuses,
        nodeResults: { ...get().nodeResults, ...nodeResults },
        executionResult: {
          ...updatedData,
          node_statuses: newStatuses,
        },
      });
      return { ok: true };
    }

    return { ok: false, message: lastError || 'Falha ao aprovar execução' };
  },

  rejectExecution: async (executionId: string, reason?: string) => {
    const endpoints = getApiEndpoints(`/api/v1/executions/${executionId}/reject`);
    const headers = getAuthHeaders();
    let updatedData: any = null;
    let lastError = '';

    for (const url of endpoints) {
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ reason: reason || 'Rejeitado via painel de controle' }),
        });
        if (resp && resp.ok) {
          updatedData = await resp.json();
          break;
        } else {
          const errData = await resp.json().catch(() => ({}));
          lastError = errData.detail || `Erro HTTP ${resp.status}`;
        }
      } catch (err: any) {
        lastError = err.message || 'Erro de conexão';
      }
    }

    if (updatedData) {
      const nodeResults: Record<string, NodeExecutionResult> = updatedData.node_results || {};
      const newStatuses: Record<string, NodeExecutionStatus> = { ...get().nodeStatuses };
      for (const [nid, res] of Object.entries(nodeResults)) {
        newStatuses[nid] = res.status === 'waiting_approval' ? 'waiting_approval' : res.status === 'error' ? 'error' : 'success';
      }

      set({
        executionLogs: updatedData.logs || get().executionLogs,
        nodeStatuses: newStatuses,
        nodeResults: { ...get().nodeResults, ...nodeResults },
        executionResult: {
          ...updatedData,
          node_statuses: newStatuses,
        },
      });
      return { ok: true };
    }

    return { ok: false, message: lastError || 'Falha ao rejeitar execução' };
  },

  generateWorkflowWithAi: async (prompt: string, mode: 'replace' | 'append' = 'replace') => {
    const activeAgentId = get().activeAgentId || get().agents[0]?.id;
    if (!activeAgentId) return { ok: false, message: 'Nenhum agente selecionado' };

    const activeAgent = get().agents.find((a) => a.id === activeAgentId);
    if (!activeAgent) return { ok: false, message: 'Agente ativo não encontrado' };

    // 1. Registra snapshot no histórico para permitir Ctrl + Z instantâneo
    get().recordHistory();

    const endpoints = getApiEndpoints(`/api/v1/agents/${activeAgentId}/generate-workflow`);
    const headers = getAuthHeaders();

    let data: any = null;
    let lastError = '';

    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ prompt, mode }),
        });
        if (res.ok) {
          data = await res.json();
          break;
        } else {
          const errData = await res.json().catch(() => ({}));
          lastError = errData.detail || `Erro HTTP ${res.status}`;
        }
      } catch (err: any) {
        lastError = err.message || 'Falha de conexão com o servidor';
      }
    }

    if (!data || !data.nodes || data.nodes.length === 0) {
      return {
        ok: false,
        message: lastError || 'Não foi possível desenhar o fluxo no momento. Tente novamente.',
      };
    }

    let finalNodes: AgentNode[] = [];
    let finalEdges: AgentEdge[] = [];

    if (mode === 'append' && activeAgent.nodes && activeAgent.nodes.length > 0) {
      // 2. Cálculo dinâmico de Offset no modo 'append' (Adicionar ao fluxo existente)
      const currentXCoordinates = activeAgent.nodes.map((n) => n.position?.x ?? 0);
      const maxCurrentX = currentXCoordinates.length > 0 ? Math.max(...currentXCoordinates) : 0;
      const xOffset = maxCurrentX + 320;

      const genXCoordinates = data.nodes.map((n: AgentNode) => n.position?.x ?? 0);
      const minGenX = genXCoordinates.length > 0 ? Math.min(...genXCoordinates) : 0;

      const uniquePrefix = `ai-${Date.now().toString(36)}`;
      const idMap: Record<string, string> = {};

      const shiftedNodes: AgentNode[] = data.nodes.map((n: AgentNode, idx: number) => {
        const newId = `${uniquePrefix}-${idx}-${n.type}`;
        idMap[n.id] = newId;
        return {
          ...n,
          id: newId,
          position: {
            x: xOffset + ((n.position?.x ?? 0) - minGenX),
            y: n.position?.y ?? 180,
          },
        };
      });

      const shiftedEdges: AgentEdge[] = (data.edges || []).map((e: AgentEdge, idx: number) => ({
        ...e,
        id: `edge-${uniquePrefix}-${idx}`,
        source_node_id: idMap[e.source_node_id] || e.source_node_id,
        target_node_id: idMap[e.target_node_id] || e.target_node_id,
      }));

      finalNodes = [...activeAgent.nodes, ...shiftedNodes];
      finalEdges = [...(activeAgent.edges || []), ...shiftedEdges];
    } else {
      // Modo 'replace'
      finalNodes = data.nodes;
      finalEdges = data.edges || [];
    }

    const updatedAgent: Agent = {
      ...activeAgent,
      name:
        data.name &&
        (activeAgent.name.startsWith('Novo Agente') ||
          activeAgent.name.startsWith('Agente ') ||
          activeAgent.name === 'Fluxo em Branco')
          ? data.name
          : activeAgent.name,
      description: data.description || activeAgent.description,
      nodes: finalNodes,
      edges: finalEdges,
      updated_at: new Date().toISOString(),
    };

    const updatedAgents = [
      updatedAgent,
      ...get().agents.filter((a) => a.id !== activeAgentId),
    ];

    const newlyCreatedIds = (mode === 'append' ? finalNodes.slice(activeAgent.nodes.length) : finalNodes).map(
      (n) => n.id
    );

    set({
      agents: updatedAgents,
      selectedNodeIds: newlyCreatedIds,
      selectedNodeId: newlyCreatedIds[0] || null,
      isAiDrawerOpen: false,
      aiToast: {
        message: `Fluxo gerado com sucesso! (${newlyCreatedIds.length} nós criados)`,
        submessage: 'Pressione Ctrl + Z a qualquer momento para desfazer.',
      },
    });

    saveStoredAgents(updatedAgents);
    syncAgentToBackend(updatedAgent);

    return {
      ok: true,
      message: data.explanation || 'Workflow gerado com sucesso!',
      count: newlyCreatedIds.length,
    };
  },
}));
