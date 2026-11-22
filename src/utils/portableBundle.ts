import JSZip from 'jszip';
import type { Book, BrandingConfig, HubState, PortableManifest } from '../types/academic';
import { DEFAULT_BRANDING, HUB_SCHEMA_VERSION } from '../data/seedData';
import { isSafeImageSrc } from './htmlInspector';
import { sanitizeSlug } from './storage';

export { HUB_SCHEMA_VERSION };
export type { PortableManifest };

export interface BundleStats {
  bookCount: number;
  unitCount: number;
  lessonCount: number;
  contentCount: number;
  htmlCount: number;
}

export function computeCurriculumStats(books: Book[]): BundleStats {
  let unitCount = 0;
  let lessonCount = 0;
  let contentCount = 0;
  let htmlCount = 0;

  for (const book of books) {
    unitCount += book.units.length;
    for (const unit of book.units) {
      lessonCount += unit.lessons.length;
      for (const lesson of unit.lessons) {
        contentCount += lesson.contents.length;
        for (const content of lesson.contents) {
          if (content.type === 'interactive-html' && content.htmlContent) {
            htmlCount += 1;
          }
        }
      }
    }
  }

  return {
    bookCount: books.length,
    unitCount,
    lessonCount,
    contentCount,
    htmlCount,
  };
}

export function buildPortableTreePreview(books: Book[]): string[] {
  const lines: string[] = [
    'hub-manifest.json',
    'config/branding.json',
    'README.txt',
  ];

  books.forEach((book, bIdx) => {
    const bSlug = `${String(bIdx + 1).padStart(2, '0')}-${sanitizeSlug(book.title, 'book')}`;
    lines.push(`books/${bSlug}/`);
    book.units.forEach((unit, uIdx) => {
      const uSlug = `unit-${String(uIdx + 1).padStart(2, '0')}-${sanitizeSlug(unit.title, 'unit')}`;
      lines.push(`  └── ${uSlug}/`);
      unit.lessons.forEach((lesson, lIdx) => {
        const lSlug = `lesson-${String(lIdx + 1).padStart(2, '0')}-${sanitizeSlug(lesson.title, 'lesson')}`;
        lines.push(`      └── ${lSlug}/`);
        lesson.contents.forEach((content) => {
          const ext = content.type === 'interactive-html' ? 'html' : content.type === 'quiz' ? 'quiz.json' : 'md';
          const cSlug = sanitizeSlug(content.title, 'content');
          lines.push(`          └── ${cSlug}.${ext}`);
        });
      });
    });
  });

  return lines;
}

