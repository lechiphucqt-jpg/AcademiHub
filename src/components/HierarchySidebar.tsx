import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Code2,
  Dices,
  FileText,
  Folder,
  GripVertical,
  HelpCircle,
  Layers,
  Orbit,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import type { Book, ContentType, DetailedContent, Lesson, SelectionPath, Unit } from '../types/academic';
import type { EditTarget } from './EditNodeModal';

interface DragNode {
  level: 'book' | 'unit' | 'lesson' | 'content';
  bookId: string;
  unitId?: string;
  lessonId?: string;
  contentId?: string;
}

interface HierarchySidebarProps {
  books: Book[];
  selection: SelectionPath;
  onSelect: (path: SelectionPath) => void;
  onAddBook: () => void;
  onAddUnit: (bookId: string) => void;
  onAddLesson: (bookId: string, unitId: string) => void;
  onAddContent: (bookId: string, unitId: string, lessonId: string) => void;
  onDeleteNode: (level: 'book' | 'unit' | 'lesson' | 'content', ids: SelectionPath, title: string) => void;
  onEditNode: (target: EditTarget) => void;
  onReorderBooks?: (newBooks: Book[]) => void;
  onReorderUnits?: (bookId: string, newUnits: Unit[]) => void;
  onReorderLessons?: (bookId: string, unitId: string, newLessons: Lesson[]) => void;
  onReorderContents?: (bookId: string, unitId: string, lessonId: string, newContents: DetailedContent[]) => void;
  onMoveLessonAcrossUnits?: (
    sourceBookId: string,
    sourceUnitId: string,
    lessonId: string,
    targetUnitId: string,
    targetIndex?: number
  ) => void;
  onMoveContentAcrossLessons?: (
    sourceBookId: string,
    sourceUnitId: string,
    sourceLessonId: string,
    contentId: string,
    targetLessonId: string,
    targetIndex?: number
  ) => void;
}

function getContentIcon(type: ContentType) {
  if (type === 'interactive-html') return <Code2 className="w-3.5 h-3.5 shrink-0" />;
  if (type === 'quiz') return <HelpCircle className="w-3.5 h-3.5 shrink-0 text-emerald-500" />;
  if (type === 'game') return <Dices className="w-3.5 h-3.5 shrink-0 text-amber-500" />;
  if (type === 'simulation') return <Orbit className="w-3.5 h-3.5 shrink-0 text-indigo-500" />;
  return <FileText className="w-3.5 h-3.5 shrink-0 text-blue-500" />;
}

