import React, { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Message, Sender } from '../types';
import { Bot, User, Copy, Check, Volume2, Loader2 } from 'lucide-react';
import { generateSpeech } from '../services/geminiService';

interface MessageItemProps {
  message: Message;
}

const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const isUser = message.sender === Sender.USER;
  const [copied, setCopied] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePlayTTS = async () => {
    if (isPlaying) return;
    
    setAudioLoading(true);
    try {
      const audioBuffer = await generateSpeech(message.text.substring(0, 500)); // Limit length for quick preview
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const buffer = await ctx.decodeAudioData(audioBuffer);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => setIsPlaying(false);
      source.start(0);
      setIsPlaying(true);
    } catch (error) {
      console.error("TTS Error:", error);
    } finally {
      setAudioLoading(false);
    }
  };

  const renderAttachment = () => {
    if (!message.attachment) return null;

    const { type, url, mimeType } = message.attachment;

    if (type === 'image') {
      return (
        <div className="mb-3 rounded-lg overflow-hidden border border-gray-700">
          <img src={url} alt="Attached" className="max-w-full max-h-[300px] object-contain bg-black" />
        </div>
      );
    }
    if (type === 'video') {
       return (
        <div className="mb-3 rounded-lg overflow-hidden border border-gray-700">
          <video src={url} controls className="max-w-full max-h-[300px] bg-black" />
        </div>
      );
    }
    if (type === 'audio') {
       return (
        <div className="mb-3 p-2 rounded-lg border border-gray-700 bg-gray-900 flex items-center gap-2">
          <audio src={url} controls className="h-8 w-full max-w-[250px]" />
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[90%] md:max-w-[80%] lg:max-w-[70%] gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-lg ${isUser ? 'bg-blue-600' : 'bg-emerald-600'}`}>
          {isUser ? <User size={18} className="text-white" /> : <Bot size={18} className="text-white" />}
        </div>

        {/* Content Bubble */}
        <div 
          className={`relative px-5 py-4 rounded-2xl shadow-md overflow-hidden text-sm md:text-base leading-relaxed
            ${isUser 
              ? 'bg-blue-600 text-white rounded-tr-none' 
              : 'bg-gray-800 text-gray-100 border border-gray-700 rounded-tl-none'
            }`}
        >
          {renderAttachment()}

          {isUser ? (
            <p className="whitespace-pre-wrap">{message.text}</p>
          ) : (
            <div className="markdown-body">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <div className="relative my-4 rounded-lg overflow-hidden border border-gray-700">
                        <div className="flex items-center justify-between px-4 py-1 bg-gray-900/80 text-xs text-gray-400 border-b border-gray-700">
                          <span>{match[1]}</span>
                        </div>
                        <SyntaxHighlighter
                          style={vscDarkPlus}
                          language={match[1]}
                          PreTag="div"
                          customStyle={{ margin: 0, borderRadius: 0, background: '#111827' }}
                          {...props}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      </div>
                    ) : (
                      <code className={`${className} bg-gray-700/50 px-1.5 py-0.5 rounded text-emerald-300 font-mono text-sm`} {...props}>
                        {children}
                      </code>
                    );
                  },
                  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc ml-6 mb-3 space-y-1">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal ml-6 mb-3 space-y-1">{children}</ol>,
                  li: ({ children }) => <li className="pl-1">{children}</li>,
                  h1: ({ children }) => <h1 className="text-2xl font-bold mb-4 mt-6 border-b border-gray-700 pb-2">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-xl font-bold mb-3 mt-5">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-lg font-semibold mb-2 mt-4">{children}</h3>,
                  blockquote: ({ children }) => <blockquote className="border-l-4 border-emerald-500 pl-4 italic my-4 text-gray-400">{children}</blockquote>,
                  table: ({ children }) => <div className="overflow-x-auto my-4"><table className="min-w-full divide-y divide-gray-700 border border-gray-700 rounded-lg">{children}</table></div>,
                  th: ({ children }) => <th className="px-3 py-2 bg-gray-900 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">{children}</th>,
                  td: ({ children }) => <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-300 border-t border-gray-700">{children}</td>,
                  a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{children}</a>
                }}
              >
                {message.text}
              </ReactMarkdown>
              
              {/* Action Buttons for AI Response */}
              <div className="mt-4 flex items-center gap-2 pt-2 border-t border-gray-700/50">
                <button 
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-gray-700"
                  title="Copy response"
                >
                  {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>

                <button 
                  onClick={handlePlayTTS}
                  disabled={audioLoading || isPlaying}
                  className={`flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-gray-700 ${isPlaying ? 'text-emerald-400' : ''}`}
                  title="Read aloud"
                >
                  {audioLoading ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />}
                  {isPlaying ? 'Playing...' : 'Read'}
                </button>
              </div>
            </div>
          )}
          
          {message.isError && (
            <div className="mt-2 text-red-400 text-xs">
              Failed. Please try again.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(MessageItem);