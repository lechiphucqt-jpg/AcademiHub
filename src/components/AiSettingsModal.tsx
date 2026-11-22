import React, { useEffect, useState } from 'react';
import {
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  Key,
  KeyRound,
  ShieldAlert,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';

interface AiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (apiKey: string, model: string) => void;
}

export const AI_MODELS = [
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash (Khuyến nghị)',
    badge: 'Mặc định',
    description: 'Phản hồi siêu tốc, tạo mã HTML5 tương tác và câu hỏi trắc nghiệm mượt mà.',
    tag: 'Tốc độ cao • Tiết kiệm quota',
    color: 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 text-blue-600',
  },
  {
    id: 'gemini-3-pro-preview',
    name: 'Gemini 3 Pro',
    badge: 'Chuyên gia',
    description: 'Tư duy sư phạm chuyên sâu, lập luận phức tạp và giải thích học thuật đa chiều.',
    tag: 'Suy luận cao cấp',
    color: 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/20 text-purple-600',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    badge: 'Dự phòng',
    description: 'Mô hình ổn định cao, đảm bảo hoạt động liên tục khi các model khác bị quá tải.',
    tag: 'Độ ổn định tối đa',
    color: 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-600',
  },
];

export const STORAGE_KEY_API_KEY = 'user_gemini_api_key';
export const STORAGE_KEY_MODEL = 'user_gemini_model';

export function getSavedApiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STORAGE_KEY_API_KEY) || '';
}

export function getSavedModel(): string {
  if (typeof window === 'undefined') return 'gemini-3-flash-preview';
  return localStorage.getItem(STORAGE_KEY_MODEL) || 'gemini-3-flash-preview';
}

export default function AiSettingsModal({ isOpen, onClose, onSaved }: AiSettingsModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-3-flash-preview');
  const [showKey, setShowKey] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setApiKey(getSavedApiKey());
      setSelectedModel(getSavedModel());
      setErrorMsg('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = apiKey.trim();
    if (!cleanKey) {
      setErrorMsg('Vui lòng nhập API key từ Google AI Studio để tiếp tục.');
      return;
    }
    localStorage.setItem(STORAGE_KEY_API_KEY, cleanKey);
    localStorage.setItem(STORAGE_KEY_MODEL, selectedModel);
    onSaved(cleanKey, selectedModel);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-6 pb-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Thiết Lập Model &amp; API Key
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Lưu trực tiếp trên trình duyệt (Local-First), bảo mật tuyệt đối
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSave} className="p-6 flex flex-col gap-5">
          {/* API Key Input */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <span>Google Gemini API Key</span>
                <span className="text-red-500">*</span>
              </label>
              <a
                href="https://aistudio.google.com/api-keys"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <span>Lấy API key tại đây</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                placeholder="AIzaSy..."
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                className="w-full text-xs pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {errorMsg && (
              <p className="text-xs text-red-500 flex items-center gap-1 mt-0.5">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                {errorMsg}
              </p>
            )}
          </div>

          {/* Model Selection Cards */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Chọn Model AI Vận Hành (Thẻ Models)
            </label>

            <div className="flex flex-col gap-2.5">
              {AI_MODELS.map((model) => {
                const isSelected = selectedModel === model.id;
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => setSelectedModel(model.id)}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start justify-between gap-3 ${
                      isSelected
                        ? `${model.color} shadow-xs`
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {model.name}
                        </span>
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {model.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        {model.description}
                      </p>
                      <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                        {model.tag}
                      </span>
                    </div>

                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Lưu &amp; Áp dụng</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
