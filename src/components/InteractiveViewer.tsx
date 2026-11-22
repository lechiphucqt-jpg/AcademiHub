import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  Download,
  Eye,
  FileDown,
  FileText,
  Lightbulb,
  Maximize2,
  Minimize2,
  Monitor,
  Presentation,
  RefreshCw,
  Share2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tablet,
  Tv,
  Upload,
  XCircle,
} from 'lucide-react';
import type { Book, DetailedContent, Lesson, QuizQuestion, SelectionPath, Unit } from '../types/academic';
import { inspectHtmlCompatibility } from '../utils/htmlInspector';
import { formatBytes } from '../utils/storage';
import SafeMarkdown from './SafeMarkdown';
import InteractiveGameEngine from './InteractiveGameEngine';
import StemSimulationLab from './StemSimulationLab';
import SocraticTutorDrawer from './SocraticTutorDrawer';
import {
  exportExamDocx,
  exportLessonPlanDocx,
  exportLessonPresentationPptx,
  exportScorm12Zip,
} from '../utils/pedagogyExport';

interface InteractiveViewerProps {
  book: Book;
  unit: Unit;
  lesson: Lesson;
  content: DetailedContent;
  onNavigate: (path: SelectionPath) => void;
  onUpdateContent: (
    bookId: string,
    unitId: string,
    lessonId: string,
    contentId: string,
    patch: Partial<DetailedContent>
  ) => void;
  onNotify: (message: string, tone?: 'success' | 'error' | 'info') => void;
}

type ViewportSize = 'desktop' | 'tablet' | 'mobile';
type EditorViewMode = 'preview' | 'split' | 'code';

