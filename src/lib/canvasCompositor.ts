/**
 * 最終画像の合成処理
 * レイヤーシステム対応版
 *
 * 合成の仕組み:
 * 1. 下レイヤー（元画像）→ アイコン形状（squircle）でクリップ
 * 2. 上レイヤー（キャラクター）→ はみ出し部分のみ表示
 *    - 消しゴムで消された部分は透明
 *    - アイコン外側のみ表示（内側は下レイヤーが見える）
 */

import { createSquirclePath } from "./squircleMask";
import { Position, Layer, ClipRegion } from "@/types/editor";
import {
  WORKSPACE_SIZE,
  ICON_SIZE,
  ICON_PADDING,
  SQUIRCLE_OFFSET,
  ROUNDNESS,
} from "./constants";

export interface CompositeOptions {
  sourceImage: HTMLImageElement;
  processedImageUrl: string | null;
  imagePosition: Position;
  imageScale: number;
  overflowStrokes: Position[][];
  brushSize: number;
  showOriginal: boolean;
  layers: Layer[];
  clipRegion?: ClipRegion;
  outputSize?: number;
  roundness?: number;
}

/**
 * 画像を読み込む（Promise）
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * 描画パラメータを計算
 */
function getDrawParams(
  sourceImage: HTMLImageElement,
  imagePosition: Position,
  imageScale: number
) {
  const imgWidth = sourceImage.width;
  const imgHeight = sourceImage.height;
  const fitScale = Math.min(ICON_SIZE / imgWidth, ICON_SIZE / imgHeight);
  const scaledWidth = imgWidth * fitScale * imageScale;
  const scaledHeight = imgHeight * fitScale * imageScale;
  const drawX = (WORKSPACE_SIZE - scaledWidth) / 2 + imagePosition.x;
  const drawY = (WORKSPACE_SIZE - scaledHeight) / 2 + imagePosition.y;

  return { drawX, drawY, scaledWidth, scaledHeight };
}

function buildSquircleMask(roundness: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = WORKSPACE_SIZE;
  canvas.height = WORKSPACE_SIZE;
  const ctx = canvas.getContext("2d")!;

  const innerSize = ICON_SIZE - ICON_PADDING * 2;

  ctx.save();
  ctx.translate(SQUIRCLE_OFFSET + ICON_PADDING, SQUIRCLE_OFFSET + ICON_PADDING);
  ctx.fillStyle = "#ffffff";
  createSquirclePath(ctx, innerSize, roundness);
  ctx.fill();
  ctx.restore();

  return canvas;
}

function applyEraserMask(
  ctx: CanvasRenderingContext2D,
  eraserMask: ImageData | null
) {
  if (!eraserMask) return;

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = WORKSPACE_SIZE;
  maskCanvas.height = WORKSPACE_SIZE;
  const maskCtx = maskCanvas.getContext("2d")!;
  maskCtx.putImageData(eraserMask, 0, 0);

  ctx.globalCompositeOperation = "destination-out";
  ctx.drawImage(maskCanvas, 0, 0);
  ctx.globalCompositeOperation = "source-over";
}

/**
 * 最終出力用キャンバスを生成（レイヤーシステム対応）
 */
