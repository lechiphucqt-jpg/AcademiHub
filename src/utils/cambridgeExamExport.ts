import JSZip from 'jszip';
import type { CambridgeExam, CambridgePart, CambridgeQuestion } from '../types/cambridge';
import { triggerBlobDownload } from './portableBundle';

// XML Escaping helper for DOCX
function escapeXml(unsafe: string | null | undefined): string {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 1. Xuất Đề thi Cambridge ra Microsoft Word (.docx)
 * Chuẩn định dạng Cambridge Assessment English:
 * - Header chuẩn Cambridge với Centre Number, Candidate Number, Candidate Name
 * - Các Part phân hóa 4 kỹ năng (Listening, Reading, Writing, Speaking)
 * - Kịch bản âm thanh Listening Audio Script
 * - Chấm điểm Writing & Speaking có Rubrics và Bài mẫu
 */
export async function exportCambridgeExamDocx(
  exam: CambridgeExam,
  institutionName?: string
): Promise<void> {
  const zip = new JSZip();

  // 1. Content Types
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

  // 2. _rels/.rels
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
    </Relationships>`
  );

  // 3. word/_rels/document.xml.rels
  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
    </Relationships>`
  );

  // 4. word/styles.xml
  zip.file(
    'word/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:docDefaults>
        <w:rPrDefault>
          <w:rPr>
            <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
            <w:sz w:val="22"/>
            <w:szCs w:val="22"/>
            <w:color w:val="0F172A"/>
          </w:rPr>
        </w:rPrDefault>
      </w:docDefaults>
    </w:styles>`
  );

  // 5. Build word/document.xml
  let docXml = `
    <!-- Top Cambridge Header Banner -->
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="40"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="64748B"/></w:rPr><w:t>${escapeXml(institutionName || 'CAMBRIDGE ASSESSMENT ENGLISH')}</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="60"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="30"/><w:color w:val="002E62"/></w:rPr><w:t>${escapeXml(exam.qualificationName.toUpperCase())}</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="100"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="1E3A8A"/></w:rPr><w:t>${escapeXml(exam.paperName)}</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="160"/></w:pPr>
      <w:r><w:rPr><w:i/><w:sz w:val="20"/><w:color w:val="475569"/></w:rPr><w:t>Paper Code: ${escapeXml(exam.examCode)} | Time: ${exam.timeMinutes} mins | Total: ${exam.totalMarks} marks${exam.aiEngineUsed ? ` | Engine: ${escapeXml(exam.aiEngineUsed)}` : ''}</w:t></w:r>
    </w:p>

    <!-- Candidate Information Box Table -->
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9400" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="12" w:space="0" w:color="002E62"/>
          <w:left w:val="single" w:sz="12" w:space="0" w:color="002E62"/>
          <w:bottom w:val="single" w:sz="12" w:space="0" w:color="002E62"/>
          <w:right w:val="single" w:sz="12" w:space="0" w:color="002E62"/>
          <w:insideH w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:insideV w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <w:tc>
          <w:tcPr><w:tcW w:w="3200" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/></w:tcPr>
          <w:p><w:pPr><w:spacing w:after="40"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="18"/><w:color w:val="475569"/></w:rPr><w:t>CENTRE NUMBER</w:t></w:r></w:p>
          <w:p><w:pPr><w:spacing w:after="40"/></w:pPr><w:r><w:rPr><w:sz w:val="24"/><w:color w:val="94A3B8"/></w:rPr><w:t>[  VN _ _ _  ]</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="3200" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/></w:tcPr>
          <w:p><w:pPr><w:spacing w:after="40"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="18"/><w:color w:val="475569"/></w:rPr><w:t>CANDIDATE NUMBER</w:t></w:r></w:p>
          <w:p><w:pPr><w:spacing w:after="40"/></w:pPr><w:r><w:rPr><w:sz w:val="24"/><w:color w:val="94A3B8"/></w:rPr><w:t>[  _ _ _ _  ]</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="3000" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/></w:tcPr>
          <w:p><w:pPr><w:spacing w:after="40"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="18"/><w:color w:val="475569"/></w:rPr><w:t>DATE OF EXAM</w:t></w:r></w:p>
          <w:p><w:pPr><w:spacing w:after="40"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/><w:color w:val="002E62"/></w:rPr><w:t>${escapeXml(exam.generatedAt)}</w:t></w:r></w:p>
        </w:tc>
      </w:tr>
      <w:tr>
        <w:tc>
          <w:tcPr><w:gridSpan w:val="3"/><w:tcW w:w="9400" w:type="dxa"/></w:tcPr>
          <w:p><w:pPr><w:spacing w:after="40"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="18"/><w:color w:val="475569"/></w:rPr><w:t>CANDIDATE NAME (Họ và tên thí sinh):</w:t></w:r></w:p>
          <w:p><w:pPr><w:spacing w:after="40"/></w:pPr><w:r><w:rPr><w:sz w:val="22"/><w:color w:val="94A3B8"/></w:rPr><w:t>____________________________________________________________________________</w:t></w:r></w:p>
        </w:tc>
      </w:tr>
    </w:tbl>

    <!-- Instructions to Candidates -->
    <w:p><w:pPr><w:spacing w:before="140" w:after="60"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="21"/><w:color w:val="002E62"/></w:rPr><w:t>INSTRUCTIONS TO CANDIDATES:</w:t></w:r>
    </w:p>
    ${exam.instructionsToCandidates
      .map(
        (inst) => `
      <w:p><w:pPr><w:ind w:left="240"/><w:spacing w:after="30"/></w:pPr>
        <w:r><w:rPr><w:sz w:val="20"/><w:color w:val="334155"/></w:rPr><w:t>• ${escapeXml(inst)}</w:t></w:r>
      </w:p>
    `
      )
      .join('')}
  `;

  // Render Parts & Questions
  let questionIndex = 1;
  const labels = ['A', 'B', 'C', 'D'];

  exam.parts.forEach((part: CambridgePart) => {
    const partQuestionStart = questionIndex;
    const partQuestionEnd = questionIndex + part.questions.length - 1;

    docXml += `
      <!-- Part Header Block -->
      <w:p>
        <w:pPr>
          <w:pBdr><w:bottom w:val="single" w:sz="12" w:space="4" w:color="002E62"/></w:pBdr>
          <w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/>
          <w:spacing w:before="240" w:after="60"/>
        </w:pPr>
        <w:r><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="002E62"/></w:rPr><w:t>Part ${part.partNumber} </w:t></w:r>
        <w:r><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="334155"/></w:rPr><w:t>— Questions ${partQuestionStart}–${partQuestionEnd} [${part.questions.reduce((a, b) => a + (b.mark || 1), 0)} marks]</w:t></w:r>
      </w:p>
      <w:p>
        <w:pPr><w:spacing w:before="60" w:after="120"/></w:pPr>
        <w:r><w:rPr><w:i/><w:b/><w:sz w:val="21"/><w:color w:val="475569"/></w:rPr><w:t>${escapeXml(part.instructions)}</w:t></w:r>
      </w:p>
    `;

    // Reading passage if present
    if (part.passage) {
      docXml += `
        <w:tbl>
          <w:tblPr>
            <w:tblW w:w="9400" w:type="dxa"/>
            <w:tblBorders>
              <w:top w:val="single" w:sz="6" w:space="0" w:color="94A3B8"/>
              <w:left w:val="single" w:sz="18" w:space="0" w:color="002E62"/>
              <w:bottom w:val="single" w:sz="6" w:space="0" w:color="94A3B8"/>
              <w:right w:val="single" w:sz="6" w:space="0" w:color="94A3B8"/>
            </w:tblBorders>
          </w:tblPr>
          <w:tr>
            <w:tc>
              <w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/></w:tcPr>
              <w:p>
                <w:pPr><w:spacing w:before="100" w:after="100"/><w:ind w:left="140" w:right="140"/></w:pPr>
                <w:r><w:rPr><w:i/><w:sz w:val="21"/></w:rPr><w:t>${escapeXml(part.passage)}</w:t></w:r>
              </w:p>
            </w:tc>
          </w:tr>
        </w:tbl>
        <w:p><w:pPr><w:spacing w:after="100"/></w:pPr></w:p>
      `;
    }

    // Render questions
    part.questions.forEach((q: CambridgeQuestion) => {
      const qMark = q.mark || 1;
      docXml += `
        <w:p>
          <w:pPr><w:spacing w:before="140" w:after="60"/></w:pPr>
          <w:r><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="002E62"/></w:rPr><w:t>${questionIndex}. </w:t></w:r>
          <w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t>${escapeXml(q.question)}</w:t></w:r>
          <w:r><w:rPr><w:sz w:val="18"/><w:color w:val="94A3B8"/></w:rPr><w:t>  [${qMark} mark${qMark > 1 ? 's' : ''}]</w:t></w:r>
        </w:p>
      `;

      if (q.contextText) {
        docXml += `
          <w:p>
            <w:pPr><w:ind w:left="360"/><w:spacing w:after="40"/></w:pPr>
            <w:r><w:rPr><w:i/><w:sz w:val="20"/><w:color w:val="475569"/></w:rPr><w:t>"${escapeXml(q.contextText)}"</w:t></w:r>
          </w:p>
        `;
      }

      // If Multiple Choice Options
      if (q.options && q.options.length > 0) {
        q.options.forEach((opt, optIdx) => {
          const label = labels[optIdx] || `${optIdx + 1}`;
          docXml += `
            <w:p>
              <w:pPr><w:ind w:left="480"/><w:spacing w:after="30"/></w:pPr>
              <w:r><w:rPr><w:b/><w:sz w:val="21"/><w:color w:val="1E293B"/></w:rPr><w:t>${label}. </w:t></w:r>
              <w:r><w:rPr><w:sz w:val="21"/></w:rPr><w:t>${escapeXml(opt)}</w:t></w:r>
            </w:p>
          `;
        });
      } else if (q.questionType === 'short_writing' || part.partSkill === 'writing') {
        // Writing area lines for candidate
        docXml += `
          <w:p><w:pPr><w:ind w:left="360"/><w:spacing w:before="60" w:after="60"/></w:pPr>
            <w:r><w:rPr><w:sz w:val="20"/><w:color w:val="94A3B8"/></w:rPr><w:t>[Write your answer here / Viết câu trả lời vào các dòng kẻ dưới đây]:</w:t></w:r>
          </w:p>
          <w:p><w:pPr><w:ind w:left="360"/><w:spacing w:after="40"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/><w:color w:val="CBD5E1"/></w:r><w:t>____________________________________________________________________________</w:t></w:r></w:p>
          <w:p><w:pPr><w:ind w:left="360"/><w:spacing w:after="40"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/><w:color w:val="CBD5E1"/></w:r><w:t>____________________________________________________________________________</w:t></w:r></w:p>
          <w:p><w:pPr><w:ind w:left="360"/><w:spacing w:after="40"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/><w:color w:val="CBD5E1"/></w:r><w:t>____________________________________________________________________________</w:t></w:r></w:p>
        `;
      }

      questionIndex += 1;
    });
  });

  // End of test page break
  docXml += `
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:before="240" w:after="240"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="475569"/></w:rPr><w:t>---------- END OF QUESTION PAPER ----------</w:t></w:r>
    </w:p>
  `;

  // Listening Script Section (if exam has listening)
  if (exam.hasListening || exam.fullListeningScript) {
    docXml += `
      <w:p><w:r><w:br w:type="page"/></w:r></w:p>
      <w:p>
        <w:pPr><w:jc w:val="center"/><w:spacing w:after="60"/></w:pPr>
        <w:r><w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="64748B"/></w:rPr><w:t>CAMBRIDGE ASSESSMENT ENGLISH — CONFIDENTIAL</w:t></w:r>
      </w:p>
      <w:p>
        <w:pPr><w:jc w:val="center"/><w:spacing w:after="100"/></w:pPr>
        <w:r><w:rPr><w:b/><w:sz w:val="26"/><w:color w:val="002E62"/></w:rPr><w:t>LISTENING AUDIO RECORDING SCRIPT (TRANSCRIPT)</w:t></w:r>
      </w:p>
      <w:p>
        <w:pPr><w:jc w:val="center"/><w:spacing w:after="140"/></w:pPr>
        <w:r><w:rPr><w:i/><w:sz w:val="20"/><w:color w:val="475569"/></w:rPr><w:t>Giám thị phòng thi có thể phát âm thanh trực tiếp trên ứng dụng hoặc đọc kịch bản dưới đây.</w:t></w:r>
      </w:p>
    `;

    const scriptText = exam.fullListeningScript || exam.parts
      .filter((p) => p.audioScript || p.questions.some((q) => q.audioScript))
      .map((p) => `[${p.title}]\n${p.audioScript || p.questions.map((q) => q.audioScript).filter(Boolean).join('\n')}`)
      .join('\n\n');

    scriptText.split('\n').forEach((line) => {
      const isHeader = line.startsWith('---') || line.startsWith('[') || line.startsWith('Narrator:');
      docXml += `
        <w:p>
          <w:pPr><w:spacing w:after="40"/></w:pPr>
          <w:r><w:rPr><w:b w:val="${isHeader ? 'true' : 'false'}"/><w:sz w:val="21"/><w:color w:val="${isHeader ? '002E62' : '334155'}"/></w:rPr><w:t>${escapeXml(line)}</w:t></w:r>
        </w:p>
      `;
    });
  }

  // Answer Key & Marking Scheme
  docXml += `
    <w:p><w:r><w:br w:type="page"/></w:r></w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="60"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="64748B"/></w:rPr><w:t>CAMBRIDGE ASSESSMENT ENGLISH</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="60"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="002E62"/></w:rPr><w:t>MARKING SCHEME &amp; EXPLANATORY ANSWER KEY</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="160"/></w:pPr>
      <w:r><w:rPr><w:i/><w:sz w:val="20"/><w:color w:val="475569"/></w:rPr><w:t>${escapeXml(exam.qualificationName)} | ${escapeXml(exam.paperName)} | Total: ${exam.totalMarks} marks</w:t></w:r>
    </w:p>

    <!-- Table of Answers -->
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9400" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="10" w:space="0" w:color="002E62"/>
          <w:left w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:bottom w:val="single" w:sz="10" w:space="0" w:color="002E62"/>
          <w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <w:tc><w:tcPr><w:tcW w:w="900" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="002E62"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Item</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="1200" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="002E62"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Key / Type</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="002E62"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Skill / Focus Area</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="4900" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="002E62"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Explanatory Rationale &amp; Evidence</w:t></w:r></w:p></w:tc>
      </w:tr>
  `;

  let qCount = 1;
  exam.parts.forEach((part) => {
    part.questions.forEach((q) => {
      const isShortWriting = q.questionType === 'short_writing' || part.partSkill === 'writing';
      const isSpeaking = q.questionType === 'speaking_prompt' || part.partSkill === 'speaking';

      let correctLetter = labels[q.correctIndex] || `Key ${q.correctIndex + 1}`;
      if (isShortWriting) correctLetter = 'Writing';
      if (isSpeaking) correctLetter = 'Speaking';

      let rationale = q.explanation || 'Correct based on curriculum material.';
      if (q.sampleAnswer) {
        rationale += ` | Model Answer: "${q.sampleAnswer}"`;
      }
      if (q.scoringRubric) {
        rationale += ` | Rubric: ${q.scoringRubric}`;
      }

      docXml += `
        <w:tr>
          <w:tc><w:tcPr><w:tcW w:w="900" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Q${qCount}</w:t></w:r></w:p></w:tc>
          <w:tc><w:tcPr><w:tcW w:w="1200" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="047857"/></w:rPr><w:t>${escapeXml(correctLetter)}</w:t></w:r></w:p></w:tc>
          <w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:sz w:val="20"/><w:color w:val="334155"/></w:rPr><w:t>${escapeXml(q.focusArea || 'Language Focus')}</w:t></w:r></w:p></w:tc>
          <w:tc><w:tcPr><w:tcW w:w="4900" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>${escapeXml(rationale)}</w:t></w:r></w:p></w:tc>
        </w:tr>
      `;
      qCount += 1;
    });
  });

  docXml += `</w:tbl>`;

  // Final document.xml container
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        ${docXml}
        <w:sectPr>
          <w:pgSz w:w="11906" w:h="16838"/>
          <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/>
        </w:sectPr>
      </w:body>
    </w:document>`
  );

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  const safeFilename = `${exam.title.replace(/[^a-zA-Z0-9_\u00C0-\u1EF9]/g, '_')}_Cambridge_Exam.docx`;
  triggerBlobDownload(blob, safeFilename);
}

