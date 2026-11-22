import type { Book, BrandingConfig, HubState } from '../types/academic';
import {
  computeCurriculumStats,
  validateAndSanitizeBranding,
  validateBooksStrictHierarchy,
  HUB_SCHEMA_VERSION,
  type PortableManifest,
} from './portableBundle';
import { sanitizeSlug } from './storage';

export interface DirectorySyncInfo {
  name: string;
  lastSyncAt: string | null;
  autoSync: boolean;
  filesWritten?: number;
}

export function isDirectoryPickerSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export async function verifyDirectoryPermission(
  handle: FileSystemDirectoryHandle,
  requestIfNeeded = true
): Promise<boolean> {
  try {
    const opts: FileSystemHandlePermissionDescriptor = { mode: 'readwrite' };
    const query = await (handle as unknown as { queryPermission: (o: FileSystemHandlePermissionDescriptor) => Promise<string> }).queryPermission(opts);
    if (query === 'granted') return true;
    if (requestIfNeeded) {
      const request = await (handle as unknown as { requestPermission: (o: FileSystemHandlePermissionDescriptor) => Promise<string> }).requestPermission(opts);
      return request === 'granted';
    }
    return false;
  } catch {
    return false;
  }
}

export async function pickLocalDirectory(): Promise<{
  handle: FileSystemDirectoryHandle;
  name: string;
  hasExistingManifest: boolean;
}> {
  const picker = (window as unknown as { showDirectoryPicker?: (options?: { mode?: string }) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker;
  if (!picker) {
    throw new Error('Trình duyệt hiện tại không hỗ trợ Web File System Access API. Hãy sử dụng Google Chrome hoặc Microsoft Edge trên máy tính để chọn thư mục.');
  }

  const handle = await picker({ mode: 'readwrite' });
  const hasPerm = await verifyDirectoryPermission(handle, true);
  if (!hasPerm) {
    throw new Error('Bạn chưa cấp quyền ghi vào thư mục này. Vui lòng cho phép quyền ghi để ứng dụng có thể lưu trữ.');
  }

  let hasExistingManifest = false;
  try {
    await handle.getFileHandle('hub-manifest.json');
    hasExistingManifest = true;
  } catch {
    hasExistingManifest = false;
  }

  return { handle, name: handle.name, hasExistingManifest };
}

export async function readStateFromDirectory(
  handle: FileSystemDirectoryHandle
): Promise<{ state: HubState; bookCount: number; lessonCount: number; htmlCount: number }> {
  const hasPerm = await verifyDirectoryPermission(handle, true);
  if (!hasPerm) {
    throw new Error('Chưa có quyền đọc thư mục. Vui lòng cấp quyền truy cập để nạp dữ liệu.');
  }

  const manifestFileHandle = await handle.getFileHandle('hub-manifest.json');
  const manifestFile = await manifestFileHandle.getFile();
  const manifestText = await manifestFile.text();
  const rawManifest = JSON.parse(manifestText) as Partial<PortableManifest>;

  const books = validateBooksStrictHierarchy(rawManifest.books);

  let branding: BrandingConfig = {
    appName: 'Interactive Academic Hub',
    institutionName: 'Tổ Chuyên Môn / Trường Học',
    accentPresetId: 'emerald',
    customAccentHex: '#059669',
    customAccentHoverHex: '#047857',
    logoDataUrl: null,
    themeMode: 'light',
  };

  try {
    const configDir = await handle.getDirectoryHandle('config');
    const brandingFileHandle = await configDir.getFileHandle('branding.json');
    const brandingFile = await brandingFileHandle.getFile();
    const brandingText = await brandingFile.text();
    branding = validateAndSanitizeBranding(JSON.parse(brandingText));
  } catch {
    // If branding.json doesn't exist, use default
  }

  const stats = computeCurriculumStats(books);
  const state: HubState = {
    schemaVersion: HUB_SCHEMA_VERSION,
    branding,
    books,
  };

  return {
    state,
    bookCount: stats.bookCount,
    lessonCount: stats.lessonCount,
    htmlCount: stats.htmlCount,
  };
}

export async function writeStateToDirectory(
  handle: FileSystemDirectoryHandle,
  state: HubState
): Promise<{ filesWritten: number; directoryName: string }> {
  const hasPerm = await verifyDirectoryPermission(handle, true);
  if (!hasPerm) {
    throw new Error('Chưa có quyền ghi vào thư mục. Vui lòng bấm Cho phép để lưu trữ dữ liệu.');
  }

  let filesWritten = 0;

  async function writeFile(dir: FileSystemDirectoryHandle, name: string, content: string) {
    const fileHandle = await dir.getFileHandle(name, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    filesWritten += 1;
  }

  const stats = computeCurriculumStats(state.books);

  // 1. Write hub-manifest.json
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
  await writeFile(handle, 'hub-manifest.json', JSON.stringify(manifest, null, 2));

  // 2. Write config/branding.json
  const configDir = await handle.getDirectoryHandle('config', { create: true });
  await writeFile(configDir, 'branding.json', JSON.stringify(state.branding, null, 2));

  // 3. Write structured books directory
  const booksDir = await handle.getDirectoryHandle('books', { create: true });
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

  // 4. Write Standalone Offline Launcher (Chay_Ung_Dung_Offline.html)
  const offlineHtml = generateOfflineStandaloneLauncherHtml(state);
  await writeFile(handle, 'Chay_Ung_Dung_Offline.html', offlineHtml);

  // 5. Write README / Guide for teachers
  const readmeContent = `==================================================================
INTERACTIVE ACADEMIC HUB - KHO LƯU TRỮ MÁY TÍNH CÁ NHÂN (LOCAL-FIRST)
==================================================================
Thư mục: ${handle.name}
Thời gian lưu: ${new Date().toLocaleString('vi-VN')}
Số lượng sách: ${stats.bookCount} sách
Số lượng bài học: ${stats.lessonCount} bài học
Số mô-đun HTML5 tương tác: ${stats.htmlCount} học liệu

------------------------------------------------------------------
HƯỚNG DẪN SỬ DỤNG VÀ GIẢNG DẠY OFFLINE TRÊN MÁY TÍNH
------------------------------------------------------------------
1. KHỞI CHẠY OFFLINE:
   - Nhấp đúp vào tệp "Chay_Ung_Dung_Offline.html" để mở ngay giao diện
     giảng dạy toàn bộ sách và bài học mà KHÔNG CẦN KẾT NỐI INTERNET.
   - Có thể sao chép toàn bộ thư mục này vào USB hoặc máy chiếu lớp học.

2. CẤU TRÚC TỆP TRONG THƯ MỤC:
   - hub-manifest.json : Tệp chứa toàn bộ cơ sở dữ liệu học liệu chuẩn.
   - config/           : Cấu hình nhận diện thương hiệu trường học, logo.
   - books/            : Các thư mục Sách -> Chương -> Bài học và các tệp
                         .html độc lập (có thể mở riêng lẻ từng trang).
   - Chay_Ung_Dung_Offline.html : Trình khởi chạy bài giảng trọn gói.

3. ĐỒNG BỘ VÀ SAO LƯU:
   - Khi sử dụng ứng dụng Interactive Academic Hub trên trình duyệt,
     chỉ cần chọn lại thư mục này để tiếp tục cập nhật và sửa đổi.
==================================================================
`;
  await writeFile(handle, 'HUONG_DAN_SU_DUNG.txt', readmeContent);

  return { filesWritten, directoryName: handle.name };
}

/**
 * Generates a self-contained offline HTML page that runs without internet.
 * Teachers can double-click this file in their local folder to teach!
 */
export function generateOfflineStandaloneLauncherHtml(state: HubState): string {
  const safeDataJson = JSON.stringify(state).replace(/<\/script>/gi, '<\\/script>');
  const appTitle = state.branding.appName || 'Interactive Academic Hub';
  const schoolName = state.branding.institutionName || 'Kho Sách Tương Tác';
  const accentHex = state.branding.customAccentHex || '#4f46e5';

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${appTitle} - Trình Giảng Dạy Ngoại Tuyến (Offline Local)</title>
  <style>
    :root {
      --accent: ${accentHex};
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --border: #e2e8f0;
      --text: #0f172a;
      --text-muted: #64748b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }
    header {
      background: #ffffff;
      border-bottom: 1px solid var(--border);
      padding: 10px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 15px;
      flex-shrink: 0;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .brand-title {
      font-weight: 700;
      font-size: 15px;
      color: var(--text);
    }
    .brand-sub {
      font-size: 11px;
      color: var(--text-muted);
    }
    .offline-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 20px;
      background: #ecfdf5;
      color: #065f46;
      border: 1px solid #a7f3d0;
      font-size: 11px;
      font-weight: 600;
    }
    .badge-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #10b981;
    }
    .main-layout {
      display: flex;
      flex: 1;
      height: calc(100vh - 57px);
      overflow: hidden;
    }
    aside {
      width: 320px;
      border-right: 1px solid var(--border);
      background: #ffffff;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    }
    .aside-header {
      padding: 12px;
      border-bottom: 1px solid var(--border);
    }
    .search-input {
      width: 100%;
      padding: 7px 12px;
      border-radius: 8px;
      border: 1px solid var(--border);
      font-size: 12px;
      outline: none;
    }
    .search-input:focus { border-color: var(--accent); }
    .tree-scroll {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
    }
    .book-select {
      width: 100%;
      padding: 8px;
      border-radius: 8px;
      border: 1px solid var(--border);
      font-weight: 600;
      font-size: 13px;
      margin-bottom: 12px;
      background: #f8fafc;
      color: var(--text);
      cursor: pointer;
    }
    .unit-block {
      margin-bottom: 10px;
    }
    .unit-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--text-muted);
      padding: 4px 8px;
      letter-spacing: 0.5px;
    }
    .lesson-block {
      margin-left: 6px;
      margin-bottom: 4px;
    }
    .lesson-title {
      font-size: 12px;
      font-weight: 600;
      color: #334155;
      padding: 4px 8px;
    }
    .content-btn {
      width: 100%;
      text-align: left;
      padding: 6px 10px;
      border-radius: 6px;
      border: none;
      background: transparent;
      font-size: 12px;
      color: #475569;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s;
    }
    .content-btn:hover {
      background: #f1f5f9;
      color: #0f172a;
    }
    .content-btn.active {
      background: var(--accent);
      color: #ffffff;
      font-weight: 600;
    }
    main {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: #0f172a;
      overflow: hidden;
      position: relative;
    }
    .content-toolbar {
      background: #ffffff;
      border-bottom: 1px solid var(--border);
      padding: 8px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-shrink: 0;
    }
    .toolbar-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .toolbar-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
    .btn-tool {
      padding: 6px 12px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: #ffffff;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn-tool:hover { background: #f8fafc; }
    .btn-present {
      background: var(--accent);
      color: #ffffff;
      border: none;
    }
    .btn-present:hover { opacity: 0.9; }
    .viewer-area {
      flex: 1;
      width: 100%;
      height: 100%;
      position: relative;
      background: #1e293b;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: none;
      background: #ffffff;
    }
    /* Presentation mode */
    body.is-presenting header,
    body.is-presenting aside,
    body.is-presenting .content-toolbar {
      display: none !important;
    }
    body.is-presenting .main-layout {
      height: 100vh !important;
    }
    .exit-btn {
      display: none;
      position: fixed;
      top: 15px;
      right: 15px;
      z-index: 9999;
      background: rgba(15, 23, 42, 0.85);
      color: #ffffff;
      border: 1px solid rgba(255,255,255,0.3);
      padding: 8px 16px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      backdrop-filter: blur(8px);
    }
    body.is-presenting .exit-btn {
      display: inline-flex;
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <div>
        <div class="brand-title">${appTitle}</div>
        <div class="brand-sub">${schoolName}</div>
      </div>
    </div>
    <div class="offline-badge">
      <span class="badge-dot"></span>
      <span>Đang chạy Ngoại Tuyến (Offline Local) từ Ổ đĩa PC</span>
    </div>
  </header>

  <button class="exit-btn" onclick="togglePresentation(false)">✕ Thoát toàn màn hình (Esc)</button>

  <div class="main-layout">
    <aside>
      <div class="aside-header">
        <select id="book-select" class="book-select" onchange="onBookChange(this.value)"></select>
        <input type="text" id="search-input" class="search-input" placeholder="Tìm kiếm bài học..." oninput="onFilter(this.value)">
      </div>
      <div id="tree-container" class="tree-scroll"></div>
    </aside>

    <main>
      <div class="content-toolbar">
        <div id="active-title" class="toolbar-title">Chọn học liệu để bắt đầu giảng dạy</div>
        <div class="toolbar-actions">
          <button class="btn-tool" onclick="reloadContent()">Tải lại</button>
          <button class="btn-tool btn-present" onclick="togglePresentation(true)">Toàn màn hình chiếu (F11)</button>
        </div>
      </div>
      <div class="viewer-area">
        <iframe id="content-frame" src="about:blank"></iframe>
      </div>
    </main>
  </div>

  <script id="hub-state-data" type="application/json">${safeDataJson}</script>

  <script>
    let state = null;
    let currentBook = null;
    let currentContent = null;

    try {
      const dataEl = document.getElementById('hub-state-data');
      state = JSON.parse(dataEl.textContent || '{}');
    } catch(e) {
      alert('Lỗi nạp dữ liệu offline: ' + e.message);
    }

    function init() {
      if (!state || !state.books || state.books.length === 0) {
        document.getElementById('active-title').textContent = 'Chưa có sách nào trong dữ liệu.';
        return;
      }
      const select = document.getElementById('book-select');
      select.innerHTML = '';
      state.books.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = b.title;
        select.appendChild(opt);
      });
      currentBook = state.books[0];
      renderTree();
      selectFirstContent();
    }

    function onBookChange(bookId) {
      currentBook = state.books.find(b => b.id === bookId) || state.books[0];
      renderTree();
      selectFirstContent();
    }

    function selectFirstContent() {
      if (!currentBook) return;
      const firstUnit = currentBook.units[0];
      const firstLesson = firstUnit ? firstUnit.lessons[0] : null;
      const firstContent = firstLesson ? firstLesson.contents[0] : null;
      if (firstContent) {
        loadContent(firstContent);
      }
    }

    function renderTree(filterQuery = '') {
      const container = document.getElementById('tree-container');
      container.innerHTML = '';
      if (!currentBook) return;

      const q = filterQuery.trim().toLowerCase();

      currentBook.units.forEach(unit => {
        const unitDiv = document.createElement('div');
        unitDiv.className = 'unit-block';

        const uTitle = document.createElement('div');
        uTitle.className = 'unit-title';
        uTitle.textContent = unit.title;
        unitDiv.appendChild(uTitle);

        unit.lessons.forEach(lesson => {
          const lessonDiv = document.createElement('div');
          lessonDiv.className = 'lesson-block';

          const lTitle = document.createElement('div');
          lTitle.className = 'lesson-title';
          lTitle.textContent = lesson.title;
          lessonDiv.appendChild(lTitle);

          lesson.contents.forEach(content => {
            if (q && !content.title.toLowerCase().includes(q) && !lesson.title.toLowerCase().includes(q)) {
              return;
            }
            const btn = document.createElement('button');
            btn.className = 'content-btn' + (currentContent && currentContent.id === content.id ? ' active' : '');
            btn.textContent = '📄 ' + content.title;
            btn.onclick = () => {
              loadContent(content);
              document.querySelectorAll('.content-btn').forEach(b => b.classList.remove('active'));
              btn.classList.add('active');
            };
            lessonDiv.appendChild(btn);
          });

          unitDiv.appendChild(lessonDiv);
        });

        container.appendChild(unitDiv);
      });
    }

    function onFilter(val) {
      renderTree(val);
    }

    function loadContent(content) {
      currentContent = content;
      document.getElementById('active-title').textContent = content.title + ' (' + (content.estimatedMinutes || 5) + ' phút)';
      const iframe = document.getElementById('content-frame');

      if (content.type === 'interactive-html' && content.htmlContent) {
        iframe.srcdoc = content.htmlContent;
      } else if (content.type === 'reading') {
        iframe.srcdoc = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:system-ui;padding:30px;line-height:1.7;color:#1e293b;max-width:800px;margin:0 auto;}</style></head><body>' + (content.readingMarkdown || 'Không có nội dung') + '</body></html>';
      } else if (content.type === 'quiz' && content.quizQuestions) {
        const questionsHtml = content.quizQuestions.map((q, idx) => {
          const opts = q.options.map((opt, oIdx) => '<div style="margin:6px 0;padding:8px 12px;border:1px solid #cbd5e1;border-radius:6px;background:#f8fafc;">' + String.fromCharCode(65 + oIdx) + '. ' + opt + '</div>').join('');
          return '<div style="margin-bottom:20px;padding:15px;border-radius:10px;background:#fff;border:1px solid #e2e8f0;"><div style="font-weight:700;margin-bottom:10px;">Câu ' + (idx + 1) + ': ' + q.question + '</div>' + opts + '</div>';
        }).join('');
        iframe.srcdoc = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:system-ui;background:#f1f5f9;padding:30px;color:#0f172a;max-width:800px;margin:0 auto;}</style></head><body><h2 style="margin-bottom:20px;">' + content.title + '</h2>' + questionsHtml + '</body></html>';
      } else {
        iframe.srcdoc = '<!DOCTYPE html><html><body style="font-family:system-ui;padding:40px;text-align:center;color:#64748b;"><h3>Chưa có dữ liệu nội dung hiển thị</h3></body></html>';
      }
    }

    function reloadContent() {
      if (currentContent) loadContent(currentContent);
    }

    function togglePresentation(enable) {
      if (enable) {
        document.body.classList.add('is-presenting');
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } else {
        document.body.classList.remove('is-presenting');
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
    }

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') togglePresentation(false);
    });

    window.addEventListener('DOMContentLoaded', init);
  </script>
</body>
</html>`;
}