export default function InteractiveViewer({
  book,
  unit,
  lesson,
  content,
  onNavigate,
  onUpdateContent,
  onNotify,
}: InteractiveViewerProps) {
  const [viewport, setViewport] = useState<ViewportSize>('desktop');
  const [viewMode, setViewMode] = useState<EditorViewMode>('preview');
  const [iframeKey, setIframeKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const [draftHtml, setDraftHtml] = useState(content.htmlContent ?? '');
  const [draftMarkdown, setDraftMarkdown] = useState(content.readingMarkdown ?? '');
  const [editingReading, setEditingReading] = useState(false);

  // Quiz state
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Pedagogy Extensions
  const [showSocraticTutor, setShowSocraticTutor] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const htmlUploadRef = useRef<HTMLInputElement | null>(null);

  const enterPresentationMode = async () => {
    setIsPresentationMode(true);
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Fallback: CSS fixed-inset handles full coverage
    }
    onNotify('Đã bật chế độ Toàn màn hình chiếu. Nhấn phím Esc hoặc nút ở góc để thoát.', 'info');
  };

  const exitPresentationMode = async () => {
    setIsPresentationMode(false);
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    if (!isPresentationMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        exitPresentationMode();
      }
    };
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isPresentationMode) {
        setIsPresentationMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isPresentationMode]);

  const handleQuickExportExamDocx = async () => {
    const questions: QuizQuestion[] = [];
    lesson.contents.forEach((c) => {
      if (c.quizQuestions) questions.push(...c.quizQuestions);
    });
    if (questions.length === 0) {
      onNotify('Bài học này chưa có câu hỏi trắc nghiệm nào để xuất đề thi.', 'error');
      return;
    }
    setIsExporting(true);
    try {
      await exportExamDocx({
        institutionName: 'Interactive Academic Hub',
        book,
        unit,
        lesson,
        questions,
      });
      onNotify('Đã xuất đề thi trắc nghiệm Word (.docx) thành công!', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Lỗi xuất đề thi Word.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleQuickExportLessonPlanDocx = async () => {
    setIsExporting(true);
    try {
      await exportLessonPlanDocx({
        institutionName: 'Interactive Academic Hub',
        book,
        unit,
        lesson,
      });
      onNotify('Đã xuất Kế hoạch bài dạy CV 5512 (.docx) thành công!', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Lỗi xuất giáo án.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleQuickExportPptx = async () => {
    setIsExporting(true);
    try {
      await exportLessonPresentationPptx({
        institutionName: 'Interactive Academic Hub',
        book,
        unit,
        lesson,
      });
      onNotify('Đã xuất bài giảng PowerPoint (.pptx) thành công!', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Lỗi xuất PowerPoint.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleQuickExportScorm = async () => {
    if (!content.htmlContent) {
      onNotify('Chỉ học liệu HTML5 tương tác mới có thể đóng gói SCORM.', 'error');
      return;
    }
    setIsExporting(true);
    try {
      await exportScorm12Zip({
        lesson,
        content,
        institutionName: 'Interactive Academic Hub',
      });
      onNotify('Đã đóng gói chuẩn SCORM 1.2 (.zip) cho Moodle LMS thành công!', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Lỗi đóng gói SCORM.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    setDraftHtml(content.htmlContent ?? '');
    setDraftMarkdown(content.readingMarkdown ?? '');
    setEditingReading(false);
    setQuizAnswers({});
    setQuizSubmitted(false);
    setIframeKey((k) => k + 1);
  }, [content.id, content.htmlContent, content.readingMarkdown]);

  const auditReport = useMemo(() => {
    if (content.type !== 'interactive-html') return null;
    return inspectHtmlCompatibility(draftHtml);
  }, [content.type, draftHtml]);

  const handleSaveHtml = () => {
    onUpdateContent(book.id, unit.id, lesson.id, content.id, {
      htmlContent: draftHtml,
      updatedAt: new Date().toISOString(),
    });
    setIframeKey((k) => k + 1);
    onNotify('Đã lưu mã nguồn HTML vào kho dữ liệu cục bộ.', 'success');
  };

  const handleUploadHtmlFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.html') && !file.name.toLowerCase().endsWith('.htm')) {
      onNotify('Vui lòng chọn tệp có phần mở rộng .html hoặc .htm.', 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      onNotify('Tệp HTML vượt quá dung lượng khuyến nghị 2 MB.', 'error');
      return;
    }
    const text = await file.text();
    setDraftHtml(text);
    onUpdateContent(book.id, unit.id, lesson.id, content.id, {
      htmlContent: text,
      sourceFilename: file.name,
      updatedAt: new Date().toISOString(),
    });
    setIframeKey((k) => k + 1);
    setShowAudit(true);
    onNotify(`Đã nạp "${file.name}" và chạy kiểm tra tương thích Sandbox.`, 'success');
  };

  const handleDownloadHtml = () => {
    const blob = new Blob([draftHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = content.sourceFilename || `${content.id}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleAiOptimizeHtml = async () => {
    if (!draftHtml.trim() || isOptimizing) return;
    setIsOptimizing(true);
    try {
      const issueDescriptions = (auditReport?.issues ?? [])
        .filter((i) => i.severity !== 'pass')
        .map((i) => `${i.label}: ${i.detail}`);

      const res = await fetch('/api/ai/optimize-html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: draftHtml,
          issues: issueDescriptions,
          lessonContext: `${book.title} > ${unit.title} > ${lesson.title} > ${content.title}`,
        }),
      });
      const data = (await res.json()) as { html?: string; error?: string };
      if (!res.ok || !data.html) {
        throw new Error(data.error || 'Không thể tối ưu hóa mã HTML.');
      }
      setDraftHtml(data.html);
      onUpdateContent(book.id, unit.id, lesson.id, content.id, {
        htmlContent: data.html,
        updatedAt: new Date().toISOString(),
      });
      setIframeKey((k) => k + 1);
      onNotify('Đã tối ưu hóa học liệu HTML5 bằng AI cho trình xem Sandbox.', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Lỗi kết nối tối ưu AI.', 'error');
    } finally {
      setIsOptimizing(false);
    }
  };

  const viewportWidthClass =
    viewport === 'mobile' ? 'max-w-[390px]' : viewport === 'tablet' ? 'max-w-[768px]' : 'w-full';

  const hasUnsavedHtml = content.type === 'interactive-html' && draftHtml !== (content.htmlContent ?? '');

  if (isPresentationMode) {
    return (
      <div className="fixed inset-0 z-[999999] w-screen h-screen bg-white dark:bg-slate-950 flex flex-col m-0 p-0 overflow-hidden select-none">
        {/* Floating presentation toolbar: faint by default, reveals smoothly on hover */}
        <div className="absolute top-3 right-4 z-[1000000] flex items-center gap-2 opacity-30 hover:opacity-100 transition-opacity duration-200">
          <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 text-white text-xs font-semibold backdrop-blur-md shadow-2xl border border-white/10 pointer-events-none">
            <Tv className="w-3.5 h-3.5 text-amber-400" />
            <span className="truncate max-w-xs">{content.title}</span>
          </span>
          <button
            type="button"
            onClick={() => setIframeKey((k) => k + 1)}
            title="Tải lại trang sách"
            className="p-2 rounded-xl bg-slate-900/85 hover:bg-slate-900 text-white backdrop-blur-md shadow-2xl border border-white/20 transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={exitPresentationMode}
            title="Thoát toàn màn hình chiếu (Phím Esc)"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/85 hover:bg-slate-900 text-white backdrop-blur-md shadow-2xl text-xs font-bold border border-white/20 transition-all cursor-pointer group"
          >
            <Minimize2 className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
            <span>Thoát màn hình chiếu (Esc)</span>
          </button>
        </div>

        {/* 100% Full-bleed content display: no margins, no padding, no outer UI */}
        <div className="w-full h-full flex-1 flex flex-col m-0 p-0 overflow-hidden bg-white">
          {content.type === 'interactive-html' && (
            <iframe
              key={`presentation-${iframeKey}`}
              title={`Toàn màn hình chiếu: ${content.title}`}
              srcDoc={draftHtml}
              sandbox="allow-scripts allow-forms allow-modals"
              className="w-full h-full flex-1 border-0 m-0 p-0 block bg-white"
            />
          )}

          {content.type === 'game' && (
            <div className="w-full h-full flex-1 overflow-y-auto p-4 sm:p-8 flex items-center justify-center bg-slate-50 dark:bg-slate-900">
              <div className="w-full max-w-5xl">
                <InteractiveGameEngine
                  lessonTitle={lesson.title}
                  questions={content.quizQuestions || []}
                  onNotify={onNotify}
                />
              </div>
            </div>
          )}

          {content.type === 'simulation' && (
            <div className="w-full h-full flex-1 overflow-y-auto p-4 sm:p-8 flex items-center justify-center bg-slate-50 dark:bg-slate-900">
              <div className="w-full max-w-5xl">
                <StemSimulationLab
                  initialType={content.simulationType || 'physics-projectile'}
                  onNotify={onNotify}
                />
              </div>
            </div>
          )}

          {content.type === 'quiz' && (
            <div className="w-full h-full flex-1 overflow-y-auto p-6 sm:p-12 flex items-center justify-center bg-slate-50 dark:bg-slate-900">
              <div className="max-w-3xl w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-2xl space-y-6">
                <div className="space-y-1 pb-4 border-b border-slate-200 dark:border-slate-800">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Bài kiểm tra tương tác · {(content.quizQuestions ?? []).length} câu hỏi
                  </p>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{content.title}</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{content.description}</p>
                </div>

                {(content.quizQuestions ?? []).map((q, qIdx) => {
                  const picked = quizAnswers[q.id];
                  const isCorrect = picked === q.correctIndex;
                  return (
                    <div key={q.id} className="space-y-3">
                      <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
                        Câu {qIdx + 1}. {q.question}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {q.options.map((opt, optIdx) => {
                          const selected = picked === optIdx;
                          let styleCls =
                            'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 hover:border-slate-400';
                          if (quizSubmitted) {
                            if (optIdx === q.correctIndex) {
                              styleCls =
                                'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 font-medium';
                            } else if (selected && optIdx !== q.correctIndex) {
                              styleCls =
                                'border-red-500 bg-red-50 dark:bg-red-950/50 text-red-900 dark:text-red-200';
                            }
                          } else if (selected) {
                            styleCls = 'hub-accent-border hub-accent-soft-bg hub-accent-text font-medium';
                          }
                          return (
                            <button
                              key={optIdx}
                              type="button"
                              disabled={quizSubmitted}
                              onClick={() => setQuizAnswers((prev) => ({ ...prev, [q.id]: optIdx }))}
                              className={`text-left px-4 py-3 rounded-xl border text-sm transition-colors cursor-pointer disabled:cursor-default ${styleCls}`}
                            >
                              <span className="font-mono text-xs mr-2 opacity-70">
                                {String.fromCharCode(65 + optIdx)}.
                              </span>
                              <span>{opt}</span>
                            </button>
                          );
                        })}
                      </div>
                      {quizSubmitted && (
                        <div className="text-xs p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                          <span
                            className={
                              isCorrect
                                ? 'font-semibold text-emerald-700 dark:text-emerald-400'
                                : 'font-semibold text-red-700 dark:text-red-400'
                            }
                          >
                            {isCorrect ? 'Chính xác: ' : 'Cần xem lại: '}
                          </span>
                          {q.explanation}
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  {quizSubmitted ? (
                    <div className="text-base font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                      Kết quả:{' '}
                      {(content.quizQuestions ?? []).filter((q) => quizAnswers[q.id] === q.correctIndex).length} /{' '}
                      {(content.quizQuestions ?? []).length} câu đúng
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      Đã chọn {Object.keys(quizAnswers).length} / {(content.quizQuestions ?? []).length} câu
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    {quizSubmitted ? (
                      <button
                        type="button"
                        onClick={() => {
                          setQuizAnswers({});
                          setQuizSubmitted(false);
                        }}
                        className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        Làm lại bài kiểm tra
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setQuizSubmitted(true)}
                        className="px-4 py-2 text-xs font-semibold rounded-lg hub-accent-bg cursor-pointer"
                      >
                        Nộp bài & Chấm điểm
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {content.type === 'reading' && (
            <div className="w-full h-full flex-1 overflow-y-auto p-6 sm:p-12 flex justify-center bg-slate-50 dark:bg-slate-900">
              <div className="max-w-4xl w-full p-8 sm:p-12 rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{content.title}</h2>
                <SafeMarkdown content={draftMarkdown || 'Chưa có nội dung bài đọc.'} />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 flex flex-col'
          : 'flex flex-col min-h-[calc(100vh-61px)]'
      }
    >
      {/* Breadcrumb & Content Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <nav aria-label="Đường dẫn phân cấp" className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <button
                type="button"
                onClick={() => onNavigate({ bookId: book.id, unitId: null, lessonId: null, contentId: null })}
                className="hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer truncate max-w-[200px]"
              >
                {book.title}
              </button>
              <span aria-hidden="true">/</span>
              <button
                type="button"
                onClick={() => onNavigate({ bookId: book.id, unitId: unit.id, lessonId: null, contentId: null })}
                className="hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer truncate max-w-[180px]"
              >
                {unit.title}
              </button>
              <span aria-hidden="true">/</span>
              <button
                type="button"
                onClick={() =>
                  onNavigate({ bookId: book.id, unitId: unit.id, lessonId: lesson.id, contentId: null })
                }
                className="hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer truncate max-w-[180px]"
              >
                {lesson.title}
              </button>
            </nav>

            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{content.title}</h1>
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {content.estimatedMinutes} phút
                {auditReport ? ` · ${formatBytes(auditReport.byteSize)}` : ''}
              </span>
            </div>

            {/* Pedagogy Quick Exports & Socratic Tutor */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                type="button"
                onClick={enterPresentationMode}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer transition-all"
                title="Chiếu toàn màn hình trang sách (phóng to tối đa, không thanh công cụ, chuyên dùng cho máy chiếu)"
              >
                <Tv className="w-3.5 h-3.5" />
                <span>Toàn màn hình chiếu</span>
              </button>

              <button
                type="button"
                onClick={() => setShowSocraticTutor(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-white shadow-xs cursor-pointer transition-all"
              >
                <Lightbulb className="w-3.5 h-3.5 fill-current" />
                <span>Gia sư Socratic</span>
              </button>

              <button
                type="button"
                disabled={isExporting}
                onClick={handleQuickExportExamDocx}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 cursor-pointer disabled:opacity-50"
                title="Xuất ngân hàng câu hỏi thành Đề thi Word (.docx)"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Xuất Đề thi (.docx)</span>
              </button>

              <button
                type="button"
                disabled={isExporting}
                onClick={handleQuickExportLessonPlanDocx}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border border-teal-200 dark:border-teal-900 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 hover:bg-teal-100 cursor-pointer disabled:opacity-50"
                title="Xuất Kế hoạch bài dạy CV 5512 ra Word (.docx)"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Giáo án 5512 (.docx)</span>
              </button>

              <button
                type="button"
                disabled={isExporting}
                onClick={handleQuickExportPptx}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border border-purple-200 dark:border-purple-900 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 cursor-pointer disabled:opacity-50"
                title="Xuất slide bài giảng PowerPoint (.pptx)"
              >
                <Presentation className="w-3.5 h-3.5" />
                <span>Slide (.pptx)</span>
              </button>

              {content.type === 'interactive-html' && (
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={handleQuickExportScorm}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer disabled:opacity-50"
                  title="Xuất gói e-learning SCORM 1.2 cho LMS Moodle/Canvas"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Gói SCORM 1.2</span>
                </button>
              )}
            </div>
          </div>

          {/* Interactive HTML Toolbar */}
          {content.type === 'interactive-html' && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <input
                ref={htmlUploadRef}
                type="file"
                accept=".html,.htm"
                onChange={handleUploadHtmlFile}
                className="hidden"
              />

              {/* Mode switcher */}
              <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setViewMode('preview')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    viewMode === 'preview'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Trình xem</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('split')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    viewMode === 'split'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Song song</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('code')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    viewMode === 'code'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <span>Mã HTML</span>
                </button>
              </div>

              {/* Viewport size switcher */}
              {viewMode !== 'code' && (
                <div className="hidden sm:flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setViewport('desktop')}
                    title="Khung Desktop (100%)"
                    className={`p-1.5 rounded-md cursor-pointer ${
                      viewport === 'desktop'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewport('tablet')}
                    title="Khung Tablet (768px)"
                    className={`p-1.5 rounded-md cursor-pointer ${
                      viewport === 'tablet'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <Tablet className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewport('mobile')}
                    title="Khung Di động (390px)"
                    className={`p-1.5 rounded-md cursor-pointer ${
                      viewport === 'mobile'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowAudit((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                  showAudit
                    ? 'hub-accent-soft-bg hub-accent-border hub-accent-text'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Kiểm định HTML</span>
              </button>

              <button
                type="button"
                onClick={() => htmlUploadRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Tải .html</span>
              </button>

              <button
                type="button"
                onClick={handleAiOptimizeHtml}
                disabled={isOptimizing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hub-accent-bg transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isOptimizing ? 'Đang tối ưu...' : 'Tối ưu bằng AI'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIframeKey((k) => k + 1)}
                title="Tải lại trình xem"
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleDownloadHtml}
                title="Tải xuống tệp HTML độc lập"
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={enterPresentationMode}
                title="Toàn màn hình chiếu (Máy chiếu lớp học)"
                className="p-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 cursor-pointer"
              >
                <Tv className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setIsFullscreen((f) => !f)}
                title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình (Giao diện)'}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>

        {/* HTML Audit Inspector Drawer */}
        {content.type === 'interactive-html' && showAudit && auditReport && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                Báo cáo Kiểm định Tương thích & Cô lập Sandbox
              </div>
              <div className="text-slate-500 dark:text-slate-400 tabular-nums">
                {auditReport.scriptCount} thẻ script · {auditReport.styleCount} thẻ style ·{' '}
                {auditReport.externalResourceCount} liên kết ngoài · {formatBytes(auditReport.byteSize)}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {auditReport.issues.map((issue) => (
                <div
                  key={issue.code}
                  className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-start gap-2.5 text-xs"
                >
                  {issue.severity === 'pass' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : issue.severity === 'warning' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-0.5">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{issue.label}</div>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{issue.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Content Stage */}
      <div className="flex-1 p-5 bg-slate-100/70 dark:bg-slate-950 flex flex-col">
        {content.type === 'interactive-html' && (
          <div
            className={`flex-1 grid gap-4 ${
              viewMode === 'split' ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'
            }`}
          >
            {/* Code Editor Pane */}
            {(viewMode === 'code' || viewMode === 'split') && (
              <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 overflow-hidden min-h-[540px]">
                <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono text-slate-300 truncate">
                    {content.sourceFilename || `${content.id}.html`}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {hasUnsavedHtml && <span className="text-amber-400">Chưa lưu thay đổi</span>}
                    <button
                      type="button"
                      onClick={handleSaveHtml}
                      className="px-3 py-1 rounded-md hub-accent-bg font-medium cursor-pointer whitespace-nowrap"
                    >
                      Lưu & Cập nhật
                    </button>
                  </div>
                </div>
                <textarea
                  value={draftHtml}
                  onChange={(e) => setDraftHtml(e.target.value)}
                  spellCheck={false}
                  aria-label="Trình soạn mã HTML tương tác"
                  className="flex-1 w-full p-4 bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed resize-none focus:outline-none"
                />
              </div>
            )}

            {/* Sandboxed Iframe Preview Pane */}
            {(viewMode === 'preview' || viewMode === 'split') && (
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`${viewportWidthClass} w-full flex-1 min-h-[560px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white overflow-hidden shadow-xs flex flex-col transition-all`}
                >
                  <iframe
                    key={iframeKey}
                    title={`Trình xem tương tác: ${content.title}`}
                    srcDoc={draftHtml}
                    sandbox="allow-scripts allow-forms allow-modals"
                    className="w-full flex-1 min-h-[560px] bg-white border-0"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Native Quiz Runner */}
        {content.type === 'quiz' && (
          <div className="max-w-3xl w-full mx-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6">
            <div className="space-y-1 pb-4 border-b border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Bài kiểm tra tương tác · {(content.quizQuestions ?? []).length} câu hỏi
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300">{content.description}</p>
            </div>

            {(content.quizQuestions ?? []).length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Chưa có câu hỏi trong bài kiểm tra này.</p>
            ) : (
              <div className="space-y-6">
                {(content.quizQuestions ?? []).map((q, qIdx) => {
                  const picked = quizAnswers[q.id];
                  const isCorrect = picked === q.correctIndex;

                  return (
                    <div key={q.id} className="space-y-3">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Câu {qIdx + 1}. {q.question}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {q.options.map((opt, optIdx) => {
                          const selected = picked === optIdx;
                          let styleCls =
                            'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 hover:border-slate-400';

                          if (quizSubmitted) {
                            if (optIdx === q.correctIndex) {
                              styleCls =
                                'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 font-medium';
                            } else if (selected && optIdx !== q.correctIndex) {
                              styleCls =
                                'border-red-500 bg-red-50 dark:bg-red-950/50 text-red-900 dark:text-red-200';
                            }
                          } else if (selected) {
                            styleCls = 'hub-accent-border hub-accent-soft-bg hub-accent-text font-medium';
                          }

                          return (
                            <button
                              key={optIdx}
                              type="button"
                              disabled={quizSubmitted}
                              onClick={() => setQuizAnswers((prev) => ({ ...prev, [q.id]: optIdx }))}
                              className={`text-left px-3.5 py-2.5 rounded-lg border text-sm transition-colors cursor-pointer disabled:cursor-default ${styleCls}`}
                            >
                              <span className="font-mono text-xs mr-2 opacity-70">
                                {String.fromCharCode(65 + optIdx)}.
                              </span>
                              <span>{opt}</span>
                            </button>
                          );
                        })}
                      </div>

                      {quizSubmitted && (
                        <div className="text-xs p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                          <span className={isCorrect ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'font-semibold text-red-700 dark:text-red-400'}>
                            {isCorrect ? 'Chính xác: ' : 'Cần xem lại: '}
                          </span>
                          {q.explanation}
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                  {quizSubmitted ? (
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                      Kết quả:{' '}
                      {(content.quizQuestions ?? []).filter((q) => quizAnswers[q.id] === q.correctIndex).length} /{' '}
                      {(content.quizQuestions ?? []).length} câu đúng
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      Đã chọn {Object.keys(quizAnswers).length} / {(content.quizQuestions ?? []).length} câu
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    {quizSubmitted ? (
                      <button
                        type="button"
                        onClick={() => {
                          setQuizAnswers({});
                          setQuizSubmitted(false);
                        }}
                        className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        Làm lại bài kiểm tra
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setQuizSubmitted(true)}
                        className="px-4 py-2 text-xs font-semibold rounded-lg hub-accent-bg cursor-pointer"
                      >
                        Nộp bài & Chấm điểm
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Structured Reading View */}
        {content.type === 'reading' && (
          <div className="max-w-3xl w-full mx-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">{content.description}</p>
              <button
                type="button"
                onClick={() => {
                  if (editingReading) {
                    onUpdateContent(book.id, unit.id, lesson.id, content.id, {
                      readingMarkdown: draftMarkdown,
                      updatedAt: new Date().toISOString(),
                    });
                    setEditingReading(false);
                    onNotify('Đã lưu tài liệu bài học.', 'success');
                  } else {
                    setEditingReading(true);
                  }
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap shrink-0"
              >
                {editingReading ? 'Lưu tài liệu' : 'Chỉnh sửa'}
              </button>
            </div>

            {editingReading ? (
              <textarea
                value={draftMarkdown}
                onChange={(e) => setDraftMarkdown(e.target.value)}
                rows={16}
                className="w-full p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
              />
            ) : (
              <SafeMarkdown content={draftMarkdown || 'Chưa có nội dung bài đọc.'} />
            )}
          </div>
        )}

        {/* Minigames Engine View */}
        {content.type === 'game' && (
          <div className="max-w-4xl w-full mx-auto">
            <InteractiveGameEngine
              lessonTitle={lesson.title}
              questions={content.quizQuestions || []}
              onNotify={onNotify}
            />
          </div>
        )}

        {/* STEM & Algorithmic Simulation View */}
        {content.type === 'simulation' && (
          <div className="max-w-4xl w-full mx-auto">
            <StemSimulationLab
              initialType={content.simulationType || 'physics-projectile'}
              onNotify={onNotify}
            />
          </div>
        )}
      </div>

      {/* Socratic Tutor Drawer */}
      <SocraticTutorDrawer
        lesson={lesson}
        content={content}
        isOpen={showSocraticTutor}
        onClose={() => setShowSocraticTutor(false)}
        onNotify={onNotify}
      />
    </div>
  );
}
