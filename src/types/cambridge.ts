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
  | 'vocabulary_grammar_focus'
  | 'reading_comprehension'
  | 'cloze_and_sentence';

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
}

export interface CambridgePart {
  partNumber: number;
  title: string;
  instructions: string;
  passage?: string;
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
}

export interface CambridgeGeneratorConfig {
  level: CambridgeLevel;
  examType: CambridgeExamType;
  questionCount: 10 | 15 | 20 | 25 | 40;
  customTitle?: string;
  includeExplanations: boolean;
}