export async function exportPortableZipBundle(state: HubState): Promise<{ blob: Blob; filename: string; stats: BundleStats }> {
  const zip = new JSZip();
  const stats = computeCurriculumStats(state.books);
  const exportedAt = new Date().toISOString();

  const manifest: PortableManifest = {
    schemaVersion: HUB_SCHEMA_VERSION,
    format: 'interactive-academic-hub-bundle',
    exportedAt,
    appName: state.branding.appName,
    stats: {
      bookCount: stats.bookCount,
      unitCount: stats.unitCount,
      lessonCount: stats.lessonCount,
      contentCount: stats.contentCount,
      htmlFilesIncluded: stats.htmlCount,
    },
    brandingFile: 'config/branding.json',
    books: state.books,
  };

  zip.file('hub-manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('config/branding.json', JSON.stringify(state.branding, null, 2));

  const readmeLines = [
    `INTERACTIVE ACADEMIC HUB — PORTABLE LOCAL-FIRST BUNDLE`,
    `======================================================`,
    `Ứng dụng: ${state.branding.appName}`,
    `Đơn vị: ${state.branding.institutionName}`,
    `Thời điểm đóng gói: ${exportedAt}`,
    `Phiên bản cấu trúc: ${HUB_SCHEMA_VERSION}`,
    ``,
    `Thống kê phân cấp (Strict Hierarchy: Book > Unit > Lesson > Content):`,
    `- Số sách (Books): ${stats.bookCount}`,
    `- Số chương (Units): ${stats.unitCount}`,
    `- Số bài học (Lessons): ${stats.lessonCount}`,
    `- Tổng học liệu chi tiết (Detailed Contents): ${stats.contentCount}`,
    `- Tệp HTML tương tác độc lập: ${stats.htmlCount}`,
    ``,
    `Hướng dẫn đồng bộ sang thiết bị khác:`,
    `1. Mở Interactive Academic Hub trên máy tính đích.`,
    `2. Vào mục "Đồng bộ & Gói dữ liệu" -> Chọn "Nhập gói dữ liệu (.zip / .json)".`,
    `3. Chọn tệp ZIP này để khôi phục toàn bộ sách, bài học HTML5 và cấu hình thương hiệu.`,
  ];
  zip.file('README.txt', readmeLines.join('\n'));

  // Write standalone files in strict Book > Unit > Lesson > Content directory hierarchy
  state.books.forEach((book, bIdx) => {
    const bSlug = `${String(bIdx + 1).padStart(2, '0')}-${sanitizeSlug(book.title, 'book')}`;
    book.units.forEach((unit, uIdx) => {
      const uSlug = `unit-${String(uIdx + 1).padStart(2, '0')}-${sanitizeSlug(unit.title, 'unit')}`;
      unit.lessons.forEach((lesson, lIdx) => {
        const lSlug = `lesson-${String(lIdx + 1).padStart(2, '0')}-${sanitizeSlug(lesson.title, 'lesson')}`;
        const basePath = `books/${bSlug}/${uSlug}/${lSlug}`;

        lesson.contents.forEach((content) => {
          const cSlug = sanitizeSlug(content.title, content.id);
          if (content.type === 'interactive-html' && content.htmlContent) {
            zip.file(`${basePath}/${cSlug}.html`, content.htmlContent);
          } else if (content.type === 'reading' && content.readingMarkdown) {
            zip.file(`${basePath}/${cSlug}.md`, content.readingMarkdown);
          } else if (content.type === 'quiz' && content.quizQuestions) {
            zip.file(`${basePath}/${cSlug}.quiz.json`, JSON.stringify(content.quizQuestions, null, 2));
          } else if (content.type === 'game' && content.quizQuestions) {
            zip.file(`${basePath}/${cSlug}.game.json`, JSON.stringify(content.quizQuestions, null, 2));
          } else if (content.type === 'simulation') {
            zip.file(`${basePath}/${cSlug}.sim.json`, JSON.stringify({ simulationType: content.simulationType }, null, 2));
          }
        });
      });
    });
  });

  // Store custom uploaded logo separately inside assets/ if present
  if (state.branding.logoDataUrl && state.branding.logoDataUrl.startsWith('data:image/')) {
    const match = state.branding.logoDataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/i);
    if (match) {
      const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
      zip.file(`assets/brand-logo.${ext}`, match[2], { base64: true });
    }
  }

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const dateStamp = exportedAt.slice(0, 10);
  const filename = `${sanitizeSlug(state.branding.appName, 'academic-hub')}-bundle-${dateStamp}.zip`;
  return { blob, filename, stats };
}

export function exportJsonSnapshot(state: HubState): { blob: Blob; filename: string } {
  const payload: HubState = {
    ...state,
    schemaVersion: HUB_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename = `${sanitizeSlug(state.branding.appName, 'academic-hub')}-snapshot-${dateStamp}.json`;
  return { blob, filename };
}

export function validateAndSanitizeBranding(raw: unknown): BrandingConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT_BRANDING;
  const candidate = raw as Partial<BrandingConfig>;
  const safeLogo = isSafeImageSrc(candidate.logoDataUrl) ? candidate.logoDataUrl ?? null : null;
  const hexRegex = /^#[0-9a-fA-F]{6}$/;

  return {
    appName: typeof candidate.appName === 'string' && candidate.appName.trim() ? candidate.appName.trim().slice(0, 60) : DEFAULT_BRANDING.appName,
    institutionName:
      typeof candidate.institutionName === 'string' && candidate.institutionName.trim()
        ? candidate.institutionName.trim().slice(0, 120)
        : DEFAULT_BRANDING.institutionName,
    accentPresetId: typeof candidate.accentPresetId === 'string' ? candidate.accentPresetId : DEFAULT_BRANDING.accentPresetId,
    customAccentHex: typeof candidate.customAccentHex === 'string' && hexRegex.test(candidate.customAccentHex) ? candidate.customAccentHex : DEFAULT_BRANDING.customAccentHex,
    customAccentHoverHex:
      typeof candidate.customAccentHoverHex === 'string' && hexRegex.test(candidate.customAccentHoverHex)
        ? candidate.customAccentHoverHex
        : DEFAULT_BRANDING.customAccentHoverHex,
    logoDataUrl: safeLogo,
    themeMode: candidate.themeMode === 'dark' ? 'dark' : 'light',
  };
}

