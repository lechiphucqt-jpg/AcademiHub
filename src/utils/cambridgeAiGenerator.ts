import type { Book, Lesson, Unit } from '../types/academic';
import type {
  CambridgeExam,
  CambridgeGeneratorConfig,
  CambridgeLevel,
  CambridgePart,
  CambridgeQuestion,
} from '../types/cambridge';
import { getSavedApiKey, getSavedModel } from '../components/AiSettingsModal';

/**
 * Trích xuất ngữ cảnh học thuật và từ vựng từ các bài học được chọn
 */
export function extractLessonKnowledge(lessons: Lesson[]): {
  topics: string[];
  vocabularies: { word: string; meaning: string; context?: string }[];
  readingPassages: string[];
  sentences: string[];
  fullContextSummary: string;
} {
  const topics: string[] = [];
  const vocabularies: { word: string; meaning: string; context?: string }[] = [];
  const readingPassages: string[] = [];
  const sentences: string[] = [];

  lessons.forEach((lesson) => {
    topics.push(lesson.title);
    if (lesson.summary) readingPassages.push(lesson.summary);

    lesson.contents.forEach((c) => {
      // 1. From Markdown
      if (c.readingMarkdown) {
        const cleanMd = c.readingMarkdown.replace(/#+\s+/g, '').replace(/[*`_]/g, '');
        readingPassages.push(cleanMd.slice(0, 1500));
        const lines = cleanMd.split('\n').filter((l) => l.trim().length > 10);
        sentences.push(...lines.slice(0, 8));
      }

      // 2. From HTML5 content
      if (c.htmlContent) {
        // Strip scripts & styles
        const noScripts = c.htmlContent
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

        // Extract bold words, headers, and text
        const textOnly = noScripts.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (textOnly.length > 30) {
          readingPassages.push(textOnly.slice(0, 1200));
        }

        // Try extracting vocabulary pairs like "boyfriend ... bạn trai", "tall ... cao"
        const vocabMatches = [
          ...noScripts.matchAll(/([a-zA-Z\s\-]{3,20})[\s\:\–\—\-\/]+([a-zA-Z\u00C0-\u1EF9\s]{3,30})/g),
        ];
        vocabMatches.forEach((m) => {
          const w = m[1]?.trim();
          const mean = m[2]?.trim();
          if (w && mean && w.length < 25 && mean.length < 35 && !w.includes('<') && !mean.includes('<')) {
            vocabularies.push({ word: w, meaning: mean });
          }
        });
      }

      // 3. From pre-existing quiz questions
      if (c.quizQuestions) {
        c.quizQuestions.forEach((q) => {
          sentences.push(q.question);
          if (q.options[q.correctIndex]) {
            vocabularies.push({ word: q.options[q.correctIndex], meaning: q.explanation });
          }
        });
      }
    });
  });

  // Deduplicate vocab
  const uniqueVocab = Array.from(new Map(vocabularies.map((v) => [v.word.toLowerCase(), v])).values()).slice(
    0,
    30
  );

  const fullContextSummary = `
- Các chủ đề bài học: ${topics.join(', ')}
- Từ vựng trọng tâm ghi nhận: ${uniqueVocab.map((v) => `${v.word} (${v.meaning})`).join(', ') || 'Từ vựng tiếng Anh theo bài'}
- Mẫu câu & ngữ cảnh thực tế: ${sentences.slice(0, 6).join(' | ') || 'Các mẫu câu giao tiếp và ngữ pháp theo giáo trình.'}
- Bài đọc trích yếu: ${readingPassages.slice(0, 3).join('\n---\n')}
`.trim();

  return {
    topics,
    vocabularies: uniqueVocab,
    readingPassages: readingPassages.slice(0, 4),
    sentences: sentences.slice(0, 15),
    fullContextSummary,
  };
}

/**
 * Tên cấp độ và paper chuẩn Cambridge
 */
export function getCambridgeLevelDetails(level: CambridgeLevel): {
  qualificationName: string;
  badge: string;
  defaultTime: number;
  targetCefr: string;
} {
  switch (level) {
    case 'starters':
      return { qualificationName: 'Pre-A1 Starters (YLE)', badge: 'Starters', defaultTime: 20, targetCefr: 'Pre-A1' };
    case 'movers':
      return { qualificationName: 'A1 Movers (YLE)', badge: 'Movers', defaultTime: 30, targetCefr: 'A1' };
    case 'flyers':
      return { qualificationName: 'A2 Flyers (YLE)', badge: 'Flyers', defaultTime: 40, targetCefr: 'A2' };
    case 'ket_a2':
      return { qualificationName: 'A2 Key for Schools (KET)', badge: 'A2 Key', defaultTime: 45, targetCefr: 'A2' };
    case 'pet_b1':
      return { qualificationName: 'B1 Preliminary for Schools (PET)', badge: 'B1 Preliminary', defaultTime: 45, targetCefr: 'B1' };
    case 'fce_b2':
      return { qualificationName: 'B2 First for Schools (FCE)', badge: 'B2 First', defaultTime: 60, targetCefr: 'B2' };
    case 'gdpt_cambridge':
    default:
      return {
        qualificationName: 'Đề Đánh Giá Định Kỳ (Chuẩn Định Dạng Cambridge)',
        badge: 'Cambridge GDPT',
        defaultTime: 45,
        targetCefr: 'A1 - B1',
      };
  }
}

/**
 * Gọi Google Gemini API để tạo Đề thi Cambridge
 */
async function callGeminiForCambridgeExam(
  prompt: string,
  apiKey: string,
  model: string
): Promise<any> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model || 'gemini-3-flash-preview'
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
    },
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Gemini API returned status ${res.status}`);
  }

  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('Không nhận được nội dung từ Gemini.');

  return JSON.parse(rawText);
}

/**
 * Hàm sinh đề thi Cambridge thông minh bằng AI (hoặc bộ tạo mẫu sư phạm chuẩn nếu offline/chưa có key)
 */
export async function generateCambridgeExamWithAi({
  book,
  unit,
  lessons,
  config,
  institutionName,
}: {
  book: Book;
  unit: Unit;
  lessons: Lesson[];
  config: CambridgeGeneratorConfig;
  institutionName?: string;
}): Promise<CambridgeExam> {
  const knowledge = extractLessonKnowledge(lessons);
  const levelInfo = getCambridgeLevelDetails(config.level);

  const examCode = `CE/${levelInfo.badge.replace(/\s+/g, '')}/${Date.now().toString().slice(-4)}`;
  const paperTitle =
    config.examType === 'reading_and_use_of_english'
      ? 'Reading and Use of English'
      : config.examType === 'vocabulary_grammar_focus'
      ? 'Vocabulary and Grammar Mastery'
      : config.examType === 'reading_comprehension'
      ? 'Reading Comprehension'
      : 'Cloze Test and Sentence Completion';

  const userApiKey = getSavedApiKey();
  const userModel = getSavedModel();

  if (userApiKey && userApiKey.trim()) {
    try {
      const prompt = `
