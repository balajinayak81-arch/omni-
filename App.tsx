import React, { useState, useRef, useEffect } from 'react';
import { Send, Menu, Sparkles } from 'lucide-react';
import Sidebar from './components/Sidebar';
import MessageItem from './components/MessageItem';
import { initializeGemini, createNewChat, sendMessageStream } from './services/geminiService';
import { getSessions, saveSession, deleteSession } from './services/chatStorage';
import { Message, Sender, AppMode, ChatSession } from './types';
import { SUGGESTIONS } from './constants';

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentMode, setCurrentMode] = useState<AppMode>(AppMode.GENERAL);
  
  // History State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Initialize app and load history
  useEffect(() => {
    initializeGemini();
    const loadedSessions = getSessions();
    setSessions(loadedSessions);
    startNewChat();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startNewChat = () => {
    const newId = Date.now().toString();
    setActiveSessionId(newId);
    setMessages([]);
    setInputValue('');
    setIsLoading(false);
    createNewChat([]); // Reset Gemini context
    if (inputRef.current) inputRef.current.focus();
  };

  const handleNewChat = () => {
    startNewChat();
  };

  const handleSelectSession = (session: ChatSession) => {
    setActiveSessionId(session.id);
    setMessages(session.messages);
    setInputValue('');
    setIsLoading(false);
    createNewChat(session.messages); // Restore Gemini context with history
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedSessions = deleteSession(id);
    setSessions(updatedSessions);
    
    // If deleted active session, start a new one
    if (id === activeSessionId) {
      startNewChat();
    }
  };

  const handleModeChange = (mode: AppMode) => {
    setCurrentMode(mode);
  };

  const updateAndSaveSession = (updatedMessages: Message[]) => {
    // Don't save if empty
    if (updatedMessages.length === 0) return;

    // Generate title from first message if it's a new conversation
    const title = updatedMessages.length > 0 
      ? (updatedMessages[0].text.slice(0, 30) + (updatedMessages[0].text.length > 30 ? '...' : '')) 
      : 'New Chat';

    const session: ChatSession = {
      id: activeSessionId,
      title,
      messages: updatedMessages,
      updatedAt: Date.now()
    };

    const newSessions = saveSession(session);
    setSessions(newSessions);
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userText = inputValue.trim();
    setInputValue('');

    // Add User Message
    const userMsg: Message = {
      id: Date.now().toString(),
      text: userText,
      sender: Sender.USER,
      timestamp: Date.now()
    };

    // Optimistic update for UI
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    updateAndSaveSession(newMessages); // Save immediately so user message is preserved
    
    setIsLoading(true);

    // Placeholder AI Message
    const aiMsgId = (Date.now() + 1).toString();
    const aiPlaceholder: Message = {
      id: aiMsgId,
      text: '',
      sender: Sender.AI,
      timestamp: Date.now() + 1
    };
    
    setMessages(prev => [...prev, aiPlaceholder]);

    try {
      // Wait for full response to save final state
      const fullResponse = await sendMessageStream(userText, newMessages, (textChunk) => {
        setMessages(prev => prev.map(msg => 
          msg.id === aiMsgId ? { ...msg, text: textChunk } : msg
        ));
      });

      // Save final state with complete AI response
      setMessages(prev => {
        const finalMessages = prev.map(msg => 
          msg.id === aiMsgId ? { ...msg, text: fullResponse } : msg
        );
        updateAndSaveSession(finalMessages);
        return finalMessages;
      });

    } catch (error) {
      setMessages(prev => prev.map(msg => 
        msg.id === aiMsgId ? { ...msg, text: "I encountered an error. Please try again.", isError: true } : msg
      ));
    } finally {
      setIsLoading(false);
      if(inputRef.current) inputRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (prompt: string) => {
    setInputValue(prompt);
    if (inputRef.current) inputRef.current.focus();
  };

  return (
    <div className="flex h-screen bg-gray-950 text-white font-sans overflow-hidden">
      <Sidebar 
        isOpen={isSidebarOpen} 
        setIsOpen={setIsSidebarOpen} 
        onNewChat={handleNewChat}
        currentMode={currentMode}
        onModeChange={handleModeChange}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900/90 backdrop-blur">
          <button onClick={() => setIsSidebarOpen(true)} className="text-gray-300">
            <Menu size={24} />
          </button>
          <span className="font-semibold text-emerald-400">OmniChat</span>
          <div className="w-6" /> {/* Spacer */}
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth">
          <div className="max-w-3xl mx-auto">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 fade-in">
                <div className="bg-gray-900/50 p-6 rounded-full border border-gray-800 shadow-2xl shadow-emerald-900/20">
                  <Sparkles size={48} className="text-emerald-400" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">
                    How can I help you today?
                  </h1>
                  <p className="text-gray-400 max-w-md mx-auto">
                    I'm your smart AI assistant. Ask me about coding, homework, creative writing, or anything else.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl px-4">
                  {SUGGESTIONS.map((s, idx) => (
                    <button 
                      key={idx}
                      onClick={() => handleSuggestionClick(s.prompt)}
                      className="text-left p-4 rounded-xl bg-gray-800/40 hover:bg-gray-800 border border-gray-700/50 hover:border-emerald-500/50 transition-all group"
                    >
                      <div className="font-medium text-gray-200 mb-1 group-hover:text-emerald-400 transition-colors">{s.title}</div>
                      <div className="text-xs text-gray-500 truncate">{s.prompt}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map(msg => <MessageItem key={msg.id} message={msg} />)
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-gray-800 bg-gray-900/80 backdrop-blur-lg">
          <div className="max-w-3xl mx-auto relative">
            <div className="relative bg-gray-800 rounded-2xl border border-gray-700 shadow-lg focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/50 transition-all">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Ask ${currentMode}...`}
                className="w-full bg-transparent text-white p-4 pr-14 rounded-2xl resize-none focus:outline-none min-h-[60px] max-h-[200px] placeholder-gray-500"
                rows={1}
                style={{ height: 'auto', minHeight: '60px' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
                }}
              />
              <div className="absolute right-2 bottom-2.5">
                <button
                  onClick={handleSend}
                  disabled={isLoading || !inputValue.trim()}
                  className={`p-2.5 rounded-xl transition-all ${
                    inputValue.trim() && !isLoading
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/50'
                      : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send size={20} />
                  )}
                </button>
              </div>
            </div>
            <div className="text-center text-[10px] text-gray-600 mt-3">
              AI can make mistakes. Please check important information.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
