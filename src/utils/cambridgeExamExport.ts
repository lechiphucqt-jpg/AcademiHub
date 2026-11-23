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

/**
 * 1. Xuất Đề thi Cambridge ra Microsoft Word (.docx)
 * Chuẩn định dạng Cambridge Assessment English:
 * - Header chuẩn Cambridge với Centre Number, Candidate Number, Candidate Name
 * - Các Part phân hóa rõ ràng (Part 1, Part 2, Part 3, Part 4)
 * - Điểm số phân bổ từng câu [1 mark]
 * - Ngắt trang sang CAMBRIDGE ASSESSMENT MARKING SCHEME & EXPLANATORY ANSWER KEY
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
      <w:r><w:rPr><w:i/><w:sz w:val="20"/><w:color w:val="475569"/></w:rPr><w:t>Paper Code: ${escapeXml(exam.examCode)} | Time allowed: ${exam.timeMinutes} minutes | Total: ${exam.totalMarks} marks</w:t></w:r>
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
          <w:tcPr><w:tcW w:w="4700" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/></w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr>
            <w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>Centre Number: </w:t></w:r>
            <w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>[   ] [   ] [   ] [   ] [   ]</w:t></w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="4700" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/></w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr>
            <w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>Candidate Number: </w:t></w:r>
            <w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>[   ] [   ] [   ] [   ]</w:t></w:r>
          </w:p>
        </w:tc>
      </w:tr>
      <w:tr>
        <w:tc>
          <w:tcPr><w:tcW w:w="4700" w:type="dxa"/></w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr>
            <w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>Candidate Name: </w:t></w:r>
            <w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>................................................................</w:t></w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="4700" w:type="dxa"/></w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr>
            <w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>Class / Date: </w:t></w:r>
            <w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>......................................................</w:t></w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>

    <!-- Instructions To Candidates Box -->
    <w:p><w:pPr><w:spacing w:before="140" w:after="60"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="21"/><w:color w:val="002E62"/></w:rPr><w:t>INSTRUCTIONS TO CANDIDATES:</w:t></w:r>
    </w:p>
    <w:p><w:pPr><w:ind w:left="240"/><w:spacing w:after="30"/></w:pPr>
      <w:r><w:rPr><w:sz w:val="20"/><w:color w:val="334155"/></w:rPr><w:t>• Write your name, centre number and candidate number in the spaces at the top of this page.</w:t></w:r>
    </w:p>
    <w:p><w:pPr><w:ind w:left="240"/><w:spacing w:after="30"/></w:pPr>
      <w:r><w:rPr><w:sz w:val="20"/><w:color w:val="334155"/></w:rPr><w:t>• Answer ALL the questions. Write your answers on this question paper.</w:t></w:r>
    </w:p>
    <w:p><w:pPr><w:ind w:left="240"/><w:spacing w:after="30"/></w:pPr>
      <w:r><w:rPr><w:sz w:val="20"/><w:color w:val="334155"/></w:rPr><w:t>• Read the instructions for each part carefully before answering.</w:t></w:r>
    </w:p>
    <w:p><w:pPr><w:ind w:left="240"/><w:spacing w:after="140"/></w:pPr>
      <w:r><w:rPr><w:sz w:val="20"/><w:color w:val="334155"/></w:rPr><w:t>• Dictionaries and electronic devices are NOT permitted.</w:t></w:r>
    </w:p>
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
        <w:r><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="334155"/></w:rPr><w:t>— Questions ${partQuestionStart}–${partQuestionEnd} [${part.questions.length} marks]</w:t></w:r>
      </w:p>
      <w:p>
        <w:pPr><w:spacing w:before="60" w:after="120"/></w:pPr>
        <w:r><w:rPr><w:i/><w:b/><w:sz w:val="21"/><w:color w:val="475569"/></w:rPr><w:t>${escapeXml(part.instructions)}</w:t></w:r>
      </w:p>
    `;

    // If Part has a reading passage
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

    // Render questions in this part
    part.questions.forEach((q: CambridgeQuestion) => {
      docXml += `
        <w:p>
          <w:pPr><w:spacing w:before="140" w:after="60"/></w:pPr>
          <w:r><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="002E62"/></w:rPr><w:t>${questionIndex}. </w:t></w:r>
          <w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t>${escapeXml(q.question)}</w:t></w:r>
          <w:r><w:rPr><w:sz w:val="18"/><w:color w:val="94A3B8"/></w:rPr><w:t>  [1 mark]</w:t></w:r>
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

      questionIndex += 1;
    });
  });

  // End of test page break
  docXml += `
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:before="240" w:after="240"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="475569"/></w:rPr><w:t>---------- END OF QUESTION PAPER ----------</w:t></w:r>
    </w:p>
    <w:p><w:r><w:br w:type="page"/></w:r></w:p>

    <!-- Page 2: Cambridge Marking Scheme & Answer Key -->
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
        <w:tc><w:tcPr><w:tcW w:w="1000" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="002E62"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Item</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="1100" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="002E62"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Key</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="2500" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="002E62"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Skill / Focus Area</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="4800" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="002E62"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Explanatory Rationale &amp; Evidence</w:t></w:r></w:p></w:tc>
      </w:tr>
  `;

  let qCount = 1;
  exam.parts.forEach((part) => {
    part.questions.forEach((q) => {
      const correctLetter = labels[q.correctIndex] || `Option ${q.correctIndex + 1}`;
      docXml += `
        <w:tr>
          <w:tc><w:tcPr><w:tcW w:w="1000" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Q${qCount}</w:t></w:r></w:p></w:tc>
          <w:tc><w:tcPr><w:tcW w:w="1100" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="047857"/></w:rPr><w:t>${correctLetter}</w:t></w:r></w:p></w:tc>
          <w:tc><w:tcPr><w:tcW w:w="2500" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:sz w:val="20"/><w:color w:val="334155"/></w:rPr><w:t>${escapeXml(q.focusArea || 'Language Focus')}</w:t></w:r></w:p></w:tc>
          <w:tc><w:tcPr><w:tcW w:w="4800" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>${escapeXml(q.explanation || 'Correct based on curriculum material.')}</w:t></w:r></w:p></w:tc>
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
          const optionsHtml = q.options
            .map((opt, optIdx) => {
              const label = labels[optIdx] || `${optIdx + 1}`;
              return `
                <div class="option-item">
                  <span class="option-label"><strong>${label}</strong></span>
                  <span class="option-text">${escapeHtml(opt)}</span>
                </div>
              `;
            })
            .join('');

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
                </div>
                <span class="q-mark">[1]</span>
              </div>
              <div class="options-grid">
                ${optionsHtml}
              </div>
            </div>
          `;
        })
        .join('');

      return `
        <div class="part-section">
          <div class="part-banner">
            <span class="part-title">Part ${part.partNumber}</span>
            <span class="part-meta">Questions ${qStart}–${qEnd} (${part.questions.length} marks)</span>
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
      const correctLetter = labels[q.correctIndex] || `${q.correctIndex + 1}`;
      answerRows += `
        <tr>
          <td class="text-center font-bold">Q${rowIdx}</td>
          <td class="text-center font-bold text-emerald-700 bg-emerald-50">${correctLetter}</td>
          <td><span class="skill-badge">${escapeHtml(q.focusArea || 'Language Focus')}</span></td>
          <td>${escapeHtml(q.explanation || 'Correct based on lesson material.')}</td>
        </tr>
      `;
      rowIdx += 1;
    });
  });

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
      z-index: 100;
      background: #002e62;
      color: #ffffff;
      padding: 10px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .toolbar-title { font-weight: 700; font-size: 14px; display: flex; align-items: center; gap: 8px; }
    .toolbar-actions { display: flex; gap: 10px; }
    .btn-action {
      background: #ffffff;
      color: #002e62;
      border: none;
      padding: 7px 14px;
      font-weight: 700;
      font-size: 12px;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s;
    }
    .btn-action:hover { background: #f1f5f9; transform: translateY(-1px); }
    .btn-action-primary { background: #c91c24; color: #ffffff; }
    .btn-action-primary:hover { background: #b01820; }
    .paper-container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 20px 24px;
    }
    /* Cambridge Header */
    .cambridge-header {
      text-align: center;
      border-bottom: 2px solid #002e62;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .inst-name { font-size: 11pt; font-weight: 700; color: #475569; letter-spacing: 0.05em; text-transform: uppercase; }
    .qual-name { font-size: 16pt; font-weight: 800; color: #002e62; margin: 4px 0; letter-spacing: -0.01em; }
    .paper-name { font-size: 12pt; font-weight: 700; color: #c91c24; }
    .meta-line { font-size: 9.5pt; color: #475569; margin-top: 6px; }
    
    /* Candidate Info Box */
    .candidate-box {
      border: 1.5px solid #002e62;
      border-radius: 4px;
      margin-bottom: 16px;
      background: #f8fafc;
      overflow: hidden;
    }
    .candidate-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border-bottom: 1px solid #cbd5e1;
    }
    .candidate-row:last-child { border-bottom: none; }
    .candidate-cell {
      padding: 6px 12px;
      font-size: 9.5pt;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .candidate-cell:first-child { border-right: 1px solid #cbd5e1; }
    .box-grid { display: inline-flex; gap: 4px; }
    .num-box {
      width: 18px;
      height: 20px;
      border: 1px solid #64748b;
      background: #ffffff;
      display: inline-block;
    }

    /* Instructions */
    .instructions-box {
      background: #f1f5f9;
      border-left: 3px solid #002e62;
      padding: 8px 12px;
      font-size: 9pt;
      margin-bottom: 20px;
      line-height: 1.4;
    }
    .instructions-box strong { color: #002e62; display: block; margin-bottom: 2px; }
    .instructions-box ul { padding-left: 18px; }

    /* Parts */
    .part-section {
      margin-bottom: 24px;
      break-inside: avoid;
    }
    .part-banner {
      background: #002e62;
      color: #ffffff;
      padding: 4px 10px;
      border-radius: 3px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .part-title { font-weight: 800; font-size: 11pt; letter-spacing: 0.02em; }
    .part-meta { font-size: 9pt; opacity: 0.9; }
    .part-instructions { font-size: 9.5pt; color: #334155; margin-bottom: 10px; }
    .passage-box {
      border: 1px solid #94a3b8;
      border-left: 4px solid #002e62;
      background: #f8fafc;
      padding: 10px 14px;
      font-size: 10pt;
      font-style: italic;
      margin-bottom: 12px;
      border-radius: 2px;
      line-height: 1.5;
    }

    /* Questions */
    .question-block {
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px dashed #e2e8f0;
      break-inside: avoid;
    }
    .question-header {
      display: flex;
      align-items: baseline;
      gap: 6px;
      margin-bottom: 6px;
    }
    .q-num { font-weight: 800; color: #002e62; font-size: 10.5pt; min-width: 22px; }
    .q-content { flex: 1; }
    .q-text { font-weight: 600; font-size: 10.5pt; color: #0f172a; }
    .q-context { font-size: 9.5pt; font-style: italic; color: #475569; margin-top: 2px; }
    .q-mark { font-size: 9pt; color: #94a3b8; margin-left: auto; font-weight: 600; }
    
    .options-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 4px 12px;
      margin-left: 28px;
    }
    .option-item {
      font-size: 10pt;
      display: flex;
      align-items: baseline;
      gap: 6px;
    }
    .option-label {
      display: inline-block;
      width: 18px;
      font-weight: 700;
      color: #002e62;
    }
    .option-text { color: #1e293b; }

    /* End divider */
    .end-paper {
      text-align: center;
      margin: 28px 0;
      font-weight: 700;
      font-size: 10pt;
      color: #64748b;
      letter-spacing: 0.1em;
    }

    /* Page break for marking scheme */
    .page-break {
      page-break-before: always;
      break-before: page;
      margin-top: 20px;
    }

    /* Marking scheme table */
    .answer-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5pt;
      margin-top: 14px;
    }
    .answer-table th, .answer-table td {
      border: 1px solid #cbd5e1;
      padding: 6px 10px;
      text-align: left;
    }
    .answer-table th {
      background: #002e62;
      color: #ffffff;
      font-weight: 700;
    }
    .skill-badge {
      display: inline-block;
      background: #f1f5f9;
      color: #1e3a8a;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 8.5pt;
      font-weight: 600;
    }
    .text-center { text-align: center; }
    .font-bold { font-weight: 700; }
    .text-emerald-700 { color: #047857; }
    .bg-emerald-50 { background: #ecfdf5; }

    @media print {
      .print-toolbar { display: none !important; }
      body { background: #ffffff; }
      .paper-container { padding: 0; max-width: 100%; }
      .page-break { page-break-before: always; break-before: page; }
    }
  </style>
</head>
<body>
  <div class="print-toolbar">
    <div class="toolbar-title">
      <span>🏛️</span>
      <span>Cambridge Assessment English — Bản in Đề thi A4 & Xuất PDF</span>
    </div>
    <div class="toolbar-actions">
      <button type="button" class="btn-action btn-action-primary" onclick="window.print()">
        🖨️ In / Lưu thành file PDF (Ctrl + P)
      </button>
      <button type="button" class="btn-action" onclick="window.close()">
        ✕ Đóng
      </button>
    </div>
  </div>

  <div class="paper-container">
    <!-- Header -->
    <div class="cambridge-header">
      <div class="inst-name">${escapeHtml(institutionName || 'CAMBRIDGE ASSESSMENT ENGLISH')}</div>
      <div class="qual-name">${escapeHtml(exam.qualificationName.toUpperCase())}</div>
      <div class="paper-name">${escapeHtml(exam.paperName)}</div>
      <div class="meta-line">
        Exam Code: <strong>${escapeHtml(exam.examCode)}</strong> &nbsp;|&nbsp; 
        Time allowed: <strong>${exam.timeMinutes} minutes</strong> &nbsp;|&nbsp; 
        Total marks: <strong>${exam.totalMarks} marks</strong>
      </div>
    </div>

    <!-- Candidate Box -->
    <div class="candidate-box">
      <div class="candidate-row">
        <div class="candidate-cell">
          <strong>Centre Number:</strong>
          <span class="box-grid">
            <span class="num-box"></span><span class="num-box"></span><span class="num-box"></span><span class="num-box"></span><span class="num-box"></span>
          </span>
        </div>
        <div class="candidate-cell">
          <strong>Candidate Number:</strong>
          <span class="box-grid">
            <span class="num-box"></span><span class="num-box"></span><span class="num-box"></span><span class="num-box"></span>
          </span>
        </div>
      </div>
      <div class="candidate-row">
        <div class="candidate-cell">
          <strong>Candidate Name:</strong>
          <span>................................................................</span>
        </div>
        <div class="candidate-cell">
          <strong>Class / Date:</strong>
          <span>................................................................</span>
        </div>
      </div>
    </div>

    <!-- Instructions -->
    <div class="instructions-box">
      <strong>INSTRUCTIONS TO CANDIDATES:</strong>
      <ul>
        <li>Write your name, centre number and candidate number in the spaces at the top of this page.</li>
        <li>Answer all questions. Write your answers on the question paper.</li>
        <li>Read the instructions for each part carefully before answering.</li>
        <li>Dictionaries and electronic devices are NOT permitted.</li>
      </ul>
    </div>

    <!-- Parts List -->
    ${partsHtml}

    <div class="end-paper">---------- END OF QUESTION PAPER ----------</div>

    <!-- Page Break for Answer Key -->
    <div class="page-break">
      <div class="cambridge-header">
        <div class="inst-name">${escapeHtml(institutionName || 'CAMBRIDGE ASSESSMENT ENGLISH')}</div>
        <div class="qual-name">MARKING SCHEME &amp; EXPLANATORY ANSWER KEY</div>
        <div class="meta-line">
          ${escapeHtml(exam.qualificationName)} &nbsp;|&nbsp; 
          ${escapeHtml(exam.paperName)} &nbsp;|&nbsp; 
          Total: ${exam.totalMarks} marks
        </div>
      </div>

      <table class="answer-table">
        <thead>
          <tr>
            <th style="width: 10%; text-align: center;">Item</th>
            <th style="width: 12%; text-align: center;">Key</th>
            <th style="width: 28%;">Skill / Focus Area</th>
            <th style="width: 50%;">Explanatory Rationale &amp; Evidence</th>
          </tr>
        </thead>
        <tbody>
          ${answerRows}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
}

/**
 * 3. Xuất file PDF theo chuẩn bài thi Cambridge (Mở cửa sổ in chuyên dụng với phím tắt Lưu PDF)
 */
export function exportCambridgeExamPdf(
  exam: CambridgeExam,
  institutionName?: string
): void {
  const htmlContent = generateCambridgePrintHtml(exam, institutionName);
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Trình duyệt đã chặn cửa sổ Popup. Vui lòng cho phép popup để mở bản in PDF.');
  }

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();

  // Auto trigger native print dialog once loaded
  printWindow.onload = () => {
    setTimeout(() => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch {
        // User can click button in toolbar
      }
    }, 400);
  };
}

function escapeHtml(unsafe: string | null | undefined): string {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
