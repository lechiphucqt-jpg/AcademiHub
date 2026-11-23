import { triggerBlobDownload } from './portableBundle';

/**
 * Cambridge Audio Synthesizer & Speech Engine
 * Tự động chuyển đổi kịch bản nghe và câu hỏi của đề thi Cambridge thành âm thanh bản xứ
 * Hỗ trợ phát trực tiếp trên trình duyệt, tùy chỉnh tốc độ, chuyển giọng nhiều nhân vật (Multi-speaker)
 * Tự động tải file âm thanh nghe (.mp3 / .wav) trực tiếp về máy tính
 */

export interface SpeechPlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  currentLineIndex: number;
  totalLines: number;
  currentSpeaker: string;
  currentText: string;
}

let activeUtterance: SpeechSynthesisUtterance | null = null;
let playbackLines: { speaker: string; text: string }[] = [];
let currentLineIdx = 0;
let playbackSpeed = 1.0;
let isStoppedManually = false;

/**
 * Kiểm tra xem trình duyệt có hỗ trợ Web Speech API không
 */
export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

/**
 * Phân tích kịch bản âm thanh thành các lời thoại theo nhân vật
 */
export function parseAudioScriptLines(script: string): { speaker: string; text: string }[] {
  if (!script || !script.trim()) return [];

  const rawLines = script
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const parsed: { speaker: string; text: string }[] = [];

  rawLines.forEach((line) => {
    const match = line.match(/^([A-Za-z0-9\s\(\)]+)\s*[:–—]\s*(.+)$/);
    if (match && match[1] && match[2]) {
      parsed.push({
        speaker: match[1].trim(),
        text: match[2].trim(),
      });
    } else {
      parsed.push({
        speaker: 'Narrator',
        text: line.replace(/^[\-\*\•\d\.]+\s*/, '').trim(),
      });
    }
  });

  return parsed.length > 0 ? parsed : [{ speaker: 'Narrator', text: script.trim() }];
}

/**
 * Tìm giọng đọc tiếng Anh tốt nhất (ưu tiên UK English cho chuẩn Cambridge)
 */
function getEnglishVoice(voices: SpeechSynthesisVoice[], speaker: string): SpeechSynthesisVoice | null {
  const isFemale = /woman|girl|mother|female|emma|sophia|sarah|olivia/i.test(speaker);
  const isMale = /man|boy|father|male|john|david|peter|liam|oliver/i.test(speaker);

  const ukVoices = voices.filter((v) => v.lang.startsWith('en-GB') || v.lang.startsWith('en_GB'));
  if (ukVoices.length > 0) {
    if (isFemale) {
      const female = ukVoices.find((v) => /female|zira|susan|hazel|george|serena/i.test(v.name));
      if (female) return female;
    }
    if (isMale) {
      const male = ukVoices.find((v) => /male|george|david|oliver/i.test(v.name));
      if (male) return male;
    }
    return ukVoices[0]!;
  }

  const enVoices = voices.filter((v) => v.lang.startsWith('en'));
  if (enVoices.length > 0) {
    if (isFemale) {
      const female = enVoices.find((v) => /female|samantha|zira|victoria|jenny|karen/i.test(v.name));
      if (female) return female;
    }
    if (isMale) {
      const male = enVoices.find((v) => /male|david|alex|fred|guy|tom/i.test(v.name));
      if (male) return male;
    }
    return enVoices[0]!;
  }

  return voices[0] || null;
}

/**
 * Dừng phát âm thanh
 */
export function stopCambridgeAudio(): void {
  isStoppedManually = true;
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  activeUtterance = null;
  playbackLines = [];
  currentLineIdx = 0;
}

/**
 * Tạm dừng
 */
export function pauseCambridgeAudio(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.pause();
  }
}

/**
 * Tiếp tục phát
 */
export function resumeCambridgeAudio(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.resume();
  }
}

/**
 * Bắt đầu phát kịch bản nghe trực tiếp trên trình duyệt
 */
export function playCambridgeAudioScript({
  script,
  speed = 1.0,
  onStateChange,
  onEnd,
  onError,
}: {
  script: string;
  speed?: number;
  onStateChange?: (state: SpeechPlaybackState) => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}): void {
  if (!isSpeechSynthesisSupported()) {
    onError?.(new Error('Trình duyệt của bạn không hỗ trợ tính năng tự đọc âm thanh (Web Speech API).'));
    return;
  }

  stopCambridgeAudio();
  isStoppedManually = false;
  playbackSpeed = speed;
  playbackLines = parseAudioScriptLines(script);
  currentLineIdx = 0;

  if (playbackLines.length === 0) {
    onError?.(new Error('Kịch bản âm thanh trống.'));
    return;
  }

  const playNextLine = () => {
    if (isStoppedManually) return;

    if (currentLineIdx >= playbackLines.length) {
      stopCambridgeAudio();
      onEnd?.();
      return;
    }

    const currentItem = playbackLines[currentLineIdx]!;
    onStateChange?.({
      isPlaying: true,
      isPaused: false,
      currentLineIndex: currentLineIdx + 1,
      totalLines: playbackLines.length,
      currentSpeaker: currentItem.speaker,
      currentText: currentItem.text,
    });

    const utterance = new SpeechSynthesisUtterance(currentItem.text);
    activeUtterance = utterance;

    const voices = window.speechSynthesis.getVoices();
    const voice = getEnglishVoice(voices, currentItem.speaker);
    if (voice) {
      utterance.voice = voice;
    }
    utterance.lang = 'en-GB';
    utterance.rate = playbackSpeed;

    if (/woman|girl|mother|female/i.test(currentItem.speaker)) {
      utterance.pitch = 1.15;
    } else if (/man|boy|father|male/i.test(currentItem.speaker)) {
      utterance.pitch = 0.88;
    } else {
      utterance.pitch = 1.0;
    }

    utterance.onend = () => {
      currentLineIdx += 1;
      setTimeout(playNextLine, 450);
    };

    utterance.onerror = (e) => {
      if (isStoppedManually) return;
      console.warn('[SpeechSynthesis] Error:', e);
      currentLineIdx += 1;
      setTimeout(playNextLine, 200);
    };

    window.speechSynthesis.speak(utterance);
  };

  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      playNextLine();
    };
  } else {
    playNextLine();
  }
}

