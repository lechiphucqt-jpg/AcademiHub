import React, { useMemo, useRef, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  Download,
  FileDown,
  FileJson,
  FileText,
  FolderSync,
  GraduationCap,
  HardDrive,
  Presentation,
  RotateCcw,
  Share2,
  Upload,
} from 'lucide-react';
import type { Book, HubState, QuizQuestion } from '../types/academic';
import {
  buildPortableTreePreview,
  computeCurriculumStats,
  exportJsonSnapshot,
  exportPortableZipBundle,
  parseImportedFile,
  saveBundleToLocalDirectory,
  triggerBlobDownload,
} from '../utils/portableBundle';
import { estimateStateByteSize, formatBytes, supportsDirectoryPicker } from '../utils/storage';
import {
  exportExamDocx,
  exportLessonPlanDocx,
  exportLessonPresentationPptx,
  exportMoodleGift,
  exportMoodleXml,
  exportScorm12Zip,
} from '../utils/pedagogyExport';

interface PortabilityConsoleProps {
  hubState: HubState;
  storageEngine: 'IndexedDB' | 'localStorage';
  lastSavedAt: string | null;
  onImportState: (imported: HubState, mode: 'replace' | 'merge') => void;
  onResetToSeed: () => void;
  onNotify: (message: string, tone?: 'success' | 'error' | 'info') => void;
}

