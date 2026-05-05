/**
 * 色指定による背景除去
 * スポイトで選択した色と許容範囲に基づいて背景を透明にする
 */

import { RGBColor } from "@/types/editor";

/**
 * 2つの色の差を計算（ユークリッド距離）
 * 返り値: 0-441.67 (sqrt(255^2 * 3))
 */
function colorDistance(c1: RGBColor, c2: RGBColor): number {
  const dr = c1.r - c2.r;
  const dg = c1.g - c2.g;
  const db = c1.b - c2.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * 許容範囲を0-100から実際の距離に変換
 * 100% = 最大距離 (441.67)
 */
function toleranceToDistance(tolerance: number): number {
  const maxDistance = Math.sqrt(255 * 255 * 3); // ≈ 441.67
  return (tolerance / 100) * maxDistance;
}

/**
 * 指定した色を透明にする
 * @param sourceImage 元画像
 * @param targetColor 除去する色
 * @param tolerance 許容範囲 (0-100)
 * @param feather フェザー（境界のぼかし）を適用するか
 */
export function removeColorFromImage(
  sourceImage: HTMLImageElement,
  targetColor: RGBColor,
  tolerance: number,
  feather: boolean = true
): Blob {
  const canvas = document.createElement("canvas");
  canvas.width = sourceImage.width;
  canvas.height = sourceImage.height;
  const ctx = canvas.getContext("2d")!;

  // 元画像を描画
  ctx.drawImage(sourceImage, 0, 0);

  // ピクセルデータを取得
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const maxDistance = toleranceToDistance(tolerance);
  // フェザー用の追加距離（許容範囲の20%）
  const featherDistance = feather ? maxDistance * 0.2 : 0;

  for (let i = 0; i < data.length; i += 4) {
    const pixelColor: RGBColor = {
      r: data[i],
      g: data[i + 1],
      b: data[i + 2],
    };

    const distance = colorDistance(pixelColor, targetColor);

    if (distance <= maxDistance) {
      // 許容範囲内 → 完全に透明
      data[i + 3] = 0;
    } else if (feather && distance <= maxDistance + featherDistance) {
      // フェザー範囲内 → 段階的に透明
      const alpha = (distance - maxDistance) / featherDistance;
      data[i + 3] = Math.round(data[i + 3] * alpha);
    }
    // それ以外はそのまま
  }

  ctx.putImageData(imageData, 0, 0);

  // Blobに変換して返す
  return new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), "image/png");
  }) as unknown as Blob;
}

/**
 * 非同期版の色除去
 */
export async function removeColorFromImageAsync(
  sourceImage: HTMLImageElement,
  targetColor: RGBColor,
  tolerance: number,
  feather: boolean = true,
  onProgress?: (progress: number, message: string) => void
): Promise<Blob> {
  return new Promise((resolve) => {
    onProgress?.(0.1, "色を分析中...");

    const canvas = document.createElement("canvas");
    canvas.width = sourceImage.width;
    canvas.height = sourceImage.height;
    const ctx = canvas.getContext("2d")!;

    ctx.drawImage(sourceImage, 0, 0);

    onProgress?.(0.3, "ピクセルを処理中...");

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const maxDistance = toleranceToDistance(tolerance);
    const featherDistance = feather ? maxDistance * 0.2 : 0;

    for (let i = 0; i < data.length; i += 4) {
      const pixelColor: RGBColor = {
        r: data[i],
        g: data[i + 1],
        b: data[i + 2],
      };

      const distance = colorDistance(pixelColor, targetColor);

      if (distance <= maxDistance) {
        data[i + 3] = 0;
      } else if (feather && distance <= maxDistance + featherDistance) {
        const alpha = (distance - maxDistance) / featherDistance;
        data[i + 3] = Math.round(data[i + 3] * alpha);
      }
    }

    onProgress?.(0.8, "画像を生成中...");

    ctx.putImageData(imageData, 0, 0);

    canvas.toBlob((blob) => {
      onProgress?.(1.0, "完了");
      resolve(blob!);
    }, "image/png");
  });
}

/**
 * 画像から指定座標の色を取得
 */
export function pickColorFromImage(
  sourceImage: HTMLImageElement,
  x: number,
  y: number,
  imagePosition: { x: number; y: number },
  imageScale: number,
  canvasSize: number
): RGBColor | null {
  const canvas = document.createElement("canvas");
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext("2d")!;

  // 画像の描画位置を計算
  const imgWidth = sourceImage.width;
  const imgHeight = sourceImage.height;
  const fitScale = Math.min(canvasSize / imgWidth, canvasSize / imgHeight);
  const scaledWidth = imgWidth * fitScale * imageScale;
  const scaledHeight = imgHeight * fitScale * imageScale;
  const drawX = (canvasSize - scaledWidth) / 2 + imagePosition.x;
  const drawY = (canvasSize - scaledHeight) / 2 + imagePosition.y;

  ctx.drawImage(sourceImage, drawX, drawY, scaledWidth, scaledHeight);

  // クリック位置のピクセルを取得
  const pixel = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;

  // 透明な部分をクリックした場合はnull
  if (pixel[3] === 0) {
    return null;
  }

  return {
    r: pixel[0],
    g: pixel[1],
    b: pixel[2],
  };
}

/**
 * RGB色を16進数文字列に変換
 */
export function rgbToHex(color: RGBColor): string {
  return `#${color.r.toString(16).padStart(2, "0")}${color.g.toString(16).padStart(2, "0")}${color.b.toString(16).padStart(2, "0")}`;
}

/**
 * 16進数文字列をRGB色に変換
 */
export function hexToRgb(hex: string): RGBColor | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}
