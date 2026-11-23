import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BookMarked, CheckCircle2, HardDrive, Info, Key, Plus, Settings, X, XCircle } from 'lucide-react';
import type {
  Book,
  BrandingConfig,
  DetailedContent,
  HubState,
  Lesson,
  SelectionPath,
  Unit,
} from './types/academic';
import { INITIAL_HUB_STATE } from './data/seedData';
import { getSavedDirectoryHandle, loadLocalHubState, saveLocalHubState, saveSavedDirectoryHandle } from './utils/storage';
import { writeStateToDirectory } from './utils/directoryStorage';
import HierarchySidebar from './components/HierarchySidebar';
import BookOverview from './components/BookOverview';
import InteractiveViewer from './components/InteractiveViewer';
import AiArchitectWorkspace from './components/AiArchitectWorkspace';
import PortabilityConsole, { type DirectoryStateInfo } from './components/PortabilityConsole';
import BrandingConsole from './components/BrandingConsole';
import ConceptMapView from './components/ConceptMapView';
import LearningAnalyticsDashboard from './components/LearningAnalyticsDashboard';
import AiSettingsModal, { getSavedApiKey } from './components/AiSettingsModal';
import ContentFormModal, { type ModalTarget } from './components/ContentFormModal';
import EditNodeModal, { type EditTarget } from './components/EditNodeModal';

type WorkspaceSection =
  | 'library'
  | 'concept-map'
  | 'analytics'
  | 'ai'
  | 'portability'
  | 'branding';

interface ToastState {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'info';
}

