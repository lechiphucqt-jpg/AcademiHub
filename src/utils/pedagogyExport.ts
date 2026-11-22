import JSZip from 'jszip';
import type { Book, DetailedContent, Lesson, QuizQuestion, Unit } from '../types/academic';
import { triggerBlobDownload } from './portableBundle';

// XML Escaping helper
function escapeXml(unsafe: string | null | undefined): string {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Strip markdown formatting for plain text insertion
function stripMarkdown(md: string): string {
  return md
    .replace(/^#+\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`{1,3}(.*?)`{1,3}/g, '$1')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .trim();
}

/**
 * 1. Xuất Đề thi trắc nghiệm ra Microsoft Word (.docx)
 * Chuẩn định dạng đề thi của Bộ GD&ĐT:
 * - Tiêu đề trường / tổ chuyên môn
 * - Tiêu đề bài thi, môn học, thời gian
 * - Danh sách câu hỏi có 4 phương án A, B, C, D rõ ràng
 * - Ngắt trang sang BẢNG ĐÁP ÁN & HƯỚNG DẪN GIẢI CHI TIẾT
 */
export async function exportExamDocx({
  institutionName,
  book,
  unit,
  lesson,
  questions,
  examTitle,
}: {
  institutionName: string;
  book?: Book | null;
  unit?: Unit | null;
  lesson?: Lesson | null;
  questions: QuizQuestion[];
  examTitle?: string;
}): Promise<void> {
  if (questions.length === 0) {
    throw new Error('Không có câu hỏi trắc nghiệm nào để xuất đề thi.');
  }

  const title = examTitle || `ĐỀ KIỂM TRA ĐÁNH GIÁ ĐỊNH KỲ`;
  const subjectName = book?.subject || 'HỌC PHẦN HỌC THUẬT';
  const grade = book?.gradeLevel ? ` - KHỐI ${book.gradeLevel.toUpperCase()}` : '';
  const scope = lesson ? `Bài: ${lesson.title}` : unit ? `Chương: ${unit.title}` : book?.title || '';

  // Generate Document XML paragraphs
  let docXmlContent = `
    <!-- Header Block -->
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>${escapeXml(institutionName || 'TRƯỜNG TRUNG HỌC PHỔ THÔNG CHUYÊN')}</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="1E3A8A"/></w:rPr><w:t>${escapeXml(title.toUpperCase())}</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:i/><w:sz w:val="22"/></w:rPr><w:t>Môn: ${escapeXml(subjectName)}${escapeXml(grade)} | ${escapeXml(scope)}</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:i/><w:sz w:val="20"/></w:rPr><w:t>Thời gian làm bài: ${Math.max(15, questions.length * 2)} phút (Không kể thời gian phát đề)</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="4" w:color="CBD5E1"/></w:pBdr><w:spacing w:after="240"/></w:pPr>
    </w:p>
    
    <!-- Candidate Info -->
    <w:p>
      <w:pPr><w:spacing w:after="200"/></w:pPr>
      <w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t>Họ và tên thí sinh: .................................................................................... Số báo danh: ........................ Lớp: ..............</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:spacing w:after="240"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="0F172A"/></w:rPr><w:t>I. PHẦN CÂU HỎI TRẮC NGHIỆM (${questions.length} câu - ${(10).toFixed(1)} điểm)</w:t></w:r>
    </w:p>
  `;

  // Render Each Question
  questions.forEach((q, index) => {
    docXmlContent += `
      <w:p>
        <w:pPr><w:spacing w:before="160" w:after="80"/></w:pPr>
        <w:r><w:rPr><w:b/><w:sz w:val="23"/><w:color w:val="1E293B"/></w:rPr><w:t>Câu ${index + 1}: </w:t></w:r>
        <w:r><w:rPr><w:sz w:val="23"/></w:rPr><w:t>${escapeXml(q.question)}</w:t></w:r>
      </w:p>
    `;

    const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
    q.options.forEach((opt, optIndex) => {
      const label = labels[optIndex] || `${optIndex + 1}`;
      docXmlContent += `
        <w:p>
          <w:pPr><w:ind w:left="480"/><w:spacing w:after="40"/></w:pPr>
          <w:r><w:rPr><w:b/><w:sz w:val="22"/></w:rPr><w:t>${label}. </w:t></w:r>
          <w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t>${escapeXml(opt)}</w:t></w:r>
        </w:p>
      `;
    });
  });

  // End of test page break
  docXmlContent += `
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:before="240" w:after="240"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="22"/></w:rPr><w:t>---------- HẾT ----------</w:t></w:r>
    </w:p>
    <w:p><w:r><w:br w:type="page"/></w:r></w:p>

    <!-- Page 2: Answer Keys & Explanations -->
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="200"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="26"/><w:color w:val="1E3A8A"/></w:rPr><w:t>II. BẢNG ĐÁP ÁN &amp; HƯỚNG DẪN GIẢI CHI TIẾT</w:t></w:r>
    </w:p>
  `;

  // Render Table of Answers
  docXmlContent += `
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9200" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:left w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <w:tc><w:tcPr><w:tcW w:w="1200" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Câu</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="1400" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Đáp án</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="6600" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Hướng dẫn giải chi tiết</w:t></w:r></w:p></w:tc>
      </w:tr>
  `;

  const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
  questions.forEach((q, index) => {
    const correctLetter = labels[q.correctIndex] || `Phương án ${q.correctIndex + 1}`;
    docXmlContent += `
      <w:tr>
        <w:tc><w:tcPr><w:tcW w:w="1200" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Câu ${index + 1}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="1400" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="16A34A"/></w:rPr><w:t>${correctLetter}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="6600" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>${escapeXml(q.explanation || 'Đáp án chính xác theo tài liệu học tập.')}</w:t></w:r></w:p></w:tc>
      </w:tr>
    `;
  });

  docXmlContent += `</w:tbl>`;

  // Assemble full DOCX ZIP
  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
      <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
    </Types>`
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
    </Relationships>`
  );

  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
    </Relationships>`
  );

  zip.file(
    'word/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:docDefaults>
        <w:rPrDefault>
          <w:rPr>
            <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
            <w:sz w:val="24"/>
            <w:szCs w:val="24"/>
            <w:lang w:val="vi-VN"/>
          </w:rPr>
        </w:rPrDefault>
      </w:docDefaults>
    </w:styles>`
  );

  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        ${docXmlContent}
        <w:sectPr>
          <w:pgSz w:w="11906" w:h="16838"/>
          <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1418" w:header="708" w:footer="708" w:gutter="0"/>
        </w:sectPr>
      </w:body>
    </w:document>`
  );

  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const filename = `De_thi_${subjectName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.docx`;
  triggerBlobDownload(blob, filename);
}

/**
 * 2. Xuất Kế hoạch bài dạy (Giáo án) theo Công văn 5512 ra Word (.docx)
 */
export async function exportLessonPlanDocx({
  institutionName,
  book,
  unit,
  lesson,
}: {
  institutionName: string;
  book: Book;
  unit: Unit;
  lesson: Lesson;
}): Promise<void> {
  const totalMinutes = lesson.contents.reduce((sum, c) => sum + (c.estimatedMinutes || 5), 0) || 45;

  let docContent = `
    <!-- Top Header -->
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t>SỞ GIÁO DỤC VÀ ĐÀO TẠO</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>${escapeXml(institutionName || 'TRƯỜNG TRUNG HỌC PHỔ THÔNG')}</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:before="120" w:after="160"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="30"/><w:color w:val="1E3A8A"/></w:rPr><w:t>KẾ HOẠCH BÀI DẠY (GIÁO ÁN ĐIỆN TỬ)</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="240"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="26"/></w:rPr><w:t>BÀI: ${escapeXml(lesson.title.toUpperCase())}</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="240"/></w:pPr>
      <w:r><w:rPr><w:i/><w:sz w:val="22"/></w:rPr><w:t>Môn: ${escapeXml(book.subject)} ${escapeXml(book.gradeLevel)} | Chương: ${escapeXml(unit.title)} | Thời lượng: ${totalMinutes} phút</w:t></w:r>
    </w:p>

    <!-- Part I: Objectives -->
    <w:p>
      <w:pPr><w:spacing w:before="180" w:after="80"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="0F172A"/></w:rPr><w:t>I. MỤC TIÊU DẠY HỌC</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:rPr><w:b/><w:i/></w:rPr><w:t>1. Năng lực đặc thù &amp; Năng lực chung:</w:t></w:r>
    </w:p>
  `;

  lesson.objectives.forEach((obj) => {
    docContent += `
      <w:p>
        <w:pPr><w:ind w:left="360"/><w:spacing w:after="40"/></w:pPr>
        <w:r><w:rPr><w:b/></w:rPr><w:t>- </w:t></w:r>
        <w:r><w:t>${escapeXml(obj)}</w:t></w:r>
      </w:p>
    `;
  });

  docContent += `
    <w:p>
      <w:r><w:rPr><w:b/><w:i/></w:rPr><w:t>2. Phẩm chất chủ yếu:</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:ind w:left="360"/><w:spacing w:after="160"/></w:pPr>
      <w:r><w:t>- Phát triển tính tích cực, chủ động, sáng tạo khi tương tác với học liệu số; rèn luyện tư duy phản biện khoa học.</w:t></w:r>
    </w:p>

    <!-- Part II: Learning Equipment & Digital Content -->
    <w:p>
      <w:pPr><w:spacing w:before="180" w:after="80"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="0F172A"/></w:rPr><w:t>II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU SỐ</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>1. Giáo viên: Máy tính kết nối Internet, máy chiếu, nền tảng Interactive Academic Hub.</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>2. Học sinh: Thiết bị thông minh hoặc máy tính cá nhân để tương tác trực tiếp.</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>3. Danh mục học liệu số được tích hợp trong bài học:</w:t></w:r>
    </w:p>
  `;

  lesson.contents.forEach((c, idx) => {
    const typeLabel =
      c.type === 'interactive-html'
        ? 'Mô phỏng HTML5 tương tác'
        : c.type === 'quiz'
        ? 'Bộ câu hỏi trắc nghiệm tự chấm'
        : c.type === 'game'
        ? 'Minigame giáo dục'
        : c.type === 'simulation'
        ? 'Phòng thí nghiệm số STEM'
        : 'Tài liệu đọc hiểu số';

    docContent += `
      <w:p>
        <w:pPr><w:ind w:left="360"/><w:spacing w:after="40"/></w:pPr>
        <w:r><w:rPr><w:b/></w:rPr><w:t>${idx + 1}. [${escapeXml(typeLabel)}] </w:t></w:r>
        <w:r><w:t>${escapeXml(c.title)} (${c.estimatedMinutes} phút)</w:t></w:r>
      </w:p>
    `;
  });

  docContent += `
    <!-- Part III: Teaching Process -->
    <w:p>
      <w:pPr><w:spacing w:before="180" w:after="80"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="0F172A"/></w:rPr><w:t>III. TIẾN TRÌNH DẠY HỌC (THEO CÔNG VĂN 5512/BGDĐT)</w:t></w:r>
    </w:p>

    <!-- Activity 1 -->
    <w:p>
      <w:r><w:rPr><w:b/><w:color w:val="1E3A8A"/></w:rPr><w:t>Hoạt động 1: Mở đầu / Khởi động (5-7 phút)</w:t></w:r>
    </w:p>
    <w:p><w:pPr><w:ind w:left="240"/></w:pPr><w:r><w:i/><w:t>a) Mục tiêu: </w:t></w:r><w:r><w:t>Tạo hứng thú, kích thích tư duy và kết nối kiến thức thực tiễn về chủ đề ${escapeXml(lesson.title)}.</w:t></w:r></w:p>
    <w:p><w:pPr><w:ind w:left="240"/></w:pPr><w:r><w:i/><w:t>b) Nội dung: </w:t></w:r><w:r><w:t>Tham gia minigame khởi động hoặc thảo luận câu hỏi gợi mở trong nền tảng.</w:t></w:r></w:p>
    <w:p><w:pPr><w:ind w:left="240"/></w:pPr><w:r><w:i/><w:t>c) Sản phẩm: </w:t></w:r><w:r><w:t>Câu trả lời của học sinh trên bảng điểm số hoặc ghi chú sơ bộ.</w:t></w:r></w:p>
    <w:p><w:pPr><w:ind w:left="240"/></w:pPr><w:r><w:i/><w:t>d) Tổ chức thực hiện: </w:t></w:r><w:r><w:t>Giáo viên giao nhiệm vụ qua màn hình, học sinh trả lời nhanh.</w:t></w:r></w:p>

    <!-- Activity 2 -->
    <w:p>
      <w:r><w:rPr><w:b/><w:color w:val="1E3A8A"/></w:rPr><w:t>Hoạt động 2: Hình thành kiến thức mới (20-25 phút)</w:t></w:r>
    </w:p>
    <w:p><w:pPr><w:ind w:left="240"/></w:pPr><w:r><w:i/><w:t>a) Mục tiêu: </w:t></w:r><w:r><w:t>Chiếm lĩnh kiến thức trọng tâm: ${escapeXml(lesson.summary)}.</w:t></w:r></w:p>
    <w:p><w:pPr><w:ind w:left="240"/></w:pPr><w:r><w:i/><w:t>b) Nội dung: </w:t></w:r><w:r><w:t>Nghiên cứu tài liệu số và trực tiếp thao tác trên các mô phỏng tương tác HTML5.</w:t></w:r></w:p>
    <w:p><w:pPr><w:ind w:left="240"/></w:pPr><w:r><w:i/><w:t>c) Sản phẩm: </w:t></w:r><w:r><w:t>Bảng tổng kết kiến thức, sơ đồ tư duy hoặc kết quả tương tác mô phỏng.</w:t></w:r></w:p>
    <w:p><w:pPr><w:ind w:left="240"/></w:pPr><w:r><w:i/><w:t>d) Tổ chức thực hiện: </w:t></w:r><w:r><w:t>Học sinh làm việc nhóm hoặc độc lập, giáo viên quan sát và hỗ trợ.</w:t></w:r></w:p>

    <!-- Activity 3 -->
    <w:p>
      <w:r><w:rPr><w:b/><w:color w:val="1E3A8A"/></w:rPr><w:t>Hoạt động 3: Luyện tập &amp; Đánh giá (10-12 phút)</w:t></w:r>
    </w:p>
    <w:p><w:pPr><w:ind w:left="240"/></w:pPr><w:r><w:i/><w:t>a) Mục tiêu: </w:t></w:r><w:r><w:t>Củng cố và đánh giá mức độ hiểu bài thông qua bài trắc nghiệm có phản hồi tức thì.</w:t></w:r></w:p>
    <w:p><w:pPr><w:ind w:left="240"/></w:pPr><w:r><w:i/><w:t>b) Nội dung: </w:t></w:r><w:r><w:t>Thực hiện các câu hỏi trắc nghiệm tự chấm trên hệ thống.</w:t></w:r></w:p>
    <w:p><w:pPr><w:ind w:left="240"/></w:pPr><w:r><w:i/><w:t>c) Sản phẩm: </w:t></w:r><w:r><w:t>Báo cáo điểm số và phân tích câu đúng/sai của hệ thống.</w:t></w:r></w:p>
    <w:p><w:pPr><w:ind w:left="240"/></w:pPr><w:r><w:i/><w:t>d) Tổ chức thực hiện: </w:t></w:r><w:r><w:t>Học sinh làm bài, giáo viên phân tích lỗi sai điển hình.</w:t></w:r></w:p>

    <!-- Activity 4 -->
    <w:p>
      <w:r><w:rPr><w:b/><w:color w:val="1E3A8A"/></w:rPr><w:t>Hoạt động 4: Vận dụng &amp; Mở rộng (3-5 phút)</w:t></w:r>
    </w:p>
    <w:p><w:pPr><w:ind w:left="240"/></w:pPr><w:r><w:i/><w:t>a) Mục tiêu: </w:t></w:r><w:r><w:t>Ứng dụng kiến thức vào giải quyết vấn đề thực tiễn liên môn.</w:t></w:r></w:p>
    <w:p><w:pPr><w:ind w:left="240"/></w:pPr><w:r><w:i/><w:t>b) Nội dung: </w:t></w:r><w:r><w:t>Nhiệm vụ về nhà hoặc dự án nhỏ tìm hiểu ứng dụng công nghệ.</w:t></w:r></w:p>
  `;

  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
      <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
    </Types>`
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
    </Relationships>`
  );

  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
    </Relationships>`
  );

  zip.file(
    'word/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:docDefaults>
        <w:rPrDefault>
          <w:rPr>
            <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
            <w:sz w:val="26"/>
            <w:szCs w:val="26"/>
            <w:lang w:val="vi-VN"/>
          </w:rPr>
        </w:rPrDefault>
      </w:docDefaults>
    </w:styles>`
  );

  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        ${docContent}
        <w:sectPr>
          <w:pgSz w:w="11906" w:h="16838"/>
          <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1418"/>
        </w:sectPr>
      </w:body>
    </w:document>`
  );

  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const filename = `Giao_an_CV5512_${lesson.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.docx`;
  triggerBlobDownload(blob, filename);
}

