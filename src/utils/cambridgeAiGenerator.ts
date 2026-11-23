import type { Book, Lesson, Unit } from '../types/academic';
import type {
  AiProvider,
  CambridgeExam,
  CambridgeExamType,
  CambridgeGeneratorConfig,
  CambridgeLevel,
  CambridgePart,
  CambridgeQuestion,
} from '../types/cambridge';
import {
  getSavedAiProvider,
  getSavedApiKey,
  getSavedModel,
  getSavedOpenAiApiKey,
  getSavedOpenAiModel,
} from '../components/AiSettingsModal';

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
        const noScripts = c.htmlContent
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

        const textOnly = noScripts.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (textOnly.length > 30) {
          readingPassages.push(textOnly.slice(0, 1200));
        }

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

  const uniqueVocab = Array.from(new Map(vocabularies.map((v) => [v.word.toLowerCase(), v])).values()).slice(
    0,
    35
  );

  const fullContextSummary = `
- Các chủ đề bài học: ${topics.join(', ')}
- Từ vựng trọng tâm: ${uniqueVocab.map((v) => `${v.word} (${v.meaning})`).join(', ') || 'Từ vựng tiếng Anh theo bài'}
- Mẫu câu & ngữ cảnh thực tế: ${sentences.slice(0, 8).join(' | ') || 'Các mẫu câu giao tiếp và ngữ pháp theo giáo trình.'}
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
 * Tên cấp độ và tiêu chuẩn Cambridge
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
        qualificationName: 'Đề Đánh Giá Định Kỳ (Chuẩn Quốc Tế Cambridge)',
        badge: 'Cambridge GDPT',
        defaultTime: 45,
        targetCefr: 'A1 - B1',
      };
  }
}

/**
 * Tên định dạng môn thi
 */
export function getCambridgePaperTitle(examType: CambridgeExamType): string {
  switch (examType) {
    case 'listening':
      return 'Listening Paper (Aural Comprehension)';
    case 'reading':
      return 'Reading Paper (Textual Analysis & Comprehension)';
    case 'writing':
      return 'Writing Paper (Communication & Extended Production)';
    case 'speaking':
      return 'Speaking Paper (Interview & Collaborative Task)';
    case 'reading_and_writing':
      return 'Reading and Writing Paper';
    case 'listening_and_speaking':
      return 'Listening and Speaking Interactive Paper';
    case 'reading_and_use_of_english':
      return 'Reading and Use of English Paper';
    case 'comprehensive_4_skills':
      return 'Comprehensive 4-Skills Examination (Listening, Reading, Writing, Speaking)';
    case 'vocabulary_grammar_focus':
      return 'Vocabulary and Grammar Mastery Paper';
    case 'reading_comprehension':
      return 'Reading Comprehension Paper';
    case 'cloze_and_sentence':
      return 'Cloze Test and Sentence Completion Paper';
    default:
      return 'Cambridge English Examination';
  }
}

// Ngân hàng 30 chủ đề thi phong phú để chống lặp đề
const CAMBRIDGE_EXAM_THEMES = [
  'A Day at the British Science & Technology Museum',
  'The Annual School Eco-Challenge and Tree Planting Project',
  'Exploration of the Coastal Wildlife Sanctuary',
  'The Young Chefs Culinary and Baking Competition',
  'Adventures in the Scottish Highlands Camp',
  'The City Marathon and Youth Charity Fun Run',
  'High School Robotics and Future Tech Innovation',
  'The Mystery of the Old Library Manuscript',
  'An Unforgettable Weekend Trip to Cambridge University',
  'The Youth Photography and Digital Arts Festival',
  'Preparing for the International Student Exchange Fair',
  'A Visit to the National Space Centre and Planetarium',
  'Community Kindness Week and Elderly Care Initiative',
  'The Inter-school Basketball and Athletics Championships',
  'Living in a Smart Green City of Tomorrow',
  'The Young Authors Creative Story Contest',
  'Discovering Marine Life on the Coral Reef Expedition',
  'The School Music Festival and Acoustic Band Finals',
  'A Walking Tour of Historic London Landmarks',
  'The Junior Meteorology Station and Weather Forecasting',
  'Volunteering at the Urban Animal Rescue Shelter',
  'A Bicycle Tour through Peaceful English Countryside Villages',
  'The School Science Fair Innovation Awards',
  'Healthy Living: Fitness Habits, Nutrition & Mental Wellbeing',
  'A Weekend Workshop on Renewable Wind & Solar Energy',
  'Discovering Ancient Roman History at Bath Spa',
  'The High School Drama Club Shakespeare Production',
  'Cultural Heritage Day: Traditions and Customs Worldwide',
  'The City Youth Chess and Brain Game Tournament',
  'An Educational Journey across National National Parks',
];

/**
 * Trích xuất JSON từ chuỗi kết quả AI một cách an toàn
 */
function extractJsonFromAiResponse(raw: string): any {
  if (!raw) throw new Error('Dữ liệu AI rỗng.');
  const trimmed = raw.trim();

  // Try direct parse
  try {
    return JSON.parse(trimmed);
  } catch {}

  // Try markdown code fence match
  const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (match && match[1]) {
    try {
      return JSON.parse(match[1]);
    } catch {}
  }

  // Try finding outermost brackets { ... }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = trimmed.substring(firstBrace, lastBrace + 1);
    return JSON.parse(candidate);
  }

  throw new Error('Không thể phân tích định dạng JSON từ phản hồi của mô hình AI.');
}

/**
 * 1. Gọi Google Gemini API
 */
async function callGeminiForCambridgeExam(
  prompt: string,
  apiKey: string,
  model: string
): Promise<any> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model || 'gemini-2.5-flash'
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.85, // Sinh động, đa dạng, không lặp lại
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

  return extractJsonFromAiResponse(rawText);
}

/**
 * 2. Gọi OpenAI / ChatGPT API
 */
async function callOpenAiForCambridgeExam(
  prompt: string,
  apiKey: string,
  model: string
): Promise<any> {
  const endpoint = 'https://api.openai.com/v1/chat/completions';

  const body = {
    model: model || 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You are a Chief Examination Officer at Cambridge Assessment English. You write authentic, highly varied, non-repetitive Cambridge examination papers strictly according to CEFR standards and Cambridge official formats. Always return valid JSON.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.85, // Sáng tạo, độc bản, đổi mới mỗi lần
    response_format: { type: 'json_object' },
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `OpenAI API returned status ${res.status}`);
  }

  const data = await res.json();
  const rawText = data?.choices?.[0]?.message?.content;
  if (!rawText) throw new Error('Không nhận được nội dung từ OpenAI.');

  return extractJsonFromAiResponse(rawText);
}

/**
 * Hàm sinh đề thi Cambridge thông minh bằng AI (ChatGPT hoặc Gemini)
 * Tự động tạo Audio Script cho bài nghe, đa dạng hóa 4 kỹ năng và đề thi mới hoàn toàn mỗi lần
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
  const paperTitle = getCambridgePaperTitle(config.examType);

  const randomThematicContext =
    CAMBRIDGE_EXAM_THEMES[Math.floor(Math.random() * CAMBRIDGE_EXAM_THEMES.length)] ||
    'Cambridge International Youth Conference';

  const randomSeed = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const examCode = `CE/${levelInfo.badge.replace(/\s+/g, '')}/${randomSeed.slice(-5).toUpperCase()}`;

  // Determine which AI engine to use
  const selectedProvider: AiProvider = config.provider || getSavedAiProvider();
  const geminiKey = config.apiKey || getSavedApiKey();
  const geminiModel = config.model || getSavedModel();
  const openaiKey = config.apiKey || getSavedOpenAiApiKey();
  const openaiModel = config.model || getSavedOpenAiModel();

  let aiEngineName = 'Smart Pedagogical Engine';

  // Build specialized prompt depending on examType
  let specializedSkillInstructions = '';

  if (config.examType === 'listening') {
    specializedSkillInstructions = `