export function validateBooksStrictHierarchy(rawBooks: unknown): Book[] {
  if (!Array.isArray(rawBooks)) {
    throw new Error('Cấu trúc dữ liệu không hợp lệ: thiếu danh sách Sách (books[]).');
  }

  return rawBooks.map((b, bIndex) => {
    if (!b || typeof b !== 'object') {
      throw new Error(`Mục Sách thứ ${bIndex + 1} không đúng định dạng đối tượng.`);
    }
    const book = b as Partial<Book>;
    if (typeof book.title !== 'string' || !book.title.trim()) {
      throw new Error(`Sách thứ ${bIndex + 1} thiếu tiêu đề bắt buộc.`);
    }
    const units = Array.isArray(book.units) ? book.units : [];
    return {
      id: typeof book.id === 'string' && book.id ? book.id : `book-${Date.now()}-${bIndex}`,
      title: book.title.trim(),
      subject: typeof book.subject === 'string' ? book.subject : 'Học thuật',
      gradeLevel: typeof book.gradeLevel === 'string' ? book.gradeLevel : 'Tổng quát',
      author: typeof book.author === 'string' ? book.author : 'Biên soạn nội bộ',
      description: typeof book.description === 'string' ? book.description : '',
      coverImage: isSafeImageSrc(book.coverImage) ? book.coverImage! : '',
      updatedAt: typeof book.updatedAt === 'string' ? book.updatedAt : new Date().toISOString(),
      units: units.map((u, uIndex) => {
        const unit = u as Partial<Book['units'][number]>;
        const lessons = Array.isArray(unit.lessons) ? unit.lessons : [];
        return {
          id: typeof unit.id === 'string' && unit.id ? unit.id : `unit-${Date.now()}-${bIndex}-${uIndex}`,
          order: typeof unit.order === 'number' ? unit.order : uIndex + 1,
          title: typeof unit.title === 'string' && unit.title.trim() ? unit.title.trim() : `Chương ${uIndex + 1}`,
          description: typeof unit.description === 'string' ? unit.description : '',
          lessons: lessons.map((l, lIndex) => {
            const lesson = l as Partial<Book['units'][number]['lessons'][number]>;
            const contents = Array.isArray(lesson.contents) ? lesson.contents : [];
            return {
              id: typeof lesson.id === 'string' && lesson.id ? lesson.id : `lesson-${Date.now()}-${bIndex}-${uIndex}-${lIndex}`,
              order: typeof lesson.order === 'number' ? lesson.order : lIndex + 1,
              title: typeof lesson.title === 'string' && lesson.title.trim() ? lesson.title.trim() : `Bài học ${lIndex + 1}`,
              summary: typeof lesson.summary === 'string' ? lesson.summary : '',
              objectives: Array.isArray(lesson.objectives) ? lesson.objectives.filter((o): o is string => typeof o === 'string') : [],
              contents: contents.map((c, cIndex) => {
                const content = c as Partial<Book['units'][number]['lessons'][number]['contents'][number]>;
                const validType =
                  content.type === 'interactive-html' ||
                  content.type === 'quiz' ||
                  content.type === 'reading' ||
                  content.type === 'game' ||
                  content.type === 'simulation'
                    ? content.type
                    : 'reading';
                return {
                  id: typeof content.id === 'string' && content.id ? content.id : `content-${Date.now()}-${bIndex}-${uIndex}-${lIndex}-${cIndex}`,
                  title: typeof content.title === 'string' && content.title.trim() ? content.title.trim() : `Học liệu ${cIndex + 1}`,
                  type: validType,
                  description: typeof content.description === 'string' ? content.description : '',
                  estimatedMinutes: typeof content.estimatedMinutes === 'number' && content.estimatedMinutes > 0 ? content.estimatedMinutes : 5,
                  htmlContent: typeof content.htmlContent === 'string' ? content.htmlContent : undefined,
                  readingMarkdown: typeof content.readingMarkdown === 'string' ? content.readingMarkdown : undefined,
                  quizQuestions: Array.isArray(content.quizQuestions) ? content.quizQuestions : undefined,
                  gameType: typeof content.gameType === 'string' ? content.gameType : undefined,
                  simulationType: typeof content.simulationType === 'string' ? content.simulationType : undefined,
                  sourceFilename: typeof content.sourceFilename === 'string' ? content.sourceFilename : undefined,
                  updatedAt: typeof content.updatedAt === 'string' ? content.updatedAt : new Date().toISOString(),
                };
              }),
            };
          }),
        };
      }),
    };
  });
}

