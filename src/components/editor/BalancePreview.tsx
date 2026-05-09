"use client";

import { useRef, useEffect, useState } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { createFinalCanvas } from "@/lib/canvasCompositor";

export function BalancePreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRendering, setIsRendering] = useState(false);

  const {
    sourceImage,
    processedImageUrl,
    imagePosition,
    imageScale,
    overflowStrokes,
    brushSize,
    showOriginal,
    layers,
    roundness,
  } = useEditorStore();

  useEffect(() => {
    if (!sourceImage || layers.length === 0) return;

    let cancelled = false;
    setIsRendering(true);

    const renderPreview = async () => {
      try {
        // clipRegion なし = ワークスペース全体（枠+飛び出しを含む）を表示
        const finalCanvas = await createFinalCanvas({
          sourceImage,
          processedImageUrl,
          imagePosition,
          imageScale,
          overflowStrokes,
          brushSize,
          showOriginal,
          layers,
          roundness,
        });

        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const SIZE = canvas.width;

        // チェッカーボード背景（透過確認用）
        const checkerSize = 10;
        for (let y = 0; y < SIZE; y += checkerSize) {
          for (let x = 0; x < SIZE; x += checkerSize) {
            const isLight = ((x / checkerSize) + (y / checkerSize)) % 2 === 0;
            ctx.fillStyle = isLight ? "#f8fafc" : "#dde3ea";
            ctx.fillRect(x, y, checkerSize, checkerSize);
          }
        }

        // 合成結果を描画（スケールダウン）
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(finalCanvas, 0, 0, SIZE, SIZE);
      } catch (err) {
        console.error("BalancePreview render error:", err);
      } finally {
        if (!cancelled) setIsRendering(false);
      }
    };

    renderPreview();
    return () => {
      cancelled = true;
    };
  }, [sourceImage, processedImageUrl, imagePosition, imageScale, overflowStrokes, brushSize, showOriginal, layers, roundness]);

  if (!sourceImage || layers.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 p-4 neu-card-sm">
      <div>
        <p className="eyebrow">BALANCE</p>
        <h3 className="text-base font-semibold text-[var(--neu-text-primary)]">
          全体バランス
        </h3>
      </div>

      <div className="relative mx-auto rounded-lg overflow-hidden" style={{ width: 220, height: 220 }}>
        {isRendering && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--neu-surface-subtle)]">
            <div className="w-5 h-5 border-2 border-[var(--neu-accent)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={220}
          height={220}
          className="block"
          style={{ opacity: isRendering ? 0 : 1, transition: "opacity 0.2s" }}
        />
      </div>

      <p className="text-xs text-[var(--neu-text-muted)] text-center">
        枠内＋飛び出し部分の全体イメージ
      </p>
    </div>
  );
}
