import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Archive,
  Check,
  CheckCircle2,
  Download,
  FileDown,
  FileJson,
  FileText,
  FolderCheck,
  FolderDown,
  FolderOpen,
  FolderSync,
  FolderUp,
  GraduationCap,
  HardDrive,
  Laptop,
  Presentation,
  RotateCcw,
  Share2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import type { Book, HubState, QuizQuestion } from '../types/academic';
import AiExamGeneratorModal from './AiExamGeneratorModal';
import {
  buildPortableTreePreview,
  computeCurriculumStats,
  exportJsonSnapshot,
  exportPortableZipBundle,
  parseImportedFile,
  saveBundleToLocalDirectory,
  triggerBlobDownload,
} from '../utils/portableBundle';
import {
  clearSavedDirectoryHandle,
  estimateStateByteSize,
  formatBytes,
  saveSavedDirectoryHandle,
  supportsDirectoryPicker,
} from '../utils/storage';
import {
  isDirectoryPickerSupported,
  pickLocalDirectory,
  readStateFromDirectory,
  writeStateToDirectory,
} from '../utils/directoryStorage';
import {
  exportExamDocx,
  exportLessonPlanDocx,
  exportLessonPresentationPptx,
  exportMoodleGift,
  exportMoodleXml,
  exportScorm12Zip,
} from '../utils/pedagogyExport';

export interface DirectoryStateInfo {
  handle: FileSystemDirectoryHandle | null;
  name: string | null;
  lastSyncAt: string | null;
  autoSync: boolean;
}

interface PortabilityConsoleProps {
  hubState: HubState;
  storageEngine: 'IndexedDB' | 'localStorage';
  lastSavedAt: string | null;
  onImportState: (imported: HubState, mode: 'replace' | 'merge') => void;
  onResetToSeed: () => void;
  onNotify: (message: string, tone?: 'success' | 'error' | 'info') => void;
  directoryInfo: DirectoryStateInfo;
  onUpdateDirectoryInfo: (updater: DirectoryStateInfo | ((prev: DirectoryStateInfo) => DirectoryStateInfo)) => void;
  onSaveExamAsQuizToLesson?: (
    bookId: string,
    unitId: string,
    lessonId: string,
    questions: QuizQuestion[],
    examTitle: string
  ) => void;
}