export async function createFinalCanvas(
  options: CompositeOptions
): Promise<HTMLCanvasElement> {
  const {
    sourceImage,
    processedImageUrl,
    imagePosition,
    imageScale,
    overflowStrokes,
    brushSize,
    showOriginal,
    layers,
    clipRegion,
    outputSize,
    roundness = ROUNDNESS,
  } = options;

  const canvas = document.createElement("canvas");
  canvas.width = WORKSPACE_SIZE;
  canvas.height = WORKSPACE_SIZE;
  const ctx = canvas.getContext("2d")!;

  const { drawX, drawY, scaledWidth, scaledHeight } = getDrawParams(
    sourceImage,
    imagePosition,
    imageScale
  );

  // レイヤーシステムがある場合
  if (layers.length >= 2) {
    const baseLayer = layers.find((l) => l.id === "base");
    const characterLayer = layers.find((l) => l.id === "character");

    if (baseLayer && characterLayer) {
      // squircleマスク
      const squircleMask = buildSquircleMask(roundness);

      // === 1. ベースレイヤー（アイコン内側） ===
      if (baseLayer.visible && baseLayer.imageUrl) {
        const baseImg = await loadImage(baseLayer.imageUrl);
        const baseCanvas = document.createElement("canvas");
        baseCanvas.width = WORKSPACE_SIZE;
        baseCanvas.height = WORKSPACE_SIZE;
        const baseCtx = baseCanvas.getContext("2d")!;

        // 画像を描画
        baseCtx.drawImage(baseImg, drawX, drawY, scaledWidth, scaledHeight);

        applyEraserMask(baseCtx, baseLayer.eraserMask);

        baseCtx.globalCompositeOperation = "destination-in";
        baseCtx.drawImage(squircleMask, 0, 0);

        // メインキャンバスに合成
        ctx.drawImage(baseCanvas, 0, 0);
      }

      // === 2. キャラクターレイヤー（はみ出し部分） ===
      if (characterLayer.visible && characterLayer.imageUrl) {
        const charImg = await loadImage(characterLayer.imageUrl);
        const charCanvas = document.createElement("canvas");
        charCanvas.width = WORKSPACE_SIZE;
        charCanvas.height = WORKSPACE_SIZE;
        const charCtx = charCanvas.getContext("2d")!;

        // 画像を描画
        charCtx.drawImage(charImg, drawX, drawY, scaledWidth, scaledHeight);

        applyEraserMask(charCtx, characterLayer.eraserMask);

        // 手動モードの場合、characterレイヤーは楕円マスク適用なし
        // 通常モードの場合、キャラクターは全体を表示（アイコン外のはみ出し部分が見える）

        // メインキャンバスに合成
        ctx.drawImage(charCanvas, 0, 0);
      }

      // クリッピング処理
      if (clipRegion) {
        const outputCanvas = document.createElement("canvas");
        const outSize = outputSize ?? clipRegion.size;
        outputCanvas.width = outSize;
        outputCanvas.height = outSize;
        const outCtx = outputCanvas.getContext("2d")!;

        outCtx.drawImage(
          canvas,
          clipRegion.x, clipRegion.y, clipRegion.size, clipRegion.size,
          0, 0, outSize, outSize
        );

        return outputCanvas;
      }

      return canvas;
    }
  }

  // === 旧方式（互換性のため残す） ===
  let imgToDraw: HTMLImageElement;

  if (!showOriginal && processedImageUrl) {
    imgToDraw = await loadImage(processedImageUrl);
  } else {
    imgToDraw = sourceImage;
  }

  // マスク用キャンバスを作成（squircle + オーバーフロー）
  const maskCanvas = createMaskCanvasLegacy(overflowStrokes, brushSize);

  // 画像を描画
  ctx.drawImage(imgToDraw, drawX, drawY, scaledWidth, scaledHeight);

  // マスクを適用
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(maskCanvas, 0, 0);
  ctx.globalCompositeOperation = "source-over";

  // クリッピング処理
  if (clipRegion) {
    const outputCanvas = document.createElement("canvas");
    const outSize = outputSize ?? clipRegion.size;
    outputCanvas.width = outSize;
    outputCanvas.height = outSize;
    const outCtx = outputCanvas.getContext("2d")!;

    outCtx.drawImage(
      canvas,
      clipRegion.x, clipRegion.y, clipRegion.size, clipRegion.size,
      0, 0, outSize, outSize
    );

    return outputCanvas;
  }

  return canvas;
}

/**
 * 旧方式のマスクキャンバス作成
 */
function createMaskCanvasLegacy(
  overflowStrokes: Position[][],
  brushSize: number
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = WORKSPACE_SIZE;
  canvas.height = WORKSPACE_SIZE;
  const ctx = canvas.getContext("2d")!;

  const innerSize = ICON_SIZE - ICON_PADDING * 2;

  // squircle領域を白で塗りつぶし
  ctx.save();
  ctx.translate(SQUIRCLE_OFFSET + ICON_PADDING, SQUIRCLE_OFFSET + ICON_PADDING);
  ctx.fillStyle = "#ffffff";
  createSquirclePath(ctx, innerSize, ROUNDNESS);
  ctx.fill();
  ctx.restore();

  // オーバーフロー領域も白で追加
  if (overflowStrokes.length > 0) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = brushSize;

    for (const stroke of overflowStrokes) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x, stroke[i].y);
      }
      ctx.stroke();
    }
  }

  return canvas;
}

/**
 * プレビュー用の小さいキャンバスを作成
 */
export function createPreviewCanvas(
  sourceCanvas: HTMLCanvasElement,
  size: number
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(sourceCanvas, 0, 0, size, size);

  return canvas;
}
