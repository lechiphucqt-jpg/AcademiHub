import type { HtmlAuditIssue, HtmlAuditReport } from '../types/academic';

export function inspectHtmlCompatibility(html: string): HtmlAuditReport {
  const source = html ?? '';
  const byteSize = new Blob([source]).size;
  const issues: HtmlAuditIssue[] = [];

  const scriptMatches = source.match(/<script\b[^>]*>/gi) ?? [];
  const styleMatches = source.match(/<style\b[^>]*>/gi) ?? [];
  const externalMatches = source.match(/(?:src|href)=["']https?:\/\/[^"']+["']/gi) ?? [];

  if (!/<!doctype\s+html>/i.test(source)) {
    issues.push({
      severity: 'warning',
      code: 'NO_DOCTYPE',
      label: 'Thiếu khai báo <!DOCTYPE html>',
      detail: 'Nên bổ sung <!DOCTYPE html> ở đầu file để tránh chế độ Quirks Mode khi hiển thị bố cục CSS.',
    });
  } else {
    issues.push({
      severity: 'pass',
      code: 'DOCTYPE_OK',
      label: 'Chuẩn tài liệu HTML5',
      detail: 'Tài liệu đã khai báo <!DOCTYPE html> đầy đủ.',
    });
  }

  if (!/<meta[^>]+name=["']viewport["'][^>]*>/i.test(source)) {
    issues.push({
      severity: 'warning',
      code: 'NO_VIEWPORT',
      label: 'Thiếu thẻ meta viewport',
      detail: 'Thiếu <meta name="viewport" content="width=device-width, initial-scale=1.0"> có thể khiến nội dung bị thu nhỏ sai tỷ lệ trên Tablet/Mobile.',
    });
  } else {
    issues.push({
      severity: 'pass',
      code: 'VIEWPORT_OK',
      label: 'Hỗ trợ hiển thị Responsive',
      detail: 'Đã cấu hình thẻ meta viewport tương thích đa thiết bị.',
    });
  }

  if (externalMatches.length > 0) {
    issues.push({
      severity: 'warning',
      code: 'EXTERNAL_CDN',
      label: `Phát hiện ${externalMatches.length} tài nguyên liên kết ngoài`,
      detail: 'Khi mang gói dữ liệu sang máy không có mạng (Local-First offline), các liên kết CDN bên ngoài có thể không tải được. Khuyến nghị nhúng nội tuyến.',
    });
  } else {
    issues.push({
      severity: 'pass',
      code: 'OFFLINE_READY',
      label: 'Tự chứa 100% (Offline-ready)',
      detail: 'Không phụ thuộc CDN bên ngoài; hoạt động ổn định khi xuất gói Local-First.',
    });
  }

  if (/\b(?:window\.top|window\.parent|document\.cookie|localStorage|sessionStorage)\b/.test(source)) {
    issues.push({
      severity: 'error',
      code: 'SANDBOX_BLOCKED_API',
      label: 'Phát hiện API bị cô lập trong Sandbox',
      detail: 'Trình xem chạy trong iframe cô lập (opaque origin). Các lời gọi localStorage, document.cookie, hoặc window.parent sẽ bị chặn để bảo vệ Hub.',
    });
  } else {
    issues.push({
      severity: 'pass',
      code: 'SANDBOX_SAFE',
      label: 'Tương thích cô lập Sandbox',
      detail: 'Không có xung đột với DOM chính hoặc API lưu trữ bị chặn trong iframe.',
    });
  }

  if (/\b(?:alert|confirm|prompt)\s*\(/.test(source)) {
    issues.push({
      severity: 'warning',
      code: 'NATIVE_DIALOG',
      label: 'Sử dụng hộp thoại trình duyệt (alert/confirm)',
      detail: 'Nên thay thế alert()/confirm() bằng phản hồi trực tiếp trong DOM để giữ trải nghiệm học tập liền mạch.',
    });
  }

  const hasError = issues.some((i) => i.severity === 'error');
  return {
    compatible: !hasError,
    byteSize,
    scriptCount: scriptMatches.length,
    styleCount: styleMatches.length,
    externalResourceCount: externalMatches.length,
    issues,
  };
}

export function extractHtmlBlocksFromMarkdown(markdown: string): string[] {
  const blocks: string[] = [];
  const regex = /```html\s*\n([\s\S]*?)```/gi;
  let match: RegExpExecArray | null = regex.exec(markdown);
  while (match !== null) {
    const code = match[1]?.trim();
    if (code && code.length > 40) {
      blocks.push(code);
    }
    match = regex.exec(markdown);
  }
  return blocks;
}

export function isSafeImageSrc(src: string | null | undefined): boolean {
  if (!src || typeof src !== 'string') return false;
  const trimmed = src.trim();
  if (trimmed.startsWith('/src/assets/images/')) return true;
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(trimmed)) return true;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}
