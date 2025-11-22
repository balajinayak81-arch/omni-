import React, { useState, useRef, useEffect } from 'react';
import { Send, Menu, Sparkles, Paperclip, Mic, X, Video } from 'lucide-react';
import Sidebar from './components/Sidebar';
import MessageItem from './components/MessageItem';
import { initializeGemini, createNewChat, sendMessageStream, generateVideo } from './services/geminiService';
import { getSessions, saveSession, deleteSession } from './services/chatStorage';
import { Message, Sender, AppMode, ChatSession, Attachment } from './types';
import { SUGGESTIONS } from './constants';

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentMode, setCurrentMode] = useState<AppMode>(AppMode.GENERAL);
  
  // Attachments State
  const [pendingAttachment, setPendingAttachment] = useState<Attachment | undefined>(undefined);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  
  // History State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize app and load history
  useEffect(() => {
    initializeGemini();
    const loadedSessions = getSessions();
    setSessions(loadedSessions);
    startNewChat();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const startNewChat = () => {
    const newId = Date.now().toString();
    setActiveSessionId(newId);
    setMessages([]);
    setInputValue('');
    setIsLoading(false);
    setPendingAttachment(undefined);
    createNewChat([], currentMode); 
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
    setPendingAttachment(undefined);
    createNewChat(session.messages, currentMode);
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedSessions = deleteSession(id);
    setSessions(updatedSessions);
    
    if (id === activeSessionId) {
      startNewChat();
    }
  };

  const handleModeChange = (mode: AppMode) => {
    setCurrentMode(mode);
    // When mode changes, we might want to reset the chat if it's empty, or just continue
    // For this app, we'll just switch context for the NEXT message
    createNewChat(messages, mode);
  };

  const updateAndSaveSession = (updatedMessages: Message[]) => {
    if (updatedMessages.length === 0) return;

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

  // --- File Handling ---

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = (ev.target?.result as string).split(',')[1];
      const url = URL.createObjectURL(file);
      
      let type: 'image' | 'video' | 'audio' = 'image';
      if (file.type.startsWith('video/')) type = 'video';
      if (file.type.startsWith('audio/')) type = 'audio';

      setPendingAttachment({
        type,
        url,
        data: base64,
        mimeType: file.type
      });
    };
    reader.readAsDataURL(file);
    
    // Reset input
    e.target.value = '';
  };

  const handleRemoveAttachment = () => {
    if (pendingAttachment) {
      URL.revokeObjectURL(pendingAttachment.url);
      setPendingAttachment(undefined);
    }
  };

  // --- Audio Recording ---
  
  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        const chunks: Blob[] = [];

        mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
        mediaRecorder.onstop = async () => {
          const blob = new Blob(chunks, { type: 'audio/webm' }); // Usually webm
          const url = URL.createObjectURL(blob);
          
          // Convert to base64
          const reader = new FileReader();
          reader.onloadend = () => {
             const base64 = (reader.result as string).split(',')[1];
             setPendingAttachment({
               type: 'audio',
               url,
               data: base64,
               mimeType: 'audio/webm'
             });
          };
          reader.readAsDataURL(blob);
          
          // Stop tracks
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) {
        console.error("Error accessing microphone", err);
        alert("Could not access microphone. Please allow permissions.");
      }
    }
  };

  // --- Sending Logic ---

  const handleSend = async () => {
    if ((!inputValue.trim() && !pendingAttachment) || isLoading) return;

    const userText = inputValue.trim();
    const currentAttachment = pendingAttachment;
    
    setInputValue('');
    setPendingAttachment(undefined);

    // User Message
    const userMsg: Message = {
      id: Date.now().toString(),
      text: userText,
      sender: Sender.USER,
      timestamp: Date.now(),
      attachment: currentAttachment
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    updateAndSaveSession(newMessages);
    
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
      // Special handling for Video Generation Mode
      if (currentMode === AppMode.VIDEO) {
        const videoUrl = await generateVideo(userText);
        
        setMessages(prev => {
          const finalMessages = prev.map(msg => 
            msg.id === aiMsgId ? { 
              ...msg, 
              text: `Here is your generated video for: "${userText}"`, 
              attachment: { type: 'video', url: videoUrl, data: '', mimeType: 'video/mp4' } as Attachment
            } : msg
          );
          updateAndSaveSession(finalMessages);
          return finalMessages;
        });
      } else {
        // Standard Chat / Attachment processing
        const fullResponse = await sendMessageStream(userText, newMessages, currentAttachment, currentMode, (textChunk) => {
          setMessages(prev => prev.map(msg => 
            msg.id === aiMsgId ? { ...msg, text: textChunk } : msg
          ));
        });

        setMessages(prev => {
          const finalMessages = prev.map(msg => 
            msg.id === aiMsgId ? { ...msg, text: fullResponse } : msg
          );
          updateAndSaveSession(finalMessages);
          return finalMessages;
        });
      }

    } catch (error) {
      console.error(error);
      setMessages(prev => prev.map(msg => 
        msg.id === aiMsgId ? { ...msg, text: "I encountered an error processing your request. Please try again.", isError: true } : msg
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
          <div className="w-6" /> 
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
                    Hi! I’m your AI Assistant.
                  </h1>
                  <p className="text-gray-400 max-w-md mx-auto">
                    What would you like me to create today — text, image, video, audio, or explanation?
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
            
            {/* Pending Attachment Preview */}
            {pendingAttachment && (
              <div className="absolute -top-20 left-0 p-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg flex items-center gap-3 animate-in slide-in-from-bottom-2">
                {pendingAttachment.type === 'image' && (
                  <img src={pendingAttachment.url} alt="Preview" className="w-12 h-12 object-cover rounded bg-black" />
                )}
                {pendingAttachment.type === 'video' && (
                  <div className="w-12 h-12 bg-black rounded flex items-center justify-center"><Video size={20} /></div>
                )}
                {pendingAttachment.type === 'audio' && (
                  <div className="w-12 h-12 bg-gray-700 rounded flex items-center justify-center"><Mic size={20} /></div>
                )}
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-gray-300 uppercase">{pendingAttachment.type} attached</span>
                  <span className="text-[10px] text-gray-500">Ready to send</span>
                </div>
                <button onClick={handleRemoveAttachment} className="p-1 hover:bg-gray-700 rounded-full">
                  <X size={14} className="text-gray-400" />
                </button>
              </div>
            )}

            <div className="relative bg-gray-800 rounded-2xl border border-gray-700 shadow-lg focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/50 transition-all">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={currentMode === AppMode.VIDEO ? "Describe the video you want to generate..." : `Ask ${currentMode}...`}
                className="w-full bg-transparent text-white p-4 pr-24 pl-12 rounded-2xl resize-none focus:outline-none min-h-[60px] max-h-[200px] placeholder-gray-500"
                rows={1}
                style={{ height: 'auto', minHeight: '60px' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
                }}
              />
              
              {/* Left Actions (Attachment) */}
              <div className="absolute left-2 bottom-2.5 flex gap-1">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*,video/*,audio/*" 
                  onChange={handleFileSelect}
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-gray-400 hover:text-emerald-400 hover:bg-gray-700/50 rounded-xl transition-colors"
                  title="Attach file"
                >
                  <Paperclip size={20} />
                </button>
              </div>

              {/* Right Actions (Mic, Send) */}
              <div className="absolute right-2 bottom-2.5 flex gap-2">
                {currentMode !== AppMode.VIDEO && (
                  <button
                    onClick={toggleRecording}
                    className={`p-2 rounded-xl transition-all ${
                      isRecording 
                        ? 'bg-red-500/20 text-red-500 animate-pulse' 
                        : 'text-gray-400 hover:text-emerald-400 hover:bg-gray-700/50'
                    }`}
                    title="Voice input"
                  >
                    <Mic size={20} />
                  </button>
                )}
                
                <button
                  onClick={handleSend}
                  disabled={isLoading || (!inputValue.trim() && !pendingAttachment)}
                  className={`p-2.5 rounded-xl transition-all ${
                    (inputValue.trim() || pendingAttachment) && !isLoading
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
               {currentMode === AppMode.VIDEO ? 'Video generation requires a paid key.' : 'AI can make mistakes. Please check important information.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;