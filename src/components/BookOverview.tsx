import React, { useState } from 'react';
import { ArrowRight, BookOpen, Code2, Dices, FileText, FolderPlus, HelpCircle, Orbit, Pencil, Plus } from 'lucide-react';
import type { Book, ContentType, Lesson, SelectionPath, Unit } from '../types/academic';
import { computeCurriculumStats } from '../utils/portableBundle';
import type { EditTarget } from './EditNodeModal';

interface BookOverviewProps {
  books: Book[];
  selection: SelectionPath;
  institutionName: string;
  onSelect: (path: SelectionPath) => void;
  onAddBook: () => void;
  onAddUnit: (bookId: string) => void;
  onAddLesson: (bookId: string, unitId: string) => void;
  onAddContent: (bookId: string, unitId: string, lessonId: string) => void;
  onAskAiForLesson: (contextPrompt: string) => void;
  onEditNode: (target: EditTarget) => void;
}

function contentTypeLabel(type: ContentType): string {
  if (type === 'interactive-html') return 'HTML5 Tương tác';
  if (type === 'quiz') return 'Trắc nghiệm';
  if (type === 'game') return 'Minigames Giáo Dục';
  if (type === 'simulation') return 'Mô Phỏng STEM';
  return 'Tài liệu đọc';
}

function contentTypeIcon(type: ContentType) {
  if (type === 'interactive-html') return <Code2 className="w-4 h-4 shrink-0" />;
  if (type === 'quiz') return <HelpCircle className="w-4 h-4 shrink-0 text-emerald-500" />;
  if (type === 'game') return <Dices className="w-4 h-4 shrink-0 text-amber-500" />;
  if (type === 'simulation') return <Orbit className="w-4 h-4 shrink-0 text-indigo-500" />;
  return <FileText className="w-4 h-4 shrink-0 text-blue-500" />;
}

function CoverArt({ src, title, subject }: { src: string; title: string; subject: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 flex flex-col justify-between p-5 text-white">
        <span className="text-xs text-slate-300">{subject}</span>
        <div>
          <BookOpen className="w-7 h-7 text-slate-300 mb-3" />
          <div className="font-editorial text-base font-semibold leading-snug line-clamp-3">{title}</div>
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`Bìa sách ${title}`}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="w-full h-full object-cover"
    />
  );
}

