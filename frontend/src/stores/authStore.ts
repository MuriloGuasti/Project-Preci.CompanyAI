import { create } from 'zustand';
import { User } from '../types';
import { useAgentStore } from './agentStore';
import { useDocStore } from './docStore';
import { useChatStore } from './chatStore';

interface AuthState {
  user: User | null;
  token: string | null;
  pendingAuth: { user: User; token: string } | null;
  isAuthenticated: boolean;
  isLoadingTransition: boolean;
  isLoggingOut: boolean;
  login: (username: string, pass: string) => Promise<boolean>;
  activateAuth: () => void;
  deactivateAuth: () => void;
  logout: () => void;
  finishLoadingTransition: () => void;
  finishLogout: () => void;
}

const getSavedAuth = () => {
  try {
    const raw = localStorage.getItem('preci_user');
    const token = localStorage.getItem('preci_token');
    if (raw && token) {
      return { user: JSON.parse(raw) as User, token };
    }
  } catch {
    // Ignore error
  }
  return { user: null, token: null };
};

const initialAuth = getSavedAuth();

export const useAuthStore = create<AuthState>((set, get) => ({
  user: initialAuth.user,
  token: initialAuth.token,
  pendingAuth: null,
  isAuthenticated: !!initialAuth.user && !!initialAuth.token,
  isLoadingTransition: false,
  isLoggingOut: false,

  login: async (username: string, pass: string) => {
    try {
      const endpoints = Array.from(
        new Set([
          `${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/v1/auth/login`,
          'http://127.0.0.1:8000/api/v1/auth/login',
          'http://localhost:8000/api/v1/auth/login',
        ])
      );

      let resp: Response | null = null;
      for (const url of endpoints) {
        try {
          const r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password: pass }),
          });
          if (r.ok || r.status === 401) {
            resp = r;
            break;
          }
        } catch {
          // Try next endpoint
        }
      }

      if (resp && resp.ok) {
        const data = await resp.json();
        set({
          pendingAuth: { user: data.user, token: data.access_token },
          isLoadingTransition: true, // Trigger loading screen while keeping LoginPage visible for fade-in
        });
        return true;
      }

      return false;
    } catch {
      return false;
    }
  },

  activateAuth: () => {
    const pending = get().pendingAuth;
    if (pending) {
      try {
        localStorage.setItem('preci_user', JSON.stringify(pending.user));
        localStorage.setItem('preci_token', pending.token);
      } catch {}
      set({
        user: pending.user,
        token: pending.token,
        isAuthenticated: true,
        pendingAuth: null,
      });
      useAgentStore.getState().resetAgents();
      useDocStore.getState().resetDocs();
      useChatStore.getState().resetChat();
      useAgentStore.getState().fetchAgents();
      useChatStore.getState().fetchConversations();
    }
  },

  deactivateAuth: () => {
    try {
      localStorage.removeItem('preci_user');
      localStorage.removeItem('preci_token');
    } catch {}
    set({
      user: null,
      token: null,
      isAuthenticated: false,
    });
    useAgentStore.getState().resetAgents();
    useDocStore.getState().resetDocs();
    useChatStore.getState().resetChat();
  },

  finishLoadingTransition: () => {
    const pending = get().pendingAuth;
    if (pending) {
      try {
        localStorage.setItem('preci_user', JSON.stringify(pending.user));
        localStorage.setItem('preci_token', pending.token);
      } catch {}
      set({
        user: pending.user,
        token: pending.token,
        isAuthenticated: true,
        pendingAuth: null,
        isLoadingTransition: false,
      });
      useAgentStore.getState().resetAgents();
      useDocStore.getState().resetDocs();
      useChatStore.getState().resetChat();
      useAgentStore.getState().fetchAgents();
      useChatStore.getState().fetchConversations();
    } else {
      set({ isLoadingTransition: false });
    }
  },

  logout: () => {
    set({ isLoggingOut: true });
  },

  finishLogout: () => {
    try {
      localStorage.removeItem('preci_user');
      localStorage.removeItem('preci_token');
    } catch {}
    set({
      user: null,
      token: null,
      pendingAuth: null,
      isAuthenticated: false,
      isLoadingTransition: false,
      isLoggingOut: false,
    });
    useAgentStore.getState().resetAgents();
    useDocStore.getState().resetDocs();
    useChatStore.getState().resetChat();
  },
}));
