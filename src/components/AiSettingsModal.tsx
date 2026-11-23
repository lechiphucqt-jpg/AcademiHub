import React, { useEffect, useState } from 'react';
import {
  Bot,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  ShieldAlert,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';

interface AiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (apiKey: string, model: string, provider?: 'gemini' | 'openai') => void;
}

export const GEMINI_MODELS = [
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash (Khuyến nghị)',
    badge: 'Mặc định',
    description: 'Phản hồi siêu tốc, tạo mã HTML5 và đề thi Cambridge 4 kỹ năng cực kỳ chuẩn xác.',
    tag: 'Tốc độ cao • Ổn định nhất',
    color: 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 text-blue-600',
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    badge: 'Thế hệ mới',
    description: 'Tối ưu cho đa phương thức, tạo ngữ cảnh thi và kịch bản nghe đa dạng.',
    tag: 'Thế hệ mới nhất',
    color: 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-600',
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    badge: 'Chuyên gia',
    description: 'Tư duy sư phạm chuyên sâu, ngữ pháp Cambridge phức tạp và bài đọc dài.',
    tag: 'Suy luận cao cấp',
    color: 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/20 text-purple-600',
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    badge: 'Tiết kiệm',
    description: 'Hoạt động nhanh, tiết kiệm quota API tối đa cho việc luyện thi số lượng lớn.',
    tag: 'Tiết kiệm quota',
    color: 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-600',
  },
];

export const OPENAI_MODELS = [
  {
    id: 'gpt-4o-mini',
    name: 'ChatGPT 4o-Mini (Khuyến nghị)',
    badge: 'Phổ biến nhất',
    description: 'Rất thông minh, chi phí cực thấp, tạo đề thi Cambridge phong phú và không bao giờ trùng lặp.',
    tag: 'Cực nhanh • Tiết kiệm 90% chi phí',
    color: 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-600',
  },
  {
    id: 'gpt-4o',
    name: 'ChatGPT 4o (Omni)',
    badge: 'Flagship',
    description: 'Khả năng tiếng Anh bản xứ xuất sắc, viết bài đọc, kịch bản nghe và tiêu chí chấm điểm tuyệt đối chuẩn xác.',
    tag: 'Chất lượng cao nhất',
    color: 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/20 text-teal-600',
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    badge: 'Kinh điển',
    description: 'Mô hình kinh điển ổn định của OpenAI dành cho các tác vụ trắc nghiệm cơ bản.',
    tag: 'Tương thích cao',
    color: 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 text-amber-600',
  },
];

export const AI_MODELS = GEMINI_MODELS;

export const STORAGE_KEY_API_KEY = 'user_gemini_api_key';
export const STORAGE_KEY_MODEL = 'user_gemini_model';
export const STORAGE_KEY_OPENAI_KEY = 'user_openai_api_key';
export const STORAGE_KEY_OPENAI_MODEL = 'user_openai_model';
export const STORAGE_KEY_PROVIDER = 'user_ai_provider';

export function getSavedApiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STORAGE_KEY_API_KEY) || '';
}

export function getSavedModel(): string {
  if (typeof window === 'undefined') return 'gemini-2.5-flash';
  return localStorage.getItem(STORAGE_KEY_MODEL) || 'gemini-2.5-flash';
}

export function getSavedOpenAiApiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STORAGE_KEY_OPENAI_KEY) || '';
}

export function getSavedOpenAiModel(): string {
  if (typeof window === 'undefined') return 'gpt-4o-mini';
  return localStorage.getItem(STORAGE_KEY_OPENAI_MODEL) || 'gpt-4o-mini';
}

export function getSavedAiProvider(): 'gemini' | 'openai' {
  if (typeof window === 'undefined') return 'gemini';
  const p = localStorage.getItem(STORAGE_KEY_PROVIDER);
  return p === 'openai' ? 'openai' : 'gemini';
}

