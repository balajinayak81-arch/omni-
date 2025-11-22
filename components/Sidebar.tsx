import React from 'react';
import { MessageSquarePlus, Layout, BookOpen, Code2, Palette, X, MessageSquare, Trash2, ChevronRight } from 'lucide-react';
import { AppMode, ChatSession } from '../types';
import { MODE_DESCRIPTIONS } from '../constants';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onNewChat: () => void;
  currentMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (session: ChatSession) => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, 
  setIsOpen, 
  onNewChat, 
  currentMode, 
  onModeChange,
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession
}) => {
  const modes = [
    { id: AppMode.GENERAL, icon: Layout, label: 'General Chat' },
    { id: AppMode.HOMEWORK, icon: BookOpen, label: 'Homework Solver' },
    { id: AppMode.CODING, icon: Code2, label: 'Coding Expert' },
    { id: AppMode.CREATIVE, icon: Palette, label: 'Creative Studio' },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed top-0 left-0 h-full bg-gray-900 border-r border-gray-800 z-30 transition-transform duration-300 ease-in-out w-72
        flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:static md:w-72 md:flex-shrink-0
      `}>
        
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-gray-800">
          <div className="flex items-center gap-2 font-bold text-emerald-400 text-xl">
            <span>OmniChat</span>
          </div>
          <button onClick={() => setIsOpen(false)} className="md:hidden text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-4">
          <button
            onClick={() => {
              onNewChat();
              if (window.innerWidth < 768) setIsOpen(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all shadow-lg shadow-emerald-900/20 font-medium"
          >
            <MessageSquarePlus size={20} />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* Mode Selector */}
          <div className="px-4 py-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-2">Assistant Modes</h3>
            <div className="space-y-1">
              {modes.map((mode) => {
                const Icon = mode.icon;
                const isActive = currentMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    onClick={() => {
                      onModeChange(mode.id);
                      if (window.innerWidth < 768) setIsOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm text-left group
                      ${isActive ? 'bg-gray-800 text-emerald-400 ring-1 ring-gray-700' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}
                    `}
                  >
                    <Icon size={18} className={isActive ? 'text-emerald-400' : 'text-gray-500 group-hover:text-gray-300'} />
                    <div className="flex flex-col">
                      <span className="font-medium">{mode.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chat History */}
          <div className="px-4 py-2 mt-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-2">Recent Chats</h3>
            <div className="space-y-1">
              {sessions.length === 0 ? (
                <div className="px-2 text-sm text-gray-600 italic">No history yet</div>
              ) : (
                sessions.map((session) => (
                  <div 
                    key={session.id}
                    className={`group flex items-center justify-between w-full rounded-lg transition-colors text-sm
                      ${activeSessionId === session.id ? 'bg-gray-800 text-emerald-400' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'}
                    `}
                  >
                    <button
                      onClick={() => {
                        onSelectSession(session);
                        if (window.innerWidth < 768) setIsOpen(false);
                      }}
                      className="flex-1 flex items-center gap-3 px-3 py-2.5 overflow-hidden text-left"
                    >
                      <MessageSquare size={16} className={`flex-shrink-0 ${activeSessionId === session.id ? 'text-emerald-400' : 'text-gray-600 group-hover:text-gray-400'}`} />
                      <span className="truncate">{session.title || 'New Chat'}</span>
                    </button>
                    <button
                      onClick={(e) => onDeleteSession(session.id, e)}
                      className="p-2 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all"
                      title="Delete chat"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-800/50 text-xs text-gray-400">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            Omni 2.5 Flash Active
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;