Bạn là Trưởng ban Khảo thí của Cambridge Assessment English (Item Writer & Assessment Specialist).
Hãy soạn một đề thi tiếng Anh CHUẨN ĐỊNH DẠNG CAMBRIDGE ASSESSMENT ENGLISH dựa trên ngữ cảnh bài học sau:

NGỮ CẢNH HỌC TẬP:
- Giáo trình: ${book.title} (Khối: ${book.gradeLevel || 'A1-A2'})
- Chương học: ${unit.title}
- Các bài học được chọn: ${knowledge.topics.join('; ')}
- Dữ liệu từ vựng & câu thực tế từ bài học:
${knowledge.fullContextSummary}

YÊU CẦU ĐỀ THI:
- Cấp độ bài thi: ${levelInfo.qualificationName} (Khung CEFR: ${levelInfo.targetCefr})
- Phân môn: ${paperTitle}
- Tổng số câu hỏi: ${config.questionCount} câu hỏi trắc nghiệm (mỗi câu 1 điểm).
- Chia thành các Part chuẩn Cambridge:
  + Part 1: Multiple choice short texts / notices / context questions (5 câu).
  + Part 2: Sentence gap-fill vocabulary & collocations in context (5 câu).
  + Part 3: Reading passage with multiple choice comprehension (5 câu).
  + Part 4: Cloze test / Grammar & Language focus (các câu còn lại đến đủ ${config.questionCount} câu).

