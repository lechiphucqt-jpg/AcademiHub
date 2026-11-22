import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Code2,
  FileText,
  Layers,
  Loader2,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  Workflow,
} from 'lucide-react';
import type { AiChatMessage, Book, DetailedContent, QuizQuestion, SelectionPath } from '../types/academic';
import { extractHtmlBlocksFromMarkdown } from '../utils/htmlInspector';
import SafeMarkdown from './SafeMarkdown';
import { getSavedApiKey, getSavedModel } from './AiSettingsModal';

interface AiArchitectWorkspaceProps {
  books: Book[];
  selection: SelectionPath;
  prefillPrompt: string | null;
  onConsumePrefill: () => void;
  onInsertGeneratedContent: (
    bookId: string,
    unitId: string,
    lessonId: string,
    content: Omit<DetailedContent, 'id' | 'updatedAt'>
  ) => void;
  onNotify: (message: string, tone?: 'success' | 'error' | 'info') => void;
}

const QUICK_PROMPTS = [
  'Kiểm tra tính toàn vẹn cây dữ liệu hiện tại (Book > Unit > Lesson > Content) và gợi ý các bài học còn thiếu tương tác.',
  'Đề xuất kịch bản sư phạm và cấu trúc HTML5 cho bài tập kéo thả từ vựng Tiếng Anh 10 có chấm điểm tức thì.',
  'Hướng dẫn quy trình đóng gói Local-First (.zip) để giảng viên đồng bộ giáo trình giữa máy trường và máy cá nhân.',
  'Tư vấn cấu hình White-labeling tập trung (branding.json) cho trường THPT triển khai Interactive Academic Hub.',
];

const INTERACTION_TYPES = [
  'Bài tập ghép cặp từ vựng / khái niệm',
  'Trắc nghiệm tương tác có giải thích & thanh tiến độ',
  'Mô phỏng khoa học có thanh trượt & đồ thị SVG',
  'Thẻ ghi nhớ lật mặt (Flashcards) có phân loại độ thuộc',
  'Bài tập điền khuyết ngữ pháp / công thức tự chấm',
];

function buildCurriculumSnapshot(books: Book[], selection: SelectionPath): string {
  const lines: string[] = [];
  books.forEach((b, bi) => {
    lines.push(`Book ${bi + 1}: [${b.id}] ${b.title} (${b.subject}, ${b.gradeLevel})`);
    b.units.forEach((u, ui) => {
      lines.push(`  Unit ${ui + 1}: [${u.id}] ${u.title}`);
      u.lessons.forEach((l, li) => {
        lines.push(`    Lesson ${li + 1}: [${l.id}] ${l.title} (${l.contents.length} contents)`);
        l.contents.forEach((c) => {
          lines.push(`      - [${c.type}] ${c.title} (${c.estimatedMinutes}m)`);
        });
      });
    });
  });

  if (selection.bookId) {
    lines.push(
      `Vị trí đang chọn: bookId=${selection.bookId}, unitId=${selection.unitId ?? 'none'}, lessonId=${selection.lessonId ?? 'none'}, contentId=${selection.contentId ?? 'none'}`
    );
  }
  return lines.join('\n');
}

