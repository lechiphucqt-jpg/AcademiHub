/**
 * Cambridge Audio Synthesizer & Speech Engine
 * Tự động chuyển đổi kịch bản nghe và câu hỏi của đề thi Cambridge thành âm thanh bản xứ
 * Hỗ trợ phát trực tiếp trên trình duyệt, tùy chỉnh tốc độ, chuyển giọng nhiều nhân vật (Multi-speaker)
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
    // Check for "Speaker: Dialogue" pattern (e.g. "Narrator: ...", "Boy: ...", "Woman: ...")
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

  // 1. Try to find en-GB (British English) voice
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

  // 2. Try English voices in general (en-US, en-AU, en-CA)
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
 * Bắt đầu phát kịch bản nghe
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

    // Pitch variation based on speaker
    if (/woman|girl|mother|female/i.test(currentItem.speaker)) {
      utterance.pitch = 1.15;
    } else if (/man|boy|father|male/i.test(currentItem.speaker)) {
      utterance.pitch = 0.88;
    } else {
      utterance.pitch = 1.0;
    }

    utterance.onend = () => {
      currentLineIdx += 1;
      // Slight pause between dialogue lines (400ms)
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

  // Ensure voices are loaded
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
