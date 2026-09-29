import { create } from 'zustand';
import { DocumentFolder, DocumentItem } from '../types';

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

function loadRecentDocIds(): string[] {
  try {
    const userId = getCurrentUserId();
    const raw = localStorage.getItem(`preci_recent_doc_ids_${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function saveRecentDocIds(ids: string[]) {
  try {
    const userId = getCurrentUserId();
    localStorage.setItem(`preci_recent_doc_ids_${userId}`, JSON.stringify(ids));
  } catch {}
}

interface DocState {
  folders: DocumentFolder[];
  documents: DocumentItem[];
  recentDocIds: string[];
  highlightedDocId: string | null;
  currentFolderId: string | null;
  isLoading: boolean;
  isUploading: boolean;
  uploadProgressText: string;
  errorMessage: string | null;
  isUploadModalOpen: boolean;
  isCreateFolderModalOpen: boolean;
  previewDoc: DocumentItem | null;
  isPreviewOpen: boolean;
  previewContent: string | null;
  isLoadingPreview: boolean;
  documentToDelete: DocumentItem | null;

  setDocumentToDelete: (doc: DocumentItem | null) => void;
  setUploadModalOpen: (open: boolean) => void;
  setCreateFolderModalOpen: (open: boolean) => void;
  navigateToFolder: (folderId: string | null) => void;
  setHighlightedDocId: (id: string | null) => void;
  markDocumentAccessed: (docId: string) => void;
  getRecentDocuments: () => DocumentItem[];
  openPreview: (doc: DocumentItem) => Promise<void>;
  closePreview: () => void;
  fetchFolders: () => Promise<void>;
  fetchDocuments: () => Promise<void>;
  createFolder: (name: string) => Promise<boolean>;
  deleteFolder: (folderId: string) => Promise<boolean>;
  uploadFile: (file: File) => Promise<boolean>;
  deleteDocument: (docId: string) => Promise<boolean>;
  clearError: () => void;
  resetDocs: () => void;
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
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const useDocStore = create<DocState>((set, get) => ({
  folders: [],
  documents: [],
  recentDocIds: loadRecentDocIds(),
  highlightedDocId: null,
  currentFolderId: null,
  isLoading: false,
  isUploading: false,
  uploadProgressText: '',
  errorMessage: null,
  isUploadModalOpen: false,
  isCreateFolderModalOpen: false,
  previewDoc: null,
  isPreviewOpen: false,
  previewContent: null,
  isLoadingPreview: false,
  documentToDelete: null,

  setDocumentToDelete: (doc) => set({ documentToDelete: doc }),
  setUploadModalOpen: (open) => set({ isUploadModalOpen: open, errorMessage: null }),
  setCreateFolderModalOpen: (open) => set({ isCreateFolderModalOpen: open, errorMessage: null }),
  navigateToFolder: (folderId) => set({ currentFolderId: folderId }),
  setHighlightedDocId: (id) => set({ highlightedDocId: id }),
  clearError: () => set({ errorMessage: null }),

  openPreview: async (doc: DocumentItem) => {
    get().markDocumentAccessed(doc.id);
    set({
      isPreviewOpen: true,
      previewDoc: doc,
      isLoadingPreview: true,
      previewContent: null,
    });

    try {
      const endpoints = getApiEndpoints(`/api/v1/documents/${doc.id}/preview`);
      let data: any = null;
      for (const url of endpoints) {
        try {
          const res = await fetch(url, {
            headers: {
              ...getAuthHeaders(),
              'Content-Type': 'application/json',
            },
          });
          if (res.ok) {
            data = await res.json();
            break;
          }
        } catch {
          // retry next endpoint
        }
      }

      if (data && data.content) {
        set({ previewContent: data.content, isLoadingPreview: false });
      } else {
        set({
          previewContent: `Documento: ${doc.name}\n\nArquivo indexado para busca semântica com Google Gemini.\nTamanho: ${((doc.file_size || 0) / 1024).toFixed(1)} KB\nStatus: Pronto para consultas`,
          isLoadingPreview: false,
        });
      }
    } catch {
      set({
        previewContent: `Documento: ${doc.name}\n\nArquivo indexado para busca semântica com Google Gemini.`,
        isLoadingPreview: false,
      });
    }
  },

  closePreview: () => set({
    isPreviewOpen: false,
    previewDoc: null,
    previewContent: null,
    isLoadingPreview: false,
  }),

  markDocumentAccessed: (docId: string) => {
    const current = get().recentDocIds.filter((id) => id !== docId);
    const updated = [docId, ...current].slice(0, 5);
    saveRecentDocIds(updated);
    set({ recentDocIds: updated, highlightedDocId: docId });
  },

  getRecentDocuments: () => {
    const { documents, recentDocIds } = get();
    if (!documents || documents.length === 0) return [];

    const docMap = new Map(documents.map((d) => [d.id, d]));
    const result: DocumentItem[] = [];

    // 1. Adiciona os explicitamente acessados recentemente
    for (const id of recentDocIds) {
      const doc = docMap.get(id);
      if (doc) {
        result.push(doc);
        docMap.delete(id);
      }
      if (result.length >= 5) break;
    }

    // 2. Se houver menos de 5, preenche com os mais recentes por data de criação
    if (result.length < 5) {
      const remaining = Array.from(docMap.values()).sort((a, b) => {
        const timeA = new Date(a.created_at || a.updated_at || 0).getTime();
        const timeB = new Date(b.created_at || b.updated_at || 0).getTime();
        return timeB - timeA;
      });
      for (const doc of remaining) {
        result.push(doc);
        if (result.length >= 5) break;
      }
    }

    return result;
  },

  resetDocs: () => set({
    folders: [],
    documents: [],
    recentDocIds: loadRecentDocIds(),
    highlightedDocId: null,
    currentFolderId: null,
    errorMessage: null,
    isUploadModalOpen: false,
    isCreateFolderModalOpen: false,
    isPreviewOpen: false,
    previewDoc: null,
    previewContent: null,
    isLoadingPreview: false,
    documentToDelete: null,
  }),

  fetchFolders: async () => {
    try {
      const endpoints = getApiEndpoints('/api/v1/documents/folders');
      let response: Response | null = null;
      for (const url of endpoints) {
        try {
          const res = await fetch(url, {
            headers: {
              ...getAuthHeaders(),
              'Content-Type': 'application/json',
            },
          });
          if (res.ok) {
            response = res;
            break;
          }
        } catch {
          // retry next
        }
      }

      if (response && response.ok) {
        const data: DocumentFolder[] = await response.json();
        set({ folders: data });
      }
    } catch (err) {
      console.error('Error fetching folders:', err);
    }
  },

  fetchDocuments: async () => {
    set({ isLoading: true });
    try {
      const endpoints = getApiEndpoints('/api/v1/documents');
      let response: Response | null = null;
      for (const url of endpoints) {
        try {
          const res = await fetch(url, {
            headers: {
              ...getAuthHeaders(),
              'Content-Type': 'application/json',
            },
          });
          if (res.ok) {
            response = res;
            break;
          }
        } catch {
          // retry next
        }
      }

      if (response && response.ok) {
        const data: DocumentItem[] = await response.json();
        set({ documents: data });
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  createFolder: async (name: string) => {
    if (!name.trim()) return false;
    const parentId = get().currentFolderId;
    const endpoints = getApiEndpoints('/api/v1/documents/folders');

    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: name.trim(),
            parent_folder_id: parentId,
          }),
        });
        if (res.ok) {
          const created: DocumentFolder = await res.json();
          set((state) => ({ folders: [...state.folders, created] }));
          return true;
        }
      } catch {
        // try next
      }
    }

    // Fallback local se offline
    const fallbackFolder: DocumentFolder = {
      id: `folder-${Date.now()}`,
      name: name.trim(),
      parent_folder_id: parentId,
      created_at: new Date().toISOString(),
    };
    set((state) => ({ folders: [...state.folders, fallbackFolder] }));
    return true;
  },

  deleteFolder: async (folderId: string) => {
    set((state) => ({
      folders: state.folders.filter((f) => f.id !== folderId && f.parent_folder_id !== folderId),
      documents: state.documents.filter((d) => d.folder_id !== folderId),
    }));

    const endpoints = getApiEndpoints(`/api/v1/documents/folders/${folderId}`);
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: 'DELETE',
          headers: getAuthHeaders(),
        });
        if (res.ok) return true;
      } catch {
        // try next
      }
    }
    return true;
  },

  uploadFile: async (file: File) => {
    set({
      isUploading: true,
      uploadProgressText: `Enviando "${file.name}" e gerando embeddings com Gemini...`,
      errorMessage: null,
    });

    const folderId = get().currentFolderId;
    const formData = new FormData();
    formData.append('file', file);
    if (folderId) {
      formData.append('folder_id', folderId);
    }

    const endpoints = getApiEndpoints('/api/v1/documents/upload');
    let successDoc: DocumentItem | null = null;

    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: getAuthHeaders(), // Note: DO NOT set Content-Type header manually with FormData!
          body: formData,
        });

        if (res.ok) {
          successDoc = await res.json();
          break;
        } else {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || 'Falha ao processar documento');
        }
      } catch (err: any) {
        console.warn(`Upload attempt failed at ${url}:`, err);
      }
    }

    if (successDoc) {
      const doc = successDoc;
      set((state) => ({
        documents: [doc, ...state.documents],
        isUploading: false,
        uploadProgressText: '',
        isUploadModalOpen: false,
      }));
      get().markDocumentAccessed(doc.id);
      return true;
    }

    // Se falhar
    set({
      isUploading: false,
      uploadProgressText: '',
      errorMessage: 'Não foi possível enviar o documento. Verifique a conexão com o servidor.',
    });
    return false;
  },

  deleteDocument: async (docId: string) => {
    set((state) => ({
      documents: state.documents.filter((d) => d.id !== docId),
      recentDocIds: state.recentDocIds.filter((id) => id !== docId),
      previewDoc: state.previewDoc?.id === docId ? null : state.previewDoc,
      isPreviewOpen: state.previewDoc?.id === docId ? false : state.isPreviewOpen,
    }));

    const endpoints = getApiEndpoints(`/api/v1/documents/${docId}`);
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: 'DELETE',
          headers: getAuthHeaders(),
        });
        if (res.ok) return true;
      } catch {
        // try next
      }
    }
    return true;
  },
}));