YÊU CẦU ĐẶC BIỆT CHO BÀI THI KỸ NĂNG NGHE (LISTENING):
- Bạn PHẢI tạo kịch bản nghe hoàn chỉnh từng phần (audioScript) với lời thoại rõ ràng của từng nhân vật (Ví dụ: "Narrator: ...", "Boy: ...", "Girl: ...", "Shop assistant: ...", "Teacher: ...").
- Cấu trúc các Part:
  + Part 1: Nghe 5 đoạn hội thoại ngắn đời thường (mỗi câu có audioScript riêng 3-4 câu thoại, học sinh chọn tranh/đáp án A, B hoặc C).
  + Part 2: Nghe một đoạn thông báo/độc thoại điền thông tin (Gap-fill note completion: Date, Time, Name, Price, Location).
  + Part 3: Nghe một bài phỏng vấn/đoạn trò chuyện dài có nhiều thông tin (3-option MCQs A, B, C).
- Bắt buộc trả về trường "fullListeningScript" chứa toàn bộ kịch bản lời thoại từ đầu đến cuối để hệ thống phát âm thanh hoặc in ra cho giám khảo.
`;
  } else if (config.examType === 'writing') {
    specializedSkillInstructions = `
YÊU CẦU ĐẶC BIỆT CHO BÀI THI KỸ NĂNG VIẾT (WRITING):
- Cấu trúc các Part:
  + Part 1: Sentence Transformations (Viết lại câu giữ nguyên nghĩa với từ gợi ý, 5 câu).
  + Part 2: Short Communicative Message (Viết tin nhắn/email ngắn 35-50 từ trả lời đủ 3 câu hỏi gợi ý).
  + Part 3: Extended Writing / Story (Viết câu chuyện hoặc bài viết 80-100 từ dựa trên câu mở đầu hoặc tranh gợi ý).
