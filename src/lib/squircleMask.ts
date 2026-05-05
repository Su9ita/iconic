/**
 * 二段階角丸による Squircle パス生成（Photoshop方式）
 *
 * 1. 大きな半径で角丸四角形を作成
 * 2. 直線とカーブの接続点のみに小さな角丸を適用
 */

/**
 * 二段階角丸の Squircle マスクを生成
 * Canvas の合成機能を使って実際に二段階処理を行う
 */
export function createSquircleMaskCanvas(
  size: number,
  roundness: number = 0.8
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  if (roundness <= 0) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    return canvas;
  }

  // 角丸比率（0.22 = やや四角寄り、0.32 = 丸め）
  const baseRatio = 0.26;

  // 第一段階: 大きな角丸
  const radius1 = size * baseRatio * roundness;

  // 第二段階: 小さな角丸（接続部をさらに丸める）
  const radius2 = radius1 * 0.7;

  // Step 1: 大きな角丸で描画
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, 0, 0, size, size, radius1);
  ctx.fill();

  // Step 2: さらに全体に小さな角丸を適用
  // 大きな角丸の結果に対して、もう一度角丸処理をかける
  ctx.globalCompositeOperation = "destination-in";
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, 0, 0, size, size, radius1 + radius2);
  ctx.fill();

  return canvas;
}

/**
 * 角丸四角形を描画
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/**
 * Squircle パスを生成（プレビュー用の近似）
 * 実際のマスク処理は createSquircleMaskCanvas で行う
 */
export function createSquirclePath(
  ctx: CanvasRenderingContext2D,
  size: number,
  roundness: number = 0.8
): void {
  if (roundness <= 0) {
    ctx.beginPath();
    ctx.rect(0, 0, size, size);
    return;
  }

  const baseRatio = 0.26;
  const radius1 = size * baseRatio * roundness;
  const radius2 = radius1 * 0.7;

  // 合計の半径（二段階適用後の見た目に近づける）
  const totalRadius = radius1 + radius2 * 0.5;

  // 曲線の開始位置を遠くに
  const curveStart = totalRadius * 1.3;

  // 滑らかな接続のための制御点
  const k = 0.55; // 円弧近似係数

  ctx.beginPath();

  // 上辺
  ctx.moveTo(curveStart, 0);
  ctx.lineTo(size - curveStart, 0);

  // 右上コーナー
  ctx.bezierCurveTo(
    size - curveStart + curveStart * k, 0,
    size, curveStart - curveStart * k,
    size, curveStart
  );

  // 右辺
  ctx.lineTo(size, size - curveStart);

  // 右下コーナー
  ctx.bezierCurveTo(
    size, size - curveStart + curveStart * k,
    size - curveStart + curveStart * k, size,
    size - curveStart, size
  );

  // 下辺
  ctx.lineTo(curveStart, size);

  // 左下コーナー
  ctx.bezierCurveTo(
    curveStart - curveStart * k, size,
    0, size - curveStart + curveStart * k,
    0, size - curveStart
  );

  // 左辺
  ctx.lineTo(0, curveStart);

  // 左上コーナー
  ctx.bezierCurveTo(
    0, curveStart - curveStart * k,
    curveStart - curveStart * k, 0,
    curveStart, 0
  );

  ctx.closePath();
}

/**
 * Squircle枠線を描画
 */
export function drawSquircleOutline(
  ctx: CanvasRenderingContext2D,
  size: number,
  roundness: number = 0.8,
  strokeColor: string = "rgba(99, 102, 241, 0.5)",
  lineWidth: number = 2
): void {
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;
  createSquirclePath(ctx, size, roundness);
  ctx.stroke();
}

/**
 * Squircle外側を暗くする（クリッピングプレビュー用）
 */
export function drawSquircleOverlay(
  ctx: CanvasRenderingContext2D,
  size: number,
  roundness: number = 0.8,
  overlayColor: string = "rgba(0, 0, 0, 0.4)"
): void {
  ctx.save();

  ctx.fillStyle = overlayColor;
  ctx.fillRect(0, 0, size, size);

  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "#ffffff";
  createSquirclePath(ctx, size, roundness);
  ctx.fill();

  ctx.restore();
}