/**
 * 3. Xuất Bài giảng PowerPoint (.pptx) chuẩn OpenXML PresentationML
 */
export async function exportLessonPresentationPptx({
  institutionName,
  book,
  unit,
  lesson,
  accentHex = '#2563EB',
}: {
  institutionName: string;
  book: Book;
  unit: Unit;
  lesson: Lesson;
  accentHex?: string;
}): Promise<void> {
  const cleanHex = accentHex.replace('#', '').toUpperCase();

  // Collect quiz questions if any
  const quizQuestions: QuizQuestion[] = [];
  lesson.contents.forEach((c) => {
    if (c.quizQuestions && c.quizQuestions.length > 0) {
      quizQuestions.push(...c.quizQuestions);
    }
  });

  // Collect reading sections
  const readingContents = lesson.contents.filter((c) => c.type === 'reading' && c.readingMarkdown);

  const zip = new JSZip();

  // Root Content Types
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
      <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
      <Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
      <Override PartName="/ppt/slides/slide3.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
      <Override PartName="/ppt/slides/slide4.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
      <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
      <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
    </Types>`
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
    </Relationships>`
  );

  zip.file(
    'ppt/_rels/presentation.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
      <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
      <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/>
      <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide3.xml"/>
      <Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide4.xml"/>
    </Relationships>`
  );

  zip.file(
    'ppt/presentation.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
      <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
      <p:sldIdLst>
        <p:sldId id="256" r:id="rId2"/>
        <p:sldId id="257" r:id="rId3"/>
        <p:sldId id="258" r:id="rId4"/>
        <p:sldId id="259" r:id="rId5"/>
      </p:sldIdLst>
      <p:sldSz cx="12192000" cy="6858000" type="screen16x9"/>
    </p:presentation>`
  );

  // Slide Master & Layout
  zip.file(
    'ppt/slideMasters/slideMaster1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <p:sldMaster xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
      <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
      <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
      <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
    </p:sldMaster>`
  );

  zip.file(
    'ppt/slideMasters/_rels/slideMaster1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
    </Relationships>`
  );

  zip.file(
    'ppt/slideLayouts/slideLayout1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
      <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
    </p:sldLayout>`
  );

  // Common slide rels
  const slideRelXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
    </Relationships>`;

  zip.file('ppt/slides/_rels/slide1.xml.rels', slideRelXml);
  zip.file('ppt/slides/_rels/slide2.xml.rels', slideRelXml);
  zip.file('ppt/slides/_rels/slide3.xml.rels', slideRelXml);
  zip.file('ppt/slides/_rels/slide4.xml.rels', slideRelXml);

  // Slide 1: Cover
  zip.file(
    'ppt/slides/slide1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
      <p:cSld>
        <p:spTree>
          <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
          <p:grpSpPr/>
          <!-- Title Box -->
          <p:sp>
            <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="1000000" y="1600000"/><a:ext cx="10192000" cy="2200000"/></a:xfrm></p:spPr>
            <p:txBody>
              <a:bodyPr anchor="ctr"/>
              <a:p>
                <a:pPr algn="ctr"/>
                <a:r>
                  <a:rPr lang="vi-VN" sz="4400" b="1">
                    <a:solidFill><a:srgbClr val="${cleanHex}"/></a:solidFill>
                    <a:latin typeface="Arial"/>
                  </a:rPr>
                  <a:t>${escapeXml(lesson.title)}</a:t>
                </a:r>
              </a:p>
              <a:p>
                <a:pPr algn="ctr"/>
                <a:r>
                  <a:rPr lang="vi-VN" sz="2400" i="1">
                    <a:solidFill><a:srgbClr val="64748B"/></a:solidFill>
                    <a:latin typeface="Arial"/>
                  </a:rPr>
                  <a:t>${escapeXml(book.title)} — ${escapeXml(unit.title)}</a:t>
                </a:r>
              </a:p>
              <a:p>
                <a:pPr algn="ctr"/>
                <a:r>
                  <a:rPr lang="vi-VN" sz="2000">
                    <a:solidFill><a:srgbClr val="0F172A"/></a:solidFill>
                    <a:latin typeface="Arial"/>
                  </a:rPr>
                  <a:t>${escapeXml(institutionName || 'Interactive Academic Hub')}</a:t>
                </a:r>
              </a:p>
            </p:txBody>
          </p:sp>
        </p:spTree>
      </p:cSld>
    </p:sld>`
  );

  // Slide 2: Objectives
  const objListXml = lesson.objectives
    .map(
      (obj) => `
    <a:p>
      <a:pPr marL="360000" indent="-360000"/>
      <a:r>
        <a:rPr lang="vi-VN" sz="2200"><a:solidFill><a:srgbClr val="1E293B"/></a:solidFill><a:latin typeface="Arial"/></a:rPr>
        <a:t>✓ ${escapeXml(obj)}</a:t>
      </a:r>
    </a:p>`
    )
    .join('');

  zip.file(
    'ppt/slides/slide2.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
      <p:cSld>
        <p:spTree>
          <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
          <p:grpSpPr/>
          <!-- Slide Heading -->
          <p:sp>
            <p:nvSpPr><p:cNvPr id="2" name="Heading"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="800000" y="600000"/><a:ext cx="10592000" cy="800000"/></a:xfrm></p:spPr>
            <p:txBody>
              <a:bodyPr/>
              <a:p>
                <a:r>
                  <a:rPr lang="vi-VN" sz="3200" b="1"><a:solidFill><a:srgbClr val="${cleanHex}"/></a:solidFill><a:latin typeface="Arial"/></a:rPr>
                  <a:t>Mục tiêu bài học cần đạt</a:t>
                </a:r>
              </a:p>
            </p:txBody>
          </p:sp>
          <!-- Content Box -->
          <p:sp>
            <p:nvSpPr><p:cNvPr id="3" name="Objectives"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="800000" y="1600000"/><a:ext cx="10592000" cy="4600000"/></a:xfrm></p:spPr>
            <p:txBody>
              <a:bodyPr/>
              ${objListXml}
            </p:txBody>
          </p:sp>
        </p:spTree>
      </p:cSld>
    </p:sld>`
  );

  // Slide 3: Core Summary
  zip.file(
    'ppt/slides/slide3.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
      <p:cSld>
        <p:spTree>
          <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
          <p:grpSpPr/>
          <p:sp>
            <p:nvSpPr><p:cNvPr id="2" name="Heading"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="800000" y="600000"/><a:ext cx="10592000" cy="800000"/></a:xfrm></p:spPr>
            <p:txBody>
              <a:bodyPr/>
              <a:p>
                <a:r>
                  <a:rPr lang="vi-VN" sz="3200" b="1"><a:solidFill><a:srgbClr val="${cleanHex}"/></a:solidFill><a:latin typeface="Arial"/></a:rPr>
                  <a:t>Khái quát nội dung cốt lõi</a:t>
                </a:r>
              </a:p>
            </p:txBody>
          </p:sp>
          <p:sp>
            <p:nvSpPr><p:cNvPr id="3" name="SummaryText"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="800000" y="1600000"/><a:ext cx="10592000" cy="4600000"/></a:xfrm></p:spPr>
            <p:txBody>
              <a:bodyPr/>
              <a:p>
                <a:r>
                  <a:rPr lang="vi-VN" sz="2200"><a:solidFill><a:srgbClr val="334155"/></a:solidFill><a:latin typeface="Arial"/></a:rPr>
                  <a:t>${escapeXml(lesson.summary)}</a:t>
                </a:r>
              </a:p>
              <a:p>
                <a:r>
                  <a:rPr lang="vi-VN" sz="2000" i="1"><a:solidFill><a:srgbClr val="64748B"/></a:solidFill><a:latin typeface="Arial"/></a:rPr>
                  <a:t>Học liệu tích hợp: ${lesson.contents.length} phần (Gồm mô phỏng tương tác, bài đọc và trắc nghiệm).</a:t>
                </a:r>
              </a:p>
            </p:txBody>
          </p:sp>
        </p:spTree>
      </p:cSld>
    </p:sld>`
  );

  // Slide 4: Interactive Quiz Preview / Conclusion
  const sampleQ = quizQuestions[0];
  const qText = sampleQ
    ? `Câu hỏi ôn tập nhanh: ${sampleQ.question}`
    : 'Học sinh truy cập Interactive Academic Hub để trải nghiệm mô phỏng và làm bài tập củng cố.';

  zip.file(
    'ppt/slides/slide4.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
      <p:cSld>
        <p:spTree>
          <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
          <p:grpSpPr/>
          <p:sp>
            <p:nvSpPr><p:cNvPr id="2" name="Heading"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="800000" y="600000"/><a:ext cx="10592000" cy="800000"/></a:xfrm></p:spPr>
            <p:txBody>
              <a:bodyPr/>
              <a:p>
                <a:r>
                  <a:rPr lang="vi-VN" sz="3200" b="1"><a:solidFill><a:srgbClr val="${cleanHex}"/></a:solidFill><a:latin typeface="Arial"/></a:rPr>
                  <a:t>Tổng kết &amp; Hoạt động tương tác</a:t>
                </a:r>
              </a:p>
            </p:txBody>
          </p:sp>
          <p:sp>
            <p:nvSpPr><p:cNvPr id="3" name="Conclusion"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="800000" y="1600000"/><a:ext cx="10592000" cy="4600000"/></a:xfrm></p:spPr>
            <p:txBody>
              <a:bodyPr/>
              <a:p>
                <a:r>
                  <a:rPr lang="vi-VN" sz="2200" b="1"><a:solidFill><a:srgbClr val="0F172A"/></a:solidFill><a:latin typeface="Arial"/></a:rPr>
                  <a:t>${escapeXml(qText)}</a:t>
                </a:r>
              </a:p>
            </p:txBody>
          </p:sp>
        </p:spTree>
      </p:cSld>
    </p:sld>`
  );

  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
  const filename = `Slide_BaiGiang_${lesson.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.pptx`;
  triggerBlobDownload(blob, filename);
}

/**
 * 4. Xuất Ngân hàng câu hỏi trắc nghiệm ra Moodle XML
 * Chuẩn Moodle Question Bank để giáo viên import 100% vào Moodle Quiz
 */
export function exportMoodleXml({
  lessonTitle,
  questions,
}: {
  lessonTitle: string;
  questions: QuizQuestion[];
}): void {
  if (questions.length === 0) {
    throw new Error('Không có câu hỏi nào để xuất ra Moodle XML.');
  }

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<quiz>\n`;
  xml += `  <question type="category">\n    <category>\n      <text>$course$/InteractiveAcademicHub/${escapeXml(lessonTitle)}</text>\n    </category>\n  </question>\n`;

  questions.forEach((q, idx) => {
    xml += `  <question type="multichoice">\n`;
    xml += `    <name><text>Câu ${idx + 1}: ${escapeXml(q.question.slice(0, 40))}...</text></name>\n`;
    xml += `    <questiontext format="html">\n      <text><![CDATA[<p>${escapeXml(q.question)}</p>]]></text>\n    </questiontext>\n`;
    xml += `    <generalfeedback format="html">\n      <text><![CDATA[<p>${escapeXml(q.explanation || 'Đáp án chính xác.')}</p>]]></text>\n    </generalfeedback>\n`;
    xml += `    <defaultgrade>1.0000000</defaultgrade>\n`;
    xml += `    <single>true</single>\n`;
    xml += `    <shuffleanswers>true</shuffleanswers>\n`;
    xml += `    <answernumbering>abc</answernumbering>\n`;

    q.options.forEach((opt, optIdx) => {
      const fraction = optIdx === q.correctIndex ? '100' : '0';
      xml += `    <answer fraction="${fraction}" format="html">\n`;
      xml += `      <text><![CDATA[<p>${escapeXml(opt)}</p>]]></text>\n`;
      xml += `    </answer>\n`;
    });

    xml += `  </question>\n`;
  });

  xml += `</quiz>`;

  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
  triggerBlobDownload(blob, `moodle_quiz_${lessonTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}.xml`);
}

/**
 * 5. Xuất Ngân hàng câu hỏi trắc nghiệm ra định dạng GIFT (Moodle / Canvas)
 */
export function exportMoodleGift({
  lessonTitle,
  questions,
}: {
  lessonTitle: string;
  questions: QuizQuestion[];
}): void {
  if (questions.length === 0) {
    throw new Error('Không có câu hỏi nào để xuất ra GIFT.');
  }

  let gift = `// Moodle GIFT Export from Interactive Academic Hub\n// Bài: ${lessonTitle}\n\n`;

  questions.forEach((q, idx) => {
    gift += `// Câu ${idx + 1}\n::Q${idx + 1}:: ${q.question} {\n`;
    q.options.forEach((opt, optIdx) => {
      if (optIdx === q.correctIndex) {
        gift += `  =${opt}#${q.explanation || 'Chính xác'}\n`;
      } else {
        gift += `  ~${opt}\n`;
      }
    });
    gift += `}\n\n`;
  });

  const blob = new Blob([gift], { type: 'text/plain;charset=utf-8' });
  triggerBlobDownload(blob, `moodle_gift_${lessonTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}.gift.txt`);
}

/**
 * 6. Xuất Gói học liệu chuẩn SCORM 1.2 Package (.zip) cho LMS (Moodle, Canvas, K12Online, vnEdu)
 */
export async function exportScorm12Zip({
  lesson,
  content,
  institutionName,
}: {
  lesson: Lesson;
  content: DetailedContent;
  institutionName: string;
}): Promise<void> {
  if (!content.htmlContent) {
    throw new Error('Nội dung cần có mã HTML5 tương tác để đóng gói SCORM.');
  }

  const zip = new JSZip();

  // SCORM 1.2 imsmanifest.xml
  const manifestXml = `<?xml version="1.0" standalone="no" ?>
<manifest identifier="MANIFEST-${content.id}" version="1.2"
          xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
          xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
                              http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="ORG-${content.id}">
    <organization identifier="ORG-${content.id}">
      <title>${escapeXml(institutionName)} - ${escapeXml(lesson.title)}</title>
      <item identifier="ITEM-${content.id}" identifierref="RES-${content.id}">
        <title>${escapeXml(content.title)}</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-${content.id}" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
    </resource>
  </resources>
</manifest>`;

  // Injected SCORM API Wrapper in HTML
  const scormWrapperHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeXml(content.title)}</title>
  <script>
    // Lightweight SCORM 1.2 API connector
    var findAPI = function(win) {
      var findAttempts = 0;
      while ((win.API == null) && (win.parent != null) && (win.parent != win)) {
        findAttempts++;
        if (findAttempts > 7) return null;
        win = win.parent;
      }
      return win.API;
    };
    var api = findAPI(window);
    if (api) {
      api.LMSInitialize("");
      api.LMSSetValue("cmi.core.lesson_status", "incomplete");
      api.LMSCommit("");
    }
    window.addEventListener("beforeunload", function() {
      if (api) {
        api.LMSSetValue("cmi.core.lesson_status", "completed");
        api.LMSCommit("");
        api.LMSFinish("");
      }
    });
  </script>
</head>
<body style="margin:0;padding:0;">
  ${content.htmlContent}
</body>
</html>`;

  zip.file('imsmanifest.xml', manifestXml);
  zip.file('index.html', scormWrapperHtml);

  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/zip' });
  triggerBlobDownload(blob, `SCORM_${lesson.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${content.id}.zip`);
}