- Với mỗi câu hỏi viết, bạn PHẢI cung cấp:
  + "sampleAnswer": Đoạn văn mẫu đạt điểm tối đa (Band 5/5 chuẩn Cambridge).
  + "scoringRubric": Tiêu chí chấm điểm chi tiết (Nội dung, Đạt mục đích giao tiếp, Bố cục, Từ vựng & Ngữ pháp).
`;
  } else if (config.examType === 'speaking') {
    specializedSkillInstructions = `
YÊU CẦU ĐẶC BIỆT CHO BÀI THI KỸ NĂNG NÓI (SPEAKING):
- Cấu trúc các Part:
  + Part 1: Phỏng vấn cá nhân (Examiner Questions: Hobbies, School life, Family, Weekend activities). Có audioScript lời đọc câu hỏi của giám khảo.
  + Part 2: Thảo luận tình huống / Miêu tả tranh ảnh (Collaborative task & Picture description).
- Bắt buộc cung cấp:
  + "audioScript": Lời hỏi trực tiếp của Giám khảo khảo thí Cambridge để hệ thống phát âm thanh đọc câu hỏi.
  + "sampleAnswer": Câu trả lời mẫu xuất sắc từ thí sinh đạt điểm cao.
  + "scoringRubric": Thang điểm phát âm, từ vựng, ngữ pháp và độ trôi chảy.
`;
  } else if (config.examType === 'comprehensive_4_skills') {
    specializedSkillInstructions = `
YÊU CẦU ĐẶC BIỆT CHO ĐỀ THI TOÀN DIỆN 4 KỸ NĂNG (COMPREHENSIVE 4-SKILLS):
- Phải bao gồm đủ cả 4 kỹ năng chia theo từng Part rõ rệt:
  + Part 1: LISTENING (Có audioScript lời thoại và câu hỏi trắc nghiệm A, B, C).
  + Part 2: READING (Bài đọc hiểu chuyên sâu với câu hỏi trắc nghiệm và điền từ).
  + Part 3: WRITING (Bài viết câu và viết email/đoạn văn ngắn có sampleAnswer).
  + Part 4: SPEAKING (Câu hỏi phỏng vấn của giám khảo có audioScript và sampleAnswer).
- Trả về "fullListeningScript" cho phần nghe.
`;
  } else if (config.examType === 'reading_and_writing') {
    specializedSkillInstructions = `
YÊU CẦU CHO ĐỀ THI ĐỌC & VIẾT KẾT HỢP (READING & WRITING CHUẨN KET/PET):
- Part 1: Đọc thông báo ngắn / biển báo chọn đáp án đúng.
- Part 2: Đọc hiểu bài văn và trả lời trắc nghiệm A, B, C.
- Part 3: Điền từ vào đoạn văn (Open cloze).
- Part 4: Viết câu & viết tin nhắn ngắn (có sampleAnswer).
`;
  } else {
    specializedSkillInstructions = `
YÊU CẦU CHO ĐỀ THI ĐỌC HIỂU & NGỮ PHÁP (READING & USE OF ENGLISH):
- Part 1: Multiple choice short texts / notices (5 câu).
- Part 2: Sentence gap-fill vocabulary & collocations in context (5 câu).
- Part 3: Reading passage with multiple choice comprehension (5 câu).
- Part 4: Open cloze / Grammar & Language focus (đến đủ số câu yêu cầu).
`;
  }

  const prompt = `
Bạn là Trưởng ban Khảo thí của Cambridge Assessment English (Item Writer & Senior Assessment Specialist).
Hãy soạn một đề thi tiếng Anh CHUẨN ĐỊNH DẠNG CAMBRIDGE ASSESSMENT ENGLISH hoàn toàn MỚI, ĐỘC BẢN và KHÔNG TRÙNG LẶP.

THÔNG TIN ĐỀ THI:
- Mã định danh bài thi: ${examCode} (Seed: ${randomSeed})
- Chủ đề ngữ cảnh bài thi lần này: "${randomThematicContext}"
- Cấp độ bài thi: ${levelInfo.qualificationName} (Khung CEFR: ${levelInfo.targetCefr})
- Phân môn / Kỹ năng trọng tâm: ${paperTitle}
- Tổng số lượng câu hỏi mục tiêu: ${config.questionCount} câu.

