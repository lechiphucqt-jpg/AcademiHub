/**
 * Image processing utilities for book covers and academic content.
 */

/**
 * Reads an image File, downscales it to max dimensions if needed,
 * and returns a clean, compact Data URL (base64) suitable for local-first storage.
 */
export async function optimizeAndEncodeImage(
  file: File,
  maxWidth = 800,
  maxHeight = 1100,
  quality = 0.88
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Tệp đã chọn không phải là hình ảnh hợp lệ (hỗ trợ .png, .jpg, .jpeg, .webp).'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không thể đọc tệp hình ảnh từ thiết bị.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Định dạng hình ảnh không được hỗ trợ bởi trình duyệt.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Downscale while preserving aspect ratio if larger than target bounds
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Prefer JPEG for photos/scans to keep base64 size compact (~60-150KB), PNG if transparency detected
        const isPngWithTransparency = file.type === 'image/png' && detectTransparency(ctx, width, height);
        const outputMime = isPngWithTransparency ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(outputMime, quality);
        resolve(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function detectTransparency(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  try {
    const data = ctx.getImageData(0, 0, width, height).data;
    const step = Math.max(1, Math.floor(data.length / 500));
    for (let i = 3; i < data.length; i += step * 4) {
      if (data[i] < 250) return true;
    }
  } catch {
    // Canvas security/taint fallback
  }
  return false;
}
