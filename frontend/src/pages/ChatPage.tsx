import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '../stores/chatStore';
import { useAuthStore } from '../stores/authStore';
import { ChatInput } from '../components/chat/ChatInput';
import { ChatMessageList } from '../components/chat/ChatMessageList';
import { PreciLogo } from '../components/common/PreciLogo';

const WELCOME_PHRASES = [
  'Olá, {user}',
  'Vamos decidir juntos?',
  'Em que posso te ajudar?',
  'Pronto para acelerar seus projetos?',
  'Qual é o desafio de hoje?',
];

export const ChatPage: React.FC = () => {
  const { messages } = useChatStore();
  const { user } = useAuthStore();

  const hasMessages = messages.length > 0;

  // Pick random phrase on mount
  const greeting = useMemo(() => {
    const raw = WELCOME_PHRASES[Math.floor(Math.random() * WELCOME_PHRASES.length)];
    const username = user?.full_name || 'admin';
    return raw.replace('{user}', username);
  }, [user]);

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-[#F5F5F5] dark:bg-[#171717] text-[#171717] dark:text-[#F5F5F5] transition-colors duration-200">
      {/* If has messages: render message history list with smooth fade-in */}
      {hasMessages ? (
        <motion.div
          key="messages-list-wrapper"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="flex-1 overflow-y-auto pb-36 pt-4"
        >
          <ChatMessageList />
        </motion.div>
      ) : (
        /* Before first message: Centered Greeting & Centered Input */
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <AnimatePresence>
            {!hasMessages && (
              <motion.div
                key="greeting-header"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20, transition: { duration: 0.25, ease: 'easeInOut' } }}
                className="flex flex-col items-center gap-3 mb-6"
              >
                <div className="w-12 h-12 rounded-2xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800/80 flex items-center justify-center shadow-lg p-2 transition-colors">
                  <PreciLogo variant="icon" height={26} />
                </div>
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-900 dark:text-white transition-colors">
                  {greeting}
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm transition-colors">
                  Converse com a inteligência artificial ou acione workflows corporativos
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Centered initial input */}
          <div className="w-full max-w-3xl px-4">
            <motion.div
              layoutId="chat-input-dock"
              transition={{
                type: 'spring',
                stiffness: 240,
                damping: 26,
                mass: 0.85,
              }}
              className="w-full"
            >
              <ChatInput hasMessages={false} />
            </motion.div>
          </div>
        </div>
      )}

      {/* When has messages: Floating bottom container with matching layoutId for smooth gliding */}
      {hasMessages && (
        <div className="absolute bottom-0 left-0 right-0 pointer-events-none pb-6 pt-10 bg-gradient-to-t from-[#F5F5F5] via-[#F5F5F5]/90 to-transparent dark:from-[#171717] dark:via-[#171717]/90 z-20">
          <div className="w-full max-w-3xl mx-auto px-4 pointer-events-auto">
            <motion.div
              layoutId="chat-input-dock"
              transition={{
                type: 'spring',
                stiffness: 240,
                damping: 26,
                mass: 0.85,
              }}
              className="w-full"
            >
              <ChatInput hasMessages={true} />
            </motion.div>
          </div>
        </div>
      )}
    </div>
  );
};
