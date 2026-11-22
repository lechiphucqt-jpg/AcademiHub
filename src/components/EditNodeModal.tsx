import React, { useEffect, useState } from 'react';
import { Pencil, X } from 'lucide-react';
import type { SelectionPath } from '../types/academic';

export type EditTarget =
  | {
      level: 'book';
      ids: SelectionPath;
      initialTitle: string;
      initialSubject?: string;
      initialGrade?: string;
      initialAuthor?: string;
      initialDescription?: string;
    }
  | {
      level: 'unit';
      ids: SelectionPath;
      initialTitle: string;
      initialDescription?: string;
    }
  | {
      level: 'lesson';
      ids: SelectionPath;
      initialTitle: string;
      initialSummary?: string;
    }
  | {
      level: 'content';
      ids: SelectionPath;
      initialTitle: string;
      initialMinutes?: number;
    };

interface EditNodeModalProps {
  target: EditTarget | null;
  onClose: () => void;
  onSave: (
    level: 'book' | 'unit' | 'lesson' | 'content',
    ids: SelectionPath,
    data: {
      title: string;
      description?: string;
      summary?: string;
      subject?: string;
      gradeLevel?: string;
      author?: string;
      estimatedMinutes?: number;
    }
  ) => void;
}

export default function EditNodeModal({ target, onClose, onSave }: EditNodeModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [summary, setSummary] = useState('');
  const [subject, setSubject] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [author, setAuthor] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState(8);

  useEffect(() => {
    if (!target) return;
    setTitle(target.initialTitle || '');
    if (target.level === 'book') {
      setSubject(target.initialSubject || '');
      setGradeLevel(target.initialGrade || '');
      setAuthor(target.initialAuthor || '');
      setDescription(target.initialDescription || '');
    } else if (target.level === 'unit') {
      setDescription(target.initialDescription || '');
    } else if (target.level === 'lesson') {
      setSummary(target.initialSummary || '');
    } else if (target.level === 'content') {
      setEstimatedMinutes(target.initialMinutes || 8);
    }
  }, [target]);

  if (!target) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (target.level === 'book') {
      onSave('book', target.ids, {
        title: title.trim(),
        subject: subject.trim() || undefined,
        gradeLevel: gradeLevel.trim() || undefined,
        author: author.trim() || undefined,
        description: description.trim() || undefined,
      });
    } else if (target.level === 'unit') {
      onSave('unit', target.ids, {
        title: title.trim(),
        description: description.trim() || undefined,
      });
    } else if (target.level === 'lesson') {
      onSave('lesson', target.ids, {
        title: title.trim(),
        summary: summary.trim() || undefined,
      });
    } else if (target.level === 'content') {
      onSave('content', target.ids, {
        title: title.trim(),
        estimatedMinutes: Math.max(1, Number(estimatedMinutes) || 5),
      });
    }
    onClose();
  };

  const getHeading = () => {
    switch (target.level) {
      case 'book':
        return 'Sửa tên & Thông tin Sách';
      case 'unit':
        return 'Sửa tên Chương (Unit)';
      case 'lesson':
        return 'Sửa tên Bài học (Lesson)';
      case 'content':
        return 'Sửa tên Học liệu chi tiết';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Pencil className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{getHeading()}</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Cập nhật thông tin phân cấp trong cơ sở dữ liệu
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-800 dark:text-slate-200">
              {target.level === 'book'
                ? 'Tên sách *'
                : target.level === 'unit'
                ? 'Tên chương *'
                : target.level === 'lesson'
                ? 'Tên bài học *'
                : 'Tên học liệu *'}
            </label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nhập tên mới..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
            />
          </div>

          {target.level === 'book' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-medium text-slate-700 dark:text-slate-300">Môn học</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="VD: Tiếng Anh, Vật lý..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-medium text-slate-700 dark:text-slate-300">Khối lớp / Trình độ</label>
                  <input
                    type="text"
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value)}
                    placeholder="VD: Beginner A1, Lớp 10..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-medium text-slate-700 dark:text-slate-300">Tác giả / Giáo viên biên soạn</label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="VD: Thầy Phúc, Tổ Tiếng Anh..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-medium text-slate-700 dark:text-slate-300">Mô tả ngắn</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Giới thiệu mục tiêu của sách..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 leading-relaxed resize-none"
                />
              </div>
            </>
          )}

          {target.level === 'unit' && (
            <div className="space-y-1.5">
              <label className="font-medium text-slate-700 dark:text-slate-300">Mô tả chương (tùy chọn)</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả chủ đề của chương học..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 leading-relaxed resize-none"
              />
            </div>
          )}

          {target.level === 'lesson' && (
            <div className="space-y-1.5">
              <label className="font-medium text-slate-700 dark:text-slate-300">Tóm tắt bài học (tùy chọn)</label>
              <textarea
                rows={3}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Tóm tắt nội dung trọng tâm bài học..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 leading-relaxed resize-none"
              />
            </div>
          )}

          {target.level === 'content' && (
            <div className="space-y-1.5">
              <label className="font-medium text-slate-700 dark:text-slate-300">Thời lượng dự kiến (phút)</label>
              <input
                type="number"
                min={1}
                max={180}
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                className="w-32 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          {/* Footer actions */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold shadow-xs transition-colors cursor-pointer"
            >
              Lưu thay đổi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
