export type CambridgeLevel =
  | 'starters'
  | 'movers'
  | 'flyers'
  | 'ket_a2'
  | 'pet_b1'
  | 'fce_b2'
  | 'gdpt_cambridge';

export type CambridgeExamType =
  | 'reading_and_use_of_english'
  | 'reading'
  | 'writing'
  | 'listening'
  | 'speaking'
  | 'reading_and_writing'
  | 'listening_and_speaking'
  | 'comprehensive_4_skills'
  | 'vocabulary_grammar_focus'
  | 'reading_comprehension'
  | 'cloze_and_sentence';

export type AiProvider = 'gemini' | 'openai';

export interface CambridgeQuestion {
  id: string;
  part: number;
  partTitle: string;
  instructions: string;
  contextText?: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  focusArea: string;
  mark: number;
  audioScript?: string;
  sampleAnswer?: string;
  scoringRubric?: string;
  questionType?:
    | 'multiple_choice'
    | 'gap_fill'
    | 'open_cloze'
    | 'sentence_transformation'
    | 'short_writing'
    | 'speaking_prompt';
}

export interface CambridgePart {
  partNumber: number;
  title: string;
  instructions: string;
  passage?: string;
  audioScript?: string;
  partSkill?: 'reading' | 'writing' | 'listening' | 'speaking' | 'use_of_english';
  questions: CambridgeQuestion[];
}

export interface CambridgeExam {
  id: string;
  title: string;
  qualificationName: string;
  levelBadge: string;
  paperName: string;
  examCode: string;
  timeMinutes: number;
  totalMarks: number;
  bookTitle: string;
  unitTitle: string;
  lessonTitles: string[];
  parts: CambridgePart[];
  questions: CambridgeQuestion[];
  instructionsToCandidates: string[];
  informationForCandidates: string[];
  generatedAt: string;
  hasListening?: boolean;
  hasSpeaking?: boolean;
  hasWriting?: boolean;
  hasReading?: boolean;
  fullListeningScript?: string;
  aiEngineUsed?: string;
}

export interface CambridgeGeneratorConfig {
  level: CambridgeLevel;
  examType: CambridgeExamType;
  questionCount: 10 | 15 | 20 | 25 | 40;
  customTitle?: string;
  includeExplanations: boolean;
  provider?: AiProvider;
  model?: string;
  apiKey?: string;
}
