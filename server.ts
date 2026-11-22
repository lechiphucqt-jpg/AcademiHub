import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MODEL_NAME = 'gemini-4-hydrogen';

const EDTECH_ARCHITECT_SYSTEM_INSTRUCTION = `# Custom System Instruction: EdTech Solution Architect & Interactive Content Specialist

## 1. Role
Bạn là một **Chuyên gia Kiến trúc Giải pháp Công nghệ Giáo dục (Senior EdTech Solutions Architect)** và **Chuyên gia Quản trị Nội dung Số**. Bạn sở hữu kiến thức sâu rộng về cấu trúc dữ liệu học thuật, thiết kế trải nghiệm người dùng (UX) trong giáo dục và khả năng tối ưu hóa các thành phần tương tác HTML từ các mô hình AI. Nhiệm vụ của bạn là tư vấn, hướng dẫn và quản lý mọi khía cạnh của hệ thống "Interactive Academic Hub".

## 2. Objective
Mục tiêu cốt lõi của bạn là giúp người dùng vận hành một hệ sinh thái học tập khép kín, linh hoạt và chuyên nghiệp:
- **Quản lý cấu trúc:** Duy trì sự chặt chẽ của phân cấp nội dung (Sách > Unit > Lesson > Content).
- **Tối ưu hóa tương tác:** Chuyển hóa và tích hợp các nội dung HTML phức tạp vào hệ thống một cách mượt mà.
- **Tùy biến thương hiệu:** Hỗ trợ người dùng thiết lập diện mạo riêng (White-labeling) thông qua bảng quản trị.
- **Bảo mật & Di động dữ liệu:** Đảm bảo dữ liệu được lưu trữ an toàn tại máy địa phương và có khả năng xuất/nhập (Import/Export) đồng bộ giữa các thiết bị.
- **Trợ lý AI:** Đóng vai trò là một người bạn đồng hành thông minh, phân tích và đề xuất cách tối ưu bài học dựa trên dữ liệu người dùng.

## 3. Guidelines & Rules
- **Quy tắc Cấu trúc Dữ liệu (Strict Hierarchy):** Không bao giờ phá vỡ sơ đồ: \`Sách (Book)\` -> \`Chương (Units)\` -> \`Bài học (Lessons)\` -> \`Thành phần chi tiết (Detailed Content)\`. Mọi dữ liệu mới phải được định danh và xếp đúng vào cây thư mục này.
- **Quy tắc Nội dung HTML:** Khi xử lý hoặc tạo file HTML, phải đảm bảo tính tương thích với trình xem sandboxed iframe của ứng dụng (tự chứa 100% HTML/CSS/JS nội tuyến, responsive, không phụ thuộc CDN dễ lỗi, không xung đột giao diện).
- **Quy tắc Local-First:** Ưu tiên lưu trữ trực tiếp tại máy địa phương (IndexedDB / thư mục cục bộ) với định dạng dữ liệu nhẹ, tốc độ truy xuất cao (JSON/ZIP).
- **Quy tắc Đóng gói (Portability):** Gói xuất dữ liệu phải gồm đủ: Tài nguyên media, File HTML theo cây thư mục chuẩn và File cấu hình JSON (manifest + branding).
- **Quy tắc Branding:** Mọi thay đổi Logo, màu sắc và tên ứng dụng thực hiện qua cấu hình tập trung (\`branding.json\` / biến môi trường).

## 4. Tone & Persona
- Chuyên nghiệp, trực diện, chính xác, hỗ trợ và gợi mở.
- Sử dụng thuật ngữ EdTech chuẩn (SCORM-compliant, Interactive UI, Data Integrity, UX Flow, Local-First) nhưng dễ hiểu cho giảng viên và người biên soạn.

## 5. Output Format (BẮT BUỘC)
Mọi phản hồi tư vấn cần tuân thủ cấu trúc 4 phần rõ ràng bằng tiếng Việt:
1. **Xác nhận trạng thái (Status):** Tóm tắt ngắn gọn yêu cầu và vị trí trong cây cấu trúc (Book > Unit > Lesson > Content).
2. **Giải pháp chi tiết (Detailed Solution):**
   - *Về cấu trúc:* Sơ đồ cây nội dung đang xử lý.
   - *Về kỹ thuật:* Đoạn mã (nếu cần), cấu hình hoặc giải pháp kiến trúc cụ thể. (Nếu cung cấp mã HTML tương tác hoàn chỉnh, đặt trong block \`\`\`html ... \`\`\` tự chứa hoàn toàn để người dùng lưu ngay vào bài học).
   - *Về giao diện:* Mô tả cách nội dung hiển thị và tương tác trong trình xem.
3. **Hành động tiếp theo (Next Steps):** Đề xuất 2–3 bước thực hành tiếp theo cụ thể.
4. **Cảnh báo/Lưu ý (Optional):** Ghi chú về dung lượng, bảo mật sandbox, hoặc tính tương thích của học liệu.`;

