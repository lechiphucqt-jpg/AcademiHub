import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  FileText,
  GraduationCap,
  Printer,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import type { Book, Lesson, QuizQuestion, Unit } from '../types/academic';
import type {
  CambridgeExam,
  CambridgeExamType,
  CambridgeGeneratorConfig,
  CambridgeLevel,
} from '../types/cambridge';
import {
  generateCambridgeExamWithAi,
  getCambridgeLevelDetails,
} from '../utils/cambridgeAiGenerator';
import {
  exportCambridgeExamDocx,
  exportCambridgeExamPdf,
} from '../utils/cambridgeExamExport';

interface AiExamGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  books: Book[];
  currentBook?: Book | null;
  currentUnit?: Unit | null;
  currentLesson?: Lesson | null;
  institutionName?: string;
  onSaveExamAsQuizToLesson?: (
    bookId: string,
    unitId: string,
    lessonId: string,
    questions: QuizQuestion[],
    examTitle: string
  ) => void;
  onNotify: (message: string, tone?: 'success' | 'error' | 'info') => void;
}

export default function AiExamGeneratorModal({
  isOpen,
  onClose,
  books,
  currentBook,
  currentUnit,
  currentLesson,
  institutionName,
  onSaveExamAsQuizToLesson,
  onNotify,
}: AiExamGeneratorModalProps) {
  // Selection state
  const [selectedBookId, setSelectedBookId] = useState<string>('');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([]);

  // Exam config state
  const [level, setLevel] = useState<CambridgeLevel>('ket_a2');
  const [examType, setExamType] = useState<CambridgeExamType>('reading_and_use_of_english');
  const [questionCount, setQuestionCount] = useState<10 | 15 | 20 | 25 | 40>(25);
  const [customTitle, setCustomTitle] = useState('');

  // Generation & Results state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState(1);
  const [generatedExam, setGeneratedExam] = useState<CambridgeExam | null>(null);
  const [activeTab, setActiveTab] = useState<'paper' | 'answers'>('paper');
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [isSavedAsQuiz, setIsSavedAsQuiz] = useState(false);

  // Initialize selection when opening
  useEffect(() => {
    if (isOpen) {
      const bId = currentBook?.id || books[0]?.id || '';
      setSelectedBookId(bId);

      const targetBook = books.find((b) => b.id === bId);
      const uId = currentUnit?.id || targetBook?.units[0]?.id || '';
      setSelectedUnitId(uId);

      const targetUnit = targetBook?.units.find((u) => u.id === uId);
      const lId = currentLesson?.id || targetUnit?.lessons[0]?.id || '';
      setSelectedLessonIds(lId ? [lId] : []);

      // Auto title recommendation
      const lName = currentLesson?.title || targetUnit?.lessons[0]?.title || '';
      setCustomTitle(lName ? `Cambridge Exam — ${lName}` : 'Đề Kiểm Tra Chuẩn Cambridge');
      setGeneratedExam(null);
      setIsSavedAsQuiz(false);
    }
  }, [isOpen, currentBook, currentUnit, currentLesson, books]);

  // Derived selected entities
  const resolvedBook = useMemo(
    () => books.find((b) => b.id === selectedBookId) || books[0],
    [books, selectedBookId]
  );

  const resolvedUnit = useMemo(
    () => resolvedBook?.units.find((u) => u.id === selectedUnitId) || resolvedBook?.units[0],
    [resolvedBook, selectedUnitId]
  );

  const resolvedLessons = useMemo(() => {
    if (!resolvedUnit) return [];
    if (selectedLessonIds.length === 0) return resolvedUnit.lessons.slice(0, 1);
    return resolvedUnit.lessons.filter((l) => selectedLessonIds.includes(l.id));
  }, [resolvedUnit, selectedLessonIds]);

  if (!isOpen) return null;

  // Handle Generate Exam
  const handleGenerateExam = async () => {
    if (!resolvedBook || !resolvedUnit || resolvedLessons.length === 0) {
      onNotify('Vui lòng chọn ít nhất một bài học để tạo đề thi.', 'error');
      return;
    }

    setIsGenerating(true);
    setGeneratingStep(1);
    setGeneratedExam(null);
    setIsSavedAsQuiz(false);

    try {
      setTimeout(() => setGeneratingStep(2), 600);
      setTimeout(() => setGeneratingStep(3), 1300);

      const exam = await generateCambridgeExamWithAi({
        book: resolvedBook,
        unit: resolvedUnit,
        lessons: resolvedLessons,
        config: {
          level,
          examType,
          questionCount,
          customTitle: customTitle.trim() || undefined,
          includeExplanations: true,
        },
        institutionName,
      });

      setGeneratedExam(exam);
      onNotify('Đã tạo thành công Đề thi chuẩn Cambridge!', 'success');
    } catch (err: any) {
      onNotify(`Không thể tạo đề thi: ${err.message || err}`, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle Export Word (.docx)
  const handleExportWord = async () => {
    if (!generatedExam) return;
    setIsExportingDocx(true);
    try {
      await exportCambridgeExamDocx(generatedExam, institutionName);
      onNotify('Đã xuất file Word (.docx) chuẩn Cambridge thành công!', 'success');
    } catch (err: any) {
      onNotify(`Lỗi xuất file Word: ${err.message || err}`, 'error');
    } finally {
      setIsExportingDocx(false);
    }
  };

  // Handle Export PDF
  const handleExportPdf = () => {
    if (!generatedExam) return;
    try {
      exportCambridgeExamPdf(generatedExam, institutionName);
      onNotify('Đang mở bản in PDF chuẩn Cambridge A4...', 'info');
    } catch (err: any) {
      onNotify(`Lỗi xuất PDF: ${err.message || err}`, 'error');
    }
  };

  // Handle Save As Quiz into current Lesson
  const handleSaveAsQuiz = () => {
    if (!generatedExam || !resolvedBook || !resolvedUnit || resolvedLessons.length === 0) return;
    const targetLesson = resolvedLessons[0];
    if (!targetLesson || !onSaveExamAsQuizToLesson) return;

    const quizQuestions: QuizQuestion[] = generatedExam.questions.map((q) => ({
      id: q.id,
      question: q.contextText ? `[${q.contextText}] ${q.question}` : q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      bloomLevel: 'apply',
    }));

    onSaveExamAsQuizToLesson(
      resolvedBook.id,
      resolvedUnit.id,
      targetLesson.id,
      quizQuestions,
      generatedExam.title
    );
    setIsSavedAsQuiz(true);
    onNotify(`Đã lưu ${quizQuestions.length} câu hỏi vào bài học "${targetLesson.title}"!`, 'success');
  };

  const levelDetails = getCambridgeLevelDetails(level);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <GraduationCap className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">
                  A.I Tạo Bài Kiểm Tra Chuẩn Cambridge
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-400 text-blue-950">
                  Cambridge English
                </span>
              </div>
              <p className="text-xs text-blue-200">
                Tự động quét bài học · Phân chia Part chuẩn · Xuất file Word (.docx) &amp; PDF A4
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* STEP 1: Configuration View (If not generated or in reconfigure mode) */}
          {!generatedExam ? (
            <div className="space-y-6">
              {/* 1. Chọn bài học */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">
                    1
                  </span>
                  <span>Chọn bài học nguồn để tạo bài kiểm tra</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* Select Book */}
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                      Sách học thuật:
                    </label>
                    <select
                      value={selectedBookId}
                      onChange={(e) => {
                        const newBId = e.target.value;
                        setSelectedBookId(newBId);
                        const b = books.find((item) => item.id === newBId);
                        if (b && b.units[0]) {
                          setSelectedUnitId(b.units[0].id);
                          setSelectedLessonIds(b.units[0].lessons[0] ? [b.units[0].lessons[0].id] : []);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium"
                    >
                      {books.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.title} ({b.subject})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Select Unit */}
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                      Chương (Unit):
                    </label>
                    <select
                      value={selectedUnitId}
                      onChange={(e) => {
                        const newUId = e.target.value;
                        setSelectedUnitId(newUId);
                        const u = resolvedBook?.units.find((item) => item.id === newUId);
                        if (u && u.lessons[0]) {
                          setSelectedLessonIds([u.lessons[0].id]);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium"
                    >
                      {resolvedBook?.units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Lesson picker checkboxes */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Các bài học đưa vào đề thi (chọn 1 hoặc nhiều bài để tạo đề tổng hợp):
                    </label>
                    {resolvedUnit && resolvedUnit.lessons.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedLessonIds.length === resolvedUnit.lessons.length) {
                            setSelectedLessonIds(resolvedUnit.lessons[0] ? [resolvedUnit.lessons[0].id] : []);
                          } else {
                            setSelectedLessonIds(resolvedUnit.lessons.map((l) => l.id));
                          }
                        }}
                        className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer font-medium"
                      >
                        {selectedLessonIds.length === resolvedUnit.lessons.length
                          ? 'Chỉ chọn 1 bài'
                          : 'Chọn toàn bộ bài học trong Chương'}
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {resolvedUnit?.lessons.map((l) => {
                      const isChecked = selectedLessonIds.includes(l.id);
                      return (
                        <label
                          key={l.id}
                          className={`flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors text-xs ${
                            isChecked
                              ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 font-semibold'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedLessonIds((prev) => [...prev, l.id]);
                              } else {
                                if (selectedLessonIds.length > 1) {
                                  setSelectedLessonIds((prev) => prev.filter((id) => id !== l.id));
                                }
                              }
                            }}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="truncate">{l.title}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 2. Chọn loại bài kiểm tra */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">
                    2
                  </span>
                  <span>Chọn loại bài kiểm tra &amp; Cấp độ chuẩn Cambridge</span>
                </div>

                {/* Level selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                    Khung trình độ &amp; Chứng chỉ Cambridge mục tiêu:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {[
                      { id: 'ket_a2', name: 'A2 Key (KET)', desc: 'Pre-Inter / Elementary' },
                      { id: 'pet_b1', name: 'B1 Preliminary', desc: 'Intermediate' },
                      { id: 'movers', name: 'A1 Movers', desc: 'Beginner / YLE' },
                      { id: 'flyers', name: 'A2 Flyers', desc: 'Upper Primary' },
                      { id: 'starters', name: 'Pre-A1 Starters', desc: 'Young Learners' },
                      { id: 'fce_b2', name: 'B2 First (FCE)', desc: 'Upper-Inter' },
                      { id: 'gdpt_cambridge', name: 'Định kỳ GDPT 2018', desc: 'Chuẩn hóa Quốc tế' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setLevel(item.id as CambridgeLevel)}
                        className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                          level === item.id
                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-900 dark:text-blue-100 ring-2 ring-blue-500/30'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                        }`}
                      >
                        <div className="font-bold">{item.name}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{item.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Exam Format / Skill focus */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                      Phần thi trọng tâm (Paper Format):
                    </label>
                    <select
                      value={examType}
                      onChange={(e) => setExamType(e.target.value as CambridgeExamType)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium"
                    >
                      <option value="reading_and_use_of_english">
                        Reading &amp; Use of English (Tổng hợp Đọc hiểu, Từ vựng &amp; Ngữ pháp)
                      </option>
                      <option value="vocabulary_grammar_focus">
                        Vocabulary &amp; Grammar Mastery (Chuyên sâu Từ vựng &amp; Ngữ pháp bài học)
                      </option>
                      <option value="reading_comprehension">
                        Reading Comprehension (Đọc hiểu văn bản dài &amp; Trắc nghiệm suy luận)
                      </option>
                      <option value="cloze_and_sentence">
                        Cloze Test &amp; Sentence Completion (Điền từ &amp; Biến đổi dạng từ)
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                      Số lượng câu &amp; Thời gian làm bài:
                    </label>
                    <select
                      value={questionCount}
                      onChange={(e) => setQuestionCount(Number(e.target.value) as any)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium"
                    >
                      <option value={10}>10 câu — 15 phút (Kiểm tra nhanh)</option>
                      <option value={20}>20 câu — 30 phút (Kiểm tra thường xuyên)</option>
                      <option value={25}>25 câu — 45 phút (Chuẩn 1 Paper Cambridge A2 Key)</option>
                      <option value={40}>40 câu — 60 phút (Đề thi học kỳ đầy đủ)</option>
                    </select>
                  </div>
                </div>

                {/* Custom Title */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Tiêu đề bài kiểm tra in trên bìa đề:
                  </label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Ví dụ: Cambridge Assessment English — A2 Key End-of-Term Test"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Action Button: Start AI Generation */}
              <div className="pt-2">
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={handleGenerateExam}
                  className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 hover:from-blue-800 hover:to-indigo-800 text-white font-bold text-sm shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.005] active:scale-[0.99] disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Bắt đầu A.I Soạn Đề thi Chuẩn Cambridge</span>
                </button>
              </div>
            </div>
          ) : (
            /* STEP 2: Preview & Export View */
            <div className="space-y-4">
              {/* Exam Overview Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-blue-900/10 via-indigo-900/10 to-slate-900/10 border border-blue-200 dark:border-blue-900 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-700 text-white">
                      {generatedExam.levelBadge}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Mã đề: {generatedExam.examCode}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {generatedExam.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {generatedExam.parts.length} phần thi · {generatedExam.totalMarks} câu hỏi · Thời gian: {generatedExam.timeMinutes} phút · Dựa trên: {generatedExam.lessonTitles.join(', ')}
                  </p>
                </div>

                {/* Main 2 Export Buttons Requested by User */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportWord}
                    disabled={isExportingDocx}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                    title="Tải file Microsoft Word (.docx) chuẩn Cambridge"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Xuất file Word (.docx)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportPdf}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-700 text-white shadow-sm transition-colors cursor-pointer"
                    title="Mở giao diện in và lưu file PDF chuẩn bài thi Cambridge"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Xuất file PDF</span>
                  </button>

                  {onSaveExamAsQuizToLesson && (
                    <button
                      type="button"
                      disabled={isSavedAsQuiz}
                      onClick={handleSaveAsQuiz}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                        isSavedAsQuiz
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                      }`}
                      title="Lưu bộ câu hỏi này thành Quiz tương tác trong bài học"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{isSavedAsQuiz ? 'Đã lưu vào bài học' : 'Lưu làm Quiz tương tác'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setGeneratedExam(null)}
                    className="p-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    title="Tạo lại hoặc đổi thiết lập"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* View Tabs: Question Paper vs Answer Key */}
              <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('paper')}
                  className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                    activeTab === 'paper'
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Đề thi học sinh (Question Paper — {generatedExam.totalMarks} câu)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('answers')}
                  className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                    activeTab === 'answers'
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Đáp án &amp; Hướng dẫn chấm (Marking Scheme &amp; Rationale)
                </button>
              </div>

              {/* Tab 1: Question Paper Preview */}
              {activeTab === 'paper' && (
                <div className="space-y-6 text-xs p-4 bg-slate-50/50 dark:bg-slate-950/30 rounded-xl border border-slate-200 dark:border-slate-800 max-h-[480px] overflow-y-auto">
                  {/* Cambridge Header Preview */}
                  <div className="text-center pb-4 border-b border-slate-200 dark:border-slate-800 space-y-1">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                      {institutionName || 'CAMBRIDGE ASSESSMENT ENGLISH'}
                    </div>
                    <div className="text-base font-extrabold text-blue-900 dark:text-blue-300">
                      {generatedExam.qualificationName.toUpperCase()}
                    </div>
                    <div className="text-xs font-bold text-red-600">
                      {generatedExam.paperName}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Time allowed: {generatedExam.timeMinutes} minutes &nbsp;|&nbsp; Total: {generatedExam.totalMarks} marks
                    </div>
                  </div>

                  {/* Candidate Box Preview */}
                  <div className="p-3 rounded-lg border border-blue-900/30 bg-blue-50/40 dark:bg-blue-950/20 text-[11px] grid grid-cols-2 gap-2">
                    <div><strong>Centre Number:</strong> [ _ _ _ _ _ ]</div>
                    <div><strong>Candidate Number:</strong> [ _ _ _ _ ]</div>
                    <div><strong>Candidate Name:</strong> ....................................................</div>
                    <div><strong>Class / Date:</strong> ........................................................</div>
                  </div>

                  {/* Parts */}
                  {generatedExam.parts.map((part) => (
                    <div key={part.partNumber} className="space-y-3 pt-2">
                      <div className="flex items-center justify-between p-2 rounded-md bg-blue-950 text-white font-bold text-xs">
                        <span>{part.title}</span>
                        <span className="text-[11px] opacity-80">{part.questions.length} marks</span>
                      </div>
                      <p className="italic text-slate-600 dark:text-slate-400 pl-1">
                        {part.instructions}
                      </p>

                      {part.passage && (
                        <div className="p-3 rounded-lg border-l-4 border-blue-900 bg-slate-100 dark:bg-slate-800/60 italic text-slate-800 dark:text-slate-200">
                          {part.passage}
                        </div>
                      )}

                      <div className="space-y-3 pl-2">
                        {part.questions.map((q, idx) => (
                          <div key={q.id} className="space-y-1.5 pb-2 border-b border-slate-200/60 dark:border-slate-800">
                            <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-baseline justify-between gap-2">
                              <span>
                                <span className="text-blue-700 dark:text-blue-400 font-bold mr-1">
                                  {idx + 1}.
                                </span>
                                {q.question}
                              </span>
                              <span className="text-slate-400 text-[10px] shrink-0">[1 mark]</span>
                            </div>
                            {q.contextText && (
                              <div className="text-[11px] italic text-slate-500 pl-4">
                                "{q.contextText}"
                              </div>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pl-4 text-slate-700 dark:text-slate-300">
                              {q.options.map((opt, optIdx) => (
                                <div key={optIdx} className="flex items-baseline gap-1.5">
                                  <span className="font-bold text-blue-900 dark:text-blue-400">
                                    {['A', 'B', 'C', 'D'][optIdx]}.
                                  </span>
                                  <span>{opt}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab 2: Answer Key Preview */}
              {activeTab === 'answers' && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden text-xs max-h-[480px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-blue-950 text-white font-bold">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-12">Câu</th>
                        <th className="py-2.5 px-3 text-center w-16">Đáp án</th>
                        <th className="py-2.5 px-3 w-44">Kỹ năng / Trọng tâm</th>
                        <th className="py-2.5 px-3">Giải thích chi tiết &amp; Dẫn chứng</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {generatedExam.questions.map((q, idx) => (
                        <tr key={q.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="py-2 px-3 text-center font-bold text-slate-600 dark:text-slate-400">
                            Q{idx + 1}
                          </td>
                          <td className="py-2 px-3 text-center font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20">
                            {['A', 'B', 'C', 'D'][q.correctIndex]}
                          </td>
                          <td className="py-2 px-3 font-semibold text-indigo-700 dark:text-indigo-400">
                            {q.focusArea}
                          </td>
                          <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                            {q.explanation}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Loading Animation during generation */}
          {isGenerating && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {generatingStep === 1 && '1/3 Đang phân tích nội dung bài học & từ vựng...'}
                  {generatingStep === 2 && '2/3 Đang thiết lập ma trận đề thi Cambridge...'}
                  {generatingStep >= 3 && '3/3 Đang soạn câu hỏi trắc nghiệm & bảng đáp án...'}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Áp dụng tiêu chuẩn Cambridge Assessment English ({levelDetails.qualificationName})
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between text-xs shrink-0">
          <div className="text-slate-500 dark:text-slate-400">
            Hỗ trợ xuất trực tiếp Microsoft Word (.docx) và PDF A4 chuẩn in ấn
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer font-medium"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