export default function AiSettingsModal({ isOpen, onClose, onSaved }: AiSettingsModalProps) {
  const [provider, setProvider] = useState<'gemini' | 'openai'>('gemini');
  const [geminiKey, setGeminiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-2.5-flash');
  const [openaiKey, setOpenaiKey] = useState('');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini');
  const [showKey, setShowKey] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setProvider(getSavedAiProvider());
      setGeminiKey(getSavedApiKey());
      setGeminiModel(getSavedModel());
      setOpenaiKey(getSavedOpenAiApiKey());
      setOpenaiModel(getSavedOpenAiModel());
      setErrorMsg('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (provider === 'gemini') {
      const cleanKey = geminiKey.trim();
      if (!cleanKey) {
        setErrorMsg('Vui lòng nhập API key từ Google AI Studio để tiếp tục.');
        return;
      }
      localStorage.setItem(STORAGE_KEY_PROVIDER, 'gemini');
      localStorage.setItem(STORAGE_KEY_API_KEY, cleanKey);
      localStorage.setItem(STORAGE_KEY_MODEL, geminiModel);
      onSaved(cleanKey, geminiModel, 'gemini');
    } else {
      const cleanKey = openaiKey.trim();
      if (!cleanKey) {
        setErrorMsg('Vui lòng nhập API key từ OpenAI (ChatGPT) để tiếp tục.');
        return;
      }
      localStorage.setItem(STORAGE_KEY_PROVIDER, 'openai');
      localStorage.setItem(STORAGE_KEY_OPENAI_KEY, cleanKey);
      localStorage.setItem(STORAGE_KEY_OPENAI_MODEL, openaiModel);
      onSaved(cleanKey, openaiModel, 'openai');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 pb-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Cài Đặt Công Cụ AI: ChatGPT &amp; Gemini
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Lưu trực tiếp trên máy tính (Local-First), bảo mật tuyệt đối
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

        {/* Provider Switcher Tabs */}
        <div className="px-6 pt-4 pb-1">
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setProvider('gemini');
                setErrorMsg('');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                provider === 'gemini'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Google Gemini</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setProvider('openai');
                setErrorMsg('');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                provider === 'openai'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>ChatGPT (OpenAI)</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSave} className="p-6 pt-3 flex flex-col gap-4 overflow-y-auto">
          {provider === 'gemini' ? (
            <>
              {/* Gemini API Key */}
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
                    <span>Lấy key miễn phí tại Google AI Studio</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    placeholder="AIzaSy..."
                    value={geminiKey}
                    onChange={(e) => {
                      setGeminiKey(e.target.value);
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
              </div>

              {/* Gemini Model Selection */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Chọn Model Gemini
                </label>
                <div className="flex flex-col gap-2">
                  {GEMINI_MODELS.map((model) => {
                    const isSelected = geminiModel === model.id;
                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => setGeminiModel(model.id)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start justify-between gap-3 ${
                          isSelected
                            ? `${model.color} shadow-xs`
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex flex-col gap-0.5">
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
            </>
          ) : (
            <>
              {/* OpenAI API Key */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <span>OpenAI (ChatGPT) API Key</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <span>Lấy key tại OpenAI Platform</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    placeholder="sk-proj-..."
                    value={openaiKey}
                    onChange={(e) => {
                      setOpenaiKey(e.target.value);
                      if (errorMsg) setErrorMsg('');
                    }}
                    className="w-full text-xs pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* OpenAI Model Selection */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Chọn Model ChatGPT (OpenAI)
                </label>
                <div className="flex flex-col gap-2">
                  {OPENAI_MODELS.map((model) => {
                    const isSelected = openaiModel === model.id;
                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => setOpenaiModel(model.id)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start justify-between gap-3 ${
                          isSelected
                            ? `${model.color} shadow-xs`
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex flex-col gap-0.5">
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
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                            isSelected
                              ? 'border-emerald-600 bg-emerald-600 text-white'
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
            </>
          )}

          {errorMsg && (
            <p className="text-xs text-red-500 flex items-center gap-1 mt-0.5">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              {errorMsg}
            </p>
          )}

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
              className={`px-5 py-2 text-xs font-bold rounded-xl text-white shadow-xs cursor-pointer flex items-center gap-1.5 ${
                provider === 'gemini'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
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