export default function App() {
  const [hubState, setHubState] = useState<HubState>(INITIAL_HUB_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [storageEngine, setStorageEngine] = useState<'IndexedDB' | 'localStorage'>('IndexedDB');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const [activeSection, setActiveSection] = useState<WorkspaceSection>('library');
  const [selection, setSelection] = useState<SelectionPath>({
    bookId: 'book-eng-10',
    unitId: 'unit-eng-1',
    lessonId: 'lesson-eng-1-1',
    contentId: 'content-eng-1-1-html',
  });

  const [modalTarget, setModalTarget] = useState<ModalTarget | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [aiPrefillPrompt, setAiPrefillPrompt] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Local-First PC Directory state
  const [directoryInfo, setDirectoryInfo] = useState<DirectoryStateInfo>({
    handle: null,
    name: null,
    lastSyncAt: null,
    autoSync: true,
  });

  // AI Key & Settings Modal
  const [isAiSettingsOpen, setIsAiSettingsOpen] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    setHasApiKey(Boolean(getSavedApiKey()));
  }, []);

  const notify = useCallback((message: string, tone: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToast({ id, message, tone });
    setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 4200);
  }, []);

  // Load Local-First state from IndexedDB on boot
  useEffect(() => {
    let active = true;
    loadLocalHubState()
      .then(({ state, engine }) => {
        if (!active) return;
        setStorageEngine(engine);
        if (state && Array.isArray(state.books)) {
          setHubState(state);
          const firstBook = state.books[0];
          const firstUnit = firstBook?.units[0];
          const firstLesson = firstUnit?.lessons[0];
          const firstContent = firstLesson?.contents[0];
          if (firstBook && firstUnit && firstLesson && firstContent) {
            setSelection({
              bookId: firstBook.id,
              unitId: firstUnit.id,
              lessonId: firstLesson.id,
              contentId: firstContent.id,
            });
          } else {
            setSelection({ bookId: null, unitId: null, lessonId: null, contentId: null });
          }
        }
        setHydrated(true);
      })
      .catch(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Persist changes automatically to IndexedDB (Local-First)
  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      saveLocalHubState(hubState)
        .then(({ engine }) => {
          setStorageEngine(engine);
          setLastSavedAt(new Date().toISOString());
        })
        .catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [hubState, hydrated]);

  // Load saved Directory Handle from IndexedDB
  useEffect(() => {
    getSavedDirectoryHandle()
      .then(({ handle, meta }) => {
        if (handle && meta) {
          setDirectoryInfo({
            handle,
            name: meta.name,
            lastSyncAt: meta.lastSyncAt,
            autoSync: meta.autoSync ?? true,
          });
        }
      })
      .catch(() => {});
  }, []);

  // Background Auto-sync to connected PC Directory with debounce
  useEffect(() => {
    if (!hydrated || !directoryInfo.handle || !directoryInfo.autoSync) return;
    const timer = setTimeout(() => {
      writeStateToDirectory(directoryInfo.handle!, hubState)
        .then(() => {
          const now = new Date().toISOString();
          setDirectoryInfo((prev) => ({ ...prev, lastSyncAt: now }));
          saveSavedDirectoryHandle(directoryInfo.handle!, {
            name: directoryInfo.name || directoryInfo.handle!.name,
            lastSyncAt: now,
            autoSync: directoryInfo.autoSync,
          });
        })
        .catch((err) => {
          console.warn('Auto-sync to PC directory skipped/failed:', err);
        });
    }, 2500);

    return () => clearTimeout(timer);
  }, [hubState, hydrated, directoryInfo.handle, directoryInfo.autoSync]);

  // Apply White-Label branding CSS tokens & Light/Dark mode globally
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--hub-accent', hubState.branding.customAccentHex);
    root.style.setProperty('--hub-accent-hover', hubState.branding.customAccentHoverHex);
    if (hubState.branding.themeMode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    document.title = `${hubState.branding.appName} — Interactive Academic Hub`;
  }, [hubState.branding]);

  const resolvedNodes = useMemo(() => {
    const book = hubState.books.find((b) => b.id === selection.bookId) ?? null;
    const unit = book?.units.find((u) => u.id === selection.unitId) ?? null;
    const lesson = unit?.lessons.find((l) => l.id === selection.lessonId) ?? null;
    const content = lesson?.contents.find((c) => c.id === selection.contentId) ?? null;
    return { book, unit, lesson, content };
  }, [hubState.books, selection]);

  // Strict 4-level CRUD handlers
  const handleCreateBook = (input: Omit<Book, 'id' | 'updatedAt' | 'units'>) => {
    const newBook: Book = {
      ...input,
      id: `book-${Date.now()}`,
      updatedAt: new Date().toISOString(),
      units: [],
    };
    setHubState((prev) => ({ ...prev, books: [...prev.books, newBook] }));
    setSelection({ bookId: newBook.id, unitId: null, lessonId: null, contentId: null });
    setActiveSection('library');
    notify(`Đã khởi tạo sách "${newBook.title}".`, 'success');
  };

  const handleCreateUnit = (bookId: string, input: Omit<Unit, 'id' | 'order' | 'lessons'>) => {
    const newUnitId = `unit-${Date.now()}`;
    setHubState((prev) => ({
      ...prev,
      books: prev.books.map((book) => {
        if (book.id !== bookId) return book;
        const nextUnit: Unit = {
          ...input,
          id: newUnitId,
          order: book.units.length + 1,
          lessons: [],
        };
        return { ...book, updatedAt: new Date().toISOString(), units: [...book.units, nextUnit] };
      }),
    }));
    setSelection({ bookId, unitId: newUnitId, lessonId: null, contentId: null });
    notify(`Đã thêm chương "${input.title}".`, 'success');
  };

  const handleCreateLesson = (
    bookId: string,
    unitId: string,
    input: Omit<Lesson, 'id' | 'order' | 'contents'>
  ) => {
    const newLessonId = `lesson-${Date.now()}`;
    setHubState((prev) => ({
      ...prev,
      books: prev.books.map((book) => {
        if (book.id !== bookId) return book;
        return {
          ...book,
          updatedAt: new Date().toISOString(),
          units: book.units.map((unit) => {
            if (unit.id !== unitId) return unit;
            const nextLesson: Lesson = {
              ...input,
              id: newLessonId,
              order: unit.lessons.length + 1,
              contents: [],
            };
            return { ...unit, lessons: [...unit.lessons, nextLesson] };
          }),
        };
      }),
    }));
    setSelection({ bookId, unitId, lessonId: newLessonId, contentId: null });
    notify(`Đã thêm bài học "${input.title}".`, 'success');
  };

  const handleCreateContent = (
    bookId: string,
    unitId: string,
    lessonId: string,
    input: Omit<DetailedContent, 'id' | 'updatedAt'>
  ) => {
    const newContentId = `content-${Date.now()}`;
    setHubState((prev) => ({
      ...prev,
      books: prev.books.map((book) => {
        if (book.id !== bookId) return book;
        return {
          ...book,
          updatedAt: new Date().toISOString(),
          units: book.units.map((unit) => {
            if (unit.id !== unitId) return unit;
            return {
              ...unit,
              lessons: unit.lessons.map((lesson) => {
                if (lesson.id !== lessonId) return lesson;
                const nextContent: DetailedContent = {
                  ...input,
                  id: newContentId,
                  updatedAt: new Date().toISOString(),
                };
                return { ...lesson, contents: [...lesson.contents, nextContent] };
              }),
            };
          }),
        };
      }),
    }));
    setSelection({ bookId, unitId, lessonId, contentId: newContentId });
    setActiveSection('library');
    notify(`Đã tích hợp học liệu "${input.title}".`, 'success');
  };

  const handleUpdateContent = (
    bookId: string,
    unitId: string,
    lessonId: string,
    contentId: string,
    patch: Partial<DetailedContent>
  ) => {
    setHubState((prev) => ({
      ...prev,
      books: prev.books.map((book) => {
        if (book.id !== bookId) return book;
        return {
          ...book,
          updatedAt: new Date().toISOString(),
          units: book.units.map((unit) => {
            if (unit.id !== unitId) return unit;
            return {
              ...unit,
              lessons: unit.lessons.map((lesson) => {
                if (lesson.id !== lessonId) return lesson;
                return {
                  ...lesson,
                  contents: lesson.contents.map((c) => (c.id === contentId ? { ...c, ...patch } : c)),
                };
              }),
            };
          }),
        };
      }),
    }));
  };

  const handleEditNode = (
    level: 'book' | 'unit' | 'lesson' | 'content',
    ids: SelectionPath,
    data: {
      title: string;
      description?: string;
      summary?: string;
      subject?: string;
      gradeLevel?: string;
      author?: string;
      coverImage?: string;
      estimatedMinutes?: number;
    }
  ) => {
    setHubState((prev) => {
      if (level === 'book') {
        return {
          ...prev,
          books: prev.books.map((b) =>
            b.id === ids.bookId
              ? {
                  ...b,
                  title: data.title,
                  ...(data.description !== undefined && { description: data.description }),
                  ...(data.subject !== undefined && { subject: data.subject }),
                  ...(data.gradeLevel !== undefined && { gradeLevel: data.gradeLevel }),
                  ...(data.author !== undefined && { author: data.author }),
                  ...(data.coverImage !== undefined && { coverImage: data.coverImage }),
                  updatedAt: new Date().toISOString(),
                }
              : b
          ),
        };
      }
      return {
        ...prev,
        books: prev.books.map((book) => {
          if (book.id !== ids.bookId) return book;
          if (level === 'unit') {
            return {
              ...book,
              updatedAt: new Date().toISOString(),
              units: book.units.map((u) =>
                u.id === ids.unitId
                  ? {
                      ...u,
                      title: data.title,
                      ...(data.description !== undefined && { description: data.description }),
                    }
                  : u
              ),
            };
          }
          return {
            ...book,
            updatedAt: new Date().toISOString(),
            units: book.units.map((unit) => {
              if (unit.id !== ids.unitId) return unit;
              if (level === 'lesson') {
                return {
                  ...unit,
                  lessons: unit.lessons.map((l) =>
                    l.id === ids.lessonId
                      ? {
                          ...l,
                          title: data.title,
                          ...(data.summary !== undefined && { summary: data.summary }),
                        }
                      : l
                  ),
                };
              }
              return {
                ...unit,
                lessons: unit.lessons.map((l) => {
                  if (l.id !== ids.lessonId) return l;
                  return {
                    ...l,
                    contents: l.contents.map((c) =>
                      c.id === ids.contentId
                        ? {
                            ...c,
                            title: data.title,
                            ...(data.estimatedMinutes !== undefined && { estimatedMinutes: data.estimatedMinutes }),
                            updatedAt: new Date().toISOString(),
                          }
                        : c
                    ),
                  };
                }),
              };
            }),
          };
        }),
      };
    });

    const levelName =
      level === 'book' ? 'sách' : level === 'unit' ? 'chương' : level === 'lesson' ? 'bài học' : 'học liệu';
    notify(`Đã cập nhật tên ${levelName} "${data.title}" thành công!`, 'success');
  };

  const handleUpdateBookCover = (bookId: string, coverImage: string) => {
    setHubState((prev) => ({
      ...prev,
      books: prev.books.map((b) =>
        b.id === bookId ? { ...b, coverImage, updatedAt: new Date().toISOString() } : b
      ),
    }));
    notify('Đã cập nhật ảnh bìa sách thành công!', 'success');
  };

  const handleDeleteNode = (
    level: 'book' | 'unit' | 'lesson' | 'content',
    ids: SelectionPath,
    title: string
  ) => {
    setHubState((prev) => {
      if (level === 'book') {
        return { ...prev, books: prev.books.filter((b) => b.id !== ids.bookId) };
      }
      return {
        ...prev,
        books: prev.books.map((book) => {
          if (book.id !== ids.bookId) return book;
          if (level === 'unit') {
            return { ...book, units: book.units.filter((u) => u.id !== ids.unitId) };
          }
          return {
            ...book,
            units: book.units.map((unit) => {
              if (unit.id !== ids.unitId) return unit;
              if (level === 'lesson') {
                return { ...unit, lessons: unit.lessons.filter((l) => l.id !== ids.lessonId) };
              }
              return {
                ...unit,
                lessons: unit.lessons.map((lesson) => {
                  if (lesson.id !== ids.lessonId) return lesson;
                  return { ...lesson, contents: lesson.contents.filter((c) => c.id !== ids.contentId) };
                }),
              };
            }),
          };
        }),
      };
    });

    // Keep selection clean
    setSelection((cur) => {
      if (level === 'book' && cur.bookId === ids.bookId) {
        return { bookId: null, unitId: null, lessonId: null, contentId: null };
      }
      if (level === 'unit' && cur.unitId === ids.unitId) {
        return { bookId: cur.bookId, unitId: null, lessonId: null, contentId: null };
      }
      if (level === 'lesson' && cur.lessonId === ids.lessonId) {
        return { bookId: cur.bookId, unitId: cur.unitId, lessonId: null, contentId: null };
      }
      if (level === 'content' && cur.contentId === ids.contentId) {
        return { bookId: cur.bookId, unitId: cur.unitId, lessonId: cur.lessonId, contentId: null };
      }
      return cur;
    });

    notify(`Đã xóa "${title}" khỏi cây học liệu.`, 'info');
  };

  const handleImportState = (imported: HubState, mode: 'replace' | 'merge') => {
    if (mode === 'replace') {
      setHubState(imported);
      const firstBook = imported.books[0];
      setSelection({
        bookId: firstBook?.id ?? null,
        unitId: firstBook?.units[0]?.id ?? null,
        lessonId: firstBook?.units[0]?.lessons[0]?.id ?? null,
        contentId: firstBook?.units[0]?.lessons[0]?.contents[0]?.id ?? null,
      });
    } else {
      setHubState((prev) => {
        const existingIds = new Set(prev.books.map((b) => b.id));
        const mergedBooks = [
          ...prev.books,
          ...imported.books.map((b, idx) =>
            existingIds.has(b.id) ? { ...b, id: `${b.id}-imp-${Date.now()}-${idx}` } : b
          ),
        ];
        return { ...prev, books: mergedBooks };
      });
    }
  };

  const handleChangeBranding = (branding: BrandingConfig) => {
    setHubState((prev) => ({ ...prev, branding }));
  };

  const handleReorderBooks = (newBooks: Book[]) => {
    setHubState((prev) => ({
      ...prev,
      books: newBooks,
    }));
    notify('Đã cập nhật thứ tự sách thành công!', 'success');
  };

  const handlePrimaryHeaderAction = () => {
    if (resolvedNodes.book && resolvedNodes.unit && resolvedNodes.lesson) {
      setModalTarget({
        kind: 'content',
        bookId: resolvedNodes.book.id,
        unitId: resolvedNodes.unit.id,
        lessonId: resolvedNodes.lesson.id,
      });
    } else if (resolvedNodes.book && resolvedNodes.unit) {
      setModalTarget({ kind: 'lesson', bookId: resolvedNodes.book.id, unitId: resolvedNodes.unit.id });
    } else if (resolvedNodes.book) {
      setModalTarget({ kind: 'unit', bookId: resolvedNodes.book.id });
    } else {
      setModalTarget({ kind: 'book' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 h-[61px] px-6 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => {
            setActiveSection('library');
            setSelection({ bookId: null, unitId: null, lessonId: null, contentId: null });
          }}
          className="flex items-center gap-2.5 text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
        >
          {hubState.branding.logoDataUrl ? (
            <img
              src={hubState.branding.logoDataUrl}
              alt={hubState.branding.appName}
              referrerPolicy="no-referrer"
              className="w-6 h-6 object-contain rounded-xs shrink-0"
            />
          ) : (
            <BookMarked className="w-5 h-5 hub-accent-text shrink-0" />
          )}
          <span>{hubState.branding.appName || 'AcademiHub'}</span>
        </button>

        {/* Zone 2: 6 Clean Single-Line Navigation Links */}
        <nav aria-label="Điều hướng chính" className="flex items-center gap-5 overflow-x-auto no-scrollbar">
          {(
            [
              { id: 'library', label: 'Thư viện & Trình xem' },
              { id: 'concept-map', label: 'Bản đồ tri thức' },
              { id: 'analytics', label: 'Thống kê & Năng lực' },
              { id: 'ai', label: 'Trợ lý AI & Pipeline' },
              { id: 'portability', label: 'Xuất bản & Đồng bộ' },
              { id: 'branding', label: 'Thương hiệu' },
            ] as const
          ).map((item) => {
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                  active
                    ? 'hub-accent-text border-current font-bold'
                    : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Settings & Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          {/* PC Local-First Storage Directory Indicator */}
          <button
            type="button"
            onClick={() => setActiveSection('portability')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              directoryInfo.name
                ? 'border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                : 'border border-dashed border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title={
              directoryInfo.name
                ? `Đang lưu trực tiếp vào thư mục PC: ${directoryInfo.name}`
                : 'Chọn thư mục/ổ đĩa PC để lưu trữ toàn bộ ứng dụng'
            }
          >
            <HardDrive className={`w-3.5 h-3.5 ${directoryInfo.name ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
            <span className="truncate max-w-[130px]">
              {directoryInfo.name ? `Ổ đĩa: ${directoryInfo.name}` : 'Chọn ổ đĩa PC'}
            </span>
          </button>

          {/* API Key Settings Button (AI_INSTRUCTIONS compliance) */}
          <button
            type="button"
            onClick={() => setIsAiSettingsOpen(true)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              !hasApiKey
                ? 'bg-red-500/10 text-red-600 border border-red-300 dark:border-red-800 hover:bg-red-500/20 animate-pulse'
                : 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Cài đặt Model AI & API Key"
          >
            <Key className={`w-3.5 h-3.5 ${!hasApiKey ? 'text-red-500' : 'text-emerald-500'}`} />
            <span>{!hasApiKey ? 'Lấy API key để sử dụng app' : 'AI Key: Đã kết nối'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrimaryHeaderAction}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg hub-accent-bg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm học liệu</span>
          </button>
        </div>
      </header>

      {/* Active Workspace Viewport */}
      <main className="flex-1 flex flex-col">
        {activeSection === 'library' && (
          <div className="flex-1 flex flex-col lg:flex-row">
            <HierarchySidebar
              books={hubState.books}
              selection={selection}
              onSelect={setSelection}
              onAddBook={() => setModalTarget({ kind: 'book' })}
              onAddUnit={(bookId) => setModalTarget({ kind: 'unit', bookId })}
              onAddLesson={(bookId, unitId) => setModalTarget({ kind: 'lesson', bookId, unitId })}
              onAddContent={(bookId, unitId, lessonId) =>
                setModalTarget({ kind: 'content', bookId, unitId, lessonId })
              }
              onDeleteNode={handleDeleteNode}
              onEditNode={setEditTarget}
              onReorderBooks={handleReorderBooks}
            />

            <div className="flex-1 min-w-0">
              {resolvedNodes.book && resolvedNodes.unit && resolvedNodes.lesson && resolvedNodes.content ? (
                <InteractiveViewer
                  book={resolvedNodes.book}
                  unit={resolvedNodes.unit}
                  lesson={resolvedNodes.lesson}
                  content={resolvedNodes.content}
                  onNavigate={setSelection}
                  onUpdateContent={handleUpdateContent}
                  onNotify={notify}
                  onEditNode={setEditTarget}
                />
              ) : (
                <BookOverview
                  books={hubState.books}
                  selection={selection}
                  institutionName={hubState.branding.institutionName}
                  onSelect={setSelection}
                  onAddBook={() => setModalTarget({ kind: 'book' })}
                  onAddUnit={(bookId) => setModalTarget({ kind: 'unit', bookId })}
                  onAddLesson={(bookId, unitId) => setModalTarget({ kind: 'lesson', bookId, unitId })}
                  onAddContent={(bookId, unitId, lessonId) =>
                    setModalTarget({ kind: 'content', bookId, unitId, lessonId })
                  }
                  onAskAiForLesson={(prompt) => {
                    setAiPrefillPrompt(prompt);
                    setActiveSection('ai');
                  }}
                  onEditNode={setEditTarget}
                  onUpdateBookCover={handleUpdateBookCover}
                />
              )}
            </div>
          </div>
        )}

        {activeSection === 'concept-map' && (
          <ConceptMapView
            books={hubState.books}
            onNavigateToContent={(p) => {
              setSelection(p);
              setActiveSection('library');
            }}
            onNotify={notify}
          />
        )}

        {activeSection === 'analytics' && (
          <LearningAnalyticsDashboard
            books={hubState.books}
            onNavigateToContent={(p) => {
              setSelection(p);
              setActiveSection('library');
            }}
            onNotify={notify}
          />
        )}

        {activeSection === 'ai' && (
          <AiArchitectWorkspace
            books={hubState.books}
            selection={selection}
            prefillPrompt={aiPrefillPrompt}
            onConsumePrefill={() => setAiPrefillPrompt(null)}
            onInsertGeneratedContent={handleCreateContent}
            onNotify={notify}
          />
        )}

        {activeSection === 'portability' && (
          <PortabilityConsole
            hubState={hubState}
            storageEngine={storageEngine}
            lastSavedAt={lastSavedAt}
            directoryInfo={directoryInfo}
            onUpdateDirectoryInfo={setDirectoryInfo}
            onImportState={handleImportState}
            onResetToSeed={() => {
              setHubState(INITIAL_HUB_STATE);
              setSelection({
                bookId: 'book-eng-10',
                unitId: 'unit-eng-1',
                lessonId: 'lesson-eng-1-1',
                contentId: 'content-eng-1-1-html',
              });
              notify('Đã khôi phục toàn bộ giáo trình mẫu ban đầu.', 'info');
            }}
            onNotify={notify}
          />
        )}

        {activeSection === 'branding' && (
          <BrandingConsole
            branding={hubState.branding}
            onChangeBranding={handleChangeBranding}
            onNotify={notify}
          />
        )}
      </main>

      {/* Creation Modal */}
      {modalTarget && (
        <ContentFormModal
          target={modalTarget}
          books={hubState.books}
          onClose={() => setModalTarget(null)}
          onCreateBook={handleCreateBook}
          onCreateUnit={handleCreateUnit}
          onCreateLesson={handleCreateLesson}
          onCreateContent={handleCreateContent}
          onNotify={notify}
        />
      )}

      {/* Node Edit / Rename Modal */}
      {editTarget && (
        <EditNodeModal
          target={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={handleEditNode}
        />
      )}

      {/* AI Key & Settings Modal */}
      <AiSettingsModal
        isOpen={isAiSettingsOpen}
        onClose={() => setIsAiSettingsOpen(false)}
        onSaved={(key, model) => {
          setHasApiKey(Boolean(key));
          notify(`Đã kết nối Google Gemini API (${model}) thành công!`, 'success');
        }}
      />

      {/* Subtle Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 max-w-md rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg px-4 py-3 flex items-center gap-3 text-xs text-slate-800 dark:text-slate-100"
        >
          {toast.tone === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : toast.tone === 'error' ? (
            <XCircle className="w-4 h-4 text-red-600 shrink-0" />
          ) : (
            <Info className="w-4 h-4 hub-accent-text shrink-0" />
          )}
          <span className="leading-snug">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Đóng thông báo"
            className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
