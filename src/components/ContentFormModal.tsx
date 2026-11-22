import React, { useRef, useState } from 'react';
import { Loader2, Sparkles, Upload, X } from 'lucide-react';
import type { Book, ContentType, DetailedContent, Lesson, Unit } from '../types/academic';

export type ModalTarget =
  | { kind: 'book' }
  | { kind: 'unit'; bookId: string }
  | { kind: 'lesson'; bookId: string; unitId: string }
  | { kind: 'content'; bookId: string; unitId: string; lessonId: string };

interface ContentFormModalProps {
  target: ModalTarget;
  books: Book[];
  onClose: () => void;
  onCreateBook: (book: Omit<Book, 'id' | 'updatedAt' | 'units'>) => void;
  onCreateUnit: (bookId: string, unit: Omit<Unit, 'id' | 'order' | 'lessons'>) => void;
  onCreateLesson: (bookId: string, unitId: string, lesson: Omit<Lesson, 'id' | 'order' | 'contents'>) => void;
  onCreateContent: (
    bookId: string,
    unitId: string,
    lessonId: string,
    content: Omit<DetailedContent, 'id' | 'updatedAt'>
  ) => void;
  onNotify: (message: string, tone?: 'success' | 'error' | 'info') => void;
}

const DEFAULT_HTML_STARTER = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Học liệu Tương tác Mới</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #f8fafc; color: #0f172a; padding: 24px; }
    .card { max-width: 680px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; }
    button { margin-top: 12px; padding: 8px 16px; border: 0; border-radius: 6px; background: #1d4ed8; color: #fff; cursor: pointer; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Mô-đun Học liệu Tương tác</h2>
    <p id="msg">Nhấn nút bên dưới để kiểm tra tương tác trong Sandbox.</p>
    <button type="button" onclick="document.getElementById('msg').textContent='Tương tác hoạt động ổn định trong trình xem Sandbox!'">Kiểm tra tương tác</button>
  </div>
</body>
</html>`;

export default function ContentFormModal({
  target,
  books,
  onClose,
  onCreateBook,
  onCreateUnit,
  onCreateLesson,
  onCreateContent,
  onNotify,
}: ContentFormModalProps) {
  // Book fields
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Khoa học Tự nhiên');
  const [gradeLevel, setGradeLevel] = useState('Lớp 10 THPT');
  const [author, setAuthor] = useState('Tổ Chuyên môn');
  const [description, setDescription] = useState('');

  // Lesson fields
  const [objectivesText, setObjectivesText] = useState('');

  // Content fields
  const [contentType, setContentType] = useState<ContentType>('interactive-html');
  const [estimatedMinutes, setEstimatedMinutes] = useState(8);
  const [htmlCode, setHtmlCode] = useState(DEFAULT_HTML_STARTER);
  const [sourceFilename, setSourceFilename] = useState('');
  const [readingMarkdown, setReadingMarkdown] = useState('### Nội dung trọng tâm\n\n- Điểm kiến thức 1\n- Điểm kiến thức 2');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);

  // Quiz starter
  const [quizQuestion, setQuizQuestion] = useState('');
  const [quizOptA, setQuizOptA] = useState('');
  const [quizOptB, setQuizOptB] = useState('');
  const [quizOptC, setQuizOptC] = useState('');
  const [quizOptD, setQuizOptD] = useState('');
  const [quizCorrect, setQuizCorrect] = useState(0);
  const [quizExplain, setQuizExplain] = useState('');

  const htmlFileRef = useRef<HTMLInputElement | null>(null);

  const parentBook = 'bookId' in target ? books.find((b) => b.id === target.bookId) : null;
  const parentUnit = 'unitId' in target ? parentBook?.units.find((u) => u.id === target.unitId) : null;
  const parentLesson = 'lessonId' in target ? parentUnit?.lessons.find((l) => l.id === target.lessonId) : null;

  const modalHeading =
    target.kind === 'book'
      ? 'Khởi tạo Sách Học thuật mới (Cấp 1)'
      : target.kind === 'unit'
      ? 'Thêm Chương / Unit mới (Cấp 2)'
      : target.kind === 'lesson'
      ? 'Thêm Bài học / Lesson mới (Cấp 3)'
      : 'Thêm Nội dung Chi tiết (Cấp 4)';

  const handleLoadHtmlFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      onNotify('Tệp HTML vượt quá giới hạn 2 MB.', 'error');
      return;
    }
    const text = await file.text();
    setHtmlCode(text);
    setSourceFilename(file.name);
    if (!title.trim()) {
      setTitle(file.name.replace(/\.html?$/i, '').replace(/[_-]+/g, ' '));
    }
  };

  const handleQuickAiHtml = async () => {
    if (!aiPrompt.trim() || aiGenerating) return;
    setAiGenerating(true);
    try {
      const res = await fetch('/api/ai/generate-html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: aiPrompt.trim(),
          bookTitle: parentBook?.title,
          unitTitle: parentUnit?.title,
          lessonTitle: parentLesson?.title,
        }),
      });
      const data = (await res.json()) as { html?: string; error?: string };
      if (!res.ok || !data.html) {
        throw new Error(data.error || 'Không thể tạo mã HTML bằng AI.');
      }
      setHtmlCode(data.html);
      setSourceFilename(`ai_module_${Date.now()}.html`);
      onNotify('Đã tạo mã HTML5 tương tác bằng AI. Nhấn "Lưu vào bài học" để hoàn tất.', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Lỗi kết nối AI.', 'error');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (target.kind === 'book') {
      onCreateBook({
        title: title.trim(),
        subject: subject.trim() || 'Học thuật',
        gradeLevel: gradeLevel.trim() || 'Tổng quát',
        author: author.trim() || 'Biên soạn nội bộ',
        description: description.trim() || 'Sách học thuật tương tác được quản trị theo cấu trúc 4 cấp.',
        coverImage: '',
      });
    } else if (target.kind === 'unit') {
      onCreateUnit(target.bookId, {
        title: title.trim(),
        description: description.trim() || 'Nội dung chương học chuẩn hóa.',
      });
    } else if (target.kind === 'lesson') {
      const objectives = objectivesText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      onCreateLesson(target.bookId, target.unitId, {
        title: title.trim(),
        summary: description.trim() || 'Bài học chi tiết kèm học liệu tương tác.',
        objectives,
      });
    } else {
      const base: Omit<DetailedContent, 'id' | 'updatedAt'> = {
        title: title.trim(),
        type: contentType,
        description: description.trim() || 'Thành phần học liệu trong bài học.',
        estimatedMinutes: Math.max(1, Number(estimatedMinutes) || 5),
      };
      if (contentType === 'interactive-html') {
        base.htmlContent = htmlCode;
        base.sourceFilename = sourceFilename || `${title.trim().toLowerCase().replace(/\s+/g, '_')}.html`;
      } else if (contentType === 'reading') {
        base.readingMarkdown = readingMarkdown;
      } else {
        base.quizQuestions = [
          {
            id: `q-${Date.now()}`,
            question: quizQuestion.trim() || 'Câu hỏi kiểm tra nhanh kiến thức trọng tâm của bài học:',
            options: [
              quizOptA.trim() || 'Phương án A',
              quizOptB.trim() || 'Phương án B',
              quizOptC.trim() || 'Phương án C',
              quizOptD.trim() || 'Phương án D',
            ],
            correctIndex: quizCorrect,
            explanation: quizExplain.trim() || 'Đáp án đúng theo tài liệu chuẩn của bài học.',
          },
        ];
      }
      onCreateContent(target.bookId, target.unitId, target.lessonId, base);
    }

    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={modalHeading}
      className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[1px] flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden my-8">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 font-sans">{modalHeading}</h2>
            {parentBook && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-lg">
                {[parentBook.title, parentUnit?.title, parentLesson?.title].filter(Boolean).join(' / ')}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp thoại"
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Tiêu đề *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                target.kind === 'book'
                  ? 'Ví dụ: Hóa Học 10 — Phản Ứng Tương Tác'
                  : target.kind === 'unit'
                  ? 'Ví dụ: Chương 2: Bảng Tuần Hoàn Nguyên Tố'
                  : target.kind === 'lesson'
                  ? 'Ví dụ: Bài 1: Cấu tạo nguyên tử'
                  : 'Ví dụ: Mô phỏng cấu hình Electron (HTML5)'
              }
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
          </div>

          {target.kind === 'book' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Môn học</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Cấp độ / Lớp</label>
                <input
                  type="text"
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Tác giả / Nhóm</label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Mô tả ngắn gọn
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tóm tắt mục tiêu và phạm vi nội dung..."
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 resize-none"
            />
          </div>

          {target.kind === 'lesson' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Mục tiêu bài học (mỗi dòng 1 mục tiêu)
              </label>
              <textarea
                rows={3}
                value={objectivesText}
                onChange={(e) => setObjectivesText(e.target.value)}
                placeholder={'Hiểu bản chất khái niệm trọng tâm.\nThực hành trên mô hình tương tác đạt từ 80% trở lên.'}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 resize-none"
              />
            </div>
          )}

          {target.kind === 'content' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Định dạng học liệu
                  </label>
                  <select
                    value={contentType}
                    onChange={(e) => setContentType(e.target.value as ContentType)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  >
                    <option value="interactive-html">HTML5 Tương tác (Tải tệp / Mã / AI)</option>
                    <option value="reading">Tài liệu đọc (Markdown)</option>
                    <option value="quiz">Câu hỏi Trắc nghiệm tương tác</option>
                    <option value="game">Minigames Giáo Dục (Vòng quay, Tốc độ, Lật thẻ)</option>
                    <option value="simulation">Mô Phỏng STEM &amp; Toán Học (Canvas / Vật lý)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Thời lượng dự kiến (phút)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={estimatedMinutes}
                    onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 tabular-nums"
                  />
                </div>
              </div>

              {contentType === 'interactive-html' && (
                <div className="space-y-3 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Nguồn mã HTML5 Tương tác
                    </span>
                    <input
                      ref={htmlFileRef}
                      type="file"
                      accept=".html,.htm"
                      onChange={handleLoadHtmlFile}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => htmlFileRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Tải tệp .html từ máy tính</span>
                    </button>
                  </div>

                  {/* Quick AI HTML Generator inline */}
                  <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Hoặc yêu cầu AI tạo mã HTML5 ngay tại đây:
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="Ví dụ: Bài tập ghép 5 công thức hóa học có chấm điểm..."
                        className="flex-1 px-3 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={handleQuickAiHtml}
                        disabled={aiGenerating || !aiPrompt.trim()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md hub-accent-bg cursor-pointer disabled:opacity-50 whitespace-nowrap"
                      >
                        {aiGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        <span>Tạo bằng AI</span>
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={8}
                    value={htmlCode}
                    onChange={(e) => setHtmlCode(e.target.value)}
                    spellCheck={false}
                    className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed"
                  />
                </div>
              )}

              {contentType === 'reading' && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Nội dung bài đọc (Hỗ trợ Markdown)
                  </label>
                  <textarea
                    rows={8}
                    value={readingMarkdown}
                    onChange={(e) => setReadingMarkdown(e.target.value)}
                    className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs text-slate-900 dark:text-slate-100"
                  />
                </div>
              )}

              {contentType === 'quiz' && (
                <div className="space-y-3 p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">Câu hỏi trắc nghiệm đầu tiên</div>
                  <input
                    type="text"
                    value={quizQuestion}
                    onChange={(e) => setQuizQuestion(e.target.value)}
                    placeholder="Nhập nội dung câu hỏi..."
                    className="w-full px-3 py-2 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={quizOptA}
                      onChange={(e) => setQuizOptA(e.target.value)}
                      placeholder="Đáp án A"
                      className="px-3 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    />
                    <input
                      type="text"
                      value={quizOptB}
                      onChange={(e) => setQuizOptB(e.target.value)}
                      placeholder="Đáp án B"
                      className="px-3 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    />
                    <input
                      type="text"
                      value={quizOptC}
                      onChange={(e) => setQuizOptC(e.target.value)}
                      placeholder="Đáp án C"
                      className="px-3 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    />
                    <input
                      type="text"
                      value={quizOptD}
                      onChange={(e) => setQuizOptD(e.target.value)}
                      placeholder="Đáp án D"
                      className="px-3 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      value={quizCorrect}
                      onChange={(e) => setQuizCorrect(Number(e.target.value))}
                      className="px-3 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    >
                      <option value={0}>Đáp án đúng: A</option>
                      <option value={1}>Đáp án đúng: B</option>
                      <option value={2}>Đáp án đúng: C</option>
                      <option value={3}>Đáp án đúng: D</option>
                    </select>
                    <input
                      type="text"
                      value={quizExplain}
                      onChange={(e) => setQuizExplain(e.target.value)}
                      placeholder="Giải thích đáp án..."
                      className="px-3 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-lg hub-accent-bg cursor-pointer"
            >
              {target.kind === 'content' ? 'Lưu vào bài học' : 'Tạo mới'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
