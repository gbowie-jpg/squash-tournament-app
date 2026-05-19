'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Send, MessageCircle, ChevronDown } from 'lucide-react';

type Message = { role: 'user' | 'assistant'; content: string };

const SUGGESTIONS = [
  "Let vs stroke — what's the difference?",
  'How do I seed 12 players?',
  'How many byes for 11 players?',
  "What's a compass draw?",
  'Scoring: win by 2 explained',
  'Conduct warning sequence?',
];

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-br-sm'
            : 'bg-[var(--surface-card)] border border-[var(--border)] text-[var(--text-primary)] rounded-bl-sm'
        }`}
      >
        {msg.content || <span className="opacity-40 italic">Thinking…</span>}
      </div>
    </div>
  );
}

export default function RulesAIChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [open, messages.length]);

  const send = useCallback(async (text: string) => {
    const question = text.trim();
    if (!question || loading) return;
    setInput('');

    const userMsg: Message = { role: 'user', content: question };
    setMessages((prev) => [...prev, userMsg, { role: 'assistant', content: '' }]);
    setLoading(true);

    try {
      const history = messages.slice(-10);
      const res = await fetch('/api/ai/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question, history }),
      });

      if (!res.ok || !res.body) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: 'Sorry, something went wrong. Try again.' };
          return updated;
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assembled = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assembled += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: assembled };
          return updated;
        });
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: 'Network error — check your connection and try again.' };
        return updated;
      });
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [loading, messages]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-20 right-4 z-40 flex items-center gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 pl-3.5 pr-4 py-2.5 rounded-full shadow-lg hover:opacity-90 transition-all text-sm font-medium"
        aria-label="Open rules assistant"
      >
        <MessageCircle className="w-4 h-4" />
        Rules AI
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-36 right-4 z-50 w-[min(380px,calc(100vw-2rem))] flex flex-col rounded-2xl shadow-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden"
          style={{ maxHeight: 'min(520px, calc(100vh - 180px))' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 dark:bg-zinc-800">
            <div>
              <p className="text-sm font-semibold text-white">Rules &amp; Brackets Assistant</p>
              <p className="text-xs text-zinc-400">Squash rules · Draw formats · Referee calls</p>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  className="text-zinc-400 hover:text-white text-xs px-2 py-1 rounded transition-colors"
                  title="Clear chat"
                >
                  Clear
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-white p-1 rounded transition-colors">
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 min-h-0">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <p className="text-xs text-[var(--text-muted)] text-center pt-1">Ask about squash rules or bracket formats</p>
                <div className="grid grid-cols-1 gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-left text-xs px-3 py-2 rounded-xl border border-[var(--border)] hover:border-zinc-400 dark:hover:border-zinc-500 hover:bg-[var(--surface-card)] text-[var(--text-secondary)] transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex items-end gap-2 px-3 py-3 border-t border-[var(--border)] bg-[var(--surface-card)]">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask a question…"
              className="flex-1 resize-none border border-[var(--border)] rounded-xl px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-zinc-400 max-h-24 overflow-y-auto"
              style={{ lineHeight: '1.4' }}
              disabled={loading}
            />
            <button
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              className="shrink-0 p-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl hover:opacity-90 disabled:opacity-40 transition-opacity"
              aria-label="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