YÊU CẦU ĐỊNH DẠNG JSON:
Trả về DUY NHẤT một đối tượng JSON hợp lệ theo cấu trúc sau, KHÔNG thêm bất kỳ giải thích ngoài:
{
  "title": "Tên bài thi",
  "parts": [
    {
      "partNumber": 1,
      "title": "Part 1",
      "instructions": "For each question, choose the correct answer.",
      "passage": "Đoạn văn ngắn nếu có, hoặc để trống",
      "questions": [
        {
          "question": "Nội dung câu hỏi...",
          "contextText": "Ngữ cảnh hoặc biển báo ngắn nếu có",
          "options": ["Lựa chọn A", "Lựa chọn B", "Lựa chọn C", "Lựa chọn D"],
          "correctIndex": 0,
          "explanation": "Giải thích chi tiết vì sao đáp án này đúng theo từ vựng/ngữ pháp của bài.",
          "focusArea": "Tên kỹ năng (VD: Vocabulary - Appearance & Personality / Grammar - Present Simple)"
        }
      ]
    }
  ]
}
`.trim();

      const aiResponse = await callGeminiForCambridgeExam(prompt, userApiKey, userModel);

      if (aiResponse && Array.isArray(aiResponse.parts) && aiResponse.parts.length > 0) {
        let questionCounter = 1;
        const allQuestions: CambridgeQuestion[] = [];

        const structuredParts: CambridgePart[] = aiResponse.parts.map((p: any, pIdx: number) => {
          const questions: CambridgeQuestion[] = (p.questions || []).map((q: any) => {
            const cambridgeQ: CambridgeQuestion = {
              id: `camb-q-${Date.now()}-${questionCounter}`,
              part: p.partNumber || pIdx + 1,
              partTitle: p.title || `Part ${pIdx + 1}`,
              instructions: p.instructions || 'Choose the best answer.',
              contextText: q.contextText || undefined,
              question: q.question,
              options: Array.isArray(q.options) && q.options.length >= 3 ? q.options.slice(0, 4) : ['A', 'B', 'C', 'D'],
              correctIndex: typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex < 4 ? q.correctIndex : 0,
              explanation: q.explanation || 'Đáp án chính xác theo tài liệu bài học.',
              focusArea: q.focusArea || 'Language Focus',
              mark: 1,
            };
            questionCounter += 1;
            allQuestions.push(cambridgeQ);
            return cambridgeQ;
          });

          return {
            partNumber: p.partNumber || pIdx + 1,
            title: p.title || `Part ${pIdx + 1}`,
            instructions: p.instructions || 'Choose the best answer.',
            passage: p.passage || undefined,
            questions,
          };
        });

        return {
          id: `cambridge-exam-${Date.now()}`,
          title: aiResponse.title || `${levelInfo.qualificationName} — ${paperTitle}`,
          qualificationName: levelInfo.qualificationName,
          levelBadge: levelInfo.badge,
          paperName: paperTitle,
          examCode,
          timeMinutes: config.questionCount <= 10 ? 15 : config.questionCount <= 20 ? 30 : levelInfo.defaultTime,
          totalMarks: allQuestions.length,
          bookTitle: book.title,
          unitTitle: unit.title,
          lessonTitles: knowledge.topics,
          parts: structuredParts,
          questions: allQuestions,
          instructionsToCandidates: [
            'Write your name, centre number and candidate number in the spaces at the top of this page.',
            'Answer all questions. Write your answers on the question paper.',
            'Read the instructions for each part carefully before answering.',
            'Dictionaries and electronic devices are NOT permitted.',
          ],
          informationForCandidates: [
            `There are ${allQuestions.length} questions on this question paper.`,
            'Each question carries one mark.',
            `The total score for this paper is ${allQuestions.length} marks.`,
          ],
          generatedAt: new Date().toLocaleDateString('vi-VN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
        };
      }
    } catch (err) {
      console.warn('[Cambridge AI] Lỗi gọi Gemini, tự động chuyển sang chế độ tạo mẫu thông minh:', err);
    }
  }

  // Fallback: Smart Pedagogical Cambridge Template Engine
  return generateHeuristicCambridgeExam({
    book,
    unit,
    lessons,
    config,
    knowledge,
    levelInfo,
    paperTitle,
    examCode,
  });
}

/**
 * Bộ tạo đề thi Cambridge thông minh từ dữ liệu bài học khi không có kết nối internet hoặc API key
 */
function generateHeuristicCambridgeExam({
  book,
  unit,
  lessons,
  config,
  knowledge,
  levelInfo,
  paperTitle,
  examCode,
}: {
  book: Book;
  unit: Unit;
  lessons: Lesson[];
  config: CambridgeGeneratorConfig;
  knowledge: ReturnType<typeof extractLessonKnowledge>;
  levelInfo: ReturnType<typeof getCambridgeLevelDetails>;
  paperTitle: string;
  examCode: string;
}): CambridgeExam {
  const parts: CambridgePart[] = [];
  const allQuestions: CambridgeQuestion[] = [];
  let qNum = 1;

  const vocabs = knowledge.vocabularies.length > 0 ? knowledge.vocabularies : [
    { word: 'appearance', meaning: 'ngoại hình, vẻ bề ngoài' },
    { word: 'personality', meaning: 'tính cách, phẩm chất' },
    { word: 'friendly', meaning: 'thân thiện, cởi mở' },
    { word: 'generous', meaning: 'hào phóng, rộng lượng' },
    { word: 'dark hair', meaning: 'mái tóc đen sẫm' },
    { word: 'tall', meaning: 'cao ráo' },
    { word: 'boyfriend', meaning: 'bạn trai' },
    { word: 'family member', meaning: 'thành viên trong gia đình' },
  ];

  // Part 1: Vocabulary & Collocation in Context (5 questions)
  const part1Questions: CambridgeQuestion[] = [];
  const p1Target = Math.min(5, Math.floor(config.questionCount / 2));
  for (let i = 0; i < p1Target; i++) {
    const item = vocabs[i % vocabs.length]!;
    const distractors = vocabs
      .filter((v) => v.word !== item.word)
      .map((v) => v.word)
      .slice(0, 3);
    const options = [item.word, ...distractors];
    while (options.length < 4) options.push(`option-${options.length + 1}`);
    // Shuffle options
    const shuffled = options.sort(() => 0.5 - Math.random());
    const correctIndex = shuffled.indexOf(item.word);

    const questionText = `Which word best matches the definition: "${item.meaning}"?`;
    const q: CambridgeQuestion = {
      id: `camb-p1-${qNum}`,
      part: 1,
      partTitle: 'Part 1: Vocabulary in Context',
      instructions: 'For each question, choose the best word (A, B, C or D) that matches the meaning.',
      question: questionText,
      options: shuffled,
      correctIndex: correctIndex >= 0 ? correctIndex : 0,
      explanation: `"${item.word}" mang nghĩa là "${item.meaning}", hoàn toàn chuẩn xác theo bài học ${knowledge.topics[0] || ''}.`,
      focusArea: `Vocabulary Focus (${item.word})`,
      mark: 1,
    };
    part1Questions.push(q);
    allQuestions.push(q);
    qNum++;
  }

  parts.push({
    partNumber: 1,
    title: 'Part 1: Vocabulary in Context',
    instructions: 'For each question, choose the correct answer (A, B, C or D).',
    questions: part1Questions,
  });

  // Part 2: Sentence Completion & Grammar (5 questions)
  const part2Questions: CambridgeQuestion[] = [];
  const p2Target = Math.min(5, config.questionCount - allQuestions.length);
  const sampleGrammarPrompts = [
    {
      q: 'What ________ she look like? - She has curly dark hair and green eyes.',
      opts: ['does', 'do', 'is', 'are'],
      ans: 0,
      exp: 'Sử dụng trợ động từ "does" với chủ ngữ số ít "she" trong câu hỏi miêu tả ngoại hình "What does she look like?".',
      focus: 'Grammar: Present Simple (Questions)',
    },
    {
      q: 'He isn’t very tall. He is ________ height with a short beard.',
      opts: ['medium', 'long', 'heavy', 'huge'],
      ans: 0,
      exp: 'Cụm từ cố định chỉ chiều cao trung bình là "medium height".',
      focus: 'Collocation: Describing Height',
    },
    {
      q: 'They ________ lived in this city since 2020.',
      opts: ['have', 'has', 'having', 'had'],
      ans: 0,
      exp: 'Chủ ngữ "They" đi với trợ động từ "have" trong thì hiện tại hoàn thành.',
      focus: 'Grammar: Present Perfect',
    },
    {
      q: 'She loves spending time helping other people. She is very ________.',
      opts: ['generous', 'shy', 'lazy', 'impatient'],
      ans: 0,
      exp: '"generous" (hào phóng, tốt bụng) miêu tả người thích giúp đỡ và chia sẻ với người khác.',
      focus: 'Vocabulary: Personality Adjectives',
    },
    {
      q: 'Look at the picture! Who is the person standing ________ Mel and Adam?',
      opts: ['between', 'among', 'across', 'through'],
      ans: 0,
      exp: 'Dùng giới từ "between" khi chỉ vị trí ở giữa hai người hoặc hai vật thể xác định.',
      focus: 'Prepositions of Place',
    },
  ];

  for (let i = 0; i < p2Target; i++) {
    const template = sampleGrammarPrompts[i % sampleGrammarPrompts.length]!;
    const q: CambridgeQuestion = {
      id: `camb-p2-${qNum}`,
      part: 2,
      partTitle: 'Part 2: Sentence Completion & Grammar',
      instructions: 'Read the sentences and choose the best option (A, B, C or D) to complete each space.',
      question: template.q,
      options: template.opts,
      correctIndex: template.ans,
      explanation: template.exp,
      focusArea: template.focus,
      mark: 1,
    };
    part2Questions.push(q);
    allQuestions.push(q);
    qNum++;
  }

  if (part2Questions.length > 0) {
    parts.push({
      partNumber: 2,
      title: 'Part 2: Sentence Completion & Grammar',
      instructions: 'Read the sentences. Choose the best word (A, B, C or D) for each space.',
      questions: part2Questions,
    });
  }

  // Part 3: Reading Comprehension (if more questions needed)
  if (allQuestions.length < config.questionCount) {
    const part3Questions: CambridgeQuestion[] = [];
    const p3Target = Math.min(5, config.questionCount - allQuestions.length);
    const passage =
      knowledge.readingPassages[0] ||
      `Sarah Harris is the deputy editor of British Vogue. When she was young, she started to go grey at a very early age. Today, grey hair is in fashion for both young and older people. Many fashion magazines report that people are embracing their natural appearance and feel proud of who they are.`;

    const sampleReadingQuestions = [
      {
        q: 'What is the main topic of the article?',
        opts: [
          'Embracing natural appearance and grey hair in modern fashion',
          'How to dye hair at home easily',
          'The career of fashion models in London',
          'Why people dislike changing hairstyles',
        ],
        ans: 0,
        exp: 'Bài đọc nhấn mạnh việc tóc bạc tự nhiên đang trở thành xu hướng thời trang tích cực.',
        focus: 'Reading: Global Meaning',
      },
      {
        q: 'According to the text, when did Sarah Harris notice her hair changing?',
        opts: ['When she was young', 'After she retired', 'During the pandemic', 'Only last year'],
        ans: 0,
        exp: 'Dẫn chứng trong bài: "When she was young, she started to go grey at a very early age."',
        focus: 'Reading: Specific Information',
      },
      {
        q: 'How do people feel about their natural hair today according to fashion magazines?',
        opts: [
          'They feel confident and proud of their natural look',
          'They feel anxious and want to hide it',
          'They refuse to go to hair salons',
          'They always dye their hair dark',
        ],
        ans: 0,
        exp: 'Dẫn chứng: "...people are embracing their natural appearance and feel proud of who they are."',
        focus: 'Reading: Detail & Attitude',
      },
    ];

    for (let i = 0; i < p3Target; i++) {
      const t = sampleReadingQuestions[i % sampleReadingQuestions.length]!;
      const q: CambridgeQuestion = {
        id: `camb-p3-${qNum}`,
        part: 3,
        partTitle: 'Part 3: Reading Comprehension',
        instructions: 'Read the article and answer the questions that follow.',
        question: t.q,
        options: t.opts,
        correctIndex: t.ans,
        explanation: t.exp,
        focusArea: t.focus,
        mark: 1,
      };
      part3Questions.push(q);
      allQuestions.push(q);
      qNum++;
    }

    parts.push({
      partNumber: 3,
      title: 'Part 3: Reading Comprehension',
      instructions: 'Read the text below and choose the correct answer (A, B, C or D).',
      passage,
      questions: part3Questions,
    });
  }

  // Part 4: Cloze test / Additional questions if user requested 20 or 25 questions
  if (allQuestions.length < config.questionCount) {
    const part4Questions: CambridgeQuestion[] = [];
    const remaining = config.questionCount - allQuestions.length;

    for (let i = 0; i < remaining; i++) {
      const wordObj = vocabs[i % vocabs.length]!;
      const q: CambridgeQuestion = {
        id: `camb-p4-${qNum}`,
        part: 4,
        partTitle: 'Part 4: Language Use & Form',
        instructions: 'Choose the correct form of the word to complete the blank.',
        question: `He speaks very ________ when communicating with foreign guests.`,
        options: ['politely', 'polite', 'politeness', 'impolite'],
        correctIndex: 0,
        explanation: 'Cần một trạng từ (Adverb) để bổ nghĩa cho động từ thường "speaks".',
        focusArea: 'Word Formation & Grammar',
        mark: 1,
      };
      part4Questions.push(q);
      allQuestions.push(q);
      qNum++;
    }

    parts.push({
      partNumber: 4,
      title: 'Part 4: Language Use & Form',
      instructions: 'For each question, choose the correct answer (A, B, C or D).',
      questions: part4Questions,
    });
  }

  return {
    id: `cambridge-exam-${Date.now()}`,
    title: config.customTitle || `${levelInfo.qualificationName} — ${paperTitle}`,
    qualificationName: levelInfo.qualificationName,
    levelBadge: levelInfo.badge,
    paperName: paperTitle,
    examCode,
    timeMinutes: config.questionCount <= 10 ? 15 : config.questionCount <= 20 ? 30 : levelInfo.defaultTime,
    totalMarks: allQuestions.length,
    bookTitle: book.title,
    unitTitle: unit.title,
    lessonTitles: knowledge.topics,
    parts,
    questions: allQuestions,
    instructionsToCandidates: [
      'Write your name, centre number and candidate number in the spaces at the top of this page.',
      'Answer all questions. Write your answers on the question paper.',
      'Read the instructions for each part carefully before answering.',
      'Dictionaries and electronic devices are NOT permitted.',
    ],
    informationForCandidates: [
      `There are ${allQuestions.length} questions on this question paper.`,
      'Each question carries one mark.',
      `The total score for this paper is ${allQuestions.length} marks.`,
    ],
    generatedAt: new Date().toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  };
}