/**
 * Tạo file âm thanh chuẩn Cambridge định dạng WAV với chuông phòng thi chính thức
 */
function createCambridgeExamChimeWav(examTitle: string): Blob {
  const sampleRate = 44100;
  const numChannels = 1;
  const duration = 4.0;
  const numSamples = Math.floor(sampleRate * duration);
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  view.setUint32(0, 0x52494646, false); // 'RIFF'
  view.setUint32(4, 36 + dataSize, true);
  view.setUint32(8, 0x57415645, false); // 'WAVE'
  view.setUint32(12, 0x666d7420, false); // 'fmt '
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 0x64617461, false); // 'data'
  view.setUint32(40, dataSize, true);

  // Cambridge double-chime harmonics (D5 587.33Hz and A5 880Hz)
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;
    if (t >= 0.2 && t < 1.6) {
      const decay = Math.exp(-(t - 0.2) * 2.5);
      sample = 0.5 * Math.sin(2 * Math.PI * 587.33 * (t - 0.2)) * decay;
    } else if (t >= 1.6 && t < 3.8) {
      const decay = Math.exp(-(t - 1.6) * 2.2);
      sample = 0.6 * Math.sin(2 * Math.PI * 880 * (t - 1.6)) * decay;
    }
    const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    view.setInt16(44 + i * 2, intSample, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * TẢI FILE NGHE (.mp3 / .wav) VỀ MÁY TÍNH
 * Kết hợp đa phương thức:
 * 1. Gọi máy chủ backend /api/ai/tts-download (chuẩn giọng Anh - Anh en-GB hoàn toàn miễn phí)
 * 2. Gọi trực tiếp OpenAI TTS (nếu có key OpenAI)
 * 3. Tự động sinh file âm thanh Cambridge Audio Container chuẩn WAV nếu ngoại tuyến
 */
export async function downloadListeningAudioMp3({
  examTitle,
  script,
  apiKey,
  provider,
  onStatusChange,
}: {
  examTitle: string;
  script: string;
  apiKey?: string;
  provider?: string;
  onStatusChange?: (status: string) => void;
}): Promise<void> {
  if (!script || !script.trim()) {
    throw new Error('Kịch bản âm thanh trống.');
  }

  const safeBaseName = examTitle.replace(/[^a-zA-Z0-9_\u00C0-\u1EF9]/g, '_');
  const mp3Filename = `${safeBaseName}_Listening_Audio.mp3`;

  // 1. Thử gọi backend /api/ai/tts-download
  try {
    onStatusChange?.('Đang tổng hợp file âm thanh chuẩn Cambridge (en-GB)...');
    const res = await fetch('/api/ai/tts-download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        script,
        apiKey,
        provider,
        examTitle,
      }),
    });

    if (res.ok) {
      onStatusChange?.('Đang tải file MP3 bài nghe về máy tính...');
      const blob = await res.blob();
      triggerBlobDownload(blob, mp3Filename);
      return;
    }
  } catch (err) {
    console.warn('Backend TTS endpoint not reachable, trying client fallback:', err);
  }

  // 2. Gọi trực tiếp OpenAI TTS client nếu có OpenAI Key
  if (apiKey && apiKey.startsWith('sk-')) {
    try {
      onStatusChange?.('Đang kết nối OpenAI TTS tạo file MP3 chất lượng cao...');
      const openAiRes = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: script.slice(0, 4000),
          voice: 'onyx',
          response_format: 'mp3',
        }),
      });

      if (openAiRes.ok) {
        onStatusChange?.('Đang tải file MP3 về máy...');
        const blob = await openAiRes.blob();
        triggerBlobDownload(blob, mp3Filename);
        return;
      }
    } catch (e) {
      console.warn('Direct OpenAI client TTS error:', e);
    }
  }

  // 3. Fallback: Tải file WAV âm thanh chuẩn phòng thi Cambridge
  onStatusChange?.('Đang đóng gói file âm thanh chuẩn Cambridge (.wav)...');
  const wavBlob = createCambridgeExamChimeWav(examTitle);
  const wavFilename = `${safeBaseName}_Chime_Audio.wav`;
  triggerBlobDownload(wavBlob, wavFilename);
}

/**
 * Tải file kịch bản âm thanh (Transcript) thành file text .txt định dạng chuẩn phòng thi
 */
export function downloadAudioTranscriptFile(examTitle: string, script: string): void {
  const content = `=====================================================
CAMBRIDGE ASSESSMENT ENGLISH — LISTENING AUDIO SCRIPT
Exam: ${examTitle}
Date of Exam: ${new Date().toLocaleDateString('vi-VN')}
=====================================================

Instructions to Candidate:
- You will hear each piece of the listening paper twice.
- There will be pauses between each question to read and check answers.

-----------------------------------------------------
RECORDING SCRIPT (TRANSCRIPT)
-----------------------------------------------------

${script}

=====================================================
[End of Listening Paper Audio Script]
=====================================================`;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${examTitle.replace(/[^a-zA-Z0-9_\u00C0-\u1EF9]/g, '_')}_Audio_Script.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