export async function parseImportedFile(file: File): Promise<{
  state: HubState;
  stats: BundleStats;
  sourceType: 'zip' | 'json';
}> {
  if (file.size > 300 * 1024 * 1024) {
    throw new Error('Dung lượng tệp vượt quá giới hạn an toàn 300 MB.');
  }

  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith('.zip')) {
    const zip = await JSZip.loadAsync(file);
    const entryCount = Object.keys(zip.files).length;
    if (entryCount > 800) {
      throw new Error('Gói ZIP chứa quá nhiều tệp con (tối đa 800 tệp).');
    }

    const manifestFile = zip.file('hub-manifest.json');
    if (!manifestFile) {
      throw new Error('Không tìm thấy tệp hub-manifest.json trong gói ZIP. Hãy đảm bảo tệp được xuất từ Interactive Academic Hub.');
    }

    const manifestJson = JSON.parse(await manifestFile.async('string')) as Partial<PortableManifest>;
    const books = validateBooksStrictHierarchy(manifestJson.books);

    let branding = DEFAULT_BRANDING;
    const brandingFile = zip.file('config/branding.json');
    if (brandingFile) {
      branding = validateAndSanitizeBranding(JSON.parse(await brandingFile.async('string')));
    }

    const state: HubState = {
      schemaVersion: typeof manifestJson.schemaVersion === 'string' ? manifestJson.schemaVersion : HUB_SCHEMA_VERSION,
      exportedAt: manifestJson.exportedAt,
      branding,
      books,
    };

    return { state, stats: computeCurriculumStats(books), sourceType: 'zip' };
  }

  if (lowerName.endsWith('.json')) {
    const text = await file.text();
    const parsed = JSON.parse(text) as Partial<HubState>;
    const books = validateBooksStrictHierarchy(parsed.books);
    const branding = validateAndSanitizeBranding(parsed.branding);

    const state: HubState = {
      schemaVersion: typeof parsed.schemaVersion === 'string' ? parsed.schemaVersion : HUB_SCHEMA_VERSION,
      exportedAt: parsed.exportedAt,
      branding,
      books,
    };

    return { state, stats: computeCurriculumStats(books), sourceType: 'json' };
  }

  throw new Error('Định dạng không được hỗ trợ. Vui lòng chọn tệp .zip hoặc .json.');
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function saveBundleToLocalDirectory(state: HubState): Promise<{ directoryName: string; filesWritten: number }> {
  const picker = (window as unknown as { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker;
  if (!picker) {
    throw new Error('Trình duyệt hiện tại hoặc khung xem trước không hỗ trợ ghi trực tiếp thư mục PC. Hãy dùng tính năng Xuất gói ZIP.');
  }

  const rootDir = await picker();
  let filesWritten = 0;

  async function writeFile(dir: FileSystemDirectoryHandle, name: string, content: string) {
    const handle = await dir.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
    filesWritten += 1;
  }

  const stats = computeCurriculumStats(state.books);
  const manifest: PortableManifest = {
    schemaVersion: HUB_SCHEMA_VERSION,
    format: 'interactive-academic-hub-bundle',
    exportedAt: new Date().toISOString(),
    appName: state.branding.appName,
    stats: {
      bookCount: stats.bookCount,
      unitCount: stats.unitCount,
      lessonCount: stats.lessonCount,
      contentCount: stats.contentCount,
      htmlFilesIncluded: stats.htmlCount,
    },
    brandingFile: 'config/branding.json',
    books: state.books,
  };

  await writeFile(rootDir, 'hub-manifest.json', JSON.stringify(manifest, null, 2));

  const configDir = await rootDir.getDirectoryHandle('config', { create: true });
  await writeFile(configDir, 'branding.json', JSON.stringify(state.branding, null, 2));

  const booksDir = await rootDir.getDirectoryHandle('books', { create: true });
  for (let bIdx = 0; bIdx < state.books.length; bIdx += 1) {
    const book = state.books[bIdx];
    const bDir = await booksDir.getDirectoryHandle(
      `${String(bIdx + 1).padStart(2, '0')}-${sanitizeSlug(book.title, 'book')}`,
      { create: true }
    );
    for (let uIdx = 0; uIdx < book.units.length; uIdx += 1) {
      const unit = book.units[uIdx];
      const uDir = await bDir.getDirectoryHandle(
        `unit-${String(uIdx + 1).padStart(2, '0')}-${sanitizeSlug(unit.title, 'unit')}`,
        { create: true }
      );
      for (let lIdx = 0; lIdx < unit.lessons.length; lIdx += 1) {
        const lesson = unit.lessons[lIdx];
        const lDir = await uDir.getDirectoryHandle(
          `lesson-${String(lIdx + 1).padStart(2, '0')}-${sanitizeSlug(lesson.title, 'lesson')}`,
          { create: true }
        );
        for (const content of lesson.contents) {
          const cSlug = sanitizeSlug(content.title, content.id);
          if (content.type === 'interactive-html' && content.htmlContent) {
            await writeFile(lDir, `${cSlug}.html`, content.htmlContent);
          } else if (content.type === 'reading' && content.readingMarkdown) {
            await writeFile(lDir, `${cSlug}.md`, content.readingMarkdown);
          } else if (content.type === 'quiz' && content.quizQuestions) {
            await writeFile(lDir, `${cSlug}.quiz.json`, JSON.stringify(content.quizQuestions, null, 2));
          }
        }
      }
    }
  }

  return { directoryName: rootDir.name, filesWritten };
}
