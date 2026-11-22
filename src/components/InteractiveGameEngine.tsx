import React, { useEffect, useRef, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Dices,
  Flame,
  HelpCircle,
  Play,
  RotateCcw,
  Sparkles,
  Timer,
  Trophy,
  Volume2,
  VolumeX,
  XCircle,
  Zap,
} from 'lucide-react';
import type { QuizQuestion } from '../types/academic';

interface InteractiveGameEngineProps {
  lessonTitle: string;
  questions?: QuizQuestion[];
  onNotify: (message: string, tone?: 'success' | 'error' | 'info') => void;
}

type GameMode = 'wheel' | 'speed' | 'memory';

const DEFAULT_SAMPLE_QUESTIONS: QuizQuestion[] = [
  {
    id: 'g-q1',
    question: 'Đơn vị đo cường độ dòng điện trong hệ SI là gì?',
    options: ['Ampe (A)', 'Vôn (V)', 'Ohm (Ω)', 'Oát (W)'],
    correctIndex: 0,
    explanation: 'Cường độ dòng điện được đo bằng Ampe (kí hiệu A).',
  },
  {
    id: 'g-q2',
    question: 'Bào quan nào được ví như "nhà máy năng lượng" của tế bào?',
    options: ['Ti thể (Mitochondria)', 'Ribosome', 'Lưới nội chất', 'Nhân tế bào'],
    correctIndex: 0,
    explanation: 'Ti thể là nơi diễn ra hô hấp tế bào và tổng hợp phần lớn ATP.',
  },
  {
    id: 'g-q3',
    question: 'Hiện tượng tán sắc ánh sáng lần đầu tiên được giải thích bởi ai?',
    options: ['Isaac Newton', 'Albert Einstein', 'Thomas Young', 'James Maxwell'],
    correctIndex: 0,
    explanation: 'Năm 1672, Isaac Newton dùng lăng kính chứng minh ánh sáng trắng gồm nhiều màu đơn sắc.',
  },
  {
    id: 'g-q4',
    question: 'Từ nào sau đây là tính từ chỉ tính cách tích cực trong tiếng Anh?',
    options: ['Persistent', 'Arrogant', 'Pessimistic', 'Clumsy'],
    correctIndex: 0,
    explanation: 'Persistent có nghĩa là kiên trì, bền bỉ (tính cách tích cực).',
  },
];

