import React, { useEffect } from 'react';
import { useAuthStore } from './stores/authStore';
import { useNavigationStore } from './stores/navigationStore';
import { useThemeStore } from './stores/themeStore';
import { LoginPage } from './pages/LoginPage';
import { ChatPage } from './pages/ChatPage';
import { AgentsPage } from './pages/AgentsPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { Sidebar } from './components/layout/Sidebar';
import { LoadingScreen } from './components/layout/LoadingScreen';
import { DocumentPreviewModal } from './components/documents/DocumentPreviewModal';
import { DeleteDocumentModal } from './components/documents/DeleteDocumentModal';
import { DeleteConversationModal } from './components/chat/DeleteConversationModal';
import { DeleteAgentModal } from './components/agents/DeleteAgentModal';

export const App: React.FC = () => {
  const {
    isAuthenticated,
    isLoadingTransition,
    isLoggingOut,
    activateAuth,
    deactivateAuth,
    finishLoadingTransition,
    finishLogout,
  } = useAuthStore();
  const { activeTab } = useNavigationStore();
  const { theme } = useThemeStore();

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  }, [theme]);

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* Base Layer: shows LoginPage when unauthenticated, Main App when authenticated */}
      {!isAuthenticated ? (
        <LoginPage />
      ) : (
        <div className="flex h-screen w-screen overflow-hidden bg-[#F5F5F5] dark:bg-[#171717] text-[#171717] dark:text-[#F5F5F5] transition-colors duration-200">
          {/* Lateral Menu (Sidebar) */}
          <Sidebar />

          {/* Main Content Area */}
          <main className="flex-1 h-full relative overflow-hidden bg-[#F5F5F5] dark:bg-[#171717] text-[#171717] dark:text-[#F5F5F5] transition-colors duration-200">
            {activeTab === 'chats' && <ChatPage />}
            {activeTab === 'agents' && <AgentsPage />}
            {activeTab === 'documents' && <DocumentsPage />}
          </main>

          {/* Document Preview Pop-up */}
          <DocumentPreviewModal />

          {/* Delete Confirmation Pop-ups */}
          <DeleteDocumentModal />
          <DeleteConversationModal />
          <DeleteAgentModal />
        </div>
      )}

      {/* Login Transition: Fades in over LoginPage, silently activates auth at peak opacity, fades out revealing Main App */}
      {isLoadingTransition && (
        <LoadingScreen
          message="Iniciando ambiente seguro"
          onCovered={activateAuth}
          onComplete={finishLoadingTransition}
        />
      )}

      {/* Logout Transition: Fades in over Main App, silently deactivates auth at peak opacity, fades out revealing LoginPage */}
      {isLoggingOut && (
        <LoadingScreen
          message="Encerrando sessão..."
          onCovered={deactivateAuth}
          onComplete={finishLogout}
        />
      )}
    </div>
  );
};
