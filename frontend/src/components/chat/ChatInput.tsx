import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, Paperclip, X, FileText, FileSpreadsheet, FileCode, Square } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { MessageAttachment } from '../../types';

interface ChatInputProps {
  hasMessages: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ hasMessages: _hasMessages }) => {
  const {
    sendMessage,
    stopGeneration,
    isStreaming,
    pendingAttachments,
    addPendingAttachment,
    removePendingAttachment,
    clearPendingAttachments,
  } = useChatStore();
  const [content, setContent] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea as content grows or shrinks
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [content]);

  // Foco automático quando anexos forem injetados externamente
  useEffect(() => {
    if (pendingAttachments.length > 0 && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [pendingAttachments.length]);

  const handleSend = () => {
    if ((!content.trim() && pendingAttachments.length === 0) || isStreaming) return;
    const sendText = content.trim() || 'Por favor, analise o documento anexado.';
    sendMessage(sendText, pendingAttachments);
    setContent('');
    clearPendingAttachments();
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      files.forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const base64Data = dataUrl.split(',')[1] || '';
          addPendingAttachment({
            name: file.name,
            size: file.size,
            type: file.type || 'application/octet-stream',
            url: dataUrl,
            data: base64Data,
          });
        };
        reader.readAsDataURL(file);
      });
      e.target.value = '';
    }
  };

  const removeFile = (idx: number) => {
    removePendingAttachment(idx);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string, name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (['csv', 'xlsx', 'xls'].includes(ext)) {
      return <FileSpreadsheet className="w-4 h-4 text-emerald-500" />;
    }
    if (['json', 'js', 'ts', 'tsx', 'py', 'html', 'css'].includes(ext)) {
      return <FileCode className="w-4 h-4 text-amber-500" />;
    }
    return <FileText className="w-4 h-4 text-indigo-500" />;
  };

  return (
    <div className="w-full relative z-10">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple
        className="hidden"
      />

      {/* Container with border matching sketch */}
      <div className="relative rounded-2xl border border-neutral-300 dark:border-neutral-700/80 bg-white dark:bg-[#1E1E1E] shadow-xl p-2.5 transition-all focus-within:border-neutral-500 dark:focus-within:border-neutral-400">
        {/* Attached files chips */}
        {pendingAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-2.5 border-b border-neutral-200 dark:border-neutral-800 mb-2">
            {pendingAttachments.map((file, idx) => {
              const isImage = file.type.startsWith('image/');
              return (
                <div
                  key={idx}
                  className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 shadow-sm transition-all"
                >
                  {isImage && file.url ? (
                    <img
                      src={file.url}
                      alt={file.name}
                      className="w-6 h-6 rounded-md object-cover border border-neutral-300 dark:border-neutral-700 shrink-0"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-md bg-neutral-200/80 dark:bg-neutral-700/70 flex items-center justify-center shrink-0">
                      {getFileIcon(file.type, file.name)}
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 min-w-0 max-w-[160px]">
                    <span className="truncate text-xs font-medium text-neutral-900 dark:text-neutral-100">
                      {file.name}
                    </span>
                    <span className="text-[10px] text-neutral-500 dark:text-neutral-400 shrink-0">
                      ({formatFileSize(file.size)})
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    title="Remover anexo"
                    className="p-1 rounded-full text-neutral-400 hover:text-red-500 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors ml-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* Direct attachment button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Anexar arquivos"
            className="p-2 rounded-xl text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Text input area */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Envie uma mensagem ou anexe arquivos..."
            className="flex-1 bg-transparent text-sm text-neutral-900 dark:text-[#F5F5F5] placeholder:text-neutral-400 dark:placeholder:text-neutral-500 resize-none outline-none max-h-32 py-1.5 leading-normal"
          />

          {/* Send or Stop Button in the exact same position */}
          {isStreaming ? (
            <button
              type="button"
              onClick={stopGeneration}
              title="Parar resposta da IA"
              className="p-2 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-all flex items-center justify-center shadow-sm active:scale-95 group"
            >
              <Square className="w-3.5 h-3.5 fill-current transition-transform group-hover:scale-110" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={!content.trim() && pendingAttachments.length === 0}
              title="Enviar mensagem"
              className="p-2 rounded-xl bg-neutral-900 dark:bg-neutral-200 text-white dark:text-[#171717] hover:bg-neutral-800 dark:hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              <ArrowUp className="w-4 h-4 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
