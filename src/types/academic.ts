export type ContentType = 'interactive-html' | 'quiz' | 'reading' | 'game' | 'simulation';

export type GameType = 'speed-quiz' | 'flashcard-match' | 'wheel-fortune' | 'memory-matrix';
export type SimulationType = 'physics-projectile' | 'physics-pendulum' | 'math-fractal' | 'math-waves' | 'biology-cells';

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  bloomLevel?: 'remember' | 'understand' | 'apply' | 'analyze';
}

export interface DetailedContent {
  id: string;
  title: string;
  type: ContentType;
  description: string;
  estimatedMinutes: number;
  htmlContent?: string;
  readingMarkdown?: string;
  quizQuestions?: QuizQuestion[];
  gameType?: GameType;
  simulationType?: SimulationType;
  sourceFilename?: string;
  updatedAt: string;
  isCompleted?: boolean;
}

export interface Lesson {
  id: string;
  order: number;
  title: string;
  summary: string;
  objectives: string[];
  contents: DetailedContent[];
}

export interface Unit {
  id: string;
  order: number;
  title: string;
  description: string;
  lessons: Lesson[];
}

export interface Book {
  id: string;
  title: string;
  subject: string;
  gradeLevel: string;
  author: string;
  description: string;
  coverImage: string;
  updatedAt: string;
  units: Unit[];
}

export interface AccentPreset {
  id: string;
  name: string;
  accent: string;
  hover: string;
}

export interface BrandingConfig {
  appName: string;
  institutionName: string;
  accentPresetId: string;
  customAccentHex: string;
  customAccentHoverHex: string;
  logoDataUrl: string | null;
  themeMode: 'light' | 'dark';
}

export interface HubState {
  schemaVersion: string;
  exportedAt?: string;
  branding: BrandingConfig;
  books: Book[];
}

export interface SelectionPath {
  bookId: string | null;
  unitId: string | null;
  lessonId: string | null;
  contentId: string | null;
}

export interface HtmlAuditIssue {
  severity: 'pass' | 'warning' | 'error';
  code: string;
  label: string;
  detail: string;
}

export interface HtmlAuditReport {
  compatible: boolean;
  byteSize: number;
  scriptCount: number;
  styleCount: number;
  externalResourceCount: number;
  issues: HtmlAuditIssue[];
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  extractedHtmlBlocks?: string[];
}

export interface PortableManifest {
  schemaVersion: string;
  format: 'interactive-academic-hub-bundle';
  exportedAt: string;
  appName: string;
  stats: {
    bookCount: number;
    unitCount: number;
    lessonCount: number;
    contentCount: number;
    htmlFilesIncluded: number;
  };
  brandingFile: string;
  books: Book[];
}