export default function InteractiveGameEngine({
  lessonTitle,
  questions = [],
  onNotify,
}: InteractiveGameEngineProps) {
  const activeQuestions = questions.length > 0 ? questions : DEFAULT_SAMPLE_QUESTIONS;
  const [mode, setMode] = useState<GameMode>('wheel');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Wheel state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<QuizQuestion | null>(null);
  const [wheelAngle, setWheelAngle] = useState(0);

  // Speed Quiz state
  const [speedIndex, setSpeedIndex] = useState(0);
  const [speedScore, setSpeedScore] = useState(0);
  const [speedStreak, setSpeedStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [speedGameOver, setSpeedGameOver] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  // Memory match state
  interface CardItem {
    id: string;
    text: string;
    matchId: string;
    isFlipped: boolean;
    isMatched: boolean;
  }
  const [cards, setCards] = useState<CardItem[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matchedPairs, setMatchedPairs] = useState(0);

  // Initialize Wheel Canvas
  useEffect(() => {
    if (mode !== 'wheel') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 16;
    const count = activeQuestions.length;
    const arc = (2 * Math.PI) / count;

    ctx.clearRect(0, 0, width, height);

    const colors = [
      '#3B82F6',
      '#10B981',
      '#F59E0B',
      '#EF4444',
      '#8B5CF6',
      '#EC4899',
      '#06B6D4',
      '#84CC16',
    ];

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(wheelAngle);

    for (let i = 0; i < count; i++) {
      const angle = i * arc;
      ctx.beginPath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, angle, angle + arc);
      ctx.lineTo(0, 0);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Text label
      ctx.save();
      ctx.rotate(angle + arc / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px system-ui, sans-serif';
      const label = `Câu ${i + 1}`;
      ctx.fillText(label, radius - 20, 5);
      ctx.restore();
    }

    // Center pin
    ctx.restore();
    ctx.beginPath();
    ctx.arc(centerX, centerY, 24, 0, 2 * Math.PI);
    ctx.fillStyle = '#0F172A';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Arrow pointer at top
    ctx.beginPath();
    ctx.moveTo(centerX - 14, 2);
    ctx.lineTo(centerX + 14, 2);
    ctx.lineTo(centerX, 28);
    ctx.closePath();
    ctx.fillStyle = '#DC2626';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [mode, wheelAngle, activeQuestions]);

  // Spin Wheel function
  const handleSpinWheel = () => {
    if (spinning) return;
    setSpinning(true);
    setSelectedQuestion(null);

    const spinRotations = 5 + Math.random() * 5;
    const finalAngle = wheelAngle + spinRotations * 2 * Math.PI;
    const duration = 3500;
    const start = performance.now();
    const initialAngle = wheelAngle;

    const animate = (time: number) => {
      const elapsed = time - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = initialAngle + (finalAngle - initialAngle) * ease;
      setWheelAngle(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setSpinning(false);
        const normalized = (current % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
        const count = activeQuestions.length;
        const arc = (2 * Math.PI) / count;
        // Pointer is at -PI/2 (top)
        const pointerAngle = (3 * Math.PI) / 2;
        const relativeAngle = (pointerAngle - normalized + 2 * Math.PI) % (2 * Math.PI);
        const index = Math.floor(relativeAngle / arc);
        const q = activeQuestions[index] || activeQuestions[0];
        setSelectedQuestion(q);
        onNotify(`Đã quay vào Câu ${index + 1}!`, 'success');
      }
    };
    requestAnimationFrame(animate);
  };

  // Speed Quiz timer
  useEffect(() => {
    if (mode !== 'speed' || speedGameOver) return;
    if (timeLeft <= 0) {
      handleSpeedTimeout();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [mode, timeLeft, speedGameOver]);

  const handleSpeedTimeout = () => {
    setSpeedStreak(0);
    if (speedIndex < activeQuestions.length - 1) {
      setSpeedIndex((prev) => prev + 1);
      setTimeLeft(15);
      setSelectedOption(null);
    } else {
      setSpeedGameOver(true);
    }
  };

  const handleSpeedAnswer = (optionIdx: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(optionIdx);
    const curr = activeQuestions[speedIndex];
    const isCorrect = optionIdx === curr.correctIndex;

    if (isCorrect) {
      const bonus = timeLeft * 10;
      const streakBonus = speedStreak * 50;
      setSpeedScore((prev) => prev + 100 + bonus + streakBonus);
      setSpeedStreak((prev) => prev + 1);
    } else {
      setSpeedStreak(0);
    }

    setTimeout(() => {
      if (speedIndex < activeQuestions.length - 1) {
        setSpeedIndex((prev) => prev + 1);
        setTimeLeft(15);
        setSelectedOption(null);
      } else {
        setSpeedGameOver(true);
      }
    }, 1200);
  };

  const restartSpeedQuiz = () => {
    setSpeedIndex(0);
    setSpeedScore(0);
    setSpeedStreak(0);
    setTimeLeft(15);
    setSpeedGameOver(false);
    setSelectedOption(null);
  };

  // Memory Game Initialization
  const initMemoryGame = () => {
    const subset = activeQuestions.slice(0, 4);
    const deck: CardItem[] = [];
    subset.forEach((q, idx) => {
      deck.push({
        id: `card-${idx}-q`,
        text: q.question.slice(0, 60),
        matchId: `pair-${idx}`,
        isFlipped: false,
        isMatched: false,
      });
      deck.push({
        id: `card-${idx}-a`,
        text: q.options[q.correctIndex].slice(0, 60),
        matchId: `pair-${idx}`,
        isFlipped: false,
        isMatched: false,
      });
    });
    // Shuffle
    deck.sort(() => Math.random() - 0.5);
    setCards(deck);
    setFlippedCards([]);
    setMoves(0);
    setMatchedPairs(0);
  };

  useEffect(() => {
    if (mode === 'memory') {
      initMemoryGame();
    }
  }, [mode]);

  const handleCardClick = (idx: number) => {
    if (cards[idx].isFlipped || cards[idx].isMatched || flippedCards.length >= 2) return;

    const nextCards = [...cards];
    nextCards[idx].isFlipped = true;
    setCards(nextCards);

    const nextFlipped = [...flippedCards, idx];
    setFlippedCards(nextFlipped);

    if (nextFlipped.length === 2) {
      setMoves((m) => m + 1);
      const [first, second] = nextFlipped;
      if (cards[first].matchId === cards[second].matchId) {
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c, i) => (i === first || i === second ? { ...c, isMatched: true } : c))
          );
          setFlippedCards([]);
          setMatchedPairs((p) => p + 1);
        }, 500);
      } else {
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c, i) => (i === first || i === second ? { ...c, isFlipped: false } : c))
          );
          setFlippedCards([]);
        }, 1000);
      }
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col gap-6">
      {/* Top Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Động cơ Minigames Giáo Dục
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Trò chơi tương tác ôn tập cho bài: <span className="font-semibold">{lessonTitle}</span>
          </p>
        </div>

        {/* Modes */}
        <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
          <button
            type="button"
            onClick={() => setMode('wheel')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              mode === 'wheel'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Dices className="w-3.5 h-3.5" />
            Vòng quay
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('speed');
              restartSpeedQuiz();
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              mode === 'speed'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Đua tốc độ
          </button>
          <button
            type="button"
            onClick={() => setMode('memory')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              mode === 'memory'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            Lật thẻ nhớ
          </button>
        </div>
      </div>

      {/* GAME MODE 1: WHEEL OF FORTUNE */}
      {mode === 'wheel' && (
        <div className="flex flex-col lg:flex-row items-center justify-center gap-8 py-4">
          <div className="relative flex flex-col items-center">
            <canvas
              ref={canvasRef}
              width={380}
              height={380}
              className="rounded-full shadow-lg border-4 border-slate-100 dark:border-slate-800"
            />
            <button
              type="button"
              disabled={spinning}
              onClick={handleSpinWheel}
              className={`mt-6 px-6 py-2.5 rounded-xl font-bold text-sm tracking-wide text-white shadow-md transition-all cursor-pointer flex items-center gap-2 ${
                spinning
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:scale-105 active:scale-95'
              }`}
            >
              <Play className="w-4 h-4 fill-current" />
              {spinning ? 'Đang quay...' : 'QUAY NGẪU NHIÊN'}
            </button>
          </div>

          {/* Selected Question Card */}
          <div className="flex-1 w-full max-w-md bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 min-h-[300px] flex flex-col justify-center">
            {selectedQuestion ? (
              <div className="flex flex-col gap-4 animate-in fade-in duration-300">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                    Câu hỏi may mắn
                  </span>
                </div>
                <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {selectedQuestion.question}
                </h4>
                <div className="grid grid-cols-1 gap-2 pt-2">
                  {selectedQuestion.options.map((opt, oIdx) => (
                    <div
                      key={oIdx}
                      className="p-3 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-2"
                    >
                      <span className="font-bold text-slate-400">
                        {String.fromCharCode(65 + oIdx)}.
                      </span>
                      <span>{opt}</span>
                    </div>
                  ))}
                </div>
                <details className="text-xs text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer">
                  <summary className="font-semibold text-blue-600 dark:text-blue-400">
                    Xem đáp án &amp; giải thích
                  </summary>
                  <p className="mt-2 text-slate-700 dark:text-slate-300">
                    <strong>Đáp án đúng:</strong>{' '}
                    {selectedQuestion.options[selectedQuestion.correctIndex]}
                    <br />
                    {selectedQuestion.explanation}
                  </p>
                </details>
              </div>
            ) : (
              <div className="text-center text-slate-400 dark:text-slate-500 py-10 flex flex-col items-center gap-2">
                <Dices className="w-10 h-10 stroke-1" />
                <p className="text-sm font-medium">Bấm "QUAY NGẪU NHIÊN" để gọi tên câu hỏi ôn tập!</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* GAME MODE 2: SPEED QUIZ */}
      {mode === 'speed' && (
        <div className="max-w-xl mx-auto w-full flex flex-col gap-5 py-2">
          {!speedGameOver ? (
            <>
              {/* Status Bar */}
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Timer className="w-4 h-4 text-amber-500" />
                  Thời gian: <span className="text-sm font-bold text-amber-600">{timeLeft}s</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-orange-500" />
                  Chuỗi đúng: <span className="text-sm font-bold text-orange-600">{speedStreak}x</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-emerald-500" />
                  Điểm: <span className="text-sm font-bold text-emerald-600">{speedScore}</span>
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full transition-all duration-1000 ease-linear"
                  style={{ width: `${(timeLeft / 15) * 100}%` }}
                />
              </div>

              {/* Question Card */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  Câu {speedIndex + 1} / {activeQuestions.length}
                </span>
                <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1 mb-4">
                  {activeQuestions[speedIndex].question}
                </h4>

                <div className="grid grid-cols-1 gap-2.5">
                  {activeQuestions[speedIndex].options.map((opt, oIdx) => {
                    const isSelected = selectedOption === oIdx;
                    const isCorrect = oIdx === activeQuestions[speedIndex].correctIndex;
                    let btnStyle =
                      'bg-white dark:bg-slate-800 hover:border-blue-400 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200';

                    if (selectedOption !== null) {
                      if (isCorrect) {
                        btnStyle = 'bg-emerald-50 border-emerald-500 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
                      } else if (isSelected) {
                        btnStyle = 'bg-red-50 border-red-500 text-red-800 dark:bg-red-950/60 dark:text-red-300';
                      }
                    }

                    return (
                      <button
                        key={oIdx}
                        disabled={selectedOption !== null}
                        type="button"
                        onClick={() => handleSpeedAnswer(oIdx)}
                        className={`w-full p-3.5 text-left text-xs font-medium rounded-xl border transition-all cursor-pointer flex items-center justify-between ${btnStyle}`}
                      >
                        <span>{opt}</span>
                        {selectedOption !== null && isCorrect && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        )}
                        {selectedOption !== null && isSelected && !isCorrect && (
                          <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            /* Game Over Screen */
            <div className="text-center bg-slate-50 dark:bg-slate-800/60 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center gap-4 animate-in zoom-in-95">
              <Trophy className="w-14 h-14 text-amber-500 animate-bounce" />
              <h4 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Hoàn thành thử thách tốc độ!
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Tổng điểm đạt được: <span className="text-2xl font-black text-blue-600">{speedScore}</span>
              </p>
              <button
                type="button"
                onClick={restartSpeedQuiz}
                className="mt-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Chơi lại
              </button>
            </div>
          )}
        </div>
      )}

      {/* GAME MODE 3: MEMORY MATCH */}
      {mode === 'memory' && (
        <div className="max-w-2xl mx-auto w-full flex flex-col gap-4 py-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
            <span>Số lượt lật: <strong className="text-blue-600">{moves}</strong></span>
            <span>Đã ghép đúng: <strong className="text-emerald-600">{matchedPairs} / 4</strong> cặp</span>
            <button
              type="button"
              onClick={initMemoryGame}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Xáo lại
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {cards.map((card, cIdx) => (
              <button
                key={card.id}
                type="button"
                disabled={card.isFlipped || card.isMatched}
                onClick={() => handleCardClick(cIdx)}
                className={`h-28 p-3 rounded-xl border text-xs font-medium text-center transition-all transform duration-300 flex items-center justify-center cursor-pointer select-none ${
                  card.isMatched
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 text-emerald-800 dark:text-emerald-300 opacity-80'
                    : card.isFlipped
                    ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-400 text-blue-900 dark:text-blue-200 shadow-md'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-transparent hover:scale-102 hover:border-blue-400'
                }`}
              >
                {card.isFlipped || card.isMatched ? (
                  <span className="line-clamp-4">{card.text}</span>
                ) : (
                  <HelpCircle className="w-6 h-6 text-slate-400" />
                )}
              </button>
            ))}
          </div>

          {matchedPairs === 4 && (
            <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-300 text-emerald-800 dark:text-emerald-300 text-xs font-bold animate-in fade-in">
              🎉 Chúc mừng! Bạn đã ghép thành công tất cả các cặp kiến thức trong {moves} lượt lật!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