export default function BookOverview({
  books,
  selection,
  institutionName,
  onSelect,
  onAddBook,
  onAddUnit,
  onAddLesson,
  onAddContent,
  onAskAiForLesson,
  onEditNode,
}: BookOverviewProps) {
  const activeBook = books.find((b) => b.id === selection.bookId) ?? null;
  const activeUnit: Unit | null = activeBook?.units.find((u) => u.id === selection.unitId) ?? null;
  const activeLesson: Lesson | null = activeUnit?.lessons.find((l) => l.id === selection.lessonId) ?? null;

  // View 1: Lesson Detail Overview (Level 3)
  if (activeBook && activeUnit && activeLesson) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <button
                type="button"
                onClick={() => onSelect({ bookId: activeBook.id, unitId: null, lessonId: null, contentId: null })}
                className="hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
              >
                {activeBook.title}
              </button>
              <span aria-hidden="true">/</span>
              <button
                type="button"
                onClick={() => onSelect({ bookId: activeBook.id, unitId: activeUnit.id, lessonId: null, contentId: null })}
                className="hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
              >
                {activeUnit.title}
              </button>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
                {activeLesson.title}
              </h1>
              <button
                type="button"
                onClick={() =>
                  onEditNode({
                    level: 'lesson',
                    ids: { bookId: activeBook.id, unitId: activeUnit.id, lessonId: activeLesson.id, contentId: null },
                    initialTitle: activeLesson.title,
                    initialSummary: activeLesson.summary,
                  })
                }
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Sửa tên bài học"
              >
                <Pencil className="w-3.5 h-3.5 text-indigo-500" />
                <span>Sửa tên bài học</span>
              </button>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{activeLesson.summary}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() =>
                onAskAiForLesson(
                  `Hãy phân tích và đề xuất thêm một học liệu HTML5 tương tác cho bài học "${activeLesson.title}" thuộc "${activeUnit.title}" của sách "${activeBook.title}".`
                )
              }
              className="px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              Tư vấn cấu trúc AI
            </button>
            <button
              type="button"
              onClick={() => onAddContent(activeBook.id, activeUnit.id, activeLesson.id)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg hub-accent-bg transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm học liệu chi tiết</span>
            </button>
          </div>
        </div>

        {activeLesson.objectives.length > 0 && (
          <section className="space-y-2.5">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 font-sans">
              Mục tiêu bài học
            </h2>
            <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300 list-disc ml-5">
              {activeLesson.objectives.map((obj, idx) => (
                <li key={idx}>{obj}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 font-sans">
              Thành phần nội dung chi tiết ({activeLesson.contents.length})
            </h2>
          </div>

          {activeLesson.contents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center space-y-3 bg-white dark:bg-slate-900">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Bài học này chưa có thành phần nội dung chi tiết. Bạn có thể tải tệp HTML tương tác từ máy tính hoặc tạo mới bằng AI.
              </p>
              <button
                type="button"
                onClick={() => onAddContent(activeBook.id, activeUnit.id, activeLesson.id)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg hub-accent-bg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tạo học liệu đầu tiên</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              {activeLesson.contents.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    onSelect({
                      bookId: activeBook.id,
                      unitId: activeUnit.id,
                      lessonId: activeLesson.id,
                      contentId: item.id,
                    })
                  }
                  className="w-full text-left px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-center justify-between gap-4 cursor-pointer"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="mt-0.5 text-slate-500 dark:text-slate-400">{contentTypeIcon(item.type)}</div>
                    <div className="min-w-0 space-y-1">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {String(idx + 1).padStart(2, '0')}. {item.title}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{item.description}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        <span>{contentTypeLabel(item.type)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{item.estimatedMinutes} phút</span>
                        {item.sourceFilename && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono text-[11px]">{item.sourceFilename}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditNode({
                          level: 'content',
                          ids: {
                            bookId: activeBook.id,
                            unitId: activeUnit.id,
                            lessonId: activeLesson.id,
                            contentId: item.id,
                          },
                          initialTitle: item.title,
                          initialMinutes: item.estimatedMinutes,
                        });
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                      title="Sửa tên học liệu"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  // View 2: Unit Overview (Level 2)
  if (activeBook && activeUnit) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <button
                type="button"
                onClick={() => onSelect({ bookId: activeBook.id, unitId: null, lessonId: null, contentId: null })}
                className="hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
              >
                {activeBook.title}
              </button>
              <span aria-hidden="true">/</span>
              <span>Chương {activeUnit.order}</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
                {activeUnit.title}
              </h1>
              <button
                type="button"
                onClick={() =>
                  onEditNode({
                    level: 'unit',
                    ids: { bookId: activeBook.id, unitId: activeUnit.id, lessonId: null, contentId: null },
                    initialTitle: activeUnit.title,
                    initialDescription: activeUnit.description,
                  })
                }
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Sửa tên chương"
              >
                <Pencil className="w-3.5 h-3.5 text-indigo-500" />
                <span>Sửa tên chương</span>
              </button>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{activeUnit.description}</p>
          </div>
          <button
            type="button"
            onClick={() => onAddLesson(activeBook.id, activeUnit.id)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg hub-accent-bg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm Bài học mới</span>
          </button>
        </div>

        <section className="space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 font-sans">
            Danh sách Bài học ({activeUnit.lessons.length})
          </h2>
          {activeUnit.lessons.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center space-y-3 bg-white dark:bg-slate-900">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Chương này chưa có bài học nào. Hãy thêm bài học để bắt đầu đính kèm học liệu HTML5 tương tác.
              </p>
              <button
                type="button"
                onClick={() => onAddLesson(activeBook.id, activeUnit.id)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg hub-accent-bg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tạo Bài học đầu tiên</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              {activeUnit.lessons.map((lesson) => (
                <div
                  key={lesson.id}
                  className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() =>
                      onSelect({
                        bookId: activeBook.id,
                        unitId: activeUnit.id,
                        lessonId: lesson.id,
                        contentId: lesson.contents[0]?.id ?? null,
                      })
                    }
                    className="flex-1 text-left space-y-1 cursor-pointer min-w-0"
                  >
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{lesson.title}</div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{lesson.summary}</p>
                    <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {lesson.contents.length} thành phần nội dung
                      {' · '}
                      {lesson.contents.filter((c) => c.type === 'interactive-html').length} mô-đun HTML5
                    </div>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        onEditNode({
                          level: 'lesson',
                          ids: { bookId: activeBook.id, unitId: activeUnit.id, lessonId: lesson.id, contentId: null },
                          initialTitle: lesson.title,
                          initialSummary: lesson.summary,
                        })
                      }
                      className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      title="Sửa tên bài học"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onAddContent(activeBook.id, activeUnit.id, lesson.id)}
                      className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                    >
                      + Học liệu
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onSelect({
                          bookId: activeBook.id,
                          unitId: activeUnit.id,
                          lessonId: lesson.id,
                          contentId: lesson.contents[0]?.id ?? null,
                        })
                      }
                      className="px-3 py-1.5 text-xs font-medium rounded-md hub-accent-bg cursor-pointer whitespace-nowrap"
                    >
                      Mở bài học
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  // View 3: Single Book Overview (Level 1)
  if (activeBook) {
    const lessonCount = activeBook.units.reduce((acc, u) => acc + u.lessons.length, 0);
    const contentCount = activeBook.units.reduce(
      (acc, u) => acc + u.lessons.reduce((la, l) => la + l.contents.length, 0),
      0
    );

    return (
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-8 pb-8 border-b border-slate-200 dark:border-slate-800 items-start">
          <div className="aspect-[3/4] w-44 md:w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
            <CoverArt src={activeBook.coverImage} title={activeBook.title} subject={activeBook.subject} />
          </div>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              <span>{activeBook.subject}</span>
              <span aria-hidden="true">·</span>
              <span>{activeBook.gradeLevel}</span>
              <span aria-hidden="true">·</span>
              <span>{activeBook.author}</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
                {activeBook.title}
              </h1>
              <button
                type="button"
                onClick={() =>
                  onEditNode({
                    level: 'book',
                    ids: { bookId: activeBook.id, unitId: null, lessonId: null, contentId: null },
                    initialTitle: activeBook.title,
                    initialSubject: activeBook.subject,
                    initialGrade: activeBook.gradeLevel,
                    initialAuthor: activeBook.author,
                    initialDescription: activeBook.description,
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                title="Sửa tên & thông tin sách"
              >
                <Pencil className="w-3.5 h-3.5 text-indigo-500" />
                <span>Sửa thông tin sách</span>
              </button>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
              {activeBook.description}
            </p>
            <div className="flex flex-wrap items-center gap-5 pt-1 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
              <span>
                <strong className="text-slate-900 dark:text-slate-100">{activeBook.units.length}</strong> Chương (Units)
              </span>
              <span>
                <strong className="text-slate-900 dark:text-slate-100">{lessonCount}</strong> Bài học (Lessons)
              </span>
              <span>
                <strong className="text-slate-900 dark:text-slate-100">{contentCount}</strong> Học liệu chi tiết
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => onAddUnit(activeBook.id)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg hub-accent-bg transition-colors cursor-pointer whitespace-nowrap"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>Thêm Chương mới</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onAskAiForLesson(
                    `Hãy kiểm tra độ đầy đủ cấu trúc Book > Unit > Lesson > Content của cuốn "${activeBook.title}" và đề xuất lộ trình bổ sung học liệu tương tác HTML5.`
                  )
                }
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
              >
                Kiểm định cấu trúc cùng AI
              </button>
            </div>
          </div>
        </div>

        <section className="space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 font-sans">
            Mục lục Chương và Bài học
          </h2>
          {activeBook.units.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center space-y-3 bg-white dark:bg-slate-900">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Cuốn sách này chưa có chương nào. Hãy tạo Chương (Unit) đầu tiên để duy trì cấu trúc chuẩn.
              </p>
              <button
                type="button"
                onClick={() => onAddUnit(activeBook.id)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg hub-accent-bg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tạo Chương đầu tiên</span>
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {activeBook.units.map((unit) => (
                <div
                  key={unit.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
                >
                  <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div>
                        <button
                          type="button"
                          onClick={() =>
                            onSelect({ bookId: activeBook.id, unitId: unit.id, lessonId: null, contentId: null })
                          }
                          className="text-base font-semibold text-slate-900 dark:text-slate-100 hover:underline cursor-pointer text-left"
                        >
                          {unit.title}
                        </button>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{unit.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onEditNode({
                            level: 'unit',
                            ids: { bookId: activeBook.id, unitId: unit.id, lessonId: null, contentId: null },
                            initialTitle: unit.title,
                            initialDescription: unit.description,
                          })
                        }
                        className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        title="Sửa tên chương"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => onAddLesson(activeBook.id, unit.id)}
                      className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                    >
                      + Thêm Bài học
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {unit.lessons.map((lesson) => (
                      <div key={lesson.id} className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() =>
                              onSelect({
                                bookId: activeBook.id,
                                unitId: unit.id,
                                lessonId: lesson.id,
                                contentId: lesson.contents[0]?.id ?? null,
                              })
                            }
                            className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:hub-accent-text cursor-pointer text-left"
                          >
                            {lesson.title}
                          </button>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                            {lesson.summary}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          <span>{lesson.contents.length} học liệu</span>
                          <button
                            type="button"
                            onClick={() =>
                              onEditNode({
                                level: 'lesson',
                                ids: { bookId: activeBook.id, unitId: unit.id, lessonId: lesson.id, contentId: null },
                                initialTitle: lesson.title,
                                initialSummary: lesson.summary,
                              })
                            }
                            className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            title="Sửa tên bài học"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onSelect({
                                bookId: activeBook.id,
                                unitId: unit.id,
                                lessonId: lesson.id,
                                contentId: lesson.contents[0]?.id ?? null,
                              })
                            }
                            className="hub-accent-text font-medium hover:underline cursor-pointer whitespace-nowrap"
                          >
                            Mở trình xem
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  // View 4: Master Library Catalog (Root)
  const stats = computeCurriculumStats(books);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-2 max-w-2xl">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{institutionName}</p>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Thư viện Sách Học thuật Tương tác
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Quản trị toàn bộ học liệu số theo phân cấp chuẩn Sách → Chương → Bài học → Thành phần chi tiết, chạy trình xem HTML5 cô lập và đồng bộ dữ liệu Local-First.
          </p>
        </div>

        <button
          type="button"
          onClick={onAddBook}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg hub-accent-bg transition-colors cursor-pointer whitespace-nowrap shrink-0 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Khởi tạo Sách mới</span>
        </button>
      </div>

      {/* Compact single-row KPI summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">Tổng số Sách</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">{stats.bookCount}</div>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">Chương (Units)</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">{stats.unitCount}</div>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">Bài học (Lessons)</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">{stats.lessonCount}</div>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400">Học liệu HTML5 Tương tác</div>
          <div className="text-2xl font-bold hub-accent-text mt-1 tabular-nums">{stats.htmlCount}</div>
        </div>
      </div>

      {/* Book Editorial Grid */}
      {books.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center space-y-3 bg-white dark:bg-slate-900">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Thư viện hiện chưa có đầu sách nào. Hãy tạo cuốn sách đầu tiên hoặc nhập gói dữ liệu từ máy khác.
          </p>
          <button
            type="button"
            onClick={onAddBook}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg hub-accent-bg cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tạo Sách đầu tiên</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {books.map((book) => {
            const uCount = book.units.length;
            const lCount = book.units.reduce((sum, u) => sum + u.lessons.length, 0);
            const firstUnit = book.units[0];
            const firstLesson = firstUnit?.lessons[0];
            const firstContent = firstLesson?.contents[0];

            return (
              <article
                key={book.id}
                className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col transition-colors hover:border-slate-300 dark:hover:border-slate-700"
              >
                <button
                  type="button"
                  onClick={() => onSelect({ bookId: book.id, unitId: null, lessonId: null, contentId: null })}
                  className="aspect-[16/10] w-full overflow-hidden bg-slate-100 dark:bg-slate-800 cursor-pointer text-left relative"
                >
                  <CoverArt src={book.coverImage} title={book.title} subject={book.subject} />
                </button>

                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      <span>{book.subject}</span>
                      <span aria-hidden="true">·</span>
                      <span>{book.gradeLevel}</span>
                      <span aria-hidden="true">·</span>
                      <span>{uCount} chương</span>
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug">
                      <button
                        type="button"
                        onClick={() => onSelect({ bookId: book.id, unitId: null, lessonId: null, contentId: null })}
                        className="text-left hover:underline cursor-pointer"
                      >
                        {book.title}
                      </button>
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {book.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {lCount} bài học
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => onSelect({ bookId: book.id, unitId: null, lessonId: null, contentId: null })}
                        className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer whitespace-nowrap"
                      >
                        Mục lục
                      </button>
                      {firstUnit && firstLesson && firstContent && (
                        <button
                          type="button"
                          onClick={() =>
                            onSelect({
                              bookId: book.id,
                              unitId: firstUnit.id,
                              lessonId: firstLesson.id,
                              contentId: firstContent.id,
                            })
                          }
                          className="inline-flex items-center gap-1 text-xs font-semibold hub-accent-text hover:underline cursor-pointer whitespace-nowrap"
                        >
                          <span>Vào học ngay</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
