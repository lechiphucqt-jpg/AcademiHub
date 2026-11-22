import React, { useRef, useState } from 'react';
import {
  Bot,
  HelpCircle,
  Lightbulb,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import type { DetailedContent, Lesson } from '../types/academic';
import { getSavedApiKey, getSavedModel } from './AiSettingsModal';

interface SocraticTutorDrawerProps {
  lesson: Lesson;
  content: DetailedContent;
  isOpen: boolean;
  onClose: () => void;
  onNotify: (message: string, tone?: 'success' | 'error' | 'info') => void;
}

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

export default function SocraticTutorDrawer({
  lesson,
  content,
  isOpen,
  onClose,
  onNotify,
}: SocraticTutorDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      text: `Xin chào! Thầy là **Gia sư Socratic**. Thầy ở đây để đồng hành cùng em trong bài **"${lesson.title}"** (phần: *${content.title}*).\n\nEm đang gặp khó khăn ở khái niệm hay câu hỏi nào? Hãy chia sẻ nhé, thầy sẽ đặt câu hỏi gợi mở để giúp em tự khám phá ra câu trả lời!`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  if (!isOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = input.trim();
    if (!query || loading) return;

    setInput('');
    const newMsgs: Message[] = [...messages, { role: 'user', text: query }];
    setMessages(newMsgs);
    setLoading(true);

    try {
      const apiKey = getSavedApiKey();
      const model = getSavedModel();

      const systemPrompt = `Bạn là Gia sư Socratic (Socratic Method Tutor) dành cho học sinh THPT trong nền tảng Interactive Academic Hub.
Bài học hiện tại: "${lesson.title}"
Mục tiêu bài học: ${lesson.objectives.join('; ')}
Phần học liệu đang xem: "${content.title}" (${content.type}).

QUY TẮC SƯ PHẠM SỐNG CÒN:
1. KHÔNG BAO GIỜ đưa ra đáp án trực tiếp hoặc làm hộ bài tập cho học sinh.
2. Dẫn dắt học sinh bằng các câu hỏi gợi mở từng bước (scaffolding), khen ngợi những điểm đúng trong suy nghĩ của học sinh và khuyến khích học sinh liên hệ thực tế.
3. Giữ giọng văn thân thiện, ấm áp, kiên nhẫn và truyền cảm hứng.
4. Trả lời bằng tiếng Việt ngắn gọn, súc tích (dưới 150 từ mỗi lần).`;

      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          apiKey,
          model,
          history: messages.map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.text }],
          })),
          curriculumContext: `Bài: ${lesson.title} - Tóm tắt: ${lesson.summary}. Học liệu: ${content.title}`,
          systemInstruction: systemPrompt,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.reply) {
        // Fallback simulated Socratic response if backend API is offline
        const fallbackReply = `Một câu hỏi rất hay! Để giải quyết được vấn đề "${query.slice(0, 30)}...", em hãy thử nhớ lại: trong phần lý thuyết của bài "${lesson.title}", yếu tố cốt lõi nào ảnh hưởng trực tiếp đến hiện tượng này? Em nghĩ nếu ta thay đổi điều kiện ban đầu thì kết quả sẽ biến chuyển ra sao?`;
        setMessages([...newMsgs, { role: 'assistant', text: fallbackReply }]);
      } else {
        setMessages([...newMsgs, { role: 'assistant', text: data.reply }]);
      }
    } catch {
      const fallbackReply = `Thầy đã nhận được câu hỏi! Để trả lời được câu này, em hãy thử liên hệ xem: định nghĩa trọng tâm của bài "${lesson.title}" nói gì về điều này? Em đang nghĩ tới hướng giải quyết nào đầu tiên?`;
      setMessages([...newMsgs, { role: 'assistant', text: fallbackReply }]);
    } finally {
      setLoading(false);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-40 flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
            <Lightbulb className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Gia Sư Socratic
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Gợi mở tư duy • Không giải hộ bài
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 text-xs">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex flex-col gap-1 ${
              m.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div
              className={`max-w-[85%] p-3 rounded-2xl ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-xs'
              }`}
            >
              <p className="whitespace-pre-line leading-relaxed">{m.text}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-slate-400 text-xs italic">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Thầy đang suy nghĩ câu hỏi gợi ý cho em...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-slate-200 dark:border-slate-800 flex gap-2">
        <input
          type="text"
          placeholder="Hỏi thầy về khái niệm hoặc bài tập..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
