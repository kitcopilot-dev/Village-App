'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface HomeworkHelperProps {
  studentName: string;
  gradeLevel: string;
  onConversation?: (messages: Message[]) => void;
}

export function HomeworkHelper({ studentName, gradeLevel, onConversation }: HomeworkHelperProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [subject, setSubject] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const subjects = ['Math', 'Reading', 'Writing', 'Science', 'History', 'Other'];

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (onConversation && messages.length > 0) {
      onConversation(messages);
    }
  }, [messages, onConversation]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          studentName,
          gradeLevel,
          subject: subject || undefined
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Oops! I had trouble thinking about that. Can you try asking again? 🤔",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setSubject('');
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-16 h-16 bg-gradient-to-br from-secondary to-secondary/80 text-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110 flex items-center justify-center text-2xl group"
        title="Need help with homework?"
      >
        <span className="group-hover:animate-bounce">🦉</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[90vw] max-w-md animate-fade-in">
      <Card className="shadow-2xl border-2 border-secondary/20 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-secondary to-secondary/80 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🦉</span>
            <div>
              <h3 className="font-display font-bold m-0 text-lg">Homework Helper</h3>
              <p className="text-xs opacity-80 m-0">I'll help you figure it out!</p>
            </div>
          </div>
          <div className="flex gap-2">
            {messages.length > 0 && (
              <button
                onClick={clearConversation}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                title="Start over"
              >
                🔄
              </button>
            )}
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Subject selector (only show at start) */}
        {messages.length === 0 && (
          <div className="p-4 bg-bg-alt border-b border-border">
            <p className="text-sm font-bold text-text-muted mb-2">What subject are you working on?</p>
            <div className="flex flex-wrap gap-2">
              {subjects.map(s => (
                <button
                  key={s}
                  onClick={() => setSubject(s)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                    subject === s
                      ? 'bg-secondary text-white'
                      : 'bg-white border border-border hover:border-secondary'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="h-80 overflow-y-auto p-4 space-y-4 bg-bg">
          {messages.length === 0 ? (
            <div className="text-center py-12 text-text-muted">
              <p className="text-4xl mb-4">🌟</p>
              <p className="font-serif italic">Hi {studentName}! Ask me anything about your homework.</p>
              <p className="text-xs mt-2">I won't give you the answers, but I'll help you figure it out!</p>
            </div>
          ) : (
            messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-3 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-primary text-white rounded-br-md'
                      : 'bg-white border border-border rounded-bl-md shadow-sm'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap m-0">{msg.content}</p>
                </div>
              </div>
            ))
          )}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-border rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-secondary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-secondary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-secondary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-white border-t border-border">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your question..."
              className="flex-1 resize-none border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50 focus:border-secondary min-h-[44px] max-h-24"
              rows={1}
              disabled={isLoading}
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              variant="secondary"
              className="px-4"
            >
              Send
            </Button>
          </div>
          <p className="text-[10px] text-text-muted text-center mt-2">
            Press Enter to send • Shift+Enter for new line
          </p>
        </div>
      </Card>
    </div>
  );
}
