/**
 * ICOファイル生成
 * PNG画像をICO形式に変換（Windows用アイコン）
 */

const ICO_HEADER_SIZE = 6;
const ICO_ENTRY_SIZE = 16;

/**
 * PNG BlobをArrayBufferに変換
 */
async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return await blob.arrayBuffer();
}

/**
 * Canvasを指定サイズにリサイズしてPNG Blobを取得
 */
async function resizeCanvasToPng(
  sourceCanvas: HTMLCanvasElement,
  size: number
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // 高品質リサイズ
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(sourceCanvas, 0, 0, size, size);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), "image/png");
  });
}

/**
 * ICOファイルを生成
 * @param canvas - ソースキャンバス（512x512推奨）
 * @param sizes - 含めるサイズの配列（デフォルト: 16, 32, 48, 256）
 * @returns ICOファイルのBlob
 */
export async function generateIco(
  canvas: HTMLCanvasElement,
  sizes: number[] = [16, 32, 48, 256]
): Promise<Blob> {
  // 各サイズのPNGを生成
  const pngBuffers: ArrayBuffer[] = [];
  for (const size of sizes) {
    const blob = await resizeCanvasToPng(canvas, size);
    const buffer = await blobToArrayBuffer(blob);
    pngBuffers.push(buffer);
  }

  // ICOファイルの総サイズを計算
  const totalDataSize = pngBuffers.reduce((sum, buf) => sum + buf.byteLength, 0);
  const totalSize =
    ICO_HEADER_SIZE + ICO_ENTRY_SIZE * sizes.length + totalDataSize;

  // ICOファイル用バッファを作成
  const icoBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(icoBuffer);

  // ICOヘッダー (6 bytes)
  view.setUint16(0, 0, true); // Reserved (must be 0)
  view.setUint16(2, 1, true); // Image type (1 = ICO)
  view.setUint16(4, sizes.length, true); // Number of images

  // 各画像のエントリとデータ
  let dataOffset = ICO_HEADER_SIZE + ICO_ENTRY_SIZE * sizes.length;

  for (let i = 0; i < sizes.length; i++) {
    const size = sizes[i];
    const pngData = pngBuffers[i];
    const entryOffset = ICO_HEADER_SIZE + ICO_ENTRY_SIZE * i;

    // ICOディレクトリエントリ (16 bytes)
    view.setUint8(entryOffset + 0, size === 256 ? 0 : size); // Width (0 = 256)
    view.setUint8(entryOffset + 1, size === 256 ? 0 : size); // Height (0 = 256)
    view.setUint8(entryOffset + 2, 0); // Color palette (0 = no palette)
    view.setUint8(entryOffset + 3, 0); // Reserved
    view.setUint16(entryOffset + 4, 1, true); // Color planes
    view.setUint16(entryOffset + 6, 32, true); // Bits per pixel
    view.setUint32(entryOffset + 8, pngData.byteLength, true); // Image size
    view.setUint32(entryOffset + 12, dataOffset, true); // Data offset

    // PNG データをコピー
    const icoArray = new Uint8Array(icoBuffer);
    const pngArray = new Uint8Array(pngData);
    icoArray.set(pngArray, dataOffset);

    dataOffset += pngData.byteLength;
  }

  return new Blob([icoBuffer], { type: "image/x-icon" });
}

/**
 * Blobをダウンロード
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * CanvasをPNGとしてダウンロード
 */
export function downloadCanvasAsPng(
  canvas: HTMLCanvasElement,
  filename: string
): void {
  canvas.toBlob((blob) => {
    if (blob) {
      downloadBlob(blob, filename);
    }
  }, "image/png");
}
