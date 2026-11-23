import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Download,
  FileText,
  GraduationCap,
  Headphones,
  KeyRound,
  Mic,
  Pause,
  PenTool,
  Play,
  Printer,
  RefreshCw,
  Sparkles,
  Square,
  Volume2,
  X,
} from 'lucide-react';
import type { Book, Lesson, QuizQuestion, Unit } from '../types/academic';
import type {
  AiProvider,
  CambridgeExam,
  CambridgeExamType,
  CambridgeLevel,
} from '../types/cambridge';
import {
  generateCambridgeExamWithAi,
  getCambridgeLevelDetails,
  getCambridgePaperTitle,
} from '../utils/cambridgeAiGenerator';
import {
  exportCambridgeExamDocx,
  exportCambridgeExamPdf,
} from '../utils/cambridgeExamExport';
import {
  downloadAudioTranscriptFile,
  downloadListeningAudioMp3,
  pauseCambridgeAudio,
  playCambridgeAudioScript,
  resumeCambridgeAudio,
  stopCambridgeAudio,
} from '../utils/cambridgeAudioSynthesizer';
import {
  getSavedAiProvider,
  getSavedApiKey,
  getSavedModel,
  getSavedOpenAiApiKey,
  getSavedOpenAiModel,
} from './AiSettingsModal';

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

  // AI Engine state
  const [aiProvider, setAiProvider] = useState<AiProvider>('gemini');
  const [geminiModel, setGeminiModel] = useState('gemini-2.5-flash');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini');
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [hasOpenAiKey, setHasOpenAiKey] = useState(false);

  // Exam config state
  const [level, setLevel] = useState<CambridgeLevel>('ket_a2');
  const [examType, setExamType] = useState<CambridgeExamType>('reading_and_use_of_english');
  const [questionCount, setQuestionCount] = useState<10 | 15 | 20 | 25 | 40>(25);
  const [customTitle, setCustomTitle] = useState('');

  // Generation & Results state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState(1);
  const [generatedExam, setGeneratedExam] = useState<CambridgeExam | null>(null);
  const [activeTab, setActiveTab] = useState<'paper' | 'script' | 'answers'>('paper');
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [isSavedAsQuiz, setIsSavedAsQuiz] = useState(false);

  // Audio Player state
  const [audioSpeed, setAudioSpeed] = useState<number>(1.0);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isAudioPaused, setIsAudioPaused] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState('');
  const [currentLineText, setCurrentLineText] = useState('');
  const [isDownloadingAudio, setIsDownloadingAudio] = useState(false);
  const [audioDownloadStatus, setAudioDownloadStatus] = useState('');

  // Initialize selection & AI state when opening
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

      const lName = currentLesson?.title || targetUnit?.lessons[0]?.title || '';
      setCustomTitle(lName ? `Cambridge Exam — ${lName}` : 'Đề Kiểm Tra Chuẩn Cambridge');
      setGeneratedExam(null);
      setIsSavedAsQuiz(false);

      // AI states
      const savedProv = getSavedAiProvider();
      setAiProvider(savedProv);
      setGeminiModel(getSavedModel() || 'gemini-2.5-flash');
      setOpenaiModel(getSavedOpenAiModel() || 'gpt-4o-mini');
      setHasGeminiKey(Boolean(getSavedApiKey()));
      setHasOpenAiKey(Boolean(getSavedOpenAiApiKey()));

      stopCambridgeAudio();
      setIsPlayingAudio(false);
      setIsAudioPaused(false);
    } else {
      stopCambridgeAudio();
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

    stopCambridgeAudio();
    setIsPlayingAudio(false);
    setIsGenerating(true);
    setGeneratingStep(1);
    setGeneratedExam(null);
    setIsSavedAsQuiz(false);

    try {
      setTimeout(() => setGeneratingStep(2), 700);
      setTimeout(() => setGeneratingStep(3), 1500);

      const chosenModel = aiProvider === 'openai' ? openaiModel : geminiModel;
      const chosenKey = aiProvider === 'openai' ? getSavedOpenAiApiKey() : getSavedApiKey();

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
          provider: aiProvider,
          model: chosenModel,
          apiKey: chosenKey,
        },
        institutionName,
      });

      setGeneratedExam(exam);
      if (exam.hasListening) {
        setActiveTab('paper');
      }
      onNotify('Đã tạo thành công Đề thi Cambridge hoàn toàn mới!', 'success');
    } catch (err: any) {
      onNotify(`Không thể tạo đề thi: ${err.message || err}`, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // Audio Playback Handlers
  const handleStartPlayAudio = (scriptToPlay?: string) => {
    const text = scriptToPlay || generatedExam?.fullListeningScript;
    if (!text) {
      onNotify('Không tìm thấy kịch bản âm thanh để phát.', 'error');
      return;
    }

    if (isAudioPaused) {
      resumeCambridgeAudio();
      setIsAudioPaused(false);
      setIsPlayingAudio(true);
      return;
    }

    setIsPlayingAudio(true);
    setIsAudioPaused(false);

    playCambridgeAudioScript({
      script: text,
      speed: audioSpeed,
      onStateChange: (state) => {
        setCurrentSpeaker(state.currentSpeaker);
        setCurrentLineText(state.currentText);
      },
      onEnd: () => {
        setIsPlayingAudio(false);
        setIsAudioPaused(false);
        setCurrentSpeaker('');
        setCurrentLineText('');
        onNotify('Đã phát xong toàn bộ phần nghe của đề thi.', 'info');
      },
      onError: (err) => {
        setIsPlayingAudio(false);
        setIsAudioPaused(false);
        onNotify(`Lỗi âm thanh: ${err.message || err}`, 'error');
      },
    });
  };

  const handlePauseAudio = () => {
    pauseCambridgeAudio();
    setIsAudioPaused(true);
  };

  const handleStopAudio = () => {
    stopCambridgeAudio();
    setIsPlayingAudio(false);
    setIsAudioPaused(false);
    setCurrentSpeaker('');
    setCurrentLineText('');
  };

  const handleDownloadTranscript = () => {
    if (!generatedExam) return;
    const script = generatedExam.fullListeningScript || generatedExam.parts
      .filter((p) => p.audioScript || p.questions.some((q) => q.audioScript))
      .map((p) => `[${p.title}]\n${p.audioScript || p.questions.map((q) => q.audioScript).filter(Boolean).join('\n')}`)
      .join('\n\n');

    if (!script) {
      onNotify('Không có kịch bản âm thanh nào trong đề thi này.', 'error');
      return;
    }

    downloadAudioTranscriptFile(generatedExam.title, script);
    onNotify('Đã tải kịch bản nghe (.txt) chuẩn Cambridge thành công!', 'success');
  };

  const handleDownloadAudioMp3 = async () => {
    if (!generatedExam) return;
    const script =
      generatedExam.fullListeningScript ||
      generatedExam.parts
        .filter((p) => p.audioScript || p.questions.some((q) => q.audioScript))
        .map(
          (p) =>
            `[${p.title}]\n${
              p.audioScript ||
              p.questions.map((q) => q.audioScript).filter(Boolean).join('\n')
            }`
        )
        .join('\n\n');

    if (!script || !script.trim()) {
      onNotify('Không tìm thấy kịch bản âm thanh để xuất file nghe.', 'error');
      return;
    }

    setIsDownloadingAudio(true);
    try {
      const activeKey =
        aiProvider === 'openai' ? getSavedOpenAiApiKey() : getSavedApiKey();
      await downloadListeningAudioMp3({
        examTitle: generatedExam.title,
        script,
        apiKey: activeKey,
        provider: aiProvider,
        onStatusChange: (status) => setAudioDownloadStatus(status),
      });
      onNotify('Đã tải thành công file âm thanh bài nghe (.mp3 / .wav)!', 'success');
    } catch (err: any) {
      onNotify(`Lỗi tải file nghe: ${err.message || err}`, 'error');
    } finally {
      setIsDownloadingAudio(false);
      setAudioDownloadStatus('');
    }
  };

  // Export Handlers
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

  const handleExportPdf = () => {
    if (!generatedExam) return;
    try {
      exportCambridgeExamPdf(generatedExam, institutionName);
      onNotify('Đang mở bản in PDF chuẩn Cambridge A4...', 'info');
    } catch (err: any) {
      onNotify(`Lỗi xuất PDF: ${err.message || err}`, 'error');
    }
  };

  const handleSaveAsQuiz = () => {
    if (!generatedExam || !resolvedBook || !resolvedUnit || resolvedLessons.length === 0) return;
    const targetLesson = resolvedLessons[0];
    if (!targetLesson || !onSaveExamAsQuizToLesson) return;

    const quizQuestions: QuizQuestion[] = generatedExam.questions.map((q) => ({
      id: q.id,
      question: q.contextText ? `[${q.contextText}] ${q.question}` : q.question,
      options: q.options && q.options.length > 0 ? q.options : ['Writing / Speaking task'],
      correctIndex: q.correctIndex || 0,
      explanation: q.explanation + (q.sampleAnswer ? ` | Bài mẫu: ${q.sampleAnswer}` : ''),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <GraduationCap className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">
                  A.I Tạo Bài Kiểm Tra Chuẩn Cambridge (ChatGPT &amp; Gemini)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-400 text-blue-950">
                  4 Kỹ Năng Độc Bản
                </span>
              </div>
              <p className="text-xs text-blue-200">
                Đổi mới hoàn toàn mỗi lần tạo · Tự tạo file nghe &amp; đọc Audio · Xuất Word (.docx) &amp; PDF
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCambridgeAudio();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!generatedExam ? (
            <div className="space-y-5">
              {/* AI Tool / Engine Picker */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                    <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Chọn Công cụ A.I Tạo Đề (ChatGPT hoặc Google Gemini)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">Mỗi lần tạo là 1 đề thi mới 100%</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* ChatGPT / OpenAI Card */}
                  <div
                    onClick={() => setAiProvider('openai')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      aiProvider === 'openai'
                        ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 ring-2 ring-emerald-500/30'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                        <Bot className="w-4 h-4 text-emerald-600" />
                        <span>ChatGPT (OpenAI)</span>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        hasOpenAiKey
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300'
                      }`}>
                        {hasOpenAiKey ? 'Đã có Key' : 'Bộ mô phỏng / Chưa có Key'}
                      </span>
                    </div>
                    <select
                      value={openaiModel}
                      onChange={(e) => setOpenaiModel(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full mt-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs"
                    >
                      <option value="gpt-4o-mini">GPT-4o Mini (Khuyến nghị — Cực nhanh &amp; Chuẩn)</option>
                      <option value="gpt-4o">GPT-4o (Đỉnh cao tiếng Anh Cambridge)</option>
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Cổ điển)</option>
                    </select>
                  </div>

                  {/* Google Gemini Card */}
                  <div
                    onClick={() => setAiProvider('gemini')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      aiProvider === 'gemini'
                        ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 ring-2 ring-blue-500/30'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                        <Sparkles className="w-4 h-4 text-blue-600" />
                        <span>Google Gemini</span>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        hasGeminiKey
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300'
                      }`}>
                        {hasGeminiKey ? 'Đã có Key' : 'Bộ mô phỏng / Chưa có Key'}
                      </span>
                    </div>
                    <select
                      value={geminiModel}
                      onChange={(e) => setGeminiModel(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full mt-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs"
                    >
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash (Khuyến nghị — Nhanh nhất)</option>
                      <option value="gemini-2.0-flash">Gemini 2.0 Flash (Thế hệ mới)</option>
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro (Tư duy sâu)</option>
                      <option value="gemini-1.5-flash">Gemini 1.5 Flash (Tiết kiệm)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 1. Chọn bài học */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">
                    1
                  </span>
                  <span>Chọn bài học nguồn để tạo bài kiểm tra</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
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

                {/* Lesson picker */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Các bài học đưa vào đề thi:
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

              {/* 2. Chọn kỹ năng & định dạng bài kiểm tra */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">
                    2
                  </span>
                  <span>Chọn kỹ năng trọng tâm &amp; Cấp độ chuẩn Cambridge</span>
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

                {/* Skill Focus Selection - Enhanced 4 Skills & Combined */}
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1.5 text-xs">
                    Phần thi trọng tâm (Phân chia 4 kỹ năng riêng biệt &amp; Kỹ năng kết hợp):
                  </label>

                  <select
                    value={examType}
                    onChange={(e) => setExamType(e.target.value as CambridgeExamType)}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium text-xs"
                  >
                    <optgroup label="⭐ Kỹ năng Độc lập (4 Kỹ năng Riêng biệt)">
                      <option value="listening">
                        🎧 Kỹ năng Nghe (Listening) — Tự tạo file nghe &amp; kịch bản Audio chuẩn Anh
                      </option>
                      <option value="reading">
                        📖 Kỹ năng Đọc (Reading) — Đọc biển báo, thông báo &amp; bài báo trắc nghiệm
                      </option>
                      <option value="writing">
                        ✍️ Kỹ năng Viết (Writing) — Viết câu, viết email ngắn 35-50 từ, bài luận kèm bài mẫu
                      </option>
                      <option value="speaking">
                        🗣 Kỹ năng Nói (Speaking) — Vấn đáp cá nhân &amp; miêu tả tranh có Audio câu hỏi
                      </option>
                    </optgroup>

                    <optgroup label="🌟 Kỹ năng Kết hợp &amp; Toàn diện">
                      <option value="comprehensive_4_skills">
                        🏆 Đề thi Toàn diện 4 Kỹ năng (Listening + Reading + Writing + Speaking)
                      </option>
                      <option value="reading_and_writing">
                        📝 Reading &amp; Writing (Đọc &amp; Viết kết hợp chuẩn KET/PET)
                      </option>
                      <option value="listening_and_speaking">
                        🎧🗣 Listening &amp; Speaking (Nghe &amp; Nói giao tiếp tương tác)
                      </option>
                      <option value="reading_and_use_of_english">
                        📚 Reading &amp; Use of English (Đọc hiểu, Từ vựng &amp; Ngữ pháp FCE/B2)
                      </option>
                    </optgroup>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                      Số lượng câu &amp; Thời gian:
                    </label>
                    <select
                      value={questionCount}
                      onChange={(e) => setQuestionCount(Number(e.target.value) as any)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium"
                    >
                      <option value={10}>10 câu — 20 phút (Kiểm tra nhanh)</option>
                      <option value={20}>20 câu — 35 phút (Kiểm tra thường xuyên)</option>
                      <option value={25}>25 câu — 45 phút (Chuẩn 1 Paper Cambridge A2 Key)</option>
                      <option value={40}>40 câu — 60 phút (Đề thi học kỳ đầy đủ)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                      Tiêu đề bài kiểm tra in trên bìa đề:
                    </label>
                    <input
                      type="text"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      placeholder="Ví dụ: Cambridge Assessment English — Unit Test"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    />
                  </div>
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
                  <span>
                    Bắt đầu A.I Soạn Đề thi Chuẩn Cambridge (Độc bản mới 100%)
                  </span>
                </button>
              </div>
            </div>
          ) : (
            /* STEP 2: Preview & Export View with Audio Player */
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
                    {generatedExam.aiEngineUsed && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {generatedExam.aiEngineUsed}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {generatedExam.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {generatedExam.parts.length} phần thi · {generatedExam.totalMarks} câu hỏi · Thời gian: {generatedExam.timeMinutes} phút · Dựa trên: {generatedExam.lessonTitles.join(', ')}
                  </p>
                </div>

                {/* Export Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportWord}
                    disabled={isExportingDocx}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                    title="Tải file Microsoft Word (.docx) chuẩn Cambridge"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Xuất Word (.docx)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportPdf}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-700 text-white shadow-xs transition-colors cursor-pointer"
                    title="Mở giao diện in và lưu file PDF chuẩn bài thi Cambridge"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Xuất PDF</span>
                  </button>

                  {(generatedExam.hasListening || generatedExam.fullListeningScript) && (
                    <button
                      type="button"
                      disabled={isDownloadingAudio}
                      onClick={handleDownloadAudioMp3}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                      title="Tải file âm thanh (.mp3) phần nghe chuẩn Cambridge về máy"
                    >
                      <Headphones className="w-4 h-4" />
                      <span>{isDownloadingAudio ? 'Đang tạo audio...' : 'Tải Audio (.mp3)'}</span>
                    </button>
                  )}

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
                      <span>{isSavedAsQuiz ? 'Đã lưu vào bài học' : 'Lưu làm Quiz'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      stopCambridgeAudio();
                      setGeneratedExam(null);
                    }}
                    className="p-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    title="Tạo lại hoặc đổi thiết lập"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Cambridge Audio Player Banner if exam has Listening or Speaking */}
              {(generatedExam.hasListening || generatedExam.hasSpeaking || generatedExam.fullListeningScript) && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-blue-500/10 border border-amber-300/60 dark:border-amber-700/60 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-amber-500 text-white">
                        <Headphones className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          Bộ Phát Âm Thanh Bài Nghe (Cambridge Listening &amp; Speaking Audio Engine)
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Tự động đọc kịch bản lời thoại với ngữ điệu chuẩn Anh - Anh (UK English) cho từng nhân vật
                        </p>
                      </div>
                    </div>

                    {/* Audio Controls */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px]">
                        <span className="text-slate-400 px-1">Tốc độ:</span>
                        {[0.85, 1.0, 1.2].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setAudioSpeed(s)}
                            className={`px-1.5 py-0.5 rounded cursor-pointer ${
                              audioSpeed === s
                                ? 'bg-indigo-600 text-white font-bold'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            {s}x
                          </button>
                        ))}
                      </div>

                      {!isPlayingAudio ? (
                        <button
                          type="button"
                          onClick={() => handleStartPlayAudio()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer shadow-xs"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Phát Audio Bài Nghe</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {isAudioPaused ? (
                            <button
                              type="button"
                              onClick={() => handleStartPlayAudio()}
                              className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer"
                              title="Tiếp tục phát"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={handlePauseAudio}
                              className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold cursor-pointer"
                              title="Tạm dừng"
                            >
                              <Pause className="w-3.5 h-3.5 fill-current" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={handleStopAudio}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                            title="Dừng hẳn"
                          >
                            <Square className="w-3.5 h-3.5 fill-current" />
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={isDownloadingAudio}
                        onClick={handleDownloadAudioMp3}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer shadow-xs disabled:opacity-50 transition-colors"
                        title="Tải file âm thanh (.mp3) phần nghe về máy tính"
                      >
                        {isDownloadingAudio ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>{audioDownloadStatus || 'Đang tạo MP3...'}</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5" />
                            <span>Tải file nghe (.mp3)</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleDownloadTranscript}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 text-xs cursor-pointer font-medium"
                        title="Tải kịch bản nghe file text .txt"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Tải kịch bản (.txt)</span>
                      </button>
                    </div>
                  </div>

                  {/* Live Speaking Feedback Bar */}
                  {isPlayingAudio && currentLineText && (
                    <div className="p-2.5 rounded-lg bg-indigo-900 text-white text-xs flex items-center gap-2 animate-pulse">
                      <Volume2 className="w-4 h-4 text-amber-300 shrink-0" />
                      <div className="truncate">
                        <strong className="text-amber-300 mr-1.5">{currentSpeaker || 'Speaker'}:</strong>
                        <span>{currentLineText}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* View Tabs */}
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
                {(generatedExam.hasListening || generatedExam.fullListeningScript) && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('script')}
                    className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'script'
                        ? 'border-amber-600 text-amber-600 dark:text-amber-400'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Headphones className="w-3.5 h-3.5" />
                    <span>Kịch bản nghe (Listening Script)</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveTab('answers')}
                  className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                    activeTab === 'answers'
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Đáp án &amp; Barem chấm (Marking Scheme &amp; Sample Answers)
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

                  {/* Parts */}
                  {generatedExam.parts.map((part) => (
                    <div key={part.partNumber} className="space-y-3 pt-2">
                      <div className="flex items-center justify-between p-2 rounded-md bg-blue-950 text-white font-bold text-xs">
                        <div className="flex items-center gap-2">
                          {part.partSkill === 'listening' && <Headphones className="w-3.5 h-3.5 text-amber-300" />}
                          {part.partSkill === 'speaking' && <Mic className="w-3.5 h-3.5 text-teal-300" />}
                          {part.partSkill === 'writing' && <PenTool className="w-3.5 h-3.5 text-rose-300" />}
                          <span>{part.title}</span>
                        </div>
                        <span className="text-[11px] opacity-80">
                          {part.questions.reduce((a, b) => a + (b.mark || 1), 0)} marks
                        </span>
                      </div>

                      <p className="italic text-slate-600 dark:text-slate-400 pl-1">
                        {part.instructions}
                      </p>

                      {part.passage && (
                        <div className="p-3 rounded-lg border-l-4 border-blue-900 bg-slate-100 dark:bg-slate-800/60 italic text-slate-800 dark:text-slate-200 leading-relaxed">
                          {part.passage}
                        </div>
                      )}

                      <div className="space-y-3.5 pl-2">
                        {part.questions.map((q, idx) => (
                          <div key={q.id} className="space-y-1.5 pb-2.5 border-b border-slate-200/60 dark:border-slate-800">
                            <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-baseline justify-between gap-2">
                              <span>
                                <span className="text-blue-700 dark:text-blue-400 font-bold mr-1">
                                  {idx + 1}.
                                </span>
                                {q.question}
                              </span>
                              <span className="text-slate-400 text-[10px] shrink-0">
                                [{q.mark || 1} mark{(q.mark || 1) > 1 ? 's' : ''}]
                              </span>
                            </div>

                            {q.contextText && (
                              <div className="text-[11px] italic text-slate-500 pl-4">
                                "{q.contextText}"
                              </div>
                            )}

                            {/* Audio prompt button for individual question */}
                            {q.audioScript && (
                              <div className="pl-4">
                                <button
                                  type="button"
                                  onClick={() => handleStartPlayAudio(q.audioScript)}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                                >
                                  <Volume2 className="w-3.5 h-3.5" />
                                  <span>Nghe âm thanh câu này</span>
                                </button>
                              </div>
                            )}

                            {q.options && q.options.length > 0 ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-4 text-slate-700 dark:text-slate-300">
                                {q.options.map((opt, optIdx) => (
                                  <div key={optIdx} className="flex items-baseline gap-1.5">
                                    <span className="font-bold text-blue-900 dark:text-blue-400">
                                      {['A', 'B', 'C', 'D'][optIdx]}.
                                    </span>
                                    <span>{opt}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="pl-4 pt-1">
                                <div className="p-2.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 text-[11px]">
                                  [Khu vực học sinh làm bài tự luận / viết câu trả lời]
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab 2: Listening Script View */}
              {activeTab === 'script' && (
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 text-xs max-h-[480px] overflow-y-auto space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Headphones className="w-4 h-4 text-amber-500" />
                      <span>Kịch bản âm thanh dành cho Giám thị / Giáo viên (Recording Script)</span>
                    </h4>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isDownloadingAudio}
                        onClick={handleDownloadAudioMp3}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer font-bold disabled:opacity-50"
                        title="Tải toàn bộ file âm thanh bài nghe (.mp3)"
                      >
                        {isDownloadingAudio ? (
                          <>
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>{audioDownloadStatus || 'Đang tạo...'}</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5" />
                            <span>Tải file nghe (.mp3)</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadTranscript}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-200 cursor-pointer font-medium"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Tải file .txt</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 font-mono leading-relaxed text-slate-800 dark:text-slate-200">
                    {(
                      generatedExam.fullListeningScript ||
                      generatedExam.parts
                        .filter((p) => p.audioScript || p.questions.some((q) => q.audioScript))
                        .map((p) => `[${p.title}]\n${p.audioScript || p.questions.map((q) => q.audioScript).filter(Boolean).join('\n')}`)
                        .join('\n\n')
                    )
                      .split('\n')
                      .map((line, idx) => {
                        const isSpeaker = line.includes(':');
                        return (
                          <div
                            key={idx}
                            className={`p-1.5 rounded ${
                              isSpeaker ? 'bg-amber-500/10 font-bold text-indigo-900 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {line}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Tab 3: Answer Key & Marking Scheme View */}
              {activeTab === 'answers' && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden text-xs max-h-[480px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-blue-950 text-white font-bold">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-12">Câu</th>
                        <th className="py-2.5 px-3 text-center w-20">Đáp án</th>
                        <th className="py-2.5 px-3 w-44">Kỹ năng / Trọng tâm</th>
                        <th className="py-2.5 px-3">Giải thích chi tiết, Dẫn chứng &amp; Bài mẫu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {generatedExam.questions.map((q, idx) => {
                        const isWriting = q.questionType === 'short_writing';
                        const isSpeaking = q.questionType === 'speaking_prompt';

                        let keyText = ['A', 'B', 'C', 'D'][q.correctIndex] || `Key ${q.correctIndex + 1}`;
                        if (isWriting) keyText = 'Writing';
                        if (isSpeaking) keyText = 'Speaking';

                        return (
                          <tr key={q.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="py-2.5 px-3 text-center font-bold text-slate-600 dark:text-slate-400">
                              Q{idx + 1}
                            </td>
                            <td className="py-2.5 px-3 text-center font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20">
                              {keyText}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-indigo-700 dark:text-indigo-400">
                              {q.focusArea}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 space-y-1">
                              <div>{q.explanation}</div>
                              {q.sampleAnswer && (
                                <div className="p-2 rounded bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-200 text-[11px]">
                                  <strong>Bài mẫu (Model Answer):</strong> "{q.sampleAnswer}"
                                </div>
                              )}
                              {q.scoringRubric && (
                                <div className="text-[10px] text-slate-500 italic">
                                  <strong>Tiêu chí chấm:</strong> {q.scoringRubric}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
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
                  {generatingStep === 1 && '1/3 Đang phân tích bài học & kích hoạt công cụ AI...'}
                  {generatingStep === 2 && '2/3 Đang thiết lập ma trận đề thi Cambridge & kịch bản hội thoại...'}
                  {generatingStep >= 3 && '3/3 Đang biên soạn câu hỏi, tiêu chí chấm & tổng hợp Audio...'}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {aiProvider === 'openai' ? 'OpenAI ChatGPT' : 'Google Gemini'} · {levelDetails.qualificationName} · Không trùng lặp
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between text-xs shrink-0">
          <div className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>Hỗ trợ cả ChatGPT &amp; Gemini · Tự tạo file nghe · Xuất Word &amp; PDF</span>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCambridgeAudio();
              onClose();
            }}
            className="px-4 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer font-medium"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