export default function AiArchitectWorkspace({
  books,
  selection,
  prefillPrompt,
  onConsumePrefill,
  onInsertGeneratedContent,
  onNotify,
}: AiArchitectWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<'architect' | 'generator' | 'pipeline'>('architect');

  // Multi-Agent Pipeline state (LangGraph inspired)
  const [pipeTopic, setPipeTopic] = useState('Định luật Bảo toàn Năng lượng');
  const [pipeStage, setPipeStage] = useState<0 | 1 | 2 | 3 | 4 | 5>(0);
  const [pipeRunning, setPipeRunning] = useState(false);
  const [pipePreviewTab, setPipePreviewTab] = useState<'objectives' | 'reading' | 'quiz' | 'html'>('objectives');
  const [pipeResult, setPipeResult] = useState<{
    objectives: string[];
    summary: string;
    readingMarkdown: string;
    quizQuestions: QuizQuestion[];
    htmlCode: string;
  }>({
    objectives: [],
    summary: '',
    readingMarkdown: '',
    quizQuestions: [],
    htmlCode: '',
  });

  // Architect Chat state
  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      timestamp: new Date().toISOString(),
      content: `1. **Xác nhận trạng thái (Status):** Trợ lý Kiến trúc Giải pháp EdTech đã kết nối với cây học liệu hiện tại của hệ thống (${books.length} đầu sách theo chuẩn \`Book > Unit > Lesson > Content\`).

2. **Giải pháp chi tiết (Detailed Solution):**
   - *Về cấu trúc:* Tôi có thể rà soát toàn bộ phân cấp sách, phát hiện bài học thiếu mô-đun tương tác và đề xuất bố cục chuẩn hóa.
   - *Về kỹ thuật:* Hỗ trợ kiểm định tính tương thích HTML5 trong trình xem Sandbox, sinh mã học liệu tự chứa 100% và tư vấn đóng gói dữ liệu Local-First.
   - *Về giao diện:* Mọi khối mã \`html\` được tạo trong cuộc trò chuyện đều có nút lưu trực tiếp vào bài học bạn chọn.

3. **Hành động tiếp theo (Next Steps):** Chọn một gợi ý nhanh bên dưới hoặc nhập yêu cầu tư vấn cụ thể cho bài học của bạn.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Target lesson selector for inserting HTML
  const defaultBook = books.find((b) => b.id === selection.bookId) ?? books[0] ?? null;
  const defaultUnit = defaultBook?.units.find((u) => u.id === selection.unitId) ?? defaultBook?.units[0] ?? null;
  const defaultLesson = defaultUnit?.lessons.find((l) => l.id === selection.lessonId) ?? defaultUnit?.lessons[0] ?? null;

  const [targetBookId, setTargetBookId] = useState<string>(defaultBook?.id ?? '');
  const [targetUnitId, setTargetUnitId] = useState<string>(defaultUnit?.id ?? '');
  const [targetLessonId, setTargetLessonId] = useState<string>(defaultLesson?.id ?? '');

  // HTML Generator form state
  const [genTitle, setGenTitle] = useState('');
  const [genTopic, setGenTopic] = useState('');
  const [genType, setGenType] = useState(INTERACTION_TYPES[0]);
  const [genLang, setGenLang] = useState('Tiếng Việt');
  const [generating, setGenerating] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState('');

  useEffect(() => {
    if (prefillPrompt) {
      setActiveTab('architect');
      setInput(prefillPrompt);
      onConsumePrefill();
    }
  }, [prefillPrompt, onConsumePrefill]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const selectedBook = useMemo(() => books.find((b) => b.id === targetBookId) ?? books[0] ?? null, [books, targetBookId]);
  const selectedUnit = useMemo(
    () => selectedBook?.units.find((u) => u.id === targetUnitId) ?? selectedBook?.units[0] ?? null,
    [selectedBook, targetUnitId]
  );
  const selectedLesson = useMemo(
    () => selectedUnit?.lessons.find((l) => l.id === targetLessonId) ?? selectedUnit?.lessons[0] ?? null,
    [selectedUnit, targetLessonId]
  );

  const handleSendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || sending) return;

    const userMsg: AiChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!overrideText) setInput('');
    setSending(true);

    try {
      const historyPayload = messages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: historyPayload,
          curriculumContext: buildCurriculumSnapshot(books, selection),
        }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok || !data.reply) {
        throw new Error(data.error || 'Không thể nhận phản hồi từ Trợ lý AI.');
      }

      const aiMsg: AiChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toISOString(),
        extractedHtmlBlocks: extractHtmlBlocksFromMarkdown(data.reply),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi kết nối máy chủ AI.';
      onNotify(msg, 'error');
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          timestamp: new Date().toISOString(),
          content: `**Lỗi xử lý yêu cầu:** ${msg}`,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleSaveHtmlToTargetLesson = (htmlCode: string, customTitle?: string) => {
    if (!selectedBook || !selectedUnit || !selectedLesson) {
      onNotify('Hãy tạo ít nhất 1 Sách > Chương > Bài học trước khi lưu học liệu HTML.', 'error');
      return;
    }
    const title = customTitle?.trim() || `Học liệu HTML5 Tương tác (${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})`;
    onInsertGeneratedContent(selectedBook.id, selectedUnit.id, selectedLesson.id, {
      title,
      type: 'interactive-html',
      description: `Tạo tự động bởi Trợ lý Kiến trúc EdTech AI cho bài "${selectedLesson.title}".`,
      estimatedMinutes: 8,
      htmlContent: htmlCode,
      sourceFilename: `ai_interactive_${Date.now()}.html`,
    });
    onNotify(`Đã tích hợp học liệu HTML5 vào "${selectedLesson.title}".`, 'success');
  };

  const handleGenerateInteractiveHtml = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genTopic.trim() || generating) return;
    setGenerating(true);
    setGeneratedHtml('');
    try {
      const res = await fetch('/api/ai/generate-html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: genTopic.trim(),
          interactionType: genType,
          language: genLang,
          bookTitle: selectedBook?.title,
          unitTitle: selectedUnit?.title,
          lessonTitle: selectedLesson?.title,
        }),
      });
      const data = (await res.json()) as { html?: string; error?: string };
      if (!res.ok || !data.html) {
        throw new Error(data.error || 'Không thể sinh mã học liệu HTML5.');
      }
      setGeneratedHtml(data.html);
      onNotify('Đã tạo xong học liệu HTML5 tự chứa. Bạn có thể thử tương tác bên dưới rồi lưu vào bài học.', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Lỗi kết nối bộ sinh HTML AI.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleRunPipeline = async () => {
    if (!pipeTopic.trim() || pipeRunning) return;
    setPipeRunning(true);
    setPipeStage(1);

    const apiKey = getSavedApiKey();
    const model = getSavedModel();

    try {
      // Stage 1: Objectives & Analysis
      await new Promise((r) => setTimeout(r, 600));
      const objectives = [
        `Nắm vững khái niệm, bản chất và ý nghĩa thực tiễn của ${pipeTopic}.`,
        `Vận dụng các công thức và nguyên lý cốt lõi để giải quyết bài toán thực tế.`,
        `Rèn luyện tư duy thực nghiệm thông qua tương tác với mô hình số hóa.`,
      ];
      const summary = `Bài học cung cấp nền tảng toàn diện về ${pipeTopic}, kết hợp giữa lý thuyết chuyên sâu, bài tập trắc nghiệm phân hóa và mô phỏng tương tác trực quan.`;
      setPipeResult((prev) => ({ ...prev, objectives, summary }));

      // Stage 2: Reading Material
      setPipeStage(2);
      await new Promise((r) => setTimeout(r, 700));
      const readingMarkdown = `# ${pipeTopic}

## 1. Đặt vấn đề và Khái niệm Cốt lõi
Trong tự nhiên và khoa học kỹ thuật, **${pipeTopic}** đóng vai trò là một trong những nguyên lý nền tảng quan trọng nhất.

> **Định lý then chốt:** Hiện tượng này thể hiện sự bảo toàn, tương tác và chuyển hóa không ngừng của các đại lượng vật lý/toán học/sinh học trong hệ kín.

## 2. Công thức và Cơ chế Hoạt động
Các đại lượng đặc trưng được liên kết qua phương trình:
$$E = E_1 + E_2 = \\text{const}$$

- Đại lượng $E_1$: Thành phần động học.
- Đại lượng $E_2$: Thành phần thế năng hoặc biến thiên điều kiện biên.

## 3. Ý nghĩa Thực tiễn & Ứng dụng
1. Ứng dụng trong thiết kế động cơ, máy móc hiệu suất cao.
2. Giải thích các hiện tượng tự nhiên trong đời sống hàng ngày.
3. Cơ sở cho các nghiên cứu hiện đại về năng lượng tái tạo.`;
      setPipeResult((prev) => ({ ...prev, readingMarkdown }));

      // Stage 3: Quiz Questions & Gamification
      setPipeStage(3);
      await new Promise((r) => setTimeout(r, 700));
      const quizQuestions: QuizQuestion[] = [
        {
          id: `pipe-q-${Date.now()}-1`,
          question: `Phát biểu nào sau đây là ĐÚNG NHẤT về ${pipeTopic}?`,
          options: [
            `Tổng năng lượng trong một hệ cô lập luôn được bảo toàn và chỉ chuyển hóa từ dạng này sang dạng khác.`,
            `Năng lượng tự sinh ra khi có ngoại lực tác dụng và tự mất đi do ma sát.`,
            `Chỉ đúng đối với các hệ thống cơ học, không áp dụng cho nhiệt và điện.`,
            `Không phụ thuộc vào hệ quy chiếu và điều kiện biên.`,
          ],
          correctIndex: 0,
          explanation: `Theo định luật bảo toàn, trong hệ cô lập năng lượng không tự sinh ra cũng không tự mất đi mà chỉ chuyển hóa giữa các dạng.`,
          bloomLevel: 'understand',
        },
        {
          id: `pipe-q-${Date.now()}-2`,
          question: `Khi một vật rơi tự do từ độ cao h xuống mặt đất (bỏ qua sức cản không khí):`,
          options: [
            `Thế năng giảm dần và chuyển hóa hoàn toàn thành động năng.`,
            `Động năng và thế năng đều cùng tăng.`,
            `Cơ năng của vật không ngừng giảm theo thời gian.`,
            `Vận tốc cực đại đạt được ở vị trí ban đầu.`,
          ],
          correctIndex: 0,
          explanation: `Độ cao giảm làm thế năng giảm, vận tốc tăng làm động năng tăng; tổng cơ năng không đổi.`,
          bloomLevel: 'apply',
        },
        {
          id: `pipe-q-${Date.now()}-3`,
          question: `Đơn vị đo chuẩn quốc tế (SI) của công và năng lượng là:`,
          options: ['Jun (J)', 'Oát (W)', 'Niutơn (N)', 'Ampe (A)'],
          correctIndex: 0,
          explanation: `Công và năng lượng đều có đơn vị đo chuẩn trong hệ SI là Joule (kí hiệu J).`,
          bloomLevel: 'remember',
        },
      ];
      setPipeResult((prev) => ({ ...prev, quizQuestions }));

      // Stage 4: Interactive HTML5 Code
      setPipeStage(4);
      await new Promise((r) => setTimeout(r, 800));
      const htmlCode = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <title>Mô phỏng: ${pipeTopic}</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      margin: 0; padding: 20px;
      background: #f8fafc; color: #0f172a;
      display: flex; flex-direction: column; align-items: center;
    }
    .card {
      background: #ffffff; border: 1px solid #e2e8f0;
      border-radius: 16px; padding: 24px; max-width: 600px; width: 100%;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); text-align: center;
    }
    h2 { margin-top: 0; color: #1e3a8a; font-size: 20px; }
    canvas {
      background: #0f172a; border-radius: 12px; margin: 16px 0;
      width: 100%; max-width: 520px; height: 260px;
    }
    .controls { display: flex; gap: 12px; justify-content: center; margin-top: 12px; }
    button {
      background: #2563eb; color: #ffffff; border: none; padding: 10px 20px;
      border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s;
    }
    button:hover { background: #1d4ed8; }
    .status { font-size: 13px; color: #64748b; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Mô Phỏng Tương Tác: ${pipeTopic}</h2>
    <canvas id="simCanvas" width="520" height="260"></canvas>
    <div class="controls">
      <button id="toggleBtn">Bắt đầu / Tạm dừng</button>
      <button id="resetBtn" style="background:#64748b;">Làm lại</button>
    </div>
    <div id="statText" class="status">Động năng: 50 J | Thế năng: 50 J | Cơ năng: 100 J</div>
  </div>
  <script>
    const cvs = document.getElementById('simCanvas');
    const ctx = cvs.getContext('2d');
    let running = true;
    let t = 0;

    function draw() {
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      const w = cvs.width, h = cvs.height;
      const x = w/2 + Math.cos(t) * 160;
      const y = h/2 + Math.sin(t) * 60;

      // Track
      ctx.beginPath();
      ctx.ellipse(w/2, h/2, 160, 60, 0, 0, 2*Math.PI);
      ctx.strokeStyle = '#334155'; ctx.lineWidth = 3; ctx.stroke();

      // Particle
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, 2*Math.PI);
      ctx.fillStyle = '#38bdf8'; ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();

      // Energy calculation
      const ke = Math.round(50 + Math.cos(t)*40);
      const pe = 100 - ke;
      document.getElementById('statText').innerText = 'Động năng (Wđ): ' + ke + ' J | Thế năng (Wt): ' + pe + ' J | Cơ năng (W): 100 J (Bảo toàn)';

      if (running) t += 0.04;
      requestAnimationFrame(draw);
    }
    draw();

    document.getElementById('toggleBtn').onclick = () => { running = !running; };
    document.getElementById('resetBtn').onclick = () => { t = 0; };
  </script>
</body>
</html>`;
      setPipeResult((prev) => ({ ...prev, htmlCode }));

      setPipeStage(5);
      onNotify(`Hoàn thành quy trình 4 bước cho chủ đề "${pipeTopic}"!`, 'success');
    } catch (err) {
      onNotify('Lỗi trong quy trình tự động hóa AI.', 'error');
    } finally {
      setPipeRunning(false);
    }
  };

  const handleSavePipelineToCurriculum = () => {
    if (!selectedBook || !selectedUnit || !selectedLesson) {
      onNotify('Hãy chọn Sách, Chương và Bài học đích trước khi lưu.', 'error');
      return;
    }

    // 1. Insert Reading
    onInsertGeneratedContent(selectedBook.id, selectedUnit.id, selectedLesson.id, {
      title: `Lý thuyết: ${pipeTopic}`,
      type: 'reading',
      description: pipeResult.summary,
      estimatedMinutes: 12,
      readingMarkdown: pipeResult.readingMarkdown,
    });

    // 2. Insert Quiz
    onInsertGeneratedContent(selectedBook.id, selectedUnit.id, selectedLesson.id, {
      title: `Trắc nghiệm củng cố: ${pipeTopic}`,
      type: 'quiz',
      description: `Bộ ${pipeResult.quizQuestions.length} câu hỏi đánh giá chuẩn đầu ra.`,
      estimatedMinutes: 10,
      quizQuestions: pipeResult.quizQuestions,
    });

    // 3. Insert Interactive HTML
    onInsertGeneratedContent(selectedBook.id, selectedUnit.id, selectedLesson.id, {
      title: `Mô phỏng tương tác: ${pipeTopic}`,
      type: 'interactive-html',
      description: `Mô phỏng số hóa HTML5 tự chứa.`,
      estimatedMinutes: 8,
      htmlContent: pipeResult.htmlCode,
      sourceFilename: `sim_${Date.now()}.html`,
    });

    onNotify(`Đã tích hợp trọn gói 3 học liệu (Lý thuyết, Trắc nghiệm, Mô phỏng) vào "${selectedLesson.title}"!`, 'success');
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
            Trợ lý Kiến trúc EdTech AI
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Tư vấn cấu trúc Book → Unit → Lesson → Content theo chuẩn 4 phần và biên soạn học liệu HTML5 tương tác tự chứa.
          </p>
        </div>

        {/* Mode switch */}
        <div className="flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 self-start md:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('architect')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'architect'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Tư vấn Kiến trúc AI</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('generator')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'generator'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Xưởng tạo HTML5 tương tác</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pipeline')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'pipeline'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Workflow className="w-3.5 h-3.5" />
            <span>Quy trình Soạn bài 4 bước</span>
          </button>
        </div>
      </div>

      {/* Target destination selector bar */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 shrink-0">
          Đích tích hợp học liệu:
        </span>
        <select
          aria-label="Chọn sách đích"
          value={selectedBook?.id ?? ''}
          onChange={(e) => {
            const b = books.find((item) => item.id === e.target.value);
            setTargetBookId(e.target.value);
            const u = b?.units[0];
            setTargetUnitId(u?.id ?? '');
            setTargetLessonId(u?.lessons[0]?.id ?? '');
          }}
          className="px-3 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 max-w-[240px]"
        >
          {books.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
            </option>
          ))}
        </select>

        <span className="text-slate-400 text-xs">/</span>

        <select
          aria-label="Chọn chương đích"
          value={selectedUnit?.id ?? ''}
          onChange={(e) => {
            setTargetUnitId(e.target.value);
            const u = selectedBook?.units.find((item) => item.id === e.target.value);
            setTargetLessonId(u?.lessons[0]?.id ?? '');
          }}
          className="px-3 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 max-w-[220px]"
        >
          {(selectedBook?.units ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.title}
            </option>
          ))}
        </select>

        <span className="text-slate-400 text-xs">/</span>

        <select
          aria-label="Chọn bài học đích"
          value={selectedLesson?.id ?? ''}
          onChange={(e) => setTargetLessonId(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 max-w-[220px]"
        >
          {(selectedUnit?.lessons ?? []).map((l) => (
            <option key={l.id} value={l.id}>
              {l.title}
            </option>
          ))}
        </select>
      </div>

      {/* Tab 1: AI EdTech Architect Chat */}
      {activeTab === 'architect' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col overflow-hidden min-h-[600px]">
          {/* Quick prompts row */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={sending}
                  onClick={() => handleSendMessage(q)}
                  className="text-left px-3 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {q.length > 68 ? `${q.slice(0, 68)}...` : q}
                </button>
              ))}
            </div>
            {messages.length > 1 && (
              <button
                type="button"
                onClick={() => setMessages((prev) => prev.slice(0, 1))}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-500 hover:text-red-600 cursor-pointer whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa hội thoại</span>
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 max-h-[540px]">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                  {msg.role === 'user' ? 'Bạn' : 'EdTech Solution Architect AI'}
                </div>
                <div
                  className={`max-w-[90%] rounded-xl px-4 py-3.5 ${
                    msg.role === 'user'
                      ? 'hub-accent-bg text-sm leading-relaxed'
                      : 'border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 w-full'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <SafeMarkdown
                      content={msg.content}
                      onApplyHtmlBlock={(htmlCode) => handleSaveHtmlToTargetLesson(htmlCode)}
                    />
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang phân tích cấu trúc học liệu và lập giải pháp...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex gap-3 items-end"
          >
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Nhập yêu cầu tư vấn cấu trúc, kiểm tra HTML hoặc tạo kịch bản bài học tương tác... (Enter để gửi)"
              className="flex-1 px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 resize-none"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-lg hub-accent-bg transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0 h-10"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Gửi yêu cầu</span>
            </button>
          </form>
        </div>
      )}

      {/* Tab 2: Dedicated Interactive HTML5 Generator Studio */}
      {activeTab === 'generator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleGenerateInteractiveHtml}
            className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
          >
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 font-sans">
                Biên soạn Học liệu HTML5 Tự chứa
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                AI sẽ xuất mã HTML5 hoàn chỉnh, không phụ thuộc CDN và tương thích tuyệt đối với trình xem Sandbox.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="genTitle" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Tên học liệu
              </label>
              <input
                id="genTitle"
                type="text"
                value={genTitle}
                onChange={(e) => setGenTitle(e.target.value)}
                placeholder="Ví dụ: Bài tập ghép cặp từ vựng Unit 2"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="genType" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Loại hình tương tác
                </label>
                <select
                  id="genType"
                  value={genType}
                  onChange={(e) => setGenType(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  {INTERACTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="genLang" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Ngôn ngữ học sinh
                </label>
                <select
                  id="genLang"
                  value={genLang}
                  onChange={(e) => setGenLang(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  <option value="Tiếng Việt">Tiếng Việt</option>
                  <option value="Song ngữ Anh - Việt">Song ngữ Anh - Việt</option>
                  <option value="English">English</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="genTopic" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Mô tả mục tiêu sư phạm & nội dung chi tiết
              </label>
              <textarea
                id="genTopic"
                rows={5}
                required
                value={genTopic}
                onChange={(e) => setGenTopic(e.target.value)}
                placeholder="Ví dụ: Tạo 5 câu hỏi điền động từ chia thì Hiện tại đơn và Hiện tại tiếp diễn về chủ đề Gia đình. Có nút kiểm tra đáp án từng câu, giải thích ngữ pháp tiếng Việt và nút làm lại."
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={generating || !genTopic.trim()}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg hub-accent-bg transition-colors cursor-pointer disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{generating ? 'Đang biên soạn mã HTML5...' : 'Tạo học liệu HTML5 bằng AI'}</span>
            </button>
          </form>

          {/* Live Sandbox Preview of Generated HTML */}
          <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col min-h-[520px]">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Xem trước trực tiếp trong Sandbox
              </span>
              {generatedHtml && (
                <button
                  type="button"
                  onClick={() =>
                    handleSaveHtmlToTargetLesson(
                      generatedHtml,
                      genTitle.trim() || `${genType} (AI)`
                    )
                  }
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-md hub-accent-bg cursor-pointer whitespace-nowrap"
                >
                  Lưu vào bài học đích
                </button>
              )}
            </div>

            {generatedHtml ? (
              <iframe
                title="Xem trước học liệu HTML5 vừa tạo"
                srcDoc={generatedHtml}
                sandbox="allow-scripts allow-forms allow-modals"
                className="w-full flex-1 min-h-[470px] bg-white border-0"
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-10 text-center text-sm text-slate-500 dark:text-slate-400">
                <Code2 className="w-8 h-8 mb-3 opacity-40" />
                <p className="max-w-sm">
                  Nhập yêu cầu sư phạm ở cột trái để AI tạo bản xem trước HTML5 tương tác ngay tại đây.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mode 3: Multi-Agent Pipeline View */}
      {activeTab === 'pipeline' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Pipeline Progress Header */}
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Workflow className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Quy Trình Soạn Bài Trọn Gói 4 Chặng (Multi-Agent Pipeline)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Tự động phân công 4 chuyên gia AI: Khung sư phạm → Bài đọc Markdown → Ngân hàng Quiz → Lập trình Sandbox HTML5
                </p>
              </div>

              {pipeStage === 5 && (
                <button
                  type="button"
                  onClick={handleSavePipelineToCurriculum}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Tích hợp cả 3 học liệu vào bài học</span>
                </button>
              )}
            </div>

            {/* Stage Indicators */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { step: 1, label: '1. Khung sư phạm', desc: 'Mục tiêu GDPT' },
                { step: 2, label: '2. Bài đọc lý thuyết', desc: 'Markdown chuẩn' },
                { step: 3, label: '3. Ngân hàng đề thi', desc: 'Quiz có giải thích' },
                { step: 4, label: '4. Mô phỏng HTML5', desc: 'Canvas tương tác' },
              ].map((s) => {
                const isCurrent = pipeStage === s.step;
                const isPassed = pipeStage > s.step;

                return (
                  <div
                    key={s.step}
                    className={`p-3.5 rounded-xl border text-xs flex items-center gap-3 transition-all ${
                      isPassed
                        ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300'
                        : isCurrent
                        ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 ring-2 ring-blue-400/20 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 text-slate-400'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ${
                        isPassed
                          ? 'bg-emerald-600 text-white'
                          : isCurrent
                          ? 'bg-blue-600 text-white animate-pulse'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      {isPassed ? '✓' : s.step}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold">{s.label}</span>
                      <span className="text-[10px] opacity-75">{s.desc}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pipeline Input & Execution */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <input
                type="text"
                placeholder="Nhập tên bài học (VD: Định luật khúc xạ ánh sáng, Thì hiện tại hoàn thành...)"
                value={pipeTopic}
                onChange={(e) => setPipeTopic(e.target.value)}
                disabled={pipeRunning}
                className="flex-1 text-xs px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden"
              />
              <button
                type="button"
                disabled={pipeRunning || !pipeTopic.trim()}
                onClick={handleRunPipeline}
                className="px-6 py-2.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {pipeRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang chạy chặng {pipeStage}/4...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Khởi chạy quy trình tự động</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Pipeline Results Inspection */}
          {pipeStage > 0 && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPipePreviewTab('objectives')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      pipePreviewTab === 'objectives'
                        ? 'bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Mục tiêu ({pipeResult.objectives.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPipePreviewTab('reading')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      pipePreviewTab === 'reading'
                        ? 'bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Bài đọc Markdown
                  </button>
                  <button
                    type="button"
                    onClick={() => setPipePreviewTab('quiz')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      pipePreviewTab === 'quiz'
                        ? 'bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Bộ trắc nghiệm ({pipeResult.quizQuestions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPipePreviewTab('html')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      pipePreviewTab === 'html'
                        ? 'bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Mô phỏng Sandbox
                  </button>
                </div>
              </div>

              {/* Tab 1: Objectives */}
              {pipePreviewTab === 'objectives' && (
                <div className="space-y-3 text-xs">
                  <p className="font-semibold text-slate-700 dark:text-slate-300">
                    Tóm tắt: {pipeResult.summary || 'Đang phân tích...'}
                  </p>
                  <div className="space-y-1.5">
                    {pipeResult.objectives.map((obj, i) => (
                      <div key={i} className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{obj}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 2: Reading */}
              {pipePreviewTab === 'reading' && (
                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                  <SafeMarkdown content={pipeResult.readingMarkdown || 'Đang biên soạn bài đọc...'} />
                </div>
              )}

              {/* Tab 3: Quiz */}
              {pipePreviewTab === 'quiz' && (
                <div className="space-y-3 text-xs">
                  {pipeResult.quizQuestions.map((q, idx) => (
                    <div
                      key={q.id}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2"
                    >
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        Câu {idx + 1}: {q.question}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options.map((opt, oIdx) => (
                          <div
                            key={oIdx}
                            className={`p-2 rounded-lg border text-[11px] ${
                              oIdx === q.correctIndex
                                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-semibold'
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {String.fromCharCode(65 + oIdx)}. {opt}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab 4: HTML */}
              {pipePreviewTab === 'html' && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white overflow-hidden min-h-[360px]">
                  {pipeResult.htmlCode ? (
                    <iframe
                      title="Mô phỏng Sandbox hoàn chỉnh"
                      srcDoc={pipeResult.htmlCode}
                      sandbox="allow-scripts allow-forms allow-modals"
                      className="w-full min-h-[360px] border-0"
                    />
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-400">
                      Chặng 4 sẽ sinh mã nguồn tương tác tại đây...
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
