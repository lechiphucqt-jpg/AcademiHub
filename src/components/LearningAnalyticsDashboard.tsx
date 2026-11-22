import React, { useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  BookMarked,
  Brain,
  CheckCircle2,
  Clock,
  Layers,
  PieChart,
  Sparkles,
  Trophy,
} from 'lucide-react';
import type { Book, SelectionPath } from '../types/academic';

interface LearningAnalyticsDashboardProps {
  books: Book[];
  onNavigateToContent: (path: SelectionPath) => void;
  onNotify: (message: string, tone?: 'success' | 'error' | 'info') => void;
}

export default function LearningAnalyticsDashboard({
  books,
  onNavigateToContent,
  onNotify,
}: LearningAnalyticsDashboardProps) {
  // Aggregate Stats
  const stats = useMemo(() => {
    let unitCount = 0;
    let lessonCount = 0;
    let contentCount = 0;
    let totalMinutes = 0;
    const typeCounts: Record<string, number> = {
      'interactive-html': 0,
      quiz: 0,
      reading: 0,
      game: 0,
      simulation: 0,
    };
    let totalQuestions = 0;

    books.forEach((b) => {
      unitCount += b.units.length;
      b.units.forEach((u) => {
        lessonCount += u.lessons.length;
        u.lessons.forEach((l) => {
          contentCount += l.contents.length;
          l.contents.forEach((c) => {
            totalMinutes += c.estimatedMinutes || 5;
            typeCounts[c.type] = (typeCounts[c.type] || 0) + 1;
            if (c.quizQuestions) {
              totalQuestions += c.quizQuestions.length;
            }
          });
        });
      });
    });

    return {
      bookCount: books.length,
      unitCount,
      lessonCount,
      contentCount,
      totalHours: (totalMinutes / 60).toFixed(1),
      typeCounts,
      totalQuestions,
    };
  }, [books]);

  // Bloom taxonomy breakdown estimate
  const bloomDistribution = [
    { label: 'Nhận biết (Remember)', percent: 35, color: '#3B82F6' },
    { label: 'Thông hiểu (Understand)', percent: 30, color: '#10B981' },
    { label: 'Vận dụng (Apply)', percent: 25, color: '#F59E0B' },
    { label: 'Vận dụng cao (Analyze/Create)', percent: 10, color: '#EF4444' },
  ];

  const contentColors: Record<string, string> = {
    'interactive-html': '#EA580C',
    quiz: '#16A34A',
    reading: '#0284C7',
    game: '#D97706',
    simulation: '#7C3AED',
  };

  const contentLabels: Record<string, string> = {
    'interactive-html': 'HTML5 Tương tác',
    quiz: 'Trắc nghiệm tự chấm',
    reading: 'Tài liệu đọc hiểu',
    game: 'Minigames giáo dục',
    simulation: 'Mô phỏng STEM',
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50 dark:bg-slate-950 flex flex-col gap-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              Bảng Phân Tích Dữ Liệu &amp; Năng Lực Học Tập
            </h1>
          </div>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Đánh giá toàn diện cấu trúc học thuật, ngân hàng câu hỏi và năng lực nhận thức
          </p>
        </div>
      </div>

      {/* KPI 4-Card Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Giáo trình &amp; Khóa học</span>
            <BookMarked className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
            {stats.bookCount} <span className="text-xs font-normal text-slate-500">Sách</span>
          </div>
          <span className="text-[11px] text-slate-400">{stats.unitCount} chương học</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Bài học &amp; Đơn vị</span>
            <Layers className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
            {stats.lessonCount} <span className="text-xs font-normal text-slate-500">Bài</span>
          </div>
          <span className="text-[11px] text-slate-400">{stats.contentCount} đơn vị học liệu</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Ngân hàng câu hỏi</span>
            <Brain className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
            {stats.totalQuestions} <span className="text-xs font-normal text-slate-500">Câu</span>
          </div>
          <span className="text-[11px] text-slate-400">Tự động chấm &amp; giải thích</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Thời lượng học tập</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
            {stats.totalHours} <span className="text-xs font-normal text-slate-500">Giờ</span>
          </div>
          <span className="text-[11px] text-slate-400">Ước tính tiêu chuẩn GDPT</span>
        </div>
      </div>

      {/* Two Column Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Content Type Breakdown */}
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Phân bố Định dạng Học liệu Số
              </h3>
            </div>
            <span className="text-xs font-semibold text-slate-400">
              Tổng: {stats.contentCount}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {Object.entries(stats.typeCounts).map(([typeKey, count]) => {
              const percent = stats.contentCount > 0 ? Math.round((count / stats.contentCount) * 100) : 0;
              const color = contentColors[typeKey] || '#64748B';
              const label = contentLabels[typeKey] || typeKey;

              return (
                <div key={typeKey} className="flex flex-col gap-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      {label}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {count} ({percent}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${percent}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart 2: Bloom Cognitive Taxonomy */}
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Phân loại Mức độ Nhận thức (Thang Bloom)
              </h3>
            </div>
            <span className="text-xs font-semibold text-purple-600">Đạt chuẩn BGDĐT</span>
          </div>

          <div className="flex flex-col gap-3.5">
            {bloomDistribution.map((item) => (
              <div key={item.label} className="flex flex-col gap-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    {item.label}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {item.percent}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${item.percent}%`, backgroundColor: item.color }}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-auto">
            💡 Tỉ lệ phân bổ 35% Nhận biết – 30% Thông hiểu – 25% Vận dụng – 10% Vận dụng cao là cơ cấu tối ưu cho các đề kiểm tra đánh giá định kỳ THPT.
          </p>
        </div>
      </div>

      {/* Curriculum Detail Table */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col gap-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          Danh mục Sách &amp; Độ phủ Học liệu Số
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold">
                <th className="pb-3">Tên Sách</th>
                <th className="pb-3">Môn học</th>
                <th className="pb-3">Khối</th>
                <th className="pb-3">Số Chương</th>
                <th className="pb-3">Số Bài</th>
                <th className="pb-3">Học liệu</th>
                <th className="pb-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {books.map((b) => {
                const totalLessons = b.units.reduce((acc, u) => acc + u.lessons.length, 0);
                const totalContents = b.units.reduce(
                  (acc, u) => acc + u.lessons.reduce((lAcc, l) => lAcc + l.contents.length, 0),
                  0
                );

                return (
                  <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3 font-semibold text-slate-900 dark:text-slate-100">
                      {b.title}
                    </td>
                    <td className="py-3 text-slate-600 dark:text-slate-400">{b.subject}</td>
                    <td className="py-3 text-slate-600 dark:text-slate-400">{b.gradeLevel}</td>
                    <td className="py-3 text-slate-600 dark:text-slate-400">{b.units.length}</td>
                    <td className="py-3 text-slate-600 dark:text-slate-400">{totalLessons}</td>
                    <td className="py-3 font-bold text-blue-600">{totalContents}</td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          const firstU = b.units[0];
                          const firstL = firstU?.lessons[0];
                          const firstC = firstL?.contents[0];
                          onNavigateToContent({
                            bookId: b.id,
                            unitId: firstU?.id ?? null,
                            lessonId: firstL?.id ?? null,
                            contentId: firstC?.id ?? null,
                          });
                          onNotify(`Đã mở giáo trình "${b.title}".`, 'success');
                        }}
                        className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 hover:bg-blue-100 font-semibold cursor-pointer"
                      >
                        Mở sách
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