const HTML_GENERATOR_SYSTEM_INSTRUCTION = `Bạn là Senior EdTech Interactive Content Engineer chuyên tạo học liệu tương tác HTML5 chuẩn cho trình xem sandboxed iframe của Interactive Academic Hub.

Yêu cầu kỹ thuật BẮT BUỘC:
1. Trả về DUY NHẤT một tài liệu HTML5 hoàn chỉnh, tự chứa 100% (bắt đầu bằng \`<!DOCTYPE html>\` và kết thúc bằng \`</html>\`), KHÔNG bọc trong markdown fence, KHÔNG thêm lời giải thích ngoài mã HTML.
2. Toàn bộ CSS nằm trong thẻ \`<style>\` và toàn bộ JavaScript nằm trong thẻ \`<script>\` nội tuyến. KHÔNG dùng CDN bên ngoài, KHÔNG dùng \`fetch()\` tới internet, KHÔNG dùng \`alert()\` hoặc \`confirm()\` (dùng phản hồi trực quan ngay trong DOM).
3. Thiết kế thẩm mỹ học thuật sạch sẽ, chuyên nghiệp:
   - Nền sáng sạch (#f8fafc / #ffffff), tương phản chữ WCAG AA (#0f172a / #334155), font hệ thống rõ dấu tiếng Việt.
   - Responsive mượt mà trên cả Desktop (100%), Tablet (768px) và Mobile (390px), \`box-sizing: border-box\`, không tràn ngang.
   - Có tương tác thực sự giàu tính sư phạm: chấm điểm tức thì, giải thích đáp án chi tiết, nút "Làm lại" (Reset), thanh tiến độ, trạng thái đúng/sai rõ ràng kèm biểu tượng chữ (không chỉ dựa vào màu sắc).
4. Không sử dụng \`window.top\`, \`window.parent\`, \`localStorage\`, hoặc \`document.cookie\` vì chạy trong iframe sandbox bảo mật.`;

const FALLBACK_MODELS = [
  'gemini-3-flash-preview',
  'gemini-3-pro-preview',
  'gemini-2.5-flash',
];

function getGeminiClient(customApiKey?: string): GoogleGenAI {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('MISSING_API_KEY');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function generateWithFallback(
  ai: GoogleGenAI,
  preferredModel: string,
  params: { contents: any; config?: any }
) {
  const modelsToTry = [
    preferredModel,
    ...FALLBACK_MODELS.filter((m) => m !== preferredModel),
  ];

  let lastError: unknown = null;
  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        ...params,
        model,
      });
      return { response, modelUsed: model };
    } catch (err) {
      lastError = err;
      console.warn(`[Fallback] Model ${model} gặp lỗi, tự động thử lại với model tiếp theo...`);
    }
  }
  throw lastError;
}

function stripMarkdownCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:html)?\s*\n([\s\S]*?)\n```$/i);
  if (fenceMatch && fenceMatch[1]) {
    return fenceMatch[1].trim();
  }
  return trimmed;
}

function handleGeminiError(res: Response, err: unknown, fallbackMessage: string) {
  const errorMessage = err instanceof Error ? err.message : String(err);
  if (errorMessage === 'MISSING_API_KEY') {
    return res.status(503).json({
      error: 'Chưa cấu hình GEMINI_API_KEY trên máy chủ. Vui lòng kiểm tra mục Settings > Secrets.',
    });
  }
  if (errorMessage.includes('403') || errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('API_KEY_INVALID')) {
    return res.status(403).json({
      error: 'Khóa Gemini API không hợp lệ hoặc bị từ chối quyền truy cập. Vui lòng kiểm tra trong Settings > Secrets.',
    });
  }
  if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
    return res.status(429).json({
      error: 'Đã đạt giới hạn lượt gọi API tạm thời. Vui lòng thử lại sau ít phút hoặc nâng cấp hạn mức trong Settings > Secrets.',
    });
  }
  console.error('[Gemini API Error]', errorMessage);
  return res.status(500).json({ error: fallbackMessage });
}

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'interactive-academic-hub' });
  });

  const handleChatRequest = async (req: Request, res: Response) => {
    try {
      const { message, history, curriculumContext, apiKey, model, systemInstruction } = req.body as {
        message?: unknown;
        history?: unknown;
        curriculumContext?: unknown;
        apiKey?: unknown;
        model?: unknown;
        systemInstruction?: unknown;
      };

      if (typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: 'Vui lòng nhập nội dung câu hỏi hoặc yêu cầu.' });
      }
      if (message.length > 12000) {
        return res.status(400).json({ error: 'Nội dung tin nhắn vượt quá giới hạn 12.000 ký tự.' });
      }

      const safeHistory: ChatTurn[] = Array.isArray(history)
        ? history
            .filter(
              (item): item is ChatTurn =>
                typeof item === 'object' &&
                item !== null &&
                ((item as ChatTurn).role === 'user' || (item as ChatTurn).role === 'assistant') &&
                typeof (item as ChatTurn).content === 'string'
            )
            .slice(-10)
        : [];

      const contextText =
        typeof curriculumContext === 'string' && curriculumContext.trim()
          ? `\n\n--- NGỮ CẢNH CẤU TRÚC DỮ LIỆU HIỆN TẠI CỦA HUB ---\n${curriculumContext.slice(0, 8000)}\n--- HẾT NGỮ CẢNH ---`
          : '';

      const contents = [
        ...safeHistory.map((turn) => ({
          role: turn.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: turn.content.slice(0, 6000) }],
        })),
        {
          role: 'user',
          parts: [{ text: `${message.trim()}${contextText}` }],
        },
      ];

      const clientKey = typeof apiKey === 'string' && apiKey.trim() ? apiKey.trim() : undefined;
      const ai = getGeminiClient(clientKey);
      const chosenModel = typeof model === 'string' && model.trim() ? model.trim() : 'gemini-3-flash-preview';
      const instruction = typeof systemInstruction === 'string' && systemInstruction.trim() ? systemInstruction.trim() : EDTECH_ARCHITECT_SYSTEM_INSTRUCTION;

      const { response, modelUsed } = await generateWithFallback(ai, chosenModel, {
        contents,
        config: {
          systemInstruction: instruction,
        },
      });

      const reply = response.text?.trim();
      if (!reply) {
        return res.status(502).json({ error: 'Mô hình AI không trả về nội dung. Vui lòng thử lại.' });
      }

      return res.json({ reply, modelUsed });
    } catch (err) {
      return handleGeminiError(res, err, 'Không thể kết nối Trợ lý Kiến trúc AI. Vui lòng thử lại.');
    }
  };

  app.post('/api/ai/chat', handleChatRequest);
  app.post('/api/ai-chat', handleChatRequest);

  app.post('/api/ai/generate-html', async (req: Request, res: Response) => {
    try {
      const { topic, interactionType, bookTitle, unitTitle, lessonTitle, language, apiKey, model } = req.body as {
        topic?: unknown;
        interactionType?: unknown;
        bookTitle?: unknown;
        unitTitle?: unknown;
        lessonTitle?: unknown;
        language?: unknown;
        apiKey?: unknown;
        model?: unknown;
      };

      if (typeof topic !== 'string' || !topic.trim()) {
        return res.status(400).json({ error: 'Vui lòng mô tả chủ đề học liệu tương tác cần tạo.' });
      }
      if (topic.length > 4000) {
        return res.status(400).json({ error: 'Mô tả vượt quá giới hạn cho phép.' });
      }

      const typeLabel = typeof interactionType === 'string' && interactionType.trim() ? interactionType.trim() : 'Bài tập tương tác tổng hợp';
      const langLabel = typeof language === 'string' && language.trim() ? language.trim() : 'Tiếng Việt';
      const hierarchyLine = [bookTitle, unitTitle, lessonTitle]
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        .join(' > ');

      const prompt = [
        `Hãy xây dựng một học liệu tương tác HTML5 hoàn chỉnh, tự chứa 100% (HTML + CSS + JS nội tuyến).`,
        hierarchyLine ? `Vị trí phân cấp học thuật: ${hierarchyLine}` : '',
        `Loại hình tương tác mong muốn: ${typeLabel}`,
        `Ngôn ngữ hiển thị cho học sinh: ${langLabel}`,
        `Yêu cầu chi tiết nội dung: ${topic.trim()}`,
        `Đảm bảo giao diện sắc nét, trực quan, có phản hồi tức thì khi học sinh thao tác, tính điểm/tiến độ rõ ràng và nút Làm lại.`,
      ]
        .filter(Boolean)
        .join('\n');

      const clientKey = typeof apiKey === 'string' && apiKey.trim() ? apiKey.trim() : undefined;
      const ai = getGeminiClient(clientKey);
      const chosenModel = typeof model === 'string' && model.trim() ? model.trim() : 'gemini-3-flash-preview';

      const { response, modelUsed } = await generateWithFallback(ai, chosenModel, {
        contents: prompt,
        config: {
          systemInstruction: HTML_GENERATOR_SYSTEM_INSTRUCTION,
        },
      });

      const html = stripMarkdownCodeFence(response.text ?? '');
      if (!html || !html.toLowerCase().includes('<html')) {
        return res.status(502).json({ error: 'Mã HTML sinh ra chưa hoàn chỉnh. Vui lòng thử lại với mô tả cụ thể hơn.' });
      }

      return res.json({ html, modelUsed });
    } catch (err) {
      return handleGeminiError(res, err, 'Không thể tạo học liệu HTML tương tác lúc này.');
    }
  });

  app.post('/api/ai/optimize-html', async (req: Request, res: Response) => {
    try {
      const { html, issues, lessonContext } = req.body as {
        html?: unknown;
        issues?: unknown;
        lessonContext?: unknown;
      };

      if (typeof html !== 'string' || !html.trim()) {
        return res.status(400).json({ error: 'Thiếu mã nguồn HTML cần tối ưu hóa.' });
      }
      if (html.length > 250000) {
        return res.status(400).json({ error: 'File HTML vượt quá dung lượng tối đa 250KB cho chế độ tối ưu AI.' });
      }

      const issueSummary = Array.isArray(issues)
        ? issues.filter((i): i is string => typeof i === 'string').slice(0, 12).join('\n- ')
        : '';

      const prompt = [
        `Hãy kiểm tra và tối ưu hóa tài liệu HTML5 tương tác sau đây để chạy mượt mà, responsive và an toàn trong sandboxed iframe của Interactive Academic Hub.`,
        typeof lessonContext === 'string' && lessonContext ? `Ngữ cảnh bài học: ${lessonContext}` : '',
        issueSummary ? `Các vấn đề kỹ thuật cần khắc phục:\n- ${issueSummary}` : '',
        `Giữ nguyên toàn bộ mục tiêu sư phạm và dữ liệu học thuật gốc, bổ sung <!DOCTYPE html>, meta viewport, chuẩn hóa CSS tránh tràn khung, loại bỏ phụ thuộc CDN dễ gãy hoặc lời gọi alert()/localStorage không tương thích sandbox.`,
        `\n--- MÃ HTML GỐC ---\n${html}`,
      ]
        .filter(Boolean)
        .join('\n');

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction: HTML_GENERATOR_SYSTEM_INSTRUCTION,
        },
      });

      const optimizedHtml = stripMarkdownCodeFence(response.text ?? '');
      if (!optimizedHtml) {
        return res.status(502).json({ error: 'Không nhận được kết quả tối ưu HTML.' });
      }

      return res.json({ html: optimizedHtml });
    } catch (err) {
      return handleGeminiError(res, err, 'Không thể tối ưu hóa mã HTML lúc này.');
    }
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Interactive Academic Hub server running at http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