export default function PortabilityConsole({
  hubState,
  storageEngine,
  lastSavedAt,
  onImportState,
  onResetToSeed,
  onNotify,
}: PortabilityConsoleProps) {
  const [exportingZip, setExportingZip] = useState(false);
  const [syncingDir, setSyncingDir] = useState(false);
  const [pendingImport, setPendingImport] = useState<{
    filename: string;
    state: HubState;
    sourceType: 'zip' | 'json';
    stats: ReturnType<typeof computeCurriculumStats>;
  } | null>(null);
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('merge');
  const [confirmReset, setConfirmReset] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stats = useMemo(() => computeCurriculumStats(hubState.books), [hubState.books]);
  const treePreview = useMemo(() => buildPortableTreePreview(hubState.books), [hubState.books]);
  const totalBytes = useMemo(() => estimateStateByteSize(hubState), [hubState]);
  const canPickDir = supportsDirectoryPicker();

  // Pedagogy Publishing State
  const [pedagogyBookId, setPedagogyBookId] = useState<string>('all');
  const [pedagogyProcessing, setPedagogyProcessing] = useState(false);

  // Collect questions from selected book or all books
  const targetQuestions = useMemo(() => {
    const list: QuizQuestion[] = [];
    const booksToScan =
      pedagogyBookId === 'all'
        ? hubState.books
        : hubState.books.filter((b) => b.id === pedagogyBookId);

    booksToScan.forEach((b) => {
      b.units.forEach((u) => {
        u.lessons.forEach((l) => {
          l.contents.forEach((c) => {
            if (c.quizQuestions && c.quizQuestions.length > 0) {
              list.push(...c.quizQuestions);
            }
          });
        });
      });
    });
    return list;
  }, [hubState.books, pedagogyBookId]);

  const handleExportPedagogyExamDocx = async () => {
    if (targetQuestions.length === 0) {
      onNotify('Không tìm thấy câu hỏi trắc nghiệm nào trong phạm vi đã chọn.', 'error');
      return;
    }
    setPedagogyProcessing(true);
    try {
      const selectedBook = hubState.books.find((b) => b.id === pedagogyBookId);
      await exportExamDocx({
        institutionName: hubState.branding.institutionName || 'Trường THPT',
        book: selectedBook,
        questions: targetQuestions,
        examTitle: `ĐỀ THI ĐÁNH GIÁ NĂNG LỰC HỌC TẬP (${targetQuestions.length} CÂU)`,
      });
      onNotify(`Đã tạo và tải xuống Đề thi Word (.docx) gồm ${targetQuestions.length} câu hỏi chuẩn Bộ GD&ĐT!`, 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Lỗi xuất đề thi Word.', 'error');
    } finally {
      setPedagogyProcessing(false);
    }
  };

  const handleExportPedagogyLessonPlanDocx = async () => {
    const firstBook = pedagogyBookId === 'all' ? hubState.books[0] : hubState.books.find((b) => b.id === pedagogyBookId);
    const firstUnit = firstBook?.units[0];
    const firstLesson = firstUnit?.lessons[0];
    if (!firstBook || !firstUnit || !firstLesson) {
      onNotify('Cần có ít nhất 1 Bài học để tạo Kế hoạch bài dạy.', 'error');
      return;
    }
    setPedagogyProcessing(true);
    try {
      await exportLessonPlanDocx({
        institutionName: hubState.branding.institutionName,
        book: firstBook,
        unit: firstUnit,
        lesson: firstLesson,
      });
      onNotify(`Đã xuất Kế hoạch bài dạy CV 5512 ra Word (.docx) cho "${firstLesson.title}".`, 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Lỗi xuất giáo án.', 'error');
    } finally {
      setPedagogyProcessing(false);
    }
  };

  const handleExportPedagogyPptx = async () => {
    const firstBook = pedagogyBookId === 'all' ? hubState.books[0] : hubState.books.find((b) => b.id === pedagogyBookId);
    const firstUnit = firstBook?.units[0];
    const firstLesson = firstUnit?.lessons[0];
    if (!firstBook || !firstUnit || !firstLesson) {
      onNotify('Cần có ít nhất 1 Bài học để tạo Slide trình chiếu.', 'error');
      return;
    }
    setPedagogyProcessing(true);
    try {
      await exportLessonPresentationPptx({
        institutionName: hubState.branding.institutionName,
        book: firstBook,
        unit: firstUnit,
        lesson: firstLesson,
        accentHex: hubState.branding.customAccentHex,
      });
      onNotify(`Đã xuất bài giảng PowerPoint (.pptx) chuẩn cho "${firstLesson.title}".`, 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Lỗi xuất bài giảng PowerPoint.', 'error');
    } finally {
      setPedagogyProcessing(false);
    }
  };

  const handleExportPedagogyMoodleXml = () => {
    if (targetQuestions.length === 0) {
      onNotify('Không tìm thấy câu hỏi trắc nghiệm nào để xuất sang Moodle.', 'error');
      return;
    }
    try {
      exportMoodleXml({
        lessonTitle: pedagogyBookId === 'all' ? 'Toan_Bo_Ngan_Hang' : pedagogyBookId,
        questions: targetQuestions,
      });
      onNotify(`Đã xuất ${targetQuestions.length} câu hỏi ra định dạng Moodle XML Question Bank!`, 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Lỗi xuất Moodle XML.', 'error');
    }
  };

  const handleExportPedagogyMoodleGift = () => {
    if (targetQuestions.length === 0) {
      onNotify('Không tìm thấy câu hỏi trắc nghiệm nào để xuất sang GIFT.', 'error');
      return;
    }
    try {
      exportMoodleGift({
        lessonTitle: pedagogyBookId === 'all' ? 'Toan_Bo_Ngan_Hang' : pedagogyBookId,
        questions: targetQuestions,
      });
      onNotify(`Đã xuất ${targetQuestions.length} câu hỏi ra định dạng Moodle GIFT!`, 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Lỗi xuất GIFT.', 'error');
    }
  };

  const handleExportPedagogyScorm = async () => {
    let targetLesson = null;
    let targetContent = null;

    for (const b of hubState.books) {
      for (const u of b.units) {
        for (const l of u.lessons) {
          const found = l.contents.find((c) => c.type === 'interactive-html' && c.htmlContent);
          if (found) {
            targetLesson = l;
            targetContent = found;
            break;
          }
        }
        if (targetContent) break;
      }
      if (targetContent) break;
    }

    if (!targetLesson || !targetContent) {
      onNotify('Cần có ít nhất 1 học liệu HTML5 để đóng gói SCORM.', 'error');
      return;
    }

    setPedagogyProcessing(true);
    try {
      await exportScorm12Zip({
        lesson: targetLesson,
        content: targetContent,
        institutionName: hubState.branding.institutionName,
      });
      onNotify(`Đã đóng gói học liệu "${targetContent.title}" thành gói SCORM 1.2 (.zip)!`, 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Lỗi đóng gói SCORM.', 'error');
    } finally {
      setPedagogyProcessing(false);
    }
  };

  const handleExportZip = async () => {
    setExportingZip(true);
    try {
      const { blob, filename } = await exportPortableZipBundle(hubState);
      triggerBlobDownload(blob, filename);
      onNotify(`Đã đóng gói và tải xuống "${filename}" kèm đầy đủ HTML, JSON và Branding.`, 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Lỗi khi xuất gói dữ liệu ZIP.', 'error');
    } finally {
      setExportingZip(false);
    }
  };

  const handleExportJson = () => {
    const { blob, filename } = exportJsonSnapshot(hubState);
    triggerBlobDownload(blob, filename);
    onNotify(`Đã xuất bản sao lưu nhanh "${filename}".`, 'success');
  };

  const handleDirectFolderSync = async () => {
    setSyncingDir(true);
    try {
      const { directoryName, filesWritten } = await saveBundleToLocalDirectory(hubState);
      onNotify(`Đã ghi trực tiếp ${filesWritten} tệp theo đúng cấu trúc cây vào thư mục "${directoryName}".`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể ghi vào thư mục cục bộ.';
      if (!msg.toLowerCase().includes('abort')) {
        onNotify(msg, 'info');
      }
    } finally {
      setSyncingDir(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = await parseImportedFile(file);
      setPendingImport({
        filename: file.name,
        state: parsed.state,
        sourceType: parsed.sourceType,
        stats: parsed.stats,
      });
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Tệp nhập vào không hợp lệ.', 'error');
    }
  };

  const handleConfirmImport = () => {
    if (!pendingImport) return;
    onImportState(pendingImport.state, importMode);
    onNotify(
      importMode === 'replace'
        ? `Đã khôi phục toàn bộ dữ liệu từ "${pendingImport.filename}".`
        : `Đã hợp nhất ${pendingImport.stats.bookCount} sách từ "${pendingImport.filename}" vào kho dữ liệu.`,
      'success'
    );
    setPendingImport(null);
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      <div className="pb-5 border-b border-slate-200 dark:border-slate-800 space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
          Lưu trữ Local-First & Đồng bộ Gói dữ liệu
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-3xl">
          Toàn bộ sách học thuật, tệp HTML5 tương tác và cấu hình thương hiệu được lưu an toàn ngay trên thiết bị của bạn và đóng gói di động để chuyển sang máy tính khác không mất định dạng.
        </p>
      </div>

      {/* Local Storage Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400">Động cơ Lưu trữ Cục bộ</div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <HardDrive className="w-4 h-4 hub-accent-text" />
            <span>{storageEngine}</span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {lastSavedAt
              ? `Đồng bộ lúc ${new Date(lastSavedAt).toLocaleTimeString('vi-VN')}`
              : 'Tự động lưu sau mỗi thay đổi'}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400">Dung lượng Kho cục bộ</div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {formatBytes(totalBytes)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {stats.bookCount} sách · {stats.lessonCount} bài học
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400">Học liệu HTML5 độc lập</div>
          <div className="text-lg font-bold hub-accent-text tabular-nums">{stats.htmlCount} tệp</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Tự chứa, sẵn sàng ngoại tuyến</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400">Toàn vẹn Cấu trúc</div>
          <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            <span>Hợp lệ 4 cấp</span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">v{hubState.schemaVersion}</div>
        </div>
      </div>

      {/* Pedagogy Publishing Center */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 md:p-8 shadow-xs flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                <GraduationCap className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Trung Tâm Xuất Bản Học Thuật &amp; Nghiệp Vụ Sư Phạm
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Xuất bản Đề thi Word, Giáo án CV 5512, Slide PowerPoint và Cầu nối đồng bộ Moodle LMS / SCORM 1.2
            </p>
          </div>

          {/* Scope Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
              Phạm vi:
            </span>
            <select
              value={pedagogyBookId}
              onChange={(e) => setPedagogyBookId(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer focus:outline-hidden"
            >
              <option value="all">Toàn bộ ngân hàng ({targetQuestions.length} câu)</option>
              {hubState.books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title} ({b.subject})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 4 Feature Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Word Exam */}
          <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 flex flex-col justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-xs">
                <FileText className="w-4 h-4" />
                <span>Đề thi Word (.docx)</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Chuẩn hóa đề thi của Bộ GD&amp;ĐT với 4 phương án A, B, C, D kèm bảng đáp án &amp; giải thích chi tiết ở trang cuối.
              </p>
            </div>
            <button
              type="button"
              disabled={pedagogyProcessing || targetQuestions.length === 0}
              onClick={handleExportPedagogyExamDocx}
              className="w-full py-2 px-3 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải Đề thi Word (.docx)</span>
            </button>
          </div>

          {/* Card 2: Lesson Plan CV 5512 */}
          <div className="p-4 rounded-xl border border-teal-200 dark:border-teal-900/60 bg-teal-50/40 dark:bg-teal-950/20 flex flex-col justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400 font-bold text-xs">
                <FileDown className="w-4 h-4" />
                <span>Giáo án CV 5512 (.docx)</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Tự động cấu trúc mục tiêu năng lực, thiết bị số và 4 hoạt động dạy học (Khởi động, Hình thành KT, Luyện tập, Vận dụng).
              </p>
            </div>
            <button
              type="button"
              disabled={pedagogyProcessing}
              onClick={handleExportPedagogyLessonPlanDocx}
              className="w-full py-2 px-3 text-xs font-bold rounded-lg bg-teal-600 hover:bg-teal-700 text-white shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải Giáo án CV 5512 (.docx)</span>
            </button>
          </div>

          {/* Card 3: PPTX Presentation */}
          <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/40 dark:bg-purple-950/20 flex flex-col justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400 font-bold text-xs">
                <Presentation className="w-4 h-4" />
                <span>Slide PowerPoint (.pptx)</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Chuyển đổi bài học thành bài giảng trình chiếu 16:9 chuyên nghiệp, áp dụng mã màu thương hiệu trường học.
              </p>
            </div>
            <button
              type="button"
              disabled={pedagogyProcessing}
              onClick={handleExportPedagogyPptx}
              className="w-full py-2 px-3 text-xs font-bold rounded-lg bg-purple-600 hover:bg-purple-700 text-white shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải Bài giảng (.pptx)</span>
            </button>
          </div>

          {/* Card 4: Moodle LMS & SCORM */}
          <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 flex flex-col justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs">
                <Share2 className="w-4 h-4" />
                <span>Moodle LMS &amp; SCORM 1.2</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Đồng bộ ngân hàng câu hỏi vào Moodle Quiz (XML / GIFT) hoặc đóng gói học liệu tương tác chuẩn SCORM 1.2 (.zip).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pedagogyProcessing || targetQuestions.length === 0}
                onClick={handleExportPedagogyMoodleXml}
                className="flex-1 py-1.5 px-2 text-[11px] font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white cursor-pointer disabled:opacity-50 text-center"
              >
                Moodle XML
              </button>
              <button
                type="button"
                disabled={pedagogyProcessing || targetQuestions.length === 0}
                onClick={handleExportPedagogyMoodleGift}
                className="flex-1 py-1.5 px-2 text-[11px] font-bold rounded-lg bg-amber-700 hover:bg-amber-800 text-white cursor-pointer disabled:opacity-50 text-center"
              >
                GIFT
              </button>
              <button
                type="button"
                disabled={pedagogyProcessing}
                onClick={handleExportPedagogyScorm}
                className="flex-1 py-1.5 px-2 text-[11px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer disabled:opacity-50 text-center"
                title="Đóng gói SCORM 1.2"
              >
                SCORM
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Export & Import Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Export Panel */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Xuất Gói dữ liệu Di động (Export)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Bao gồm đầy đủ tệp cấu hình <code className="font-mono">hub-manifest.json</code>,{' '}
              <code className="font-mono">branding.json</code>, tài nguyên hình ảnh và toàn bộ tệp{' '}
              <code className="font-mono">.html</code> phân loại theo đúng thư mục Sách / Chương / Bài học.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleExportZip}
              disabled={exportingZip}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg hub-accent-bg transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
            >
              <Archive className="w-4 h-4" />
              <span>{exportingZip ? 'Đang nén gói ZIP...' : 'Xuất gói đầy đủ (.zip)'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              <FileJson className="w-4 h-4" />
              <span>Sao lưu nhanh (.json)</span>
            </button>

            {canPickDir && (
              <button
                type="button"
                onClick={handleDirectFolderSync}
                disabled={syncingDir}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
              >
                <FolderSync className="w-4 h-4" />
                <span>{syncingDir ? 'Đang ghi...' : 'Ghi trực tiếp vào thư mục PC'}</span>
              </button>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Xem trước cấu trúc cây thư mục đóng gói:
            </div>
            <pre className="p-4 rounded-lg bg-slate-950 text-slate-200 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-64">
              {treePreview.join('\n')}
            </pre>
          </div>
        </section>

        {/* Import & Recovery Panel */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Nhập Gói dữ liệu từ Thiết bị khác (Import)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Hệ thống tự động kiểm tra tính toàn vẹn của phân cấp 4 tầng trước khi hợp nhất hoặc thay thế dữ liệu hiện tại.
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,.json"
            onChange={handleFileChange}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full p-8 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 bg-slate-50/70 dark:bg-slate-950/60 transition-colors flex flex-col items-center justify-center gap-2 text-center cursor-pointer"
          >
            <Upload className="w-6 h-6 text-slate-500 dark:text-slate-400" />
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Chọn tệp gói dữ liệu (.zip hoặc .json)
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Hỗ trợ gói dữ liệu lớn lên đến 300 MB · Tự động giải nén manifest, HTML và cấu hình thương hiệu
            </div>
          </button>

          {pendingImport && (
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 space-y-4">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  Đã kiểm định hợp lệ: {pendingImport.filename}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                  {pendingImport.stats.bookCount} sách · {pendingImport.stats.unitCount} chương ·{' '}
                  {pendingImport.stats.lessonCount} bài học · {pendingImport.stats.contentCount} học liệu
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <label className="flex items-start gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="importMode"
                    checked={importMode === 'merge'}
                    onChange={() => setImportMode('merge')}
                    className="mt-0.5"
                  />
                  <span>
                    <strong>Hợp nhất (Merge):</strong> Thêm các đầu sách mới vào thư viện hiện có (giữ nguyên dữ liệu đang làm).
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="importMode"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    className="mt-0.5"
                  />
                  <span>
                    <strong>Khôi phục toàn bộ (Replace):</strong> Thay thế toàn bộ thư viện và cấu hình thương hiệu theo gói nhập.
                  </span>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg hub-accent-bg cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Xác nhận nhập dữ liệu</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPendingImport(null)}
                  className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Hủy bỏ
                </button>
              </div>
            </div>
          )}

          {/* Reset section */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Khôi phục bộ giáo trình mẫu ban đầu (Tiếng Anh 10, Sinh học 11, Vật lý 12).
            </div>
            {confirmReset ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onResetToSeed();
                    setConfirmReset(false);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-md bg-red-600 text-white hover:bg-red-700 cursor-pointer"
                >
                  Xác nhận đặt lại
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="px-3 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Hủy
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Khôi phục dữ liệu mẫu</span>
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