DỮ LIỆU BÀI HỌC GỐC ĐỂ KHAI THÁC TỪ VỰNG & NGỮ PHÁP:
- Giáo trình: ${book.title} (Khối: ${book.gradeLevel || 'A1-B1'})
- Chương: ${unit.title}
- Các bài học được chọn: ${knowledge.topics.join('; ')}
- Dữ liệu kiến thức đã học:
${knowledge.fullContextSummary}

${specializedSkillInstructions}

QUY TẮC ĐA DẠNG HÓA & TRÁNH TRÙNG LẶP:
1. Mỗi lần tạo là một ngữ cảnh hoàn toàn mới, các tên nhân vật, tình huống thực tế và câu văn phải được sáng tạo mới mẻ 100%.
2. Với bài Nghe (Listening) hoặc Nói (Speaking), BẮT BUỘC phải có trường "audioScript" chứa lời thoại tiếng Anh tự nhiên, phát âm chuẩn Anh - Anh hoặc Anh - Mỹ.
3. Đáp án trắc nghiệm A, B, C, D phải được hoán vị ngẫu nhiên vị trí đúng (không được để dồn vào A).
4. Phần giải thích ("explanation") phải sâu sắc, chỉ rõ từ vựng hoặc cấu trúc ngữ pháp liên quan đến bài học.