export default function PortabilityConsole({
  hubState,
  storageEngine,
  lastSavedAt,
  onImportState,
  onResetToSeed,
  onNotify,
  directoryInfo,
  onUpdateDirectoryInfo,
  onSaveExamAsQuizToLesson,
}: PortabilityConsoleProps) {
  const [exportingZip, setExportingZip] = useState(false);
  const [syncingDir, setSyncingDir] = useState(false);
  const [isProcessingDir, setIsProcessingDir] = useState(false);
  const [isCambridgeModalOpen, setIsCambridgeModalOpen] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderActionPending, setFolderActionPending] = useState<{
    handle: FileSystemDirectoryHandle;
    name: string;
  } | null>(null);
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
    if (directoryInfo.handle) {
      handleSyncCurrentDirectory();
      return;
    }
    handleSelectDirectory();
  };

  const handleSelectDirectory = async () => {
    setIsProcessingDir(true);
    try {
      const { handle, name, hasExistingManifest } = await pickLocalDirectory();

      if (hasExistingManifest) {
        setFolderActionPending({ handle, name });
        setShowFolderModal(true);
        return;
      }

      const result = await writeStateToDirectory(handle, hubState);
      const now = new Date().toISOString();
      const newInfo: DirectoryStateInfo = {
        handle,
        name,
        lastSyncAt: now,
        autoSync: directoryInfo.autoSync,
      };
      await saveSavedDirectoryHandle(handle, {
        name,
        lastSyncAt: now,
        autoSync: directoryInfo.autoSync,
      });
      onUpdateDirectoryInfo(newInfo);
      onNotify(
        `Đã liên kết và ghi thành công ${result.filesWritten} tệp vào thư mục "${name}". Tệp Chay_Ung_Dung_Offline.html đã sẵn sàng!`,
        'success'
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể chọn thư mục.';
      if (!msg.toLowerCase().includes('abort')) {
        onNotify(msg, 'error');
      }
    } finally {
      setIsProcessingDir(false);
    }
  };

  const handleLoadFromExistingFolder = async () => {
    if (!folderActionPending) return;
    setIsProcessingDir(true);
    try {
      const result = await readStateFromDirectory(folderActionPending.handle);
      onImportState(result.state, 'replace');
      const now = new Date().toISOString();
      const newInfo: DirectoryStateInfo = {
        handle: folderActionPending.handle,
        name: folderActionPending.name,
        lastSyncAt: now,
        autoSync: directoryInfo.autoSync,
      };
      await saveSavedDirectoryHandle(folderActionPending.handle, {
        name: folderActionPending.name,
        lastSyncAt: now,
        autoSync: directoryInfo.autoSync,
      });
      onUpdateDirectoryInfo(newInfo);
      setShowFolderModal(false);
      setFolderActionPending(null);
      onNotify(
        `Đã nạp thành công ${result.bookCount} sách và ${result.lessonCount} bài học từ thư mục "${folderActionPending.name}"!`,
        'success'
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Lỗi khi đọc dữ liệu từ thư mục.', 'error');
    } finally {
      setIsProcessingDir(false);
    }
  };

  const handleOverwriteFolderFromApp = async () => {
    if (!folderActionPending) return;
    setIsProcessingDir(true);
    try {
      const result = await writeStateToDirectory(folderActionPending.handle, hubState);
      const now = new Date().toISOString();
      const newInfo: DirectoryStateInfo = {
        handle: folderActionPending.handle,
        name: folderActionPending.name,
        lastSyncAt: now,
        autoSync: directoryInfo.autoSync,
      };
      await saveSavedDirectoryHandle(folderActionPending.handle, {
        name: folderActionPending.name,
        lastSyncAt: now,
        autoSync: directoryInfo.autoSync,
      });
      onUpdateDirectoryInfo(newInfo);
      setShowFolderModal(false);
      setFolderActionPending(null);
      onNotify(
        `Đã ghi đè toàn bộ dữ liệu hiện tại (${result.filesWritten} tệp) vào thư mục "${folderActionPending.name}".`,
        'success'
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Lỗi khi ghi vào thư mục.', 'error');
    } finally {
      setIsProcessingDir(false);
    }
  };

  const handleSyncCurrentDirectory = async () => {
    if (!directoryInfo.handle) {
      handleSelectDirectory();
      return;
    }
    setIsProcessingDir(true);
    try {
      const result = await writeStateToDirectory(directoryInfo.handle, hubState);
      const now = new Date().toISOString();
      onUpdateDirectoryInfo((prev) => ({ ...prev, lastSyncAt: now }));
      await saveSavedDirectoryHandle(directoryInfo.handle, {
        name: directoryInfo.name || directoryInfo.handle.name,
        lastSyncAt: now,
        autoSync: directoryInfo.autoSync,
      });
      onNotify(
        `Đã ghi thành công ${result.filesWritten} tệp vào thư mục "${directoryInfo.name}". Tệp Chay_Ung_Dung_Offline.html đã được cập nhật mới nhất!`,
        'success'
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Lỗi khi đồng bộ vào thư mục.', 'error');
    } finally {
      setIsProcessingDir(false);
    }
  };

  const handleReadCurrentDirectory = async () => {
    if (!directoryInfo.handle) {
      handleSelectDirectory();
      return;
    }
    setIsProcessingDir(true);
    try {
      const result = await readStateFromDirectory(directoryInfo.handle);
      onImportState(result.state, 'replace');
      const now = new Date().toISOString();
      onUpdateDirectoryInfo((prev) => ({ ...prev, lastSyncAt: now }));
      onNotify(
        `Đã nạp thành công ${result.bookCount} sách, ${result.lessonCount} bài học từ thư mục "${directoryInfo.name}"!`,
        'success'
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Lỗi khi đọc từ thư mục.', 'error');
    } finally {
      setIsProcessingDir(false);
    }
  };

  const handleDisconnectDirectory = async () => {
    await clearSavedDirectoryHandle();
    onUpdateDirectoryInfo({
      handle: null,
      name: null,
      lastSyncAt: null,
      autoSync: true,
    });
    onNotify('Đã ngắt kết nối thư mục PC. Dữ liệu trên ổ cứng vẫn được bảo toàn nguyên vẹn.', 'info');
  };

  const handleToggleAutoSync = async () => {
    const nextVal = !directoryInfo.autoSync;
    onUpdateDirectoryInfo((prev) => ({ ...prev, autoSync: nextVal }));
    if (directoryInfo.handle && directoryInfo.name) {
      await saveSavedDirectoryHandle(directoryInfo.handle, {
        name: directoryInfo.name,
        lastSyncAt: directoryInfo.lastSyncAt,
        autoSync: nextVal,
      });
    }
    onNotify(nextVal ? 'Đã bật tự động đồng bộ vào thư mục PC.' : 'Đã tắt tự động đồng bộ.', 'info');
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

      {/* Local-First PC Directory Storage Center */}
      <section className="rounded-2xl border-2 border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-br from-white via-indigo-50/20 to-white dark:from-slate-900 dark:via-indigo-950/20 dark:to-slate-900 p-6 md:p-8 shadow-xs flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-indigo-100 dark:border-indigo-900/40">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-xs">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    Kho Lưu Trữ Ổ Đĩa / Thư Mục Máy Tính Cá Nhân (Local-First)
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                    Khuyên dùng
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Chọn thư mục bất kỳ trên máy tính (ổ C:, D:, E:...) để lưu trữ toàn bộ chương trình, học liệu tương tác và chạy Offline không cần Internet.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {directoryInfo.handle ? (
              <button
                type="button"
                onClick={handleSelectDirectory}
                disabled={isProcessingDir}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Đổi thư mục khác</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Directory Status Box */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {/* Col 1 & 2: Current Status */}
          <div className="lg:col-span-2 space-y-4 flex flex-col justify-between">
            {directoryInfo.handle ? (
              <div className="p-5 rounded-xl border border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/60 dark:bg-emerald-950/30 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-600 text-white shrink-0">
                      <FolderCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">Thư mục máy tính đang liên kết:</div>
                      <div className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span>📁 {directoryInfo.name}</span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full">
                          <Check className="w-3 h-3" /> Đã kết nối
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleDisconnectDirectory}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors cursor-pointer"
                    title="Ngắt kết nối thư mục này"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-y-2 gap-x-5 text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-emerald-200 dark:border-emerald-900/50">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Quyền: <strong>Đọc &amp; Ghi trực tiếp</strong></span>
                  </div>
                  <div>
                    Lần ghi gần nhất:{' '}
                    <strong>
                      {directoryInfo.lastSyncAt
                        ? new Date(directoryInfo.lastSyncAt).toLocaleTimeString('vi-VN') +
                          ' (' +
                          new Date(directoryInfo.lastSyncAt).toLocaleDateString('vi-VN') +
                          ')'
                        : 'Vừa liên kết'}
                    </strong>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer font-medium select-none text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={directoryInfo.autoSync}
                      onChange={handleToggleAutoSync}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                    />
                    <span>Tự động đồng bộ khi thay đổi</span>
                  </label>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-xl border border-dashed border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500 text-white shrink-0">
                    <FolderOpen className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-amber-900 dark:text-amber-200">
                      Chưa chọn thư mục máy tính cá nhân
                    </div>
                    <p className="text-xs text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
                      Dữ liệu học thuật hiện chỉ nằm tạm trong bộ nhớ trình duyệt IndexedDB. Hãy bấm nút bên dưới để chọn một thư mục trên ổ cứng máy tính (ổ C, D, E...) giúp lưu trữ trọn đời và chạy offline.
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleSelectDirectory}
                    disabled={isProcessingDir}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
                  >
                    <FolderSync className={`w-4 h-4 ${isProcessingDir ? 'animate-spin' : ''}`} />
                    <span>{isProcessingDir ? 'Đang mở hộp thoại chọn thư mục...' : 'Chọn Ổ Đĩa / Thư Mục Máy Tính Cá Nhân Ngay'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Offline teaching highlight banner */}
            <div className="p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-950/20 flex items-start gap-3 text-xs text-slate-700 dark:text-slate-300">
              <Laptop className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-bold text-slate-900 dark:text-slate-100">
                  Tệp khởi chạy Offline độc lập: <code className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 font-mono text-[11px] text-indigo-600 dark:text-indigo-400">Chay_Ung_Dung_Offline.html</code>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                  Sau khi lưu, thư mục máy tính của thầy/cô sẽ có sẵn tệp này. Thầy/cô chỉ cần nhấp đúp vào tệp để mở bài giảng, chiếu toàn màn hình lớp học mà không cần kết nối mạng hay cài đặt phần mềm phụ trợ.
                </p>
              </div>
            </div>
          </div>

          {/* Col 3: Direct Actions */}
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Thao tác với Thư mục PC
              </div>

              <button
                type="button"
                disabled={isProcessingDir}
                onClick={handleSyncCurrentDirectory}
                className="w-full py-2.5 px-3 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
              >
                <FolderDown className={`w-4 h-4 ${isProcessingDir ? 'animate-spin' : ''}`} />
                <span>{isProcessingDir ? 'Đang ghi dữ liệu...' : 'Ghi toàn bộ vào Thư mục PC'}</span>
              </button>

              <button
                type="button"
                disabled={isProcessingDir}
                onClick={handleReadCurrentDirectory}
                className="w-full py-2 px-3 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <FolderUp className="w-4 h-4 text-emerald-600" />
                <span>Đọc dữ liệu từ Thư mục PC</span>
              </button>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              💡 <strong>Mẹo:</strong> Thầy/cô có thể copy toàn bộ thư mục này vào USB để mang sang máy tính lớp học sử dụng bình thường.
            </div>
          </div>
        </div>
      </section>

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
          {/* Card 1: Cambridge & Word Exam */}
          <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 flex flex-col justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-xs">
                <FileText className="w-4 h-4" />
                <span>Đề thi Chuẩn Cambridge (A.I)</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                A.I quét các bài học, thiết lập ma trận đề Cambridge (YLE, KET, PET, FCE, GDPT), xuất file Word (.docx) &amp; PDF A4.
              </p>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setIsCambridgeModalOpen(true)}
                className="w-full py-2 px-3 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>A.I Soạn Đề thi (Word/PDF)</span>
              </button>
              <button
                type="button"
                disabled={pedagogyProcessing || targetQuestions.length === 0}
                onClick={handleExportPedagogyExamDocx}
                className="w-full py-1.5 px-3 text-[11px] font-semibold rounded-lg border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Download className="w-3 h-3" />
                <span>Xuất nhanh câu có sẵn (.docx)</span>
              </button>
            </div>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              disabled={isProcessingDir}
              onClick={handleReadCurrentDirectory}
              className="p-4 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 hover:bg-emerald-100/50 transition-colors flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer disabled:opacity-50"
            >
              <FolderUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                Đọc từ Thư mục PC
              </div>
              <div className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                {directoryInfo.name ? `Từ: ${directoryInfo.name}` : 'Chọn thư mục trên máy tính'}
              </div>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-slate-400 bg-slate-50/70 dark:bg-slate-950/60 transition-colors flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer"
            >
              <Upload className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Tải lên tệp .zip / .json
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Gói sao lưu di động
              </div>
            </button>
          </div>

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

      {/* Existing Manifest Choice Modal */}
      {showFolderModal && folderActionPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
                <FolderCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Thư mục đã có dữ liệu Hub từ trước
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Thư mục: <strong>{folderActionPending.name}</strong>
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Hệ thống phát hiện tệp <code className="font-mono">hub-manifest.json</code> đã tồn tại trong thư mục này. Thầy/cô muốn thực hiện thao tác nào?
            </p>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleLoadFromExistingFolder}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer flex items-center justify-center gap-2"
              >
                <FolderUp className="w-4 h-4" />
                <span>Nạp dữ liệu từ thư mục vào App (Khuyên dùng)</span>
              </button>

              <button
                type="button"
                onClick={handleOverwriteFolderFromApp}
                className="w-full py-2.5 px-4 rounded-xl border border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-700 dark:text-red-300 font-bold text-xs cursor-pointer flex items-center justify-center gap-2"
              >
                <FolderDown className="w-4 h-4" />
                <span>Ghi đè dữ liệu hiện tại của App vào thư mục này</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowFolderModal(false);
                  setFolderActionPending(null);
                }}
                className="w-full py-2 px-4 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer text-center"
              >
                Hủy bỏ
              </button>
            </div>
          </div>
        </div>
      )}
      {/* A.I Cambridge Exam Generator Modal */}
      {isCambridgeModalOpen && (
        <AiExamGeneratorModal
          isOpen={isCambridgeModalOpen}
          onClose={() => setIsCambridgeModalOpen(false)}
          books={hubState.books}
          institutionName={hubState.branding.institutionName}
          onSaveExamAsQuizToLesson={onSaveExamAsQuizToLesson}
          onNotify={onNotify}
        />
      )}
    </div>
  );
}
