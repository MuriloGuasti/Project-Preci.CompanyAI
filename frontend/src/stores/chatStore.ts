import { create } from 'zustand';
import { Conversation, Message, AIModel, MessageAttachment } from '../types';

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Message[];
  messagesByConversation: Record<string, Message[]>;
  selectedModel: string;
  availableModels: AIModel[];
  isStreaming: boolean;
  streamingContent: string;
  pendingAttachments: MessageAttachment[];
  setPendingAttachments: (attachments: MessageAttachment[]) => void;
  addPendingAttachment: (attachment: MessageAttachment) => void;
  removePendingAttachment: (index: number) => void;
  clearPendingAttachments: () => void;
  conversationToDelete: Conversation | null;
  setConversationToDelete: (conv: Conversation | null) => void;
  fetchConversations: () => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  createNewConversation: () => Promise<string>;
  updateConversationTitle: (id: string, newTitle: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  setSelectedModel: (modelId: string) => void;
  sendMessage: (content: string, attachments?: MessageAttachment[]) => Promise<void>;
  stopGeneration: () => void;
  resetChat: () => void;
}

const generateUuid = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

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

function loadStoredConversations(): Conversation[] {
  try {
    const userId = getCurrentUserId();
    const raw = localStorage.getItem(`preci_conversations_${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.sort(
          (a, b) =>
            new Date(b.updated_at || b.created_at).getTime() -
            new Date(a.updated_at || a.created_at).getTime()
        );
      }
    }
  } catch {}
  return [];
}

function saveStoredConversations(convs: Conversation[]) {
  try {
    const userId = getCurrentUserId();
    localStorage.setItem(`preci_conversations_${userId}`, JSON.stringify(convs));
  } catch {}
}

function loadStoredMessagesByConv(): Record<string, Message[]> {
  try {
    const userId = getCurrentUserId();
    const raw = localStorage.getItem(`preci_messages_by_conv_${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch {}
  return {};
}

function saveStoredMessagesByConv(msgs: Record<string, Message[]>) {
  try {
    const userId = getCurrentUserId();
    localStorage.setItem(`preci_messages_by_conv_${userId}`, JSON.stringify(msgs));
  } catch {}
}

const initialConversations = loadStoredConversations();
const initialMessagesByConv = loadStoredMessagesByConv();

let activeAbortController: AbortController | null = null;

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: initialConversations,
  activeConversationId: null,
  messages: [],
  messagesByConversation: initialMessagesByConv,
  selectedModel: 'gemini-3.6-flash',
  availableModels: [
    {
      id: 'gemini-3.6-flash',
      provider: 'google',
      display_name: 'Gemini 3.6 Flash',
      enabled: true,
      max_tokens: 8192,
    },
  ],
  isStreaming: false,
  streamingContent: '',
  pendingAttachments: [],
  conversationToDelete: null,

  setSelectedModel: (modelId: string) => set({ selectedModel: modelId }),

  setConversationToDelete: (conv: Conversation | null) => set({ conversationToDelete: conv }),

  setPendingAttachments: (attachments: MessageAttachment[]) =>
    set({ pendingAttachments: attachments }),

  addPendingAttachment: (attachment: MessageAttachment) =>
    set((state) => ({ pendingAttachments: [...state.pendingAttachments, attachment] })),

  removePendingAttachment: (index: number) =>
    set((state) => ({
      pendingAttachments: state.pendingAttachments.filter((_, i) => i !== index),
    })),

  clearPendingAttachments: () => set({ pendingAttachments: [] }),

  resetChat: () => {
    if (activeAbortController) {
      try {
        activeAbortController.abort();
      } catch {}
      activeAbortController = null;
    }
    const convs = loadStoredConversations();
    const msgsByConv = loadStoredMessagesByConv();
    set({
      conversations: convs,
      activeConversationId: convs[0]?.id || null,
      messages: convs[0]?.id ? (msgsByConv[convs[0].id] || []) : [],
      messagesByConversation: msgsByConv,
      isStreaming: false,
      streamingContent: '',
      pendingAttachments: [],
      conversationToDelete: null,
    });
  },

  fetchConversations: async () => {
    const endpoints = getApiEndpoints('/api/v1/conversations');
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
            set({ conversations: sorted });
            saveStoredConversations(sorted);
            return;
          }
        }
      } catch {
        // Try next endpoint
      }
    }
  },

  selectConversation: async (id: string) => {
    const currentActiveId = get().activeConversationId;
    const currentMessages = get().messages;

    // 1. Salva mensagens da conversa atual localmente
    let updatedByConv = { ...get().messagesByConversation };
    if (currentActiveId && currentMessages.length > 0) {
      updatedByConv[currentActiveId] = currentMessages;
    }

    // 2. Carrega mensagens em cache para resposta imediata na tela
    const cachedMessages = updatedByConv[id] || [];

    set({
      activeConversationId: id,
      messages: cachedMessages,
      messagesByConversation: updatedByConv,
      streamingContent: '',
      isStreaming: false,
    });

    saveStoredMessagesByConv(updatedByConv);

    // 3. Sincroniza mensagens atualizadas do Supabase em segundo plano
    const endpoints = getApiEndpoints(`/api/v1/conversations/${id}/messages`);
    const headers = getAuthHeaders();

    for (const url of endpoints) {
      try {
        const resp = await fetch(url, { headers });
        if (resp.ok) {
          const serverMsgs = await resp.json();
          if (Array.isArray(serverMsgs)) {
            set((state) => {
              const nextByConv = {
                ...state.messagesByConversation,
                [id]: serverMsgs,
              };
              saveStoredMessagesByConv(nextByConv);
              return {
                messages: state.activeConversationId === id ? serverMsgs : state.messages,
                messagesByConversation: nextByConv,
              };
            });
            return;
          }
        }
      } catch {}
    }
  },

  createNewConversation: async () => {
    const currentActiveId = get().activeConversationId;
    const currentMessages = get().messages;

    let updatedByConv = { ...get().messagesByConversation };
    if (currentActiveId && currentMessages.length > 0) {
      updatedByConv[currentActiveId] = currentMessages;
    }

    const newId = generateUuid();
    const newConv: Conversation = {
      id: newId,
      title: 'Nova conversa',
      ai_model: get().selectedModel,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    updatedByConv[newId] = [];
    const updatedConvs = [newConv, ...get().conversations];

    set({
      conversations: updatedConvs,
      activeConversationId: newId,
      messages: [],
      messagesByConversation: updatedByConv,
      streamingContent: '',
      isStreaming: false,
    });

    saveStoredConversations(updatedConvs);
    saveStoredMessagesByConv(updatedByConv);

    // Grava no Supabase via backend
    const endpoints = getApiEndpoints('/api/v1/conversations');
    const headers = getAuthHeaders();
    for (const url of endpoints) {
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ id: newId, title: 'Nova conversa', ai_model: get().selectedModel }),
        });
        if (r.ok) break;
      } catch {}
    }

    return newId;
  },

  updateConversationTitle: async (id: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    const target = get().conversations.find((c) => c.id === id);
    if (!target) return;
    const updatedTarget: Conversation = {
      ...target,
      title: trimmed,
      updated_at: new Date().toISOString(),
    };
    const updatedConvs = [
      updatedTarget,
      ...get().conversations.filter((c) => c.id !== id),
    ];
    set({ conversations: updatedConvs });
    saveStoredConversations(updatedConvs);

    const endpoints = getApiEndpoints(`/api/v1/conversations/${id}`);
    const headers = getAuthHeaders();
    for (const url of endpoints) {
      try {
        const r = await fetch(url, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ title: trimmed }),
        });
        if (r.ok) break;
      } catch {}
    }
  },

  deleteConversation: async (id: string) => {
    const remainingConvs = get().conversations.filter((c) => c.id !== id);
    const updatedByConv = { ...get().messagesByConversation };
    delete updatedByConv[id];

    const currentActiveId = get().activeConversationId;
    const nextActiveId = currentActiveId === id ? (remainingConvs[0]?.id || null) : currentActiveId;
    const nextMessages = nextActiveId ? (updatedByConv[nextActiveId] || []) : [];

    set({
      conversations: remainingConvs,
      activeConversationId: nextActiveId,
      messages: nextMessages,
      messagesByConversation: updatedByConv,
    });

    saveStoredConversations(remainingConvs);
    saveStoredMessagesByConv(updatedByConv);

    const endpoints = getApiEndpoints(`/api/v1/conversations/${id}`);
    const headers = getAuthHeaders();
    for (const url of endpoints) {
      try {
        const r = await fetch(url, {
          method: 'DELETE',
          headers,
        });
        if (r.ok) break;
      } catch {}
    }
  },

  sendMessage: async (content: string, attachments = []) => {
    let convId = get().activeConversationId;
    if (!convId) {
      convId = await get().createNewConversation();
    }

    if (activeAbortController) {
      try {
        activeAbortController.abort();
      } catch {}
      activeAbortController = null;
    }

    const abortController = new AbortController();
    activeAbortController = abortController;

    const userMsgId = generateUuid();
    const userMsg: Message = {
      id: userMsgId,
      conversation_id: convId,
      role: 'user',
      content,
      attachments,
      created_at: new Date().toISOString(),
    };

    const newMessages = [...get().messages, userMsg];
    const updatedByConv = {
      ...get().messagesByConversation,
      [convId]: newMessages,
    };

    // Atualiza título da conversa se for a primeira mensagem e move conversa para o topo do histórico
    const currentConvs = get().conversations;
    const targetConv = currentConvs.find((c) => c.id === convId);
    let updatedTargetConv: Conversation;
    if (targetConv) {
      let title = targetConv.title;
      if (title === 'Nova conversa' && content.trim()) {
        title = content.length > 28 ? content.slice(0, 28) + '...' : content;
      }
      updatedTargetConv = {
        ...targetConv,
        title,
        updated_at: new Date().toISOString(),
      };
    } else {
      updatedTargetConv = {
        id: convId,
        title: content.length > 28 ? content.slice(0, 28) + '...' : (content || 'Nova conversa'),
        ai_model: get().selectedModel,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    const updatedConvs = [
      updatedTargetConv,
      ...currentConvs.filter((c) => c.id !== convId),
    ];

    set({
      messages: newMessages,
      messagesByConversation: updatedByConv,
      conversations: updatedConvs,
      isStreaming: true,
      streamingContent: '',
    });

    saveStoredConversations(updatedConvs);
    saveStoredMessagesByConv(updatedByConv);

    // Tentativa de streaming SSE com backend conectado ao Supabase
    const endpoints = getApiEndpoints(`/api/v1/conversations/${convId}/messages`);
    const headers = getAuthHeaders();
    let streamSuccess = false;

    for (const url of endpoints) {
      if (abortController.signal.aborted) break;

      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ content, attachments }),
          signal: abortController.signal,
        });

        if (resp && resp.ok && resp.body) {
          streamSuccess = true;
          const reader = resp.body.getReader();
          const decoder = new TextDecoder();
          let fullAssistantText = '';

          while (true) {
            if (abortController.signal.aborted) break;
            const { done, value } = await reader.read();
            if (done || abortController.signal.aborted) break;
            const chunkStr = decoder.decode(value);
            const lines = chunkStr.split('\n');
            for (const line of lines) {
              if (abortController.signal.aborted) break;
              if (line.startsWith('data: ')) {
                try {
                  const parsed = JSON.parse(line.slice(6));
                  if (parsed.chunk) {
                    fullAssistantText += parsed.chunk;
                    set({ streamingContent: fullAssistantText });
                  }
                  if (parsed.done) {
                    activeAbortController = null;
                    const assistantMsg: Message = {
                      id: parsed.message_id || generateUuid(),
                      conversation_id: convId,
                      role: 'assistant',
                      content: fullAssistantText,
                      created_at: new Date().toISOString(),
                    };
                    const finalMessages = [...get().messages, assistantMsg];
                    const finalByConv = {
                      ...get().messagesByConversation,
                      [convId]: finalMessages,
                    };
                    set({
                      messages: finalMessages,
                      messagesByConversation: finalByConv,
                      isStreaming: false,
                      streamingContent: '',
                    });
                    saveStoredMessagesByConv(finalByConv);
                    return;
                  }
                } catch {}
              }
            }
          }

          if (abortController.signal.aborted) {
            return;
          }
          return;
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || abortController.signal.aborted) {
          return;
        }
        // Try next endpoint
      }
    }

    if (abortController.signal.aborted) {
      return;
    }

    // Fallback simulado se offline
    if (!streamSuccess) {
      const promptSummary = content.trim() || (attachments.length > 0 ? `[Arquivo: ${attachments.map((a) => a.name).join(', ')}]` : '');
      const mockReply = `Resposta processada no ecossistema **preci.**:\n\nRecebi sua instrução: "${promptSummary}". Todo o contexto corporativo e nós de automação configurados estão sincronizados para otimizar seu fluxo de trabalho. Como podemos dar o próximo passo?`;

      let current = '';
      const words = mockReply.split(' ');
      for (const w of words) {
        if (abortController.signal.aborted) break;
        await new Promise((r) => setTimeout(r, 35));
        if (abortController.signal.aborted) break;
        current += w + ' ';
        set({ streamingContent: current });
      }

      if (abortController.signal.aborted) {
        return;
      }

      activeAbortController = null;
      const assistantMsg: Message = {
        id: generateUuid(),
        conversation_id: convId,
        role: 'assistant',
        content: current.trim(),
        created_at: new Date().toISOString(),
      };

      const finalMessages = [...get().messages, assistantMsg];
      const finalByConv = {
        ...get().messagesByConversation,
        [convId]: finalMessages,
      };

      set({
        messages: finalMessages,
        messagesByConversation: finalByConv,
        isStreaming: false,
        streamingContent: '',
      });

      saveStoredMessagesByConv(finalByConv);
    }
  },

  stopGeneration: () => {
    if (activeAbortController) {
      try {
        activeAbortController.abort();
      } catch {}
      activeAbortController = null;
    }

    const { isStreaming, streamingContent, activeConversationId, messages, messagesByConversation } = get();
    if (!isStreaming) return;

    if (!activeConversationId) {
      set({ isStreaming: false, streamingContent: '' });
      return;
    }

    const assistantMsg: Message = {
      id: generateUuid(),
      conversation_id: activeConversationId,
      role: 'assistant',
      content: (streamingContent || '').trim(),
      created_at: new Date().toISOString(),
      is_interrupted: true,
      attachments: [{ name: 'cancelled', type: 'interrupted', size: 0 }],
    };

    const finalMessages = [...messages, assistantMsg];
    const finalByConv = {
      ...messagesByConversation,
      [activeConversationId]: finalMessages,
    };

    set({
      messages: finalMessages,
      messagesByConversation: finalByConv,
      isStreaming: false,
      streamingContent: '',
    });

    saveStoredMessagesByConv(finalByConv);
  },
}));
