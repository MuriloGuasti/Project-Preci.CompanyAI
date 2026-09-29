import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Bot,
  FolderClosed,
  Plus,
  PanelLeftClose,
  PanelLeft,
  Settings,
  HelpCircle,
  LogOut,
  ChevronRight,
  Trash2,
  FileText,
  FileCode,
  Eye,
} from 'lucide-react';
import { useNavigationStore } from '../../stores/navigationStore';
import { useChatStore } from '../../stores/chatStore';
import { useAgentStore } from '../../stores/agentStore';
import { useDocStore } from '../../stores/docStore';
import { useAuthStore } from '../../stores/authStore';
import { ThemeToggle } from './ThemeToggle';
import { PreciLogo } from '../common/PreciLogo';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, isSidebarOpen, toggleSidebar } = useNavigationStore();
  const {
    conversations,
    activeConversationId,
    selectConversation,
    createNewConversation,
    updateConversationTitle,
    setConversationToDelete,
    fetchConversations,
  } = useChatStore();
  const {
    agents,
    activeAgentId,
    selectAgent,
    createNewAgent,
    updateAgentName,
    setAgentToDelete,
    fetchAgents,
  } = useAgentStore();
  const {
    fetchDocuments,
    fetchFolders,
    getRecentDocuments,
    markDocumentAccessed,
    navigateToFolder,
    setUploadModalOpen,
    setDocumentToDelete,
    highlightedDocId,
    currentFolderId,
    openPreview,
    documents,
    recentDocIds,
  } = useDocStore();
  const { user, logout } = useAuthStore();

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    type: 'conversation' | 'agent';
    id: string;
    value: string;
  } | null>(null);

  useEffect(() => {
    fetchConversations();
    fetchAgents();
    fetchDocuments();
    fetchFolders();
  }, [fetchConversations, fetchAgents, fetchDocuments, fetchFolders]);

  const activeConvRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeConversationId && activeConvRef.current) {
      activeConvRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeConversationId]);

  const activeAgentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeAgentId && activeAgentRef.current) {
      activeAgentRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeAgentId]);

  React.useEffect(() => {
    if (!isProfileMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.profile-menu-container') && !target.closest('.profile-trigger')) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileMenuOpen]);

  const handleStartRename = (
    type: 'conversation' | 'agent',
    id: string,
    currentName: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingItem({ type, id, value: currentName });
  };

  const handleSaveRename = () => {
    if (!editingItem) return;
    const trimmed = editingItem.value.trim();
    if (trimmed) {
      if (editingItem.type === 'conversation') {
        updateConversationTitle(editingItem.id, trimmed);
      } else {
        updateAgentName(editingItem.id, trimmed);
      }
    }
    setEditingItem(null);
  };

  const handleCancelRename = () => {
    setEditingItem(null);
  };

  const handleNewChat = () => {
    setActiveTab('chats');
    createNewConversation();
  };

  const handleNewAgent = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveTab('agents');
    createNewAgent();
  };

  const handleToggleSidebar = () => {
    setIsProfileMenuOpen(false);
    toggleSidebar();
  };

  const recentDocs = getRecentDocuments();

  const getDocIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') {
      return <FileText className="w-3.5 h-3.5 text-rose-500 shrink-0" />;
    }
    if (['json', 'js', 'ts', 'tsx', 'py', 'html', 'css', 'sql'].includes(ext || '')) {
      return <FileCode className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
    }
    return <FileText className="w-3.5 h-3.5 text-sky-500 shrink-0" />;
  };

  const avatarInitial = user?.full_name ? user.full_name[0].toUpperCase() : 'A';

  return (
    <aside
      className={`h-screen relative flex flex-col border-r transition-all duration-300 ease-in-out select-none ${
        isProfileMenuOpen ? 'z-50' : 'z-[45]'
      } ${
        isSidebarOpen ? 'w-64' : 'w-16'
      } bg-[#EFEFEF] dark:bg-[#131313] border-neutral-300 dark:border-neutral-800 text-neutral-900 dark:text-[#F5F5F5]`}
    >
      {/* Inner wrapper with overflow-hidden for the sliding views */}
      <div className="w-full h-full relative overflow-hidden">
        {/* Expanded View */}
        <div
          className={`absolute inset-0 w-64 min-w-[16rem] h-full flex flex-col justify-between transition-all duration-300 ease-in-out ${
            isSidebarOpen
              ? 'opacity-100 translate-x-0 pointer-events-auto'
              : 'opacity-0 -translate-x-6 pointer-events-none'
          }`}
        >
          {/* Brand Header */}
          <div className="px-4 py-3 flex items-center justify-between border-b border-neutral-300/80 dark:border-neutral-800/80 shrink-0">
            <PreciLogo variant="logomarca" height={18} />
          </div>

          {/* Top Header: New Chat & Toggle Collapse */}
          <div className="p-3 flex items-center justify-between border-b border-neutral-300/80 dark:border-neutral-800/80 shrink-0">
            <button
              onClick={handleNewChat}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white/80 dark:bg-neutral-800/60 hover:bg-white dark:hover:bg-neutral-700/70 transition-all text-neutral-800 dark:text-neutral-200 hover:text-neutral-950 dark:hover:text-white"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova conversa</span>
            </button>
            <button
              onClick={handleToggleSidebar}
              title="Recolher menu lateral"
              className="p-1.5 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>

          {/* Main Content Sections */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-4">
            {/* Section: Chats */}
            <div>
              <div
                onClick={() => setActiveTab('chats')}
                className={`flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                  activeTab === 'chats'
                    ? 'text-neutral-950 dark:text-white font-medium'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
                  <MessageSquare className="w-4 h-4" />
                  <span>Conversas</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNewChat();
                  }}
                  title="Nova Conversa"
                  className="p-1 rounded text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              <div
                className={`mt-1 space-y-0.5 pl-2 pr-1 scroll-smooth ${
                  conversations.length > 10
                    ? 'max-h-[302px] overflow-y-auto overflow-x-hidden'
                    : 'overflow-hidden'
                }`}
              >
                {conversations.map((conv) => {
                  const isActive = activeTab === 'chats' && activeConversationId === conv.id;
                  const isEditing = editingItem?.type === 'conversation' && editingItem.id === conv.id;

                  if (isEditing) {
                    return (
                      <div key={conv.id} className="px-1 py-0.5">
                        <input
                          type="text"
                          autoFocus
                          value={editingItem.value}
                          onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename();
                            if (e.key === 'Escape') handleCancelRename();
                          }}
                          onBlur={handleSaveRename}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full px-2 py-1 text-xs rounded-md bg-white dark:bg-neutral-900 border border-neutral-400 dark:border-neutral-600 text-neutral-950 dark:text-white outline-none ring-1 ring-neutral-400 dark:ring-neutral-500 shadow-sm"
                        />
                      </div>
                    );
                  }

                  return (
                    <div
                      key={conv.id}
                      ref={isActive ? activeConvRef : null}
                      className="group relative flex items-center w-full"
                    >
                      <button
                        onClick={() => {
                          setActiveTab('chats');
                          selectConversation(conv.id);
                        }}
                        onDoubleClick={(e) => handleStartRename('conversation', conv.id, conv.title, e)}
                        title="Clique 2 vezes para renomear"
                        className={`w-full text-left pl-2.5 pr-7 py-1.5 text-xs rounded-md truncate transition-all ${
                          isActive
                            ? 'bg-neutral-300/80 dark:bg-neutral-800 text-neutral-950 dark:text-white font-medium'
                            : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/70 dark:hover:bg-neutral-800/50 hover:text-neutral-900 dark:hover:text-neutral-200'
                        }`}
                      >
                        {conv.title}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConversationToDelete(conv);
                        }}
                        title="Excluir"
                        className="absolute right-1 p-1 rounded opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-neutral-200 dark:hover:bg-neutral-700/80 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section: Agents */}
            <div>
              <div
                onClick={() => setActiveTab('agents')}
                className={`flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                  activeTab === 'agents'
                    ? 'text-neutral-950 dark:text-white font-medium'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
                  <Bot className="w-4 h-4" />
                  <span>Agentes</span>
                </div>
                <button
                  onClick={handleNewAgent}
                  title="Novo Agente"
                  className="p-1 rounded text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-800"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              <div
                className={`mt-1 space-y-0.5 pl-2 pr-1 scroll-smooth ${
                  agents.length > 5
                    ? 'max-h-[152px] overflow-y-auto overflow-x-hidden'
                    : 'overflow-hidden'
                }`}
              >
                {agents.map((agent) => {
                  const isActive = activeTab === 'agents' && activeAgentId === agent.id;
                  const isEditing = editingItem?.type === 'agent' && editingItem.id === agent.id;

                  if (isEditing) {
                    return (
                      <div key={agent.id} className="px-1 py-0.5">
                        <input
                          type="text"
                          autoFocus
                          value={editingItem.value}
                          onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename();
                            if (e.key === 'Escape') handleCancelRename();
                          }}
                          onBlur={handleSaveRename}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full px-2 py-1 text-xs rounded-md bg-white dark:bg-neutral-900 border border-neutral-400 dark:border-neutral-600 text-neutral-950 dark:text-white outline-none ring-1 ring-neutral-400 dark:ring-neutral-500 shadow-sm"
                        />
                      </div>
                    );
                  }

                  return (
                    <div
                      key={agent.id}
                      ref={isActive ? activeAgentRef : null}
                      className="group relative flex items-center w-full"
                    >
                      <button
                        onClick={() => {
                          setActiveTab('agents');
                          selectAgent(agent.id);
                        }}
                        onDoubleClick={(e) => handleStartRename('agent', agent.id, agent.name, e)}
                        title="Clique 2 vezes para renomear"
                        className={`w-full text-left pl-2.5 pr-7 py-1.5 text-xs rounded-md truncate transition-all ${
                          isActive
                            ? 'bg-neutral-300/80 dark:bg-neutral-800 text-neutral-950 dark:text-white font-medium'
                            : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/70 dark:hover:bg-neutral-800/50 hover:text-neutral-900 dark:hover:text-neutral-200'
                        }`}
                      >
                        {agent.name}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAgentToDelete(agent);
                        }}
                        title="Excluir"
                        className="absolute right-1 p-1 rounded opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-neutral-200 dark:hover:bg-neutral-700/80 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section: Documents */}
            <div>
              <div
                onClick={() => setActiveTab('documents')}
                className={`flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                  activeTab === 'documents'
                    ? 'text-neutral-950 dark:text-white font-medium'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
                  <FolderClosed className="w-4 h-4" />
                  <span>Documentos</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTab('documents');
                    setUploadModalOpen(true);
                  }}
                  title="Adicionar documento"
                  className="p-1 rounded text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              <div className="mt-1 space-y-0.5 pl-2 pr-1">
                {recentDocs.length > 0 ? (
                  recentDocs.map((doc) => {
                    const isSelected = activeTab === 'documents' && highlightedDocId === doc.id;
                    return (
                      <div
                        key={doc.id}
                        className="group relative flex items-center w-full"
                      >
                        <button
                          onClick={() => {
                            setActiveTab('documents');
                            navigateToFolder(doc.folder_id || null);
                            markDocumentAccessed(doc.id);
                          }}
                          title={`${doc.name} (Clique para abrir na pasta)`}
                          className={`w-full flex items-center gap-2 text-left pl-2.5 pr-14 py-1.5 text-xs rounded-md truncate transition-all ${
                            isSelected
                              ? 'bg-neutral-300/80 dark:bg-neutral-800 text-neutral-950 dark:text-white font-medium'
                              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/70 dark:hover:bg-neutral-800/50 hover:text-neutral-900 dark:hover:text-neutral-200'
                          }`}
                        >
                          {getDocIcon(doc.name)}
                          <span className="truncate">{doc.name}</span>
                        </button>
                        <div className="absolute right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openPreview(doc);
                            }}
                            title="Visualizar documento"
                            className="p-1 rounded text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-700/80 transition-all"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDocumentToDelete(doc);
                            }}
                            title="Excluir documento"
                            className="p-1 rounded text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-neutral-200 dark:hover:bg-neutral-700/80 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="px-2.5 py-1 text-[11px] text-neutral-400 dark:text-neutral-500 italic">
                    Nenhum documento recente
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Profile Area & Theme Toggle */}
          <div className="p-2 border-t border-neutral-300/80 dark:border-neutral-800/80 shrink-0">
            <div className="flex items-center justify-between p-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsProfileMenuOpen((prev) => !prev);
                }}
                className="profile-trigger flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity text-left outline-none min-w-0"
              >
                <div className="w-7 h-7 rounded-full border border-neutral-300 dark:border-neutral-600 bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center font-semibold text-xs text-neutral-900 dark:text-white shrink-0">
                  {avatarInitial}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate max-w-[140px]">
                    {user?.full_name || 'Admin'}
                  </span>
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate max-w-[140px]">
                    {user?.email || 'admin@preci.local'}
                  </span>
                </div>
              </button>
              <ThemeToggle />
            </div>
          </div>
        </div>

        {/* Collapsed View */}
        <div
          className={`absolute inset-0 w-16 min-w-[4rem] h-full flex flex-col justify-between transition-all duration-300 ease-in-out ${
            isSidebarOpen
              ? 'opacity-0 pointer-events-none'
              : 'opacity-100 translate-x-0 pointer-events-auto delay-75'
          }`}
        >
          {/* Brand Header */}
          <div className="px-4 py-3 flex items-center justify-center border-b border-neutral-300/80 dark:border-neutral-800/80 shrink-0">
            <PreciLogo variant="icon" height={20} />
          </div>

          {/* Top Header */}
          <div className="p-3 flex flex-col items-center gap-2 border-b border-neutral-300/80 dark:border-neutral-800/80 shrink-0">
            <button
              onClick={handleToggleSidebar}
              title="Expandir menu lateral"
              className="p-2 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNewChat}
              title="Nova conversa"
              className="p-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white/80 dark:bg-neutral-800 hover:bg-white dark:hover:bg-neutral-700 transition-colors text-neutral-800 dark:text-neutral-200"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Main Content Sections */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 flex flex-col items-center gap-3">
            <button
              onClick={() => setActiveTab('chats')}
              title="Conversas"
              className={`p-2 rounded-lg flex items-center justify-center transition-colors ${
                activeTab === 'chats'
                  ? 'bg-neutral-300/80 dark:bg-neutral-800 text-neutral-950 dark:text-white font-medium'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-800'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
            </button>

            <button
              onClick={() => setActiveTab('agents')}
              title="Agentes"
              className={`p-2 rounded-lg flex items-center justify-center transition-colors ${
                activeTab === 'agents'
                  ? 'bg-neutral-300/80 dark:bg-neutral-800 text-neutral-950 dark:text-white font-medium'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-800'
              }`}
            >
              <Bot className="w-4 h-4" />
            </button>

            <button
              onClick={() => setActiveTab('documents')}
              title="Documentos"
              className={`p-2 rounded-lg flex items-center justify-center transition-colors ${
                activeTab === 'documents'
                  ? 'bg-neutral-300/80 dark:bg-neutral-800 text-neutral-950 dark:text-white font-medium'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-800'
              }`}
            >
              <FolderClosed className="w-4 h-4" />
            </button>
          </div>

          {/* Bottom Profile Area & Theme Toggle */}
          <div className="p-2 border-t border-neutral-300/80 dark:border-neutral-800/80 shrink-0">
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsProfileMenuOpen((prev) => !prev);
                }}
                title={user?.full_name || 'Perfil do Usuário'}
                className="profile-trigger w-8 h-8 rounded-full border border-neutral-300 dark:border-neutral-600 bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center font-semibold text-xs text-neutral-900 dark:text-white cursor-pointer hover:ring-2 hover:ring-neutral-400 dark:hover:ring-neutral-600 transition-all outline-none"
              >
                {avatarInitial}
              </button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>

      {/* Profile Popover Menu (positioned relative to aside so it floats outside when collapsed) */}
      <AnimatePresence>
        {isProfileMenuOpen && (
          <motion.div
            initial={
              isSidebarOpen
                ? { opacity: 0, y: 10, scale: 0.95 }
                : { opacity: 0, x: -10, y: 4, scale: 0.94 }
            }
            animate={
              isSidebarOpen
                ? { opacity: 1, y: 0, scale: 1 }
                : { opacity: 1, x: 0, y: 0, scale: 1 }
            }
            exit={
              isSidebarOpen
                ? { opacity: 0, y: 6, scale: 0.97 }
                : { opacity: 0, x: -8, y: 2, scale: 0.96 }
            }
            transition={{ type: 'spring', damping: 25, stiffness: 320, mass: 0.8 }}
            className={`profile-menu-container absolute z-50 p-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700/80 bg-white dark:bg-[#1A1A1A] text-neutral-800 dark:text-neutral-300 shadow-2xl space-y-1 ${
              isSidebarOpen ? 'bottom-16 left-2 right-2' : 'left-full ml-2 bottom-2 w-52'
            }`}
          >
            <div className="px-2.5 py-1.5 border-b border-neutral-200 dark:border-neutral-800 mb-1">
              <p className="text-xs font-semibold text-neutral-900 dark:text-white truncate">
                {user?.full_name || 'Admin'}
              </p>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                {user?.email || 'admin@preci.local'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsProfileMenuOpen(false)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-neutral-700 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-left cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Configurações</span>
            </button>
            <button
              type="button"
              onClick={() => setIsProfileMenuOpen(false)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-neutral-700 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-left cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Ajuda</span>
            </button>
            <div className="h-px bg-neutral-200 dark:bg-neutral-800 my-1" />
            <button
              type="button"
              onClick={() => {
                setIsProfileMenuOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-left cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
};
