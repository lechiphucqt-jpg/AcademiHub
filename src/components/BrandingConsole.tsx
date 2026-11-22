import React, { useRef } from 'react';
import { BookMarked, Check, Moon, RotateCcw, Sun, Trash2, Upload } from 'lucide-react';
import type { BrandingConfig } from '../types/academic';
import { ACCENT_PRESETS, DEFAULT_BRANDING } from '../data/seedData';

interface BrandingConsoleProps {
  branding: BrandingConfig;
  onChangeBranding: (next: BrandingConfig) => void;
  onNotify: (message: string, tone?: 'success' | 'error' | 'info') => void;
}

export default function BrandingConsole({
  branding,
  onChangeBranding,
  onNotify,
}: BrandingConsoleProps) {
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const handleUploadLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      onNotify('Vui lòng chọn ảnh định dạng PNG, JPG, WebP hoặc GIF.', 'error');
      return;
    }
    if (file.size > 512 * 1024) {
      onNotify('Logo thương hiệu nên có dung lượng dưới 512 KB để tối ưu tốc độ Local-First.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onChangeBranding({ ...branding, logoDataUrl: reader.result });
        onNotify('Đã cập nhật logo thương hiệu trên toàn hệ thống.', 'success');
      }
    };
    reader.readAsDataURL(file);
  };

  const configPreviewJson = JSON.stringify(
    {
      APP_BRAND_NAME: branding.appName,
      INSTITUTION_NAME: branding.institutionName,
      THEME_ACCENT_HEX: branding.customAccentHex,
      THEME_MODE: branding.themeMode,
      HAS_CUSTOM_LOGO: Boolean(branding.logoDataUrl),
    },
    null,
    2
  );

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
            Tùy biến Thương hiệu Tập trung (White-Labeling)
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Thiết lập tên ứng dụng, biểu trưng đơn vị và bảng màu chủ đạo một lần duy nhất — tự động áp dụng đồng bộ và lưu trong tệp cấu hình khi đóng gói.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            onChangeBranding(DEFAULT_BRANDING);
            onNotify('Đã khôi phục cấu hình thương hiệu mặc định.', 'info');
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Mặc định hệ thống</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Controls */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="brandAppName" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tên Ứng dụng (Hiển thị trên thanh tiêu đề & gói xuất)
              </label>
              <input
                id="brandAppName"
                type="text"
                maxLength={48}
                value={branding.appName}
                onChange={(e) => onChangeBranding({ ...branding, appName: e.target.value })}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="brandInst" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tên Đơn vị / Trường học / Trung tâm Đào tạo
              </label>
              <input
                id="brandInst"
                type="text"
                maxLength={100}
                value={branding.institutionName}
                onChange={(e) => onChangeBranding({ ...branding, institutionName: e.target.value })}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Logo Upload */}
          <div className="space-y-2.5 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">Logo Thương hiệu</div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="w-12 h-12 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 flex items-center justify-center overflow-hidden shrink-0">
                {branding.logoDataUrl ? (
                  <img
                    src={branding.logoDataUrl}
                    alt="Logo hiện tại"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain p-1"
                  />
                ) : (
                  <BookMarked className="w-6 h-6 hub-accent-text" />
                )}
              </div>

              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleUploadLogo}
                className="hidden"
              />

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Tải Logo lên</span>
                </button>
                {branding.logoDataUrl && (
                  <button
                    type="button"
                    onClick={() => onChangeBranding({ ...branding, logoDataUrl: null })}
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Gỡ bỏ</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Accent Color Presets */}
          <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Màu nhấn Học thuật (Chuẩn tương phản WCAG AA)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {ACCENT_PRESETS.map((preset) => {
                const active = branding.accentPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      onChangeBranding({
                        ...branding,
                        accentPresetId: preset.id,
                        customAccentHex: preset.accent,
                        customAccentHoverHex: preset.hover,
                      })
                    }
                    className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                      active
                        ? 'border-slate-900 dark:border-slate-100 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                        : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        className="w-4 h-4 rounded-sm shrink-0 border border-black/10"
                        style={{ backgroundColor: preset.accent }}
                      />
                      <span>{preset.name}</span>
                    </span>
                    {active && <Check className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Theme Mode */}
          <div className="space-y-2.5 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">Chế độ Giao diện</div>
            <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => onChangeBranding({ ...branding, themeMode: 'light' })}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                  branding.themeMode === 'light'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Sáng (Academic Paper)</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeBranding({ ...branding, themeMode: 'dark' })}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                  branding.themeMode === 'dark'
                    ? 'bg-slate-800 text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Tối (Focus Slate)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Live Config Preview */}
        <div className="lg:col-span-5 space-y-5">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Xem trước Diện mạo Thanh điều hướng
            </div>
            <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {branding.logoDataUrl ? (
                  <img
                    src={branding.logoDataUrl}
                    alt="Xem trước logo"
                    referrerPolicy="no-referrer"
                    className="w-6 h-6 object-contain rounded-sm shrink-0"
                  />
                ) : (
                  <BookMarked className="w-5 h-5 hub-accent-text shrink-0" />
                )}
                <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                  {branding.appName || 'AcademiHub'}
                </span>
              </div>
              <span className="px-3 py-1 rounded-md text-[11px] font-semibold hub-accent-bg whitespace-nowrap shrink-0">
                Thêm học liệu
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {branding.institutionName}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Cấu hình tập trung (<code className="font-mono">config/branding.json</code>)
            </div>
            <pre className="p-3.5 rounded-lg bg-slate-950 text-slate-200 font-mono text-[11px] leading-relaxed overflow-x-auto">
              {configPreviewJson}
            </pre>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Tệp cấu hình này được tự động đóng gói khi bạn xuất bản sao lưu di động (.zip) để giữ nguyên bản sắc thương hiệu trên mọi máy trạm.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