YÊU CẦU ĐỊNH DẠNG JSON (TRẢ VỀ DUY NHẤT 1 ĐỐI TƯỢNG JSON):
{
  "title": "Tên bài thi",
  "fullListeningScript": "Toàn bộ kịch bản nghe nếu có phần Listening, định dạng theo từng người nói (Narrator: ..., Boy: ..., Girl: ...)",
  "parts": [
    {
      "partNumber": 1,
      "title": "Part 1: Listening / Reading / Writing / Speaking",
      "instructions": "Lời dặn thí sinh...",
      "partSkill": "listening hoặc reading hoặc writing hoặc speaking hoặc use_of_english",
      "passage": "Đoạn văn đọc nếu có",
      "audioScript": "Kịch bản âm thanh của phần này nếu là phần nghe/nói",
      "questions": [
        {
          "question": "Nội dung câu hỏi...",
          "contextText": "Ngữ cảnh hoặc đoạn trích nếu có",
          "audioScript": "Lời thoại âm thanh riêng của câu này nếu có",
          "options": ["A. Lựa chọn 1", "B. Lựa chọn 2", "C. Lựa chọn 3", "D. Lựa chọn 4"],
          "correctIndex": 0,
          "explanation": "Giải thích chi tiết...",
          "focusArea": "Kỹ năng / Từ vựng trọng tâm...",
          "sampleAnswer": "Câu trả lời mẫu nếu là bài tự luận Writing hoặc Speaking",
          "scoringRubric": "Tiêu chí chấm điểm nếu có"
        }
      ]
    }
  ]
}
`.trim();

  // Try calling the selected provider first, then fallback to other provider, then heuristic
  let aiResponse: any = null;

  if (selectedProvider === 'openai' && openaiKey && openaiKey.trim()) {
    try {
      aiResponse = await callOpenAiForCambridgeExam(prompt, openaiKey, openaiModel);
      aiEngineName = `ChatGPT (${openaiModel || 'gpt-4o-mini'})`;
    } catch (err: any) {
      console.warn('[Cambridge AI] Lỗi gọi OpenAI, thử chuyển sang Gemini nếu có:', err.message);
    }
  }

  if (!aiResponse && geminiKey && geminiKey.trim()) {
    try {
      aiResponse = await callGeminiForCambridgeExam(prompt, geminiKey, geminiModel);
      aiEngineName = `Google Gemini (${geminiModel || 'gemini-2.5-flash'})`;
    } catch (err: any) {
      console.warn('[Cambridge AI] Lỗi gọi Gemini:', err.message);
    }
  }

  // If still no response and we haven't tried OpenAI yet
  if (!aiResponse && selectedProvider !== 'openai' && openaiKey && openaiKey.trim()) {
    try {
      aiResponse = await callOpenAiForCambridgeExam(prompt, openaiKey, openaiModel);
      aiEngineName = `ChatGPT (${openaiModel || 'gpt-4o-mini'})`;
    } catch (err: any) {
      console.warn('[Cambridge AI] Lỗi gọi OpenAI fallback:', err.message);
    }
  }

  if (aiResponse && Array.isArray(aiResponse.parts) && aiResponse.parts.length > 0) {
    let questionCounter = 1;
    const allQuestions: CambridgeQuestion[] = [];
    let hasListening = false;
    let hasSpeaking = false;
    let hasWriting = false;
    let hasReading = false;

    const structuredParts: CambridgePart[] = aiResponse.parts.map((p: any, pIdx: number) => {
      const pSkill = p.partSkill || (
        config.examType === 'listening' ? 'listening' :
        config.examType === 'writing' ? 'writing' :
        config.examType === 'speaking' ? 'speaking' : 'reading'
      );

      if (pSkill === 'listening' || p.audioScript) hasListening = true;
      if (pSkill === 'speaking') hasSpeaking = true;
      if (pSkill === 'writing') hasWriting = true;
      if (pSkill === 'reading' || pSkill === 'use_of_english') hasReading = true;

      const questions: CambridgeQuestion[] = (p.questions || []).map((q: any) => {
        const isSpeakingOrWriting = pSkill === 'writing' || pSkill === 'speaking';
        const rawOptions = Array.isArray(q.options) && q.options.length > 0
          ? q.options
          : isSpeakingOrWriting
          ? []
          : ['A', 'B', 'C', 'D'];

        const cambridgeQ: CambridgeQuestion = {
          id: `camb-q-${Date.now()}-${questionCounter}`,
          part: p.partNumber || pIdx + 1,
          partTitle: p.title || `Part ${pIdx + 1}`,
          instructions: p.instructions || 'Choose the best answer.',
          contextText: q.contextText || undefined,
          audioScript: q.audioScript || undefined,
          question: q.question || `Question ${questionCounter}`,
          options: rawOptions,
          correctIndex:
            typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex < rawOptions.length
              ? q.correctIndex
              : 0,
          explanation: q.explanation || 'Đáp án chính xác theo tiêu chuẩn bài học.',
          focusArea: q.focusArea || 'Language Focus',
          mark: 1,
          sampleAnswer: q.sampleAnswer || undefined,
          scoringRubric: q.scoringRubric || undefined,
          questionType: isSpeakingOrWriting
            ? (pSkill === 'writing' ? 'short_writing' : 'speaking_prompt')
            : 'multiple_choice',
        };
        questionCounter += 1;
        allQuestions.push(cambridgeQ);
        return cambridgeQ;
      });

      return {
        partNumber: p.partNumber || pIdx + 1,
        title: p.title || `Part ${pIdx + 1}`,
        instructions: p.instructions || 'Follow the instructions carefully.',
        passage: p.passage || undefined,
        audioScript: p.audioScript || undefined,
        partSkill: pSkill,
        questions,
      };
    });

    // Check overall listening script
    let fullScript = aiResponse.fullListeningScript || '';
    if (!fullScript && hasListening) {
      fullScript = structuredParts
        .filter((p) => p.audioScript || p.questions.some((q) => q.audioScript))
        .map((p) => {
          const partHeader = `--- ${p.title} ---\n${p.instructions}\n`;
          const partBody = p.audioScript || p.questions.map((q) => q.audioScript).filter(Boolean).join('\n\n');
          return `${partHeader}${partBody}`;
        })
        .join('\n\n');
    }

    return {
      id: `cambridge-exam-${Date.now()}`,
      title: aiResponse.title || `${levelInfo.qualificationName} — ${paperTitle}`,
      qualificationName: levelInfo.qualificationName,
      levelBadge: levelInfo.badge,
      paperName: paperTitle,
      examCode,
      timeMinutes: config.questionCount <= 10 ? 20 : config.questionCount <= 20 ? 35 : levelInfo.defaultTime,
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
        hasListening ? 'For the listening test, you will hear each recording twice.' : '',
        'Dictionaries and electronic devices are NOT permitted.',
      ].filter(Boolean),
      informationForCandidates: [
        `There are ${allQuestions.length} questions on this question paper.`,
        'Each question carries one mark unless stated otherwise.',
        `The total score for this paper is ${allQuestions.length} marks.`,
      ],
      generatedAt: new Date().toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      hasListening: hasListening || config.examType === 'listening' || config.examType === 'comprehensive_4_skills',
      hasSpeaking: hasSpeaking || config.examType === 'speaking' || config.examType === 'comprehensive_4_skills',
      hasWriting: hasWriting || config.examType === 'writing' || config.examType === 'comprehensive_4_skills',
      hasReading: hasReading || config.examType === 'reading' || config.examType === 'reading_and_use_of_english',
      fullListeningScript: fullScript || undefined,
      aiEngineUsed: aiEngineName,
    };
  }

  // Fallback: Smart Pedagogical Dynamic Generator (completely varied every run)
  return generateDynamicHeuristicCambridgeExam({
    book,
    unit,
    lessons,
    config,
    knowledge,
    levelInfo,
    paperTitle,
    examCode,
    thematicContext: randomThematicContext,
  });
}

/**
 * Bộ tạo đề thi Cambridge thông minh ngoại tuyến:
 * Tự động tạo ngữ cảnh mới, câu hỏi phong phú, kèm Audio Script nghe chân thực và câu hỏi đa kỹ năng
 */
function generateDynamicHeuristicCambridgeExam({
  book,
  unit,
  lessons,
  config,
  knowledge,
  levelInfo,
  paperTitle,
  examCode,
  thematicContext,
}: {
  book: Book;
  unit: Unit;
  lessons: Lesson[];
  config: CambridgeGeneratorConfig;
  knowledge: ReturnType<typeof extractLessonKnowledge>;
  levelInfo: ReturnType<typeof getCambridgeLevelDetails>;
  paperTitle: string;
  examCode: string;
  thematicContext: string;
}): CambridgeExam {
  const parts: CambridgePart[] = [];
  const allQuestions: CambridgeQuestion[] = [];
  let qNum = 1;

  // Shuffle vocabulary pool to avoid repetition
  const rawVocabs = knowledge.vocabularies.length >= 4
    ? [...knowledge.vocabularies].sort(() => 0.5 - Math.random())
    : [
        { word: 'appearance', meaning: 'ngoại hình, diện mạo' },
        { word: 'personality', meaning: 'tính cách, phẩm chất' },
        { word: 'friendly', meaning: 'thân thiện, hòa đồng' },
        { word: 'generous', meaning: 'hào phóng, rộng lượng' },
        { word: 'curly hair', meaning: 'mái tóc xoăn' },
        { word: 'direction', meaning: 'phương hướng, chỉ đường' },
        { word: 'tradition', meaning: 'truyền thống, phong tục' },
        { word: 'custom', meaning: 'tập quán lâu đời' },
        { word: 'celebration', meaning: 'lễ kỷ niệm, ngày hội' },
        { word: 'creative', meaning: 'sáng tạo, giàu ý tưởng' },
      ].sort(() => 0.5 - Math.random());

  const isListening = config.examType === 'listening' || config.examType === 'listening_and_speaking' || config.examType === 'comprehensive_4_skills';
  const isWriting = config.examType === 'writing' || config.examType === 'reading_and_writing' || config.examType === 'comprehensive_4_skills';
  const isSpeaking = config.examType === 'speaking' || config.examType === 'comprehensive_4_skills';

  let fullAudioScript = '';

  // 1. Part 1: Listening / Short Text Context
  if (isListening) {
    const p1Questions: CambridgeQuestion[] = [];
    const scriptLines: string[] = [
      `Narrator: Cambridge English Qualifications. ${levelInfo.qualificationName}. Listening Paper.`,
      `Narrator: Theme: ${thematicContext}. You will hear each conversation twice.`,
    ];

    const count = Math.min(5, Math.max(3, Math.floor(config.questionCount / 4)));
    for (let i = 0; i < count; i++) {
      const vocab = rawVocabs[i % rawVocabs.length]!;
      const names = ['Oliver', 'Emma', 'Lucas', 'Sophia', 'Jack', 'Mia'];
      const speaker1 = names[i % names.length];
      const speaker2 = names[(i + 1) % names.length];

      const conversationScript = `Narrator: Question ${qNum}. Where are the students planning to meet?\n${speaker1}: Hi ${speaker2}, will we meet near the school gate or at the library for our project about ${vocab.word}?\n${speaker2}: Let's meet at the library near the park, so we can prepare our notes quietly.\nNarrator: Now listen again.\n${speaker1}: Hi ${speaker2}, will we meet near the school gate or at the library for our project about ${vocab.word}?\n${speaker2}: Let's meet at the library near the park, so we can prepare our notes quietly.`;

      scriptLines.push(`\n${conversationScript}`);

      const options = [
        'At the school library near the park',
        'In front of the main entrance gate',
        'Inside the busy sports cafeteria',
      ];
      // Randomize correct option position
      const correctIdx = Math.floor(Math.random() * 3);
      if (correctIdx !== 0) {
        const temp = options[0]!;
        options[0] = options[correctIdx]!;
        options[correctIdx] = temp;
      }

      const q: CambridgeQuestion = {
        id: `camb-listen-${qNum}`,
        part: 1,
        partTitle: 'Part 1: Listening Comprehension',
        instructions: 'Listen to the conversation and choose the correct answer (A, B or C).',
        question: `Question ${qNum}: Where will the students meet for their discussion?`,
        audioScript: conversationScript,
        options,
        correctIndex: correctIdx,
        explanation: `Theo lời thoại của nhân vật ("Let's meet at the library near the park"), địa điểm chính xác là thư viện trường gần công viên.`,
        focusArea: `Listening for specific information (${vocab.word})`,
        mark: 1,
      };
      p1Questions.push(q);
      allQuestions.push(q);
      qNum += 1;
    }

    fullAudioScript = scriptLines.join('\n');
    parts.push({
      partNumber: 1,
      title: 'Part 1: Listening Comprehension',
      instructions: 'You will hear short conversations. For each question, choose the best answer.',
      partSkill: 'listening',
      audioScript: fullAudioScript,
      questions: p1Questions,
    });
  }

  // 2. Part 2: Reading Comprehension
  const readingTarget = Math.min(5, Math.max(3, Math.floor(config.questionCount / 3)));
  const p2Questions: CambridgeQuestion[] = [];
  const samplePassage = `Welcome to the ${thematicContext}. This annual event brings together students and educators from across the region to celebrate cultural diversity, academic excellence, and teamwork. Participants will take part in engaging workshops focusing on ${rawVocabs.slice(0, 3).map((v) => v.word).join(', ')}, and collaborate on practical community initiatives. Please remember to arrive 15 minutes before the opening ceremony and wear your student badges at all times.`;

  for (let i = 0; i < readingTarget; i++) {
    const vocab = rawVocabs[(i + 2) % rawVocabs.length]!;
    const q: CambridgeQuestion = {
      id: `camb-read-${qNum}`,
      part: parts.length + 1,
      partTitle: `Part ${parts.length + 1}: Reading in Context`,
      instructions: 'Read the informational article above and choose the best answer for each question.',
      question: `According to the article about "${thematicContext}", what is the key purpose of the event?`,
      options: [
        `To encourage collaboration and develop understanding in ${vocab.word}.`,
        'To organize a silent reading test without group participation.',
        'To sell commercial products to overseas tourists.',
        'To cancel all weekend extra-curricular activities.',
      ],
      correctIndex: 0,
      explanation: `Đoạn văn nêu rõ mục tiêu là tôn vinh sự đa dạng học thuật và thúc đẩy sự hợp tác gắn với từ khóa ${vocab.word}.`,
      focusArea: `Reading for gist and detail (${vocab.word})`,
      mark: 1,
    };
    p2Questions.push(q);
    allQuestions.push(q);
    qNum += 1;
  }

  parts.push({
    partNumber: parts.length + 1,
    title: `Part ${parts.length}: Reading Comprehension`,
    instructions: 'Read the text and answer the questions that follow.',
    passage: samplePassage,
    partSkill: 'reading',
    questions: p2Questions,
  });

  // 3. Part 3: Language Focus & Vocabulary Cloze
  const clozeTarget = Math.max(3, config.questionCount - allQuestions.length - (isWriting ? 2 : 0) - (isSpeaking ? 2 : 0));
  if (clozeTarget > 0) {
    const p3Questions: CambridgeQuestion[] = [];
    for (let i = 0; i < clozeTarget; i++) {
      const vocab = rawVocabs[(i + 4) % rawVocabs.length]!;
      const otherVocabs = rawVocabs.filter((v) => v.word !== vocab.word).map((v) => v.word);
      const options = [vocab.word, otherVocabs[0] || 'different', otherVocabs[1] || 'similar', otherVocabs[2] || 'regular'];
      
      const correctIdx = Math.floor(Math.random() * 4);
      if (correctIdx !== 0) {
        const temp = options[0]!;
        options[0] = options[correctIdx]!;
        options[correctIdx] = temp;
      }

      const q: CambridgeQuestion = {
        id: `camb-cloze-${qNum}`,
        part: parts.length + 1,
        partTitle: `Part ${parts.length + 1}: Language & Vocabulary Focus`,
        instructions: 'Choose the word that best completes the sentence grammatically and contextually.',
        question: `Sentence ${qNum}: A person who is always ready to share their time and help others is described as ______ (${vocab.meaning}).`,
        options,
        correctIndex: correctIdx,
        explanation: `"${vocab.word}" là từ vựng chính xác mang ý nghĩa "${vocab.meaning}", phù hợp với ngữ cảnh câu.`,
        focusArea: `Lexical Resource & Collocation (${vocab.word})`,
        mark: 1,
      };
      p3Questions.push(q);
      allQuestions.push(q);
      qNum += 1;
    }

    parts.push({
      partNumber: parts.length + 1,
      title: `Part ${parts.length}: Language & Vocabulary Focus`,
      instructions: 'For each sentence, choose the word which best fits the gap.',
      partSkill: 'use_of_english',
      questions: p3Questions,
    });
  }

  // 4. Part 4: Writing Task (if requested)
  if (isWriting) {
    const writingVocab = rawVocabs[0]!;
    const writingPartQuestions: CambridgeQuestion[] = [
      {
        id: `camb-write-${qNum}`,
        part: parts.length + 1,
        partTitle: `Part ${parts.length + 1}: Writing Task`,
        instructions: 'Read the email prompt and write a response of 35–50 words.',
        question: `You received an email from your English friend, Alex, asking about your plans for "${thematicContext}". Write an email to Alex. In your email, describe what you will do, explain why you enjoy ${writingVocab.word}, and suggest a time to meet.`,
        options: [],
        correctIndex: 0,
        explanation: 'Thí sinh cần trả lời đủ 3 ý, sử dụng đúng thì và vốn từ vựng phong phú.',
        focusArea: 'Communicative Writing (Email / Short Message)',
        mark: 5,
        sampleAnswer: `Dear Alex,\nI'm so excited about the upcoming ${thematicContext}! I'm planning to join the group project on Wednesday. I really enjoy ${writingVocab.word} because it gives us a great chance to learn together. Can we meet at 3 p.m. at the library?\nBest,\nYour friend`,
        scoringRubric: 'Content (5/5): All 3 points addressed. Communicative Achievement (5/5): Natural informal tone. Language (5/5): Good range of vocabulary and connectors.',
        questionType: 'short_writing',
      },
    ];
    allQuestions.push(writingPartQuestions[0]!);
    qNum += 1;

    parts.push({
      partNumber: parts.length + 1,
      title: `Part ${parts.length}: Guided Writing`,
      instructions: 'Write your answer in the space provided on the question paper.',
      partSkill: 'writing',
      questions: writingPartQuestions,
    });
  }

  // 5. Part 5: Speaking Interview Prompts (if requested)
  if (isSpeaking) {
    const speakingQuestions: CambridgeQuestion[] = [
      {
        id: `camb-speak-${qNum}`,
        part: parts.length + 1,
        partTitle: `Part ${parts.length + 1}: Speaking Interview`,
        instructions: 'Listen to the examiner question and answer clearly with full sentences.',
        question: `Examiner: "Now let's talk about your daily activities and interests. Can you tell me what you enjoy doing in your free time, especially regarding ${rawVocabs[1]?.word || 'creative hobbies'}?"`,
        audioScript: `Examiner: Good morning. Now let's talk about your free time and hobbies. Can you tell me what you enjoy doing after school, especially regarding ${rawVocabs[1]?.word || 'creative projects'}?`,
        options: [],
        correctIndex: 0,
        explanation: 'Thí sinh phát âm rõ ràng, sử dụng câu ghép và mở rộng câu trả lời với lý do.',
        focusArea: 'Spoken Interaction & Fluency',
        mark: 5,
        sampleAnswer: `In my free time, I really enjoy reading books and practicing ${rawVocabs[1]?.word || 'sports'} with my classmates. It helps me relax after intensive study sessions and keeps me energized for the whole week.`,
        scoringRubric: 'Grammar and Vocabulary: Accurate structures. Pronunciation: Intelligible and natural rhythm. Interactive Communication: Quick response without hesitation.',
        questionType: 'speaking_prompt',
      },
    ];
    allQuestions.push(speakingQuestions[0]!);
    qNum += 1;

    parts.push({
      partNumber: parts.length + 1,
      title: `Part ${parts.length}: Speaking Interaction`,
      instructions: 'Respond to the questions asked by the examiner.',
      partSkill: 'speaking',
      audioScript: speakingQuestions[0]?.audioScript,
      questions: speakingQuestions,
    });
  }

  return {
    id: `cambridge-exam-${Date.now()}`,
    title: `${levelInfo.qualificationName} — ${paperTitle}`,
    qualificationName: levelInfo.qualificationName,
    levelBadge: levelInfo.badge,
    paperName: paperTitle,
    examCode,
    timeMinutes: config.questionCount <= 10 ? 20 : config.questionCount <= 20 ? 35 : levelInfo.defaultTime,
    totalMarks: allQuestions.reduce((acc, q) => acc + (q.mark || 1), 0),
    bookTitle: book.title,
    unitTitle: unit.title,
    lessonTitles: knowledge.topics,
    parts,
    questions: allQuestions,
    instructionsToCandidates: [
      'Write your name, centre number and candidate number in the spaces at the top of this page.',
      'Answer all questions. Write your answers on the question paper.',
      'Read the instructions for each part carefully before answering.',
      isListening ? 'For the listening test, you will hear each recording twice.' : '',
      'Dictionaries and electronic devices are NOT permitted.',
    ].filter(Boolean),
    informationForCandidates: [
      `There are ${allQuestions.length} items on this question paper.`,
      `The total score for this paper is ${allQuestions.reduce((acc, q) => acc + (q.mark || 1), 0)} marks.`,
    ],
    generatedAt: new Date().toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    hasListening: isListening,
    hasSpeaking: isSpeaking,
    hasWriting: isWriting,
    hasReading: true,
    fullListeningScript: fullAudioScript || undefined,
    aiEngineUsed: 'Smart Pedagogical Engine (Varied Mode)',
  };
}
