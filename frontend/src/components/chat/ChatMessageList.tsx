import React, { useEffect, useRef } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { Bot, User as UserIcon, Image as ImageIcon, Square } from 'lucide-react';
import { PreciLogo } from '../common/PreciLogo';
import { MarkdownContent } from './MarkdownContent';

export const ChatMessageList: React.FC = () => {
  const { messages, isStreaming, streamingContent } = useChatStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8 space-y-6">
      {messages.map((msg) => {
        const isUser = msg.role === 'user';
        const isInterrupted =
          !isUser &&
          Boolean(
            msg.is_interrupted ||
              msg.attachments?.some((a: any) => a.type === 'interrupted')
          );
        const visibleAttachments = (msg.attachments || []).filter(
          (a: any) => a.type !== 'interrupted'
        );

        return (
          <div
            key={msg.id}
            className={`flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'}`}
          >
            {!isUser && (
              <div className="w-7 h-7 rounded-full border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0 mt-1 overflow-hidden p-0.5">
                <PreciLogo variant="icon" height={16} />
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                isUser
                  ? 'bg-neutral-900 dark:bg-neutral-800 text-white dark:text-[#F5F5F5] border border-neutral-800 dark:border-neutral-700/80 rounded-tr-sm shadow-sm'
                  : 'bg-white/80 dark:bg-transparent text-neutral-900 dark:text-current border border-neutral-200 dark:border-neutral-800/80 rounded-tl-sm shadow-sm'
              }`}
            >
              {msg.content ? <MarkdownContent content={msg.content} /> : null}

              {isInterrupted && (
                <div
                  className={`flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 ${
                    msg.content
                      ? 'mt-2.5 pt-2 border-t border-neutral-200/60 dark:border-neutral-800/80'
                      : 'py-0.5'
                  }`}
                >
                  <Square className="w-2.5 h-2.5 fill-amber-500/80 text-amber-500 shrink-0" />
                  <span className="italic font-normal">
                    Envio de mensagem interrompida pelo Usuário
                  </span>
                </div>
              )}

              {visibleAttachments.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-current/15 flex flex-wrap gap-2">
                  {visibleAttachments.map((att: any, idx: number) => {
                    const isImage =
                      (att.type && att.type.startsWith('image/')) ||
                      (att.url && att.url.startsWith('data:image/')) ||
                      /\.(png|jpe?g|webp|gif|svg)$/i.test(att.name || '');

                    const formatSize = (bytes: number) => {
                      if (!bytes) return '';
                      if (bytes < 1024) return `${bytes} B`;
                      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
                      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
                    };

                    if (isImage) {
                      return (
                        <div
                          key={idx}
                          onClick={() => att.url && window.open(att.url, '_blank')}
                          title={att.url ? 'Clique para visualizar imagem completa' : (att.name || 'Foto')}
                          className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-black/10 dark:bg-white/10 border border-current/15 text-xs shadow-sm transition-all ${
                            att.url ? 'cursor-pointer hover:bg-black/15 dark:hover:bg-white/15 hover:border-current/30' : ''
                          }`}
                        >
                          {att.url ? (
                            <img
                              src={att.url}
                              alt={att.name || 'Foto'}
                              className="w-5 h-5 rounded-md object-cover border border-current/20 shrink-0"
                            />
                          ) : (
                            <ImageIcon className="w-4 h-4 opacity-75 shrink-0" />
                          )}
                          <span className="truncate max-w-[180px] font-medium">
                            {att.name || 'foto.png'}
                          </span>
                          {att.size ? (
                            <span className="text-[10px] opacity-60">
                              {formatSize(att.size)}
                            </span>
                          ) : null}
                        </div>
                      );
                    }

                    return (
                      <div
                        key={idx}
                        className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-black/10 dark:bg-white/10 border border-current/15 text-xs shadow-sm"
                      >
                        <span className="text-[10px] font-mono uppercase opacity-75 px-1 py-0.5 rounded bg-black/10 dark:bg-white/10">
                          {att.name?.split('.').pop() || 'ARQ'}
                        </span>
                        <span className="truncate max-w-[180px] font-medium">
                          {att.name || 'Arquivo'}
                        </span>
                        {att.size ? (
                          <span className="text-[10px] opacity-60">
                            {formatSize(att.size)}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {isUser && (
              <div className="w-7 h-7 rounded-full border border-neutral-300 dark:border-neutral-700 bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center shrink-0 mt-1 text-neutral-700 dark:text-neutral-300">
                <UserIcon className="w-4 h-4" />
              </div>
            )}
          </div>
        );
      })}

      {/* Real-time Streaming chunk display */}
      {isStreaming && (
        <div className="flex gap-3.5 justify-start">
          <div className="w-7 h-7 rounded-full border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0 mt-1 animate-pulse overflow-hidden p-0.5">
            <PreciLogo variant="icon" height={16} />
          </div>
          <div className="max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed border border-neutral-200 dark:border-neutral-800/80 bg-white/80 dark:bg-transparent text-neutral-900 dark:text-current shadow-sm">
            {streamingContent ? (
              <MarkdownContent content={streamingContent} />
            ) : (
              <span className="inline-flex gap-1 items-center text-neutral-400 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce delay-100" />
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce delay-200" />
              </span>
            )}
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};
