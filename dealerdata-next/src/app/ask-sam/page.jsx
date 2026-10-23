'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useDealer } from '@/lib/DealerContext';
import { normalizeDealerId } from '@/lib/useSupabaseData';
import { Send, Sparkles, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const SUGGESTED_QUESTIONS = [
  'Who had the best performance last month?',
  'Which vendor had the biggest drop this past weekend?',
  'Why is there a drop in sales?',
  'How are AutoTrader leads doing right now?',
  'What is our overall close rate for the last 30 days?',
  'Which dealership has the lowest sold percentage?',
];

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  );
}

function MessageBubble({ role, content }) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex gap-3 max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-slate-700' : 'bg-blue-600'
        }`}>
          {isUser ? <span className="text-white text-xs font-bold">You</span> : <Sparkles size={16} className="text-white" />}
        </div>
        <div className={`rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-slate-800 text-white rounded-tr-sm'
            : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm'
        }`}>
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap">{content}</p>
          ) : (
            <div className="text-sm prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-headings:my-2 prose-strong:text-slate-800">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AskSam() {
  const { activeStores, activeDealershipKeys, selectedLabel, isDealerLoading } = useDealer();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async (questionText) => {
    const question = (questionText ?? input).trim();
    if (!question || isLoading) return;

    const userMessage = { role: 'user', content: question };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const storeNames = activeStores.map(s => ({ key: normalizeDealerId(s.dealership_key), name: s.name }));
      const conversationHistory = messages.map(m => ({ role: m.role, content: m.content }));

      const response = await base44.functions.invoke('askSam', {
        question,
        dealer_ids: activeDealershipKeys,
        store_names: storeNames,
        conversation_history: conversationHistory,
      });

      setMessages(prev => [...prev, { role: 'assistant', content: response.data.answer }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I ran into an error: ${error.response?.data?.error || error.message}`,
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (q) => {
    handleSend(q);
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
            <Sparkles size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Ask Sam</h1>
            <p className="text-xs text-slate-500">
              AI assistant for lead performance data
              {!isDealerLoading && selectedLabel ? ` · ${selectedLabel}` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-6 bg-slate-50">
        {!hasMessages && !isLoading ? (
          <div className="max-w-2xl mx-auto text-center pt-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center mx-auto mb-4">
              <Sparkles size={32} className="text-white" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Ask me anything about your performance</h2>
            <p className="text-sm text-slate-500 mb-8">
              I can analyze your lead data, vendor performance, and sales trends. Try one of these:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {SUGGESTED_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => handleSuggestion(q)}
                  className="flex items-start gap-3 text-left px-4 py-3 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50 transition-all group"
                >
                  <MessageSquare size={16} className="text-slate-400 group-hover:text-blue-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-700 group-hover:text-slate-900">{q}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg, i) => (
              <MessageBubble key={i} role={msg.role} content={msg.content} />
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex gap-3 max-w-[85%] flex-row">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-blue-600">
                    <Sparkles size={16} className="text-white" />
                  </div>
                  <div className="rounded-2xl rounded-tl-sm bg-white border border-slate-200">
                    <TypingIndicator />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="px-4 md:px-6 py-4 border-t border-slate-200 bg-white shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2 rounded-xl border border-slate-300 bg-white focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Sam about your lead performance..."
              rows={1}
              className="flex-1 px-4 py-3 text-sm bg-transparent border-0 outline-none resize-none placeholder:text-slate-400"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className="m-1.5 p-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0"
            >
              <Send size={16} />
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2 text-center">
            Sam analyzes the last 30 days of lead performance data. Press Enter to send, Shift+Enter for a new line.
          </p>
        </div>
      </div>
    </div>
  );
}