/**
 * 2. Tạo mã HTML in chuẩn Cambridge A4 (dùng để xuất PDF trực tiếp)
 */
export function generateCambridgePrintHtml(
  exam: CambridgeExam,
  institutionName?: string
): string {
  const labels = ['A', 'B', 'C', 'D'];
  let totalQ = 0;

  const partsHtml = exam.parts
    .map((part) => {
      const qStart = totalQ + 1;
      const qEnd = totalQ + part.questions.length;
      totalQ += part.questions.length;

      const questionsHtml = part.questions
        .map((q, idx) => {
          const currentNumber = qStart + idx;
          const qMark = q.mark || 1;
          const isWriting = q.questionType === 'short_writing' || part.partSkill === 'writing';
          const isSpeaking = q.questionType === 'speaking_prompt' || part.partSkill === 'speaking';

          let optionsHtml = '';
          if (q.options && q.options.length > 0) {
            optionsHtml = `
              <div class="options-grid">
                ${q.options
                  .map((opt, optIdx) => {
                    const label = labels[optIdx] || `${optIdx + 1}`;
                    return `
                      <div class="option-item">
                        <span class="option-label"><strong>${label}</strong></span>
                        <span class="option-text">${escapeHtml(opt)}</span>
                      </div>
                    `;
                  })
                  .join('')}
              </div>
            `;
          } else if (isWriting) {
            optionsHtml = `
              <div class="writing-answer-space">
                <div class="writing-lines">
                  <div class="line"></div>
                  <div class="line"></div>
                  <div class="line"></div>
                  <div class="line"></div>
                </div>
              </div>
            `;
          }

          return `
            <div class="question-block">
              <div class="question-header">
                <span class="q-num">${currentNumber}.</span>
                <div class="q-content">
                  <span class="q-text">${escapeHtml(q.question)}</span>
                  ${
                    q.contextText
                      ? `<div class="q-context">"${escapeHtml(q.contextText)}"</div>`
                      : ''
                  }
                  ${
                    isSpeaking
                      ? `<div class="speaking-badge">🗣 Examiner Prompt: Listen &amp; Respond with full sentences</div>`
                      : ''
                  }
                </div>
                <span class="q-mark">[${qMark}]</span>
              </div>
              ${optionsHtml}
            </div>
          `;
        })
        .join('');

      return `
        <div class="part-section">
          <div class="part-banner">
            <span class="part-title">Part ${part.partNumber} (${part.title})</span>
            <span class="part-meta">Questions ${qStart}–${qEnd} (${part.questions.reduce((a, b) => a + (b.mark || 1), 0)} marks)</span>
          </div>
          <p class="part-instructions"><em>${escapeHtml(part.instructions)}</em></p>
          ${
            part.passage
              ? `<div class="passage-box"><p>${escapeHtml(part.passage)}</p></div>`
              : ''
          }
          <div class="questions-list">
            ${questionsHtml}
          </div>
        </div>
      `;
    })
    .join('');

  // Marking Scheme Table Rows
  let answerRows = '';
  let rowIdx = 1;
  exam.parts.forEach((part) => {
    part.questions.forEach((q) => {
      const isWriting = q.questionType === 'short_writing' || part.partSkill === 'writing';
      const isSpeaking = q.questionType === 'speaking_prompt' || part.partSkill === 'speaking';

      let correctKey = labels[q.correctIndex] || `${q.correctIndex + 1}`;
      if (isWriting) correctKey = 'Writing';
      if (isSpeaking) correctKey = 'Speaking';

      let explanationText = escapeHtml(q.explanation || 'Correct based on lesson material.');
      if (q.sampleAnswer) {
        explanationText += `<div class="sample-ans"><strong>Model Answer:</strong> "${escapeHtml(q.sampleAnswer)}"</div>`;
      }
      if (q.scoringRubric) {
        explanationText += `<div class="rubric-text"><strong>Rubric:</strong> ${escapeHtml(q.scoringRubric)}</div>`;
      }

      answerRows += `
        <tr>
          <td class="text-center font-bold">Q${rowIdx}</td>
          <td class="text-center font-bold text-emerald-700 bg-emerald-50">${correctKey}</td>
          <td><span class="skill-badge">${escapeHtml(q.focusArea || 'Language Focus')}</span></td>
          <td>${explanationText}</td>
        </tr>
      `;
      rowIdx += 1;
    });
  });

  // Audio Script section for PDF
  let audioTranscriptHtml = '';
  if (exam.hasListening || exam.fullListeningScript) {
    const script = exam.fullListeningScript || exam.parts
      .filter((p) => p.audioScript || p.questions.some((q) => q.audioScript))
      .map((p) => `[${p.title}]\n${p.audioScript || p.questions.map((q) => q.audioScript).filter(Boolean).join('\n')}`)
      .join('\n\n');

    audioTranscriptHtml = `
      <div class="page-break"></div>
      <div class="exam-header-banner">
        <div class="inst-name">CAMBRIDGE ASSESSMENT ENGLISH — CONFIDENTIAL RECORDING SCRIPT</div>
        <h1 class="exam-title">LISTENING AUDIO SCRIPT (TRANSCRIPT)</h1>
        <div class="paper-name">${escapeHtml(exam.title)} | Code: ${escapeHtml(exam.examCode)}</div>
      </div>
      <div class="transcript-box">
        ${script
          .split('\n')
          .filter((l) => l.trim().length > 0)
          .map((line) => {
            const isSpeaker = line.includes(':');
            return `<div class="transcript-line ${isSpeaker ? 'speaker' : ''}">${escapeHtml(line)}</div>`;
          })
          .join('')}
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(exam.title)} — Cambridge Exam</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 16mm 14mm 16mm 14mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.45;
      font-size: 11pt;
    }
    .print-toolbar {
      position: sticky;
      top: 0;
      background: #002e62;
      color: #ffffff;
      padding: 10px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      z-index: 1000;
    }
    .print-btn {
      background: #ffffff;
      color: #002e62;
      border: none;
      padding: 8px 18px;
      font-weight: bold;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
    }
    .print-btn:hover { background: #f1f5f9; }
    .page-container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 15mm 12mm;
    }
    .exam-header-banner {
      text-align: center;
      border-bottom: 2px solid #002e62;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .inst-name {
      font-size: 10pt;
      font-weight: bold;
      color: #64748b;
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }
    .exam-title {
      font-size: 18pt;
      font-weight: 800;
      color: #002e62;
      margin: 4px 0;
      letter-spacing: 0.5px;
    }
    .paper-name {
      font-size: 13pt;
      font-weight: 700;
      color: #1e3a8a;
    }
    .exam-meta-line {
      font-size: 9.5pt;
      font-style: italic;
      color: #475569;
      margin-top: 4px;
    }
    .candidate-box {
      width: 100%;
      border: 1.5px solid #002e62;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    .candidate-box td {
      border: 1px solid #cbd5e1;
      padding: 6px 10px;
      font-size: 9.5pt;
    }
    .candidate-label {
      font-weight: bold;
      color: #475569;
      font-size: 8pt;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .candidate-dots {
      color: #94a3b8;
      font-size: 11pt;
      letter-spacing: 2px;
    }
    .instructions-box {
      background: #f8fafc;
      border-left: 3px solid #002e62;
      padding: 8px 12px;
      margin-bottom: 20px;
      font-size: 9.5pt;
    }
    .instructions-box h4 {
      color: #002e62;
      font-size: 9.5pt;
      margin-bottom: 4px;
    }
    .instructions-box ul {
      margin-left: 18px;
      color: #334155;
    }
    .part-section {
      margin-bottom: 24px;
    }
    .part-banner {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-bottom: 1.5px solid #002e62;
      background: #f1f5f9;
      padding: 6px 10px;
      margin-bottom: 6px;
    }
    .part-title {
      font-size: 12pt;
      font-weight: bold;
      color: #002e62;
    }
    .part-meta {
      font-size: 9.5pt;
      font-weight: 600;
      color: #334155;
    }
    .part-instructions {
      font-size: 10pt;
      color: #475569;
      margin-bottom: 12px;
      padding: 0 4px;
    }
    .passage-box {
      border: 1px solid #94a3b8;
      border-left: 3px solid #002e62;
      background: #f8fafc;
      padding: 10px 14px;
      margin-bottom: 14px;
      font-style: italic;
      line-height: 1.55;
      font-size: 10.5pt;
    }
    .question-block {
      margin-bottom: 14px;
      page-break-inside: avoid;
    }
    .question-header {
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin-bottom: 6px;
    }
    .q-num {
      font-weight: bold;
      color: #002e62;
      font-size: 11pt;
      min-width: 22px;
    }
    .q-content {
      flex: 1;
    }
    .q-text {
      font-size: 11pt;
      font-weight: 500;
    }
    .q-context {
      font-size: 9.5pt;
      color: #475569;
      font-style: italic;
      margin-top: 2px;
    }
    .speaking-badge {
      display: inline-block;
      margin-top: 4px;
      font-size: 8.5pt;
      background: #e0e7ff;
      color: #3730a3;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 600;
    }
    .writing-answer-space {
      margin-left: 28px;
      margin-top: 8px;
    }
    .writing-lines .line {
      border-bottom: 1px dashed #cbd5e1;
      height: 24px;
      width: 100%;
    }
    .q-mark {
      font-size: 9pt;
      color: #94a3b8;
    }
    .options-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 16px;
      margin-left: 28px;
    }
    .option-item {
      display: flex;
      align-items: baseline;
      gap: 6px;
      font-size: 10.5pt;
    }
    .option-label {
      color: #1e293b;
      min-width: 18px;
    }
    .page-break {
      page-break-before: always;
      margin-top: 30px;
    }
    .answers-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
    }
    .answers-table th {
      background: #002e62;
      color: #ffffff;
      padding: 8px 10px;
      font-size: 9.5pt;
      text-align: left;
    }
    .answers-table td {
      border: 1px solid #cbd5e1;
      padding: 7px 10px;
      font-size: 9.5pt;
      vertical-align: top;
    }
    .answers-table tr:nth-child(even) {
      background: #f8fafc;
    }
    .skill-badge {
      display: inline-block;
      padding: 2px 6px;
      background: #e2e8f0;
      color: #334155;
      border-radius: 4px;
      font-size: 8pt;
      font-weight: 600;
    }
    .sample-ans {
      margin-top: 4px;
      font-size: 9pt;
      color: #0369a1;
      background: #f0f9ff;
      padding: 4px 8px;
      border-radius: 4px;
    }
    .rubric-text {
      margin-top: 2px;
      font-size: 8.5pt;
      color: #64748b;
      font-style: italic;
    }
    .transcript-box {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-left: 4px solid #002e62;
      padding: 14px 18px;
      border-radius: 6px;
      margin-top: 14px;
      font-size: 10pt;
      line-height: 1.6;
    }
    .transcript-line {
      margin-bottom: 6px;
    }
    .transcript-line.speaker {
      font-weight: 600;
      color: #002e62;
    }
    .end-paper-tag {
      text-align: center;
      font-weight: bold;
      color: #64748b;
      margin: 30px 0;
      font-size: 10.5pt;
      letter-spacing: 1px;
    }
    @media print {
      .print-toolbar { display: none !important; }
      body { background: #ffffff !important; }
      .page-container { padding: 0 !important; width: 100% !important; max-width: 100% !important; }
    }
  </style>
</head>
<body>
  <div class="print-toolbar">
    <div>
      <strong>Interactive Academic Hub</strong> — Cambridge Assessment Print Mode
    </div>
    <button class="print-btn" onclick="window.print()">In hoặc Lưu PDF (Ctrl + P)</button>
  </div>

  <div class="page-container">
    <!-- Header -->
    <div class="exam-header-banner">
      <div class="inst-name">${escapeHtml(institutionName || 'CAMBRIDGE ASSESSMENT ENGLISH')}</div>
      <h1 class="exam-title">${escapeHtml(exam.qualificationName.toUpperCase())}</h1>
      <div class="paper-name">${escapeHtml(exam.paperName)}</div>
      <div class="exam-meta-line">
        Paper Code: ${escapeHtml(exam.examCode)} | Time allowed: ${exam.timeMinutes} minutes | Total score: ${exam.totalMarks} marks
      </div>
    </div>

    <!-- Candidate Box -->
    <table class="candidate-box">
      <tr>
        <td style="width: 35%;">
          <div class="candidate-label">CENTRE NUMBER</div>
          <div class="candidate-dots">[ VN _ _ _ ]</div>
        </td>
        <td style="width: 35%;">
          <div class="candidate-label">CANDIDATE NUMBER</div>
          <div class="candidate-dots">[ _ _ _ _ ]</div>
        </td>
        <td style="width: 30%;">
          <div class="candidate-label">EXAM DATE</div>
          <div style="font-weight: 600; color: #002e62;">${escapeHtml(exam.generatedAt)}</div>
        </td>
      </tr>
      <tr>
        <td colspan="3">
          <div class="candidate-label">CANDIDATE NAME (Họ và tên thí sinh):</div>
          <div style="color: #cbd5e1; letter-spacing: 2px;">________________________________________________________________________________________</div>
        </td>
      </tr>
    </table>

    <!-- Instructions -->
    <div class="instructions-box">
      <h4>INSTRUCTIONS TO CANDIDATES:</h4>
      <ul>
        ${exam.instructionsToCandidates.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}
      </ul>
    </div>

    <!-- Parts & Questions -->
    ${partsHtml}

    <div class="end-paper-tag">---------- END OF QUESTION PAPER ----------</div>

    <!-- Listening Audio Script if present -->
    ${audioTranscriptHtml}

    <!-- Answer Key & Marking Scheme -->
    <div class="page-break"></div>
    <div class="exam-header-banner">
      <div class="inst-name">CAMBRIDGE ASSESSMENT ENGLISH</div>
      <h1 class="exam-title">MARKING SCHEME &amp; EXPLANATORY ANSWER KEY</h1>
      <div class="paper-name">${escapeHtml(exam.qualificationName)} — ${escapeHtml(exam.paperName)}</div>
    </div>

    <table class="answers-table">
      <thead>
        <tr>
          <th style="width: 60px; text-align: center;">Item</th>
          <th style="width: 80px; text-align: center;">Key</th>
          <th style="width: 170px;">Skill / Focus Area</th>
          <th>Explanatory Rationale &amp; Evidence</th>
        </tr>
      </thead>
      <tbody>
        ${answerRows}
      </tbody>
    </table>
  </div>
</body>
</html>`;
}

/**
 * 3. Mở cửa sổ in PDF chuẩn Cambridge A4
 */
export async function exportCambridgeExamPdf(
  exam: CambridgeExam,
  institutionName?: string
): Promise<void> {
  const htmlContent = generateCambridgePrintHtml(exam, institutionName);
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Trình duyệt đã chặn cửa sổ Popup. Vui lòng cho phép Pop-up để mở bản in PDF.');
  }

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();

  setTimeout(() => {
    printWindow.focus();
  }, 400);
}