export default function HierarchySidebar({
  books,
  selection,
  onSelect,
  onAddBook,
  onAddUnit,
  onAddLesson,
  onAddContent,
  onDeleteNode,
  onEditNode,
  onReorderBooks,
  onReorderUnits,
  onReorderLessons,
  onReorderContents,
  onMoveLessonAcrossUnits,
  onMoveContentAcrossLessons,
}: HierarchySidebarProps) {
  const [query, setQuery] = useState('');
  const [dragNode, setDragNode] = useState<DragNode | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [showSortMenu, setShowSortMenu] = useState(false);

  const [expandedBooks, setExpandedBooks] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    books.forEach((b, idx) => {
      initial[b.id] = idx === 0;
    });
    return initial;
  });
  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    books[0]?.units.forEach((u) => {
      initial[u.id] = true;
    });
    return initial;
  });
  const [expandedLessons, setExpandedLessons] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    books[0]?.units[0]?.lessons.forEach((l) => {
      initial[l.id] = true;
    });
    return initial;
  });

  const normalizedQuery = query.trim().toLowerCase();

  const handleMoveBook = (bookId: string, direction: 'up' | 'down') => {
    if (!onReorderBooks) return;
    const currentIndex = books.findIndex((b) => b.id === bookId);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= books.length) return;

    const newBooks = [...books];
    const [moved] = newBooks.splice(currentIndex, 1);
    newBooks.splice(targetIndex, 0, moved);
    onReorderBooks(newBooks);
  };

  const handleMoveUnit = (bookId: string, unitId: string, direction: 'up' | 'down') => {
    if (!onReorderUnits) return;
    const book = books.find((b) => b.id === bookId);
    if (!book) return;
    const curIdx = book.units.findIndex((u) => u.id === unitId);
    if (curIdx === -1) return;
    const targetIdx = direction === 'up' ? curIdx - 1 : curIdx + 1;
    if (targetIdx < 0 || targetIdx >= book.units.length) return;

    const newUnits = [...book.units];
    const [moved] = newUnits.splice(curIdx, 1);
    newUnits.splice(targetIdx, 0, moved);
    onReorderUnits(bookId, newUnits);
  };

  const handleMoveLesson = (bookId: string, unitId: string, lessonId: string, direction: 'up' | 'down') => {
    if (!onReorderLessons) return;
    const book = books.find((b) => b.id === bookId);
    const unit = book?.units.find((u) => u.id === unitId);
    if (!unit) return;
    const curIdx = unit.lessons.findIndex((l) => l.id === lessonId);
    if (curIdx === -1) return;
    const targetIdx = direction === 'up' ? curIdx - 1 : curIdx + 1;
    if (targetIdx < 0 || targetIdx >= unit.lessons.length) return;

    const newLessons = [...unit.lessons];
    const [moved] = newLessons.splice(curIdx, 1);
    newLessons.splice(targetIdx, 0, moved);
    onReorderLessons(bookId, unitId, newLessons);
  };

  const handleMoveContent = (
    bookId: string,
    unitId: string,
    lessonId: string,
    contentId: string,
    direction: 'up' | 'down'
  ) => {
    if (!onReorderContents) return;
    const book = books.find((b) => b.id === bookId);
    const unit = book?.units.find((u) => u.id === unitId);
    const lesson = unit?.lessons.find((l) => l.id === lessonId);
    if (!lesson) return;
    const curIdx = lesson.contents.findIndex((c) => c.id === contentId);
    if (curIdx === -1) return;
    const targetIdx = direction === 'up' ? curIdx - 1 : curIdx + 1;
    if (targetIdx < 0 || targetIdx >= lesson.contents.length) return;

    const newContents = [...lesson.contents];
    const [moved] = newContents.splice(curIdx, 1);
    newContents.splice(targetIdx, 0, moved);
    onReorderContents(bookId, unitId, lessonId, newContents);
  };

  const handleDragStart = (e: React.DragEvent, node: DragNode) => {
    setDragNode(node);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(node));
  };

  const handleDragOver = (
    e: React.DragEvent,
    key: string,
    level: 'book' | 'unit' | 'lesson' | 'content'
  ) => {
    e.preventDefault();
    if (!dragNode || dragNode.level !== level) return;
    e.dataTransfer.dropEffect = 'move';
    if (dragOverKey !== key) {
      setDragOverKey(key);
    }
  };

  const handleDropBook = (e: React.DragEvent, targetBookId: string) => {
    e.preventDefault();
    setDragOverKey(null);
    if (!dragNode || dragNode.level !== 'book' || dragNode.bookId === targetBookId || !onReorderBooks) {
      setDragNode(null);
      return;
    }

    const sourceIndex = books.findIndex((b) => b.id === dragNode.bookId);
    const targetIndex = books.findIndex((b) => b.id === targetBookId);

    if (sourceIndex === -1 || targetIndex === -1) {
      setDragNode(null);
      return;
    }

    const newBooks = [...books];
    const [moved] = newBooks.splice(sourceIndex, 1);
    newBooks.splice(targetIndex, 0, moved);
    onReorderBooks(newBooks);
    setDragNode(null);
  };

  const handleDropUnit = (e: React.DragEvent, bookId: string, targetUnitId: string) => {
    e.preventDefault();
    setDragOverKey(null);
    if (!dragNode || dragNode.level !== 'unit' || dragNode.unitId === targetUnitId || !onReorderUnits) {
      setDragNode(null);
      return;
    }

    const book = books.find((b) => b.id === bookId);
    if (!book || dragNode.bookId !== bookId) {
      setDragNode(null);
      return;
    }

    const sourceIndex = book.units.findIndex((u) => u.id === dragNode.unitId);
    const targetIndex = book.units.findIndex((u) => u.id === targetUnitId);

    if (sourceIndex === -1 || targetIndex === -1) {
      setDragNode(null);
      return;
    }

    const newUnits = [...book.units];
    const [moved] = newUnits.splice(sourceIndex, 1);
    newUnits.splice(targetIndex, 0, moved);
    onReorderUnits(bookId, newUnits);
    setDragNode(null);
  };

  const handleDropLesson = (
    e: React.DragEvent,
    targetBookId: string,
    targetUnitId: string,
    targetLessonId: string
  ) => {
    e.preventDefault();
    setDragOverKey(null);
    if (!dragNode || dragNode.level !== 'lesson' || !dragNode.lessonId) {
      setDragNode(null);
      return;
    }

    if (dragNode.lessonId === targetLessonId) {
      setDragNode(null);
      return;
    }

    if (dragNode.bookId === targetBookId && dragNode.unitId === targetUnitId) {
      if (!onReorderLessons) {
        setDragNode(null);
        return;
      }
      const book = books.find((b) => b.id === targetBookId);
      const unit = book?.units.find((u) => u.id === targetUnitId);
      if (!unit) {
        setDragNode(null);
        return;
      }
      const sourceIndex = unit.lessons.findIndex((l) => l.id === dragNode.lessonId);
      const targetIndex = unit.lessons.findIndex((l) => l.id === targetLessonId);
      if (sourceIndex === -1 || targetIndex === -1) {
        setDragNode(null);
        return;
      }
      const newLessons = [...unit.lessons];
      const [moved] = newLessons.splice(sourceIndex, 1);
      newLessons.splice(targetIndex, 0, moved);
      onReorderLessons(targetBookId, targetUnitId, newLessons);
    } else {
      if (onMoveLessonAcrossUnits && dragNode.unitId) {
        const targetUnit = books.find((b) => b.id === targetBookId)?.units.find((u) => u.id === targetUnitId);
        const targetIdx = targetUnit?.lessons.findIndex((l) => l.id === targetLessonId) ?? 0;
        onMoveLessonAcrossUnits(dragNode.bookId, dragNode.unitId, dragNode.lessonId, targetUnitId, targetIdx);
      }
    }
    setDragNode(null);
  };

  const handleDropContent = (
    e: React.DragEvent,
    targetBookId: string,
    targetUnitId: string,
    targetLessonId: string,
    targetContentId: string
  ) => {
    e.preventDefault();
    setDragOverKey(null);
    if (!dragNode || dragNode.level !== 'content' || !dragNode.contentId) {
      setDragNode(null);
      return;
    }

    if (dragNode.contentId === targetContentId) {
      setDragNode(null);
      return;
    }

    if (dragNode.bookId === targetBookId && dragNode.unitId === targetUnitId && dragNode.lessonId === targetLessonId) {
      if (!onReorderContents) {
        setDragNode(null);
        return;
      }
      const book = books.find((b) => b.id === targetBookId);
      const unit = book?.units.find((u) => u.id === targetUnitId);
      const lesson = unit?.lessons.find((l) => l.id === targetLessonId);
      if (!lesson) {
        setDragNode(null);
        return;
      }
      const sourceIndex = lesson.contents.findIndex((c) => c.id === dragNode.contentId);
      const targetIndex = lesson.contents.findIndex((c) => c.id === targetContentId);
      if (sourceIndex === -1 || targetIndex === -1) {
        setDragNode(null);
        return;
      }
      const newContents = [...lesson.contents];
      const [moved] = newContents.splice(sourceIndex, 1);
      newContents.splice(targetIndex, 0, moved);
      onReorderContents(targetBookId, targetUnitId, targetLessonId, newContents);
    } else {
      if (onMoveContentAcrossLessons && dragNode.unitId && dragNode.lessonId) {
        const targetLesson = books
          .find((b) => b.id === targetBookId)
          ?.units.find((u) => u.id === targetUnitId)
          ?.lessons.find((l) => l.id === targetLessonId);
        const targetIdx = targetLesson?.contents.findIndex((c) => c.id === targetContentId) ?? 0;
        onMoveContentAcrossLessons(
          dragNode.bookId,
          dragNode.unitId,
          dragNode.lessonId,
          dragNode.contentId,
          targetLessonId,
          targetIdx
        );
      }
    }
    setDragNode(null);
  };

  const handleDragEnd = () => {
    setDragNode(null);
    setDragOverKey(null);
  };

  const handleSortAlphabetically = (direction: 'asc' | 'desc') => {
    if (!onReorderBooks) return;
    const sorted = [...books].sort((a, b) => {
      const cmp = a.title.localeCompare(b.title, 'vi', { numeric: true, sensitivity: 'base' });
      return direction === 'asc' ? cmp : -cmp;
    });
    onReorderBooks(sorted);
    setShowSortMenu(false);
  };

  const handleReverseOrder = () => {
    if (!onReorderBooks) return;
    const reversed = [...books].slice().reverse();
    onReorderBooks(reversed);
    setShowSortMenu(false);
  };

  const filteredBooks = useMemo(() => {
    if (!normalizedQuery) return books;
    return books
      .map((book) => {
        const bookMatches =
          book.title.toLowerCase().includes(normalizedQuery) ||
          book.subject.toLowerCase().includes(normalizedQuery);

        const units = book.units
          .map((unit) => {
            const unitMatches = unit.title.toLowerCase().includes(normalizedQuery);
            const lessons = unit.lessons
              .map((lesson) => {
                const lessonMatches = lesson.title.toLowerCase().includes(normalizedQuery);
                const contents = lesson.contents.filter((c) =>
                  c.title.toLowerCase().includes(normalizedQuery)
                );
                if (lessonMatches || contents.length > 0 || unitMatches || bookMatches) {
                  return {
                    ...lesson,
                    contents: lessonMatches || unitMatches || bookMatches ? lesson.contents : contents,
                  };
                }
                return null;
              })
              .filter((l): l is NonNullable<typeof l> => l !== null);

            if (unitMatches || lessons.length > 0 || bookMatches) {
              return { ...unit, lessons };
            }
            return null;
          })
          .filter((u): u is NonNullable<typeof u> => u !== null);

        if (bookMatches || units.length > 0) {
          return { ...book, units };
        }
        return null;
      })
      .filter((b): b is Book => b !== null);
  }, [books, normalizedQuery]);

  const toggleBook = (id: string) => setExpandedBooks((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleUnit = (id: string) => setExpandedUnits((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleLesson = (id: string) => setExpandedLessons((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <aside
      aria-label="Cây cấu trúc học liệu"
      className="w-full lg:w-[292px] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col lg:h-[calc(100vh-61px)] lg:sticky lg:top-[61px]"
    >
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 font-sans">
              Cấu trúc Học liệu
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sách · Chương · Bài học · Nội dung
            </p>
          </div>
          <button
            type="button"
            onClick={onAddBook}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="Thêm sách học thuật mới"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Sách mới</span>
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm sách, chương, bài học..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {/* All Books Header & Sort Actions */}
        <div className="relative">
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800">
            <button
              type="button"
              onClick={() => onSelect({ bookId: null, unitId: null, lessonId: null, contentId: null })}
              className={`flex-1 flex items-center justify-between min-w-0 pr-2 cursor-pointer ${
                selection.bookId === null
                  ? 'hub-accent-text font-semibold'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <Layers className="w-3.5 h-3.5 shrink-0 opacity-75" />
                <span className="truncate">Tất cả Sách Học thuật</span>
              </span>
              <span className="tabular-nums text-[11px] px-1.5 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                {books.length}
              </span>
            </button>

            {onReorderBooks && books.length > 1 && (
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setShowSortMenu((prev) => !prev)}
                  title="Sắp xếp danh sách Sách"
                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </button>

                {showSortMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setShowSortMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1.5 z-30 text-xs">
                      <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        Sắp xếp thứ tự Sách
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSortAlphabetically('asc')}
                        className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer flex items-center gap-2"
                      >
                        <ArrowUp className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Sắp xếp A → Z (Tiêu đề)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSortAlphabetically('desc')}
                        className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer flex items-center gap-2"
                      >
                        <ArrowDown className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Sắp xếp Z → A (Tiêu đề)</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleReverseOrder}
                        className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 mt-1 pt-1.5"
                      >
                        <ArrowUpDown className="w-3.5 h-3.5 text-amber-500" />
                        <span>Đảo ngược thứ tự</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {filteredBooks.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
            Không tìm thấy mục phù hợp với từ khóa.
          </div>
        ) : (
          filteredBooks.map((book) => {
            const isBookOpen = normalizedQuery ? true : !!expandedBooks[book.id];
            const isBookSelected = selection.bookId === book.id && !selection.unitId;
            const bookIndex = books.findIndex((b) => b.id === book.id);
            const isFirst = bookIndex === 0;
            const isLast = bookIndex === books.length - 1;
            const isDragging = dragNode?.level === 'book' && dragNode.bookId === book.id;
            const isDragOver = dragOverKey === `book-${book.id}`;

            return (
              <div
                key={book.id}
                className={`space-y-0.5 transition-all ${
                  isDragging ? 'opacity-40 scale-[0.98]' : ''
                } ${
                  isDragOver ? 'border-t-2 border-indigo-500 rounded-xs pt-0.5' : ''
                }`}
                onDragOver={(e) => {
                  if (!normalizedQuery) handleDragOver(e, `book-${book.id}`, 'book');
                }}
                onDrop={(e) => {
                  if (!normalizedQuery) handleDropBook(e, book.id);
                }}
              >
                {/* Level 1: Book */}
                <div
                  draggable={!normalizedQuery}
                  onDragStart={(e) => handleDragStart(e, { level: 'book', bookId: book.id })}
                  onDragEnd={handleDragEnd}
                  className={`group flex items-center gap-1 px-2 py-1.5 rounded-md text-xs transition-colors ${
                    isBookSelected
                      ? 'hub-accent-soft-bg hub-accent-text font-semibold'
                      : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/70 font-medium'
                  }`}
                >
                  {!normalizedQuery && onReorderBooks && books.length > 1 && (
                    <span
                      title="Kéo thả để sắp xếp thứ tự sách"
                      className="cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 p-0.5 -ml-1 shrink-0"
                    >
                      <GripVertical className="w-3.5 h-3.5" />
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleBook(book.id)}
                    aria-label={isBookOpen ? 'Thu gọn sách' : 'Mở rộng sách'}
                    className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer shrink-0"
                  >
                    {isBookOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedBooks((prev) => ({ ...prev, [book.id]: true }));
                      onSelect({ bookId: book.id, unitId: null, lessonId: null, contentId: null });
                    }}
                    className="flex-1 flex items-center gap-1.5 min-w-0 text-left cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5 shrink-0 opacity-80" />
                    <span className="truncate">{book.title}</span>
                  </button>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                    {!normalizedQuery && onReorderBooks && books.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleMoveBook(book.id, 'up')}
                          disabled={isFirst}
                          title={isFirst ? 'Đã ở vị trí đầu tiên' : 'Di chuyển sách lên trên'}
                          className={`p-1 rounded transition-colors cursor-pointer ${
                            isFirst
                              ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                              : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400'
                          }`}
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveBook(book.id, 'down')}
                          disabled={isLast}
                          title={isLast ? 'Đã ở vị trí cuối cùng' : 'Di chuyển sách xuống dưới'}
                          className={`p-1 rounded transition-colors cursor-pointer ${
                            isLast
                              ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                              : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400'
                          }`}
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        onEditNode({
                          level: 'book',
                          ids: { bookId: book.id, unitId: null, lessonId: null, contentId: null },
                          initialTitle: book.title,
                          initialSubject: book.subject,
                          initialGrade: book.gradeLevel,
                          initialAuthor: book.author,
                          initialDescription: book.description,
                          initialCoverImage: book.coverImage,
                        })
                      }
                      title="Sửa tên & thông tin Sách"
                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedBooks((prev) => ({ ...prev, [book.id]: true }));
                        onAddUnit(book.id);
                      }}
                      title="Thêm Chương (Unit)"
                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onDeleteNode('book', { bookId: book.id, unitId: null, lessonId: null, contentId: null }, book.title)
                      }
                      title="Xóa Sách"
                      className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-950 text-slate-500 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Level 2: Units */}
                {isBookOpen && (
                  <div className="ml-3.5 pl-2.5 border-l border-slate-200 dark:border-slate-800 space-y-0.5">
                    {book.units.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => onAddUnit(book.id)}
                        className="w-full text-left px-2 py-1 text-[11px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                      >
                        + Thêm chương đầu tiên
                      </button>
                    ) : (
                      book.units.map((unit, uIndex) => {
                        const isUnitOpen = normalizedQuery ? true : !!expandedUnits[unit.id];
                        const isUnitSelected =
                          selection.bookId === book.id && selection.unitId === unit.id && !selection.lessonId;
                        const isFirstUnit = uIndex === 0;
                        const isLastUnit = uIndex === book.units.length - 1;
                        const isDraggingUnit = dragNode?.level === 'unit' && dragNode.unitId === unit.id;
                        const isDragOverUnit = dragOverKey === `unit-${unit.id}`;

                        return (
                          <div
                            key={unit.id}
                            className={`space-y-0.5 transition-all ${
                              isDraggingUnit ? 'opacity-40 scale-[0.98]' : ''
                            } ${
                              isDragOverUnit ? 'border-t-2 border-indigo-500 rounded-xs pt-0.5' : ''
                            }`}
                            onDragOver={(e) => {
                              if (!normalizedQuery) handleDragOver(e, `unit-${unit.id}`, 'unit');
                            }}
                            onDrop={(e) => {
                              if (!normalizedQuery) handleDropUnit(e, book.id, unit.id);
                            }}
                          >
                            <div
                              draggable={!normalizedQuery}
                              onDragStart={(e) =>
                                handleDragStart(e, { level: 'unit', bookId: book.id, unitId: unit.id })
                              }
                              onDragEnd={handleDragEnd}
                              className={`group flex items-center gap-1 px-1.5 py-1.5 rounded-md text-xs transition-colors ${
                                isUnitSelected
                                  ? 'hub-accent-soft-bg hub-accent-text font-semibold'
                                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                              }`}
                            >
                              {!normalizedQuery && onReorderUnits && (
                                <span
                                  title="Kéo thả để sắp xếp thứ tự chương"
                                  className="cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 p-0.5 -ml-1 shrink-0"
                                >
                                  <GripVertical className="w-3 h-3" />
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => toggleUnit(unit.id)}
                                aria-label={isUnitOpen ? 'Thu gọn chương' : 'Mở rộng chương'}
                                className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer shrink-0"
                              >
                                {isUnitOpen ? (
                                  <ChevronDown className="w-3 h-3" />
                                ) : (
                                  <ChevronRight className="w-3 h-3" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedUnits((prev) => ({ ...prev, [unit.id]: true }));
                                  onSelect({ bookId: book.id, unitId: unit.id, lessonId: null, contentId: null });
                                }}
                                className="flex-1 flex items-center gap-1.5 min-w-0 text-left cursor-pointer"
                              >
                                <Folder className="w-3.5 h-3.5 shrink-0 opacity-75" />
                                <span className="truncate">{unit.title}</span>
                              </button>
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                                {!normalizedQuery && onReorderUnits && book.units.length > 1 && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleMoveUnit(book.id, unit.id, 'up')}
                                      disabled={isFirstUnit}
                                      title={isFirstUnit ? 'Đã ở vị trí đầu tiên' : 'Di chuyển chương lên trên'}
                                      className={`p-1 rounded transition-colors cursor-pointer ${
                                        isFirstUnit
                                          ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                                          : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400'
                                      }`}
                                    >
                                      <ArrowUp className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleMoveUnit(book.id, unit.id, 'down')}
                                      disabled={isLastUnit}
                                      title={isLastUnit ? 'Đã ở vị trí cuối cùng' : 'Di chuyển chương xuống dưới'}
                                      className={`p-1 rounded transition-colors cursor-pointer ${
                                        isLastUnit
                                          ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                                          : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400'
                                      }`}
                                    >
                                      <ArrowDown className="w-3 h-3" />
                                    </button>
                                  </>
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    onEditNode({
                                      level: 'unit',
                                      ids: { bookId: book.id, unitId: unit.id, lessonId: null, contentId: null },
                                      initialTitle: unit.title,
                                      initialDescription: unit.description,
                                    })
                                  }
                                  title="Sửa tên Chương"
                                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setExpandedUnits((prev) => ({ ...prev, [unit.id]: true }));
                                    onAddLesson(book.id, unit.id);
                                  }}
                                  title="Thêm Bài học (Lesson)"
                                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onDeleteNode(
                                      'unit',
                                      { bookId: book.id, unitId: unit.id, lessonId: null, contentId: null },
                                      unit.title
                                    )
                                  }
                                  title="Xóa Chương"
                                  className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-950 text-slate-500 hover:text-red-600 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            {/* Level 3: Lessons */}
                            {isUnitOpen && (
                              <div className="ml-3 pl-2.5 border-l border-slate-200 dark:border-slate-800 space-y-0.5">
                                {unit.lessons.length === 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => onAddLesson(book.id, unit.id)}
                                    className="w-full text-left px-2 py-1 text-[11px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                                  >
                                    + Thêm bài học mới
                                  </button>
                                ) : (
                                  unit.lessons.map((lesson, lIndex) => {
                                    const isLessonOpen = normalizedQuery ? true : !!expandedLessons[lesson.id];
                                    const isLessonSelected =
                                      selection.lessonId === lesson.id && !selection.contentId;
                                    const isFirstLesson = lIndex === 0;
                                    const isLastLesson = lIndex === unit.lessons.length - 1;
                                    const isDraggingLesson =
                                      dragNode?.level === 'lesson' && dragNode.lessonId === lesson.id;
                                    const isDragOverLesson = dragOverKey === `lesson-${lesson.id}`;

                                    return (
                                      <div
                                        key={lesson.id}
                                        className={`space-y-0.5 transition-all ${
                                          isDraggingLesson ? 'opacity-40 scale-[0.98]' : ''
                                        } ${
                                          isDragOverLesson ? 'border-t-2 border-indigo-500 rounded-xs pt-0.5' : ''
                                        }`}
                                        onDragOver={(e) => {
                                          if (!normalizedQuery) handleDragOver(e, `lesson-${lesson.id}`, 'lesson');
                                        }}
                                        onDrop={(e) => {
                                          if (!normalizedQuery) handleDropLesson(e, book.id, unit.id, lesson.id);
                                        }}
                                      >
                                        <div
                                          draggable={!normalizedQuery}
                                          onDragStart={(e) =>
                                            handleDragStart(e, {
                                              level: 'lesson',
                                              bookId: book.id,
                                              unitId: unit.id,
                                              lessonId: lesson.id,
                                            })
                                          }
                                          onDragEnd={handleDragEnd}
                                          className={`group flex items-center gap-1 px-1.5 py-1.5 rounded-md text-xs transition-colors ${
                                            isLessonSelected
                                              ? 'hub-accent-soft-bg hub-accent-text font-semibold'
                                              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                                          }`}
                                        >
                                          {!normalizedQuery && onReorderLessons && (
                                            <span
                                              title="Kéo thả để di chuyển bài học"
                                              className="cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 p-0.5 -ml-1 shrink-0"
                                            >
                                              <GripVertical className="w-3 h-3" />
                                            </span>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => toggleLesson(lesson.id)}
                                            aria-label={isLessonOpen ? 'Thu gọn bài học' : 'Mở rộng bài học'}
                                            className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer shrink-0"
                                          >
                                            {isLessonOpen ? (
                                              <ChevronDown className="w-3 h-3" />
                                            ) : (
                                              <ChevronRight className="w-3 h-3" />
                                            )}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setExpandedLessons((prev) => ({ ...prev, [lesson.id]: true }));
                                              onSelect({
                                                bookId: book.id,
                                                unitId: unit.id,
                                                lessonId: lesson.id,
                                                contentId: null,
                                              });
                                            }}
                                            className="flex-1 truncate text-left cursor-pointer"
                                          >
                                            {lesson.title}
                                          </button>
                                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                                            {!normalizedQuery && onReorderLessons && unit.lessons.length > 1 && (
                                              <>
                                                <button
                                                  type="button"
                                                  onClick={() => handleMoveLesson(book.id, unit.id, lesson.id, 'up')}
                                                  disabled={isFirstLesson}
                                                  title={
                                                    isFirstLesson
                                                      ? 'Đã ở vị trí đầu tiên'
                                                      : 'Di chuyển bài học lên trên'
                                                  }
                                                  className={`p-1 rounded transition-colors cursor-pointer ${
                                                    isFirstLesson
                                                      ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                                                      : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400'
                                                  }`}
                                                >
                                                  <ArrowUp className="w-3 h-3" />
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => handleMoveLesson(book.id, unit.id, lesson.id, 'down')}
                                                  disabled={isLastLesson}
                                                  title={
                                                    isLastLesson
                                                      ? 'Đã ở vị trí cuối cùng'
                                                      : 'Di chuyển bài học xuống dưới'
                                                  }
                                                  className={`p-1 rounded transition-colors cursor-pointer ${
                                                    isLastLesson
                                                      ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                                                      : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400'
                                                  }`}
                                                >
                                                  <ArrowDown className="w-3 h-3" />
                                                </button>
                                              </>
                                            )}
                                            <button
                                              type="button"
                                              onClick={() =>
                                                onEditNode({
                                                  level: 'lesson',
                                                  ids: {
                                                    bookId: book.id,
                                                    unitId: unit.id,
                                                    lessonId: lesson.id,
                                                    contentId: null,
                                                  },
                                                  initialTitle: lesson.title,
                                                  initialSummary: lesson.summary,
                                                })
                                              }
                                              title="Sửa tên Bài học"
                                              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                                            >
                                              <Pencil className="w-3 h-3" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setExpandedLessons((prev) => ({ ...prev, [lesson.id]: true }));
                                                onAddContent(book.id, unit.id, lesson.id);
                                              }}
                                              title="Thêm Nội dung chi tiết"
                                              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                                            >
                                              <Plus className="w-3 h-3" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                onDeleteNode(
                                                  'lesson',
                                                  {
                                                    bookId: book.id,
                                                    unitId: unit.id,
                                                    lessonId: lesson.id,
                                                    contentId: null,
                                                  },
                                                  lesson.title
                                                )
                                              }
                                              title="Xóa Bài học"
                                              className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-950 text-slate-500 hover:text-red-600 cursor-pointer"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          </div>
                                        </div>

                                        {/* Level 4: Detailed Contents */}
                                        {isLessonOpen && (
                                          <div className="ml-3 pl-2.5 border-l border-slate-200 dark:border-slate-800 space-y-0.5">
                                            {lesson.contents.length === 0 ? (
                                              <button
                                                type="button"
                                                onClick={() => onAddContent(book.id, unit.id, lesson.id)}
                                                className="w-full text-left px-2 py-1 text-[11px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                                              >
                                                + Tải HTML / thêm học liệu
                                              </button>
                                            ) : (
                                              lesson.contents.map((content, cIndex) => {
                                                const isContentSelected = selection.contentId === content.id;
                                                const isFirstContent = cIndex === 0;
                                                const isLastContent = cIndex === lesson.contents.length - 1;
                                                const isDraggingContent =
                                                  dragNode?.level === 'content' && dragNode.contentId === content.id;
                                                const isDragOverContent = dragOverKey === `content-${content.id}`;

                                                return (
                                                  <div
                                                    key={content.id}
                                                    draggable={!normalizedQuery}
                                                    onDragStart={(e) =>
                                                      handleDragStart(e, {
                                                        level: 'content',
                                                        bookId: book.id,
                                                        unitId: unit.id,
                                                        lessonId: lesson.id,
                                                        contentId: content.id,
                                                      })
                                                    }
                                                    onDragEnd={handleDragEnd}
                                                    onDragOver={(e) => {
                                                      if (!normalizedQuery)
                                                        handleDragOver(e, `content-${content.id}`, 'content');
                                                    }}
                                                    onDrop={(e) => {
                                                      if (!normalizedQuery)
                                                        handleDropContent(
                                                          e,
                                                          book.id,
                                                          unit.id,
                                                          lesson.id,
                                                          content.id
                                                        );
                                                    }}
                                                    className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs transition-colors ${
                                                      isDraggingContent ? 'opacity-40 scale-[0.98]' : ''
                                                    } ${
                                                      isDragOverContent
                                                        ? 'border-t-2 border-indigo-500 rounded-xs pt-0.5'
                                                        : ''
                                                    } ${
                                                      isContentSelected
                                                        ? 'hub-accent-bg font-medium'
                                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100'
                                                    }`}
                                                  >
                                                    {!normalizedQuery && onReorderContents && (
                                                      <span
                                                        title="Kéo thả để di chuyển học liệu"
                                                        className="cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 p-0.5 -ml-1 shrink-0"
                                                      >
                                                        <GripVertical className="w-2.5 h-2.5" />
                                                      </span>
                                                    )}
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        onSelect({
                                                          bookId: book.id,
                                                          unitId: unit.id,
                                                          lessonId: lesson.id,
                                                          contentId: content.id,
                                                        })
                                                      }
                                                      className="flex-1 flex items-center gap-1.5 min-w-0 text-left cursor-pointer"
                                                    >
                                                      {getContentIcon(content.type)}
                                                      <span className="truncate">{content.title}</span>
                                                    </button>
                                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                                                      {!normalizedQuery &&
                                                        onReorderContents &&
                                                        lesson.contents.length > 1 && (
                                                          <>
                                                            <button
                                                              type="button"
                                                              onClick={() =>
                                                                handleMoveContent(
                                                                  book.id,
                                                                  unit.id,
                                                                  lesson.id,
                                                                  content.id,
                                                                  'up'
                                                                )
                                                              }
                                                              disabled={isFirstContent}
                                                              title={
                                                                isFirstContent
                                                                  ? 'Đã ở vị trí đầu tiên'
                                                                  : 'Di chuyển nội dung lên trên'
                                                              }
                                                              className={`p-1 rounded transition-colors cursor-pointer shrink-0 ${
                                                                isFirstContent
                                                                  ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                                                                  : isContentSelected
                                                                  ? 'hover:bg-white/20 text-white'
                                                                  : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-indigo-600'
                                                              }`}
                                                            >
                                                              <ArrowUp className="w-2.5 h-2.5" />
                                                            </button>
                                                            <button
                                                              type="button"
                                                              onClick={() =>
                                                                handleMoveContent(
                                                                  book.id,
                                                                  unit.id,
                                                                  lesson.id,
                                                                  content.id,
                                                                  'down'
                                                                )
                                                              }
                                                              disabled={isLastContent}
                                                              title={
                                                                isLastContent
                                                                  ? 'Đã ở vị trí cuối cùng'
                                                                  : 'Di chuyển nội dung xuống dưới'
                                                              }
                                                              className={`p-1 rounded transition-colors cursor-pointer shrink-0 ${
                                                                isLastContent
                                                                  ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                                                                  : isContentSelected
                                                                  ? 'hover:bg-white/20 text-white'
                                                                  : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-indigo-600'
                                                              }`}
                                                            >
                                                              <ArrowDown className="w-2.5 h-2.5" />
                                                            </button>
                                                          </>
                                                        )}
                                                      <button
                                                        type="button"
                                                        onClick={() =>
                                                          onEditNode({
                                                            level: 'content',
                                                            ids: {
                                                              bookId: book.id,
                                                              unitId: unit.id,
                                                              lessonId: lesson.id,
                                                              contentId: content.id,
                                                            },
                                                            initialTitle: content.title,
                                                            initialMinutes: content.estimatedMinutes,
                                                          })
                                                        }
                                                        title="Sửa tên học liệu"
                                                        className={`p-1 rounded cursor-pointer shrink-0 ${
                                                          isContentSelected
                                                            ? 'hover:bg-white/20 text-white'
                                                            : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-indigo-600'
                                                        }`}
                                                      >
                                                        <Pencil className="w-3 h-3" />
                                                      </button>
                                                      <button
                                                        type="button"
                                                        onClick={() =>
                                                          onDeleteNode(
                                                            'content',
                                                            {
                                                              bookId: book.id,
                                                              unitId: unit.id,
                                                              lessonId: lesson.id,
                                                              contentId: content.id,
                                                            },
                                                            content.title
                                                          )
                                                        }
                                                        title="Xóa học liệu"
                                                        className={`p-1 rounded cursor-pointer shrink-0 ${
                                                          isContentSelected
                                                            ? 'hover:bg-white/20 text-white'
                                                            : 'hover:bg-red-100 dark:hover:bg-red-950 text-slate-400 hover:text-red-600'
                                                        }`}
                                                      >
                                                        <Trash2 className="w-3 h-3" />
                                                      </button>
                                                    </div>
                                                  </div>
                                                );
                                              })
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
