"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  DownloadSimple,
  FileImage,
  AppWindow,
  Spinner,
  CheckCircle,
} from "@phosphor-icons/react";
import { useEditorStore } from "@/stores/editorStore";
import { createFinalCanvas } from "@/lib/canvasCompositor";
import { generateIco, downloadBlob, downloadCanvasAsPng } from "@/lib/icoGenerator";
import { drawSquircleOutline } from "@/lib/squircleMask";
import { getClipMargins, updateClipMargin, ClipMarginEdge } from "@/lib/clipRegion";
import {
  WORKSPACE_SIZE,
  ICON_SIZE,
  ICON_PADDING,
  SQUIRCLE_SIZE,
  SQUIRCLE_OFFSET,
  CLIP_MIN_SIZE,
  CLIP_MAX_SIZE,
} from "@/lib/constants";

// リサイズハンドルの検出範囲
const RESIZE_HANDLE_SIZE = 20;

type ResizeHandle = "nw" | "ne" | "sw" | "se" | null;

export function ExportModal() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const finalPreviewRef = useRef<HTMLCanvasElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, size: 0, clipX: 0, clipY: 0 });
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [loadedImages, setLoadedImages] = useState<Map<string, HTMLImageElement>>(new Map());

  const {
    sourceImage,
    processedImageUrl,
    imagePosition,
    imageScale,
    overflowStrokes,
    brushSize,
    showOriginal,
    layers,
    isManualMode,
    clipRegion,
    isExportModalOpen,
    roundness,
    setClipRegion,
    setExportModalOpen,
  } = useEditorStore();
  const clipMargins = getClipMargins(clipRegion);
  const marginFields: { edge: ClipMarginEdge; label: string }[] = [
    { edge: "top", label: "上" },
    { edge: "right", label: "右" },
    { edge: "bottom", label: "下" },
    { edge: "left", label: "左" },
  ];

  // レイヤー画像を読み込む
  useEffect(() => {
    const loadImages = async () => {
      const newLoadedImages = new Map<string, HTMLImageElement>();

      for (const layer of layers) {
        if (layer.imageUrl) {
          const img = new Image();
          await new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = layer.imageUrl!;
          });
          newLoadedImages.set(layer.id, img);
        }
      }

      setLoadedImages(newLoadedImages);
    };

    if (layers.length > 0) {
      loadImages();
    }
  }, [layers]);

  // 画像描画位置を計算
  const getImageDrawParams = useCallback(() => {
    if (!sourceImage) return null;

    const imgWidth = sourceImage.width;
    const imgHeight = sourceImage.height;
    const fitScale = Math.min(ICON_SIZE / imgWidth, ICON_SIZE / imgHeight);
    const scaledWidth = imgWidth * fitScale * imageScale;
    const scaledHeight = imgHeight * fitScale * imageScale;
    const drawX = (WORKSPACE_SIZE - scaledWidth) / 2 + imagePosition.x;
    const drawY = (WORKSPACE_SIZE - scaledHeight) / 2 + imagePosition.y;

    return { drawX, drawY, scaledWidth, scaledHeight };
  }, [sourceImage, imagePosition, imageScale]);

  // プレビューキャンバス描画（EditorCanvasと同様のロジック）
  const drawMainCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, WORKSPACE_SIZE, WORKSPACE_SIZE);

    // チェッカーボード背景
    const checkerSize = 16;
    for (let y = 0; y < WORKSPACE_SIZE; y += checkerSize) {
      for (let x = 0; x < WORKSPACE_SIZE; x += checkerSize) {
        const isLight = ((x / checkerSize) + (y / checkerSize)) % 2 === 0;
        ctx.fillStyle = isLight ? "#ffffff" : "#e0e0e0";
        ctx.fillRect(x, y, checkerSize, checkerSize);
      }
    }

    const drawParams = getImageDrawParams();
    if (!drawParams) return;

    const { drawX, drawY, scaledWidth, scaledHeight } = drawParams;

    // レイヤーシステムで描画
    if (layers.length > 0) {
      for (const layer of layers) {
        if (!layer.visible) continue;

        const img = loadedImages.get(layer.id);
        if (!img) continue;

        // オフスクリーンキャンバスに画像を描画
        const layerCanvas = document.createElement("canvas");
        layerCanvas.width = WORKSPACE_SIZE;
        layerCanvas.height = WORKSPACE_SIZE;
        const layerCtx = layerCanvas.getContext("2d");
        if (!layerCtx) continue;

        layerCtx.drawImage(img, drawX, drawY, scaledWidth, scaledHeight);

        // 消しゴムマスクを適用
        if (layer.eraserMask) {
          const maskCanvas = document.createElement("canvas");
          maskCanvas.width = WORKSPACE_SIZE;
          maskCanvas.height = WORKSPACE_SIZE;
          const maskCtx = maskCanvas.getContext("2d")!;
          maskCtx.putImageData(layer.eraserMask, 0, 0);

          layerCtx.globalCompositeOperation = "destination-out";
          layerCtx.drawImage(maskCanvas, 0, 0);
          layerCtx.globalCompositeOperation = "source-over";
        }

        // メインキャンバスに合成
        ctx.drawImage(layerCanvas, 0, 0);
      }
    } else if (sourceImage) {
      // 旧方式
      ctx.drawImage(sourceImage, drawX, drawY, scaledWidth, scaledHeight);
    }
  }, [sourceImage, layers, loadedImages, getImageDrawParams]);

  // オーバーレイキャンバス描画（クリップ枠とsquircle枠線）
  const drawOverlay = useCallback(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, WORKSPACE_SIZE, WORKSPACE_SIZE);

    // クリップ領域外を暗くする
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, WORKSPACE_SIZE, WORKSPACE_SIZE);

    // クリップ領域を透明に（切り抜く）
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(clipRegion.x, clipRegion.y, clipRegion.size, clipRegion.size);
    ctx.globalCompositeOperation = "source-over";

    // クリップ枠線（明るい青）
    ctx.strokeStyle = "rgba(96, 165, 250, 0.8)";
    ctx.lineWidth = 2;
    ctx.strokeRect(clipRegion.x, clipRegion.y, clipRegion.size, clipRegion.size);

    // 四隅にリサイズハンドル
    const handleSize = 8;
    const handles = [
      { x: clipRegion.x, y: clipRegion.y }, // nw
      { x: clipRegion.x + clipRegion.size, y: clipRegion.y }, // ne
      { x: clipRegion.x, y: clipRegion.y + clipRegion.size }, // sw
      { x: clipRegion.x + clipRegion.size, y: clipRegion.y + clipRegion.size }, // se
    ];

    ctx.fillStyle = "rgba(96, 165, 250, 1)";
    for (const handle of handles) {
      ctx.fillRect(
        handle.x - handleSize / 2,
        handle.y - handleSize / 2,
        handleSize,
        handleSize
      );
    }

    // squircle枠線（参考用）
    const squircleX = SQUIRCLE_OFFSET + ICON_PADDING;
    const squircleY = SQUIRCLE_OFFSET + ICON_PADDING;

    ctx.save();
    ctx.translate(squircleX, squircleY);
    drawSquircleOutline(ctx, SQUIRCLE_SIZE, roundness, "rgba(139, 92, 246, 0.4)", 2);
    ctx.restore();
  }, [clipRegion, roundness]);

  useEffect(() => {
    drawMainCanvas();
  }, [drawMainCanvas]);

  useEffect(() => {
    drawOverlay();
  }, [drawOverlay]);

  useEffect(() => {
    const canvas = finalPreviewRef.current;
    if (!canvas || !sourceImage || !isExportModalOpen) return;

    let cancelled = false;

    const drawFinalPreview = async () => {
      const finalCanvas = await createFinalCanvas({
        sourceImage,
        processedImageUrl,
        imagePosition,
        imageScale,
        overflowStrokes,
        brushSize,
        showOriginal,
        layers,
        isManualMode,
        clipRegion,
        roundness,
      });

      if (cancelled) return;

      canvas.width = finalCanvas.width;
      canvas.height = finalCanvas.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(finalCanvas, 0, 0);
    };

    drawFinalPreview().catch((error) => {
      console.error("Preview error:", error);
    });

    return () => {
      cancelled = true;
    };
  }, [
    sourceImage,
    processedImageUrl,
    imagePosition,
    imageScale,
    overflowStrokes,
    brushSize,
    showOriginal,
    layers,
    isManualMode,
    clipRegion,
    roundness,
    isExportModalOpen,
  ]);

  // カーソル位置からリサイズハンドルを検出
  const detectResizeHandle = useCallback(
    (x: number, y: number): ResizeHandle => {
      const corners = [
        { handle: "nw" as const, x: clipRegion.x, y: clipRegion.y },
        { handle: "ne" as const, x: clipRegion.x + clipRegion.size, y: clipRegion.y },
        { handle: "sw" as const, x: clipRegion.x, y: clipRegion.y + clipRegion.size },
        { handle: "se" as const, x: clipRegion.x + clipRegion.size, y: clipRegion.y + clipRegion.size },
      ];

      for (const corner of corners) {
        const dx = x - corner.x;
        const dy = y - corner.y;
        if (Math.abs(dx) <= RESIZE_HANDLE_SIZE && Math.abs(dy) <= RESIZE_HANDLE_SIZE) {
          return corner.handle;
        }
      }

      return null;
    },
    [clipRegion]
  );

  // マウス座標をキャンバス座標に変換
  const getCanvasPoint = useCallback((e: React.MouseEvent) => {
    const canvas = overlayRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = WORKSPACE_SIZE / rect.width;
    const scaleY = WORKSPACE_SIZE / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  // マウスダウン（ドラッグ or リサイズ開始）
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const point = getCanvasPoint(e);
      if (!point) return;

      const handle = detectResizeHandle(point.x, point.y);

      if (handle) {
        // リサイズ開始
        setIsResizing(true);
        setResizeHandle(handle);
        setResizeStart({
          x: point.x,
          y: point.y,
          size: clipRegion.size,
          clipX: clipRegion.x,
          clipY: clipRegion.y,
        });
      } else if (
        point.x >= clipRegion.x &&
        point.x <= clipRegion.x + clipRegion.size &&
        point.y >= clipRegion.y &&
        point.y <= clipRegion.y + clipRegion.size
      ) {
        // ドラッグ開始（クリップ領域内をクリック）
        setIsDragging(true);
        setDragStart({
          x: point.x - clipRegion.x,
          y: point.y - clipRegion.y,
        });
      }
    },
    [clipRegion, getCanvasPoint, detectResizeHandle]
  );

  // マウス移動
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const point = getCanvasPoint(e);
      if (!point) return;

      if (isResizing && resizeHandle) {
        // リサイズ処理（1:1正方形維持）
        const dx = point.x - resizeStart.x;
        const dy = point.y - resizeStart.y;

        // ハンドルに応じた変化量を計算
        let newSize = resizeStart.size;
        let newX = resizeStart.clipX;
        let newY = resizeStart.clipY;

        if (resizeHandle === "se") {
          // 右下: サイズを増やす（中心は左上固定）
          const delta = Math.max(dx, dy);
          newSize = resizeStart.size + delta;
        } else if (resizeHandle === "nw") {
          // 左上: サイズを減らす（中心は右下固定）
          const delta = Math.min(dx, dy);
          newSize = resizeStart.size - delta;
          newX = resizeStart.clipX + delta;
          newY = resizeStart.clipY + delta;
        } else if (resizeHandle === "ne") {
          // 右上
          const deltaX = dx;
          const deltaY = -dy;
          const delta = Math.max(deltaX, deltaY);
          newSize = resizeStart.size + delta;
          newY = resizeStart.clipY - delta;
        } else if (resizeHandle === "sw") {
          // 左下
          const deltaX = -dx;
          const deltaY = dy;
          const delta = Math.max(deltaX, deltaY);
          newSize = resizeStart.size + delta;
          newX = resizeStart.clipX - delta;
        }

        // サイズ制限
        newSize = Math.max(CLIP_MIN_SIZE, Math.min(CLIP_MAX_SIZE, newSize));

        // ワークスペース内に収める
        newX = Math.max(0, Math.min(WORKSPACE_SIZE - newSize, newX));
        newY = Math.max(0, Math.min(WORKSPACE_SIZE - newSize, newY));

        setClipRegion({ x: newX, y: newY, size: newSize });
      } else if (isDragging) {
        // ドラッグ移動
        let newX = point.x - dragStart.x;
        let newY = point.y - dragStart.y;

        // ワークスペース内に制限
        newX = Math.max(0, Math.min(WORKSPACE_SIZE - clipRegion.size, newX));
        newY = Math.max(0, Math.min(WORKSPACE_SIZE - clipRegion.size, newY));

        setClipRegion({ ...clipRegion, x: newX, y: newY });
      } else {
        // カーソル形状を変更（リサイズハンドル上かチェック）
        const handle = detectResizeHandle(point.x, point.y);
        if (handle) {
          if (handle === "nw" || handle === "se") {
            document.body.style.cursor = "nwse-resize";
          } else {
            document.body.style.cursor = "nesw-resize";
          }
        } else if (
          point.x >= clipRegion.x &&
          point.x <= clipRegion.x + clipRegion.size &&
          point.y >= clipRegion.y &&
          point.y <= clipRegion.y + clipRegion.size
        ) {
          document.body.style.cursor = "move";
        } else {
          document.body.style.cursor = "default";
        }
      }
    },
    [
      isResizing,
      isDragging,
      resizeHandle,
      resizeStart,
      dragStart,
      clipRegion,
      getCanvasPoint,
      detectResizeHandle,
      setClipRegion,
    ]
  );

  // マウスアップ
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
    document.body.style.cursor = "default";
  }, []);

  // サイズスライダー変更（中央を維持）
  const handleSizeChange = useCallback(
    (newSize: number) => {
      const centerX = clipRegion.x + clipRegion.size / 2;
      const centerY = clipRegion.y + clipRegion.size / 2;

      let newX = centerX - newSize / 2;
      let newY = centerY - newSize / 2;

      // ワークスペース内に制限
      newX = Math.max(0, Math.min(WORKSPACE_SIZE - newSize, newX));
      newY = Math.max(0, Math.min(WORKSPACE_SIZE - newSize, newY));

      setClipRegion({ x: newX, y: newY, size: newSize });
    },
    [clipRegion, setClipRegion]
  );

  const handleMarginChange = useCallback(
    (edge: ClipMarginEdge, value: number) => {
      setClipRegion(updateClipMargin(clipRegion, edge, value));
    },
    [clipRegion, setClipRegion]
  );

  // エクスポート処理
  const handleExport = useCallback(
    async (format: "png" | "ico") => {
      if (!sourceImage) return;

      setIsExporting(true);
      setExportSuccess(null);

      try {
        const finalCanvas = await createFinalCanvas({
          sourceImage,
          processedImageUrl,
          imagePosition,
          imageScale,
          overflowStrokes,
          brushSize,
          showOriginal,
          layers,
          isManualMode,
          clipRegion,
          roundness,
        });

        const timestamp = Date.now();

        if (format === "png") {
          downloadCanvasAsPng(finalCanvas, `icon_${timestamp}.png`);
          setExportSuccess("PNG");
        } else {
          const icoBlob = await generateIco(finalCanvas, [16, 32, 48, 256]);
          downloadBlob(icoBlob, `icon_${timestamp}.ico`);
          setExportSuccess("ICO");
        }

        setTimeout(() => setExportSuccess(null), 2000);
      } catch (error) {
        console.error("Export error:", error);
      } finally {
        setIsExporting(false);
      }
    },
    [
      sourceImage,
      processedImageUrl,
      imagePosition,
      imageScale,
      overflowStrokes,
      brushSize,
      showOriginal,
      layers,
      isManualMode,
      clipRegion,
      roundness,
    ]
  );

  // 両方エクスポート
  const handleExportBoth = useCallback(async () => {
    await handleExport("png");
    await new Promise((resolve) => setTimeout(resolve, 500)); // 少し待つ
    await handleExport("ico");
  }, [handleExport]);

  // モーダルが開いていない場合は何も表示しない
  if (!isExportModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--neu-bg)] rounded-2xl shadow-xl max-w-5xl w-full mx-4 neu-card">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--neu-shadow-light)]">
          <h2 className="text-lg font-medium text-[var(--neu-text-primary)]">エクスポート</h2>
          <button
            onClick={() => setExportModalOpen(false)}
            className="neu-button neu-button-sm"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          {/* プレビューキャンバス */}
          <div>
            <div className="relative mx-auto" style={{ width: 400, height: 400 }}>
              <canvas
                ref={canvasRef}
                width={WORKSPACE_SIZE}
                height={WORKSPACE_SIZE}
                className="absolute inset-0 w-full h-full"
              />
              <canvas
                ref={overlayRef}
                width={WORKSPACE_SIZE}
                height={WORKSPACE_SIZE}
                className="absolute inset-0 w-full h-full cursor-move"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              />
            </div>
            <p className="text-xs text-center text-[var(--neu-text-muted)] mt-2">
              ドラッグで移動、四隅でリサイズ（1:1維持）
            </p>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-[var(--neu-text-primary)]">
              実際の出力プレビュー
            </p>
            <div className="checker-bg flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border border-[var(--neu-border)]">
              <canvas
                ref={finalPreviewRef}
                width={clipRegion.size}
                height={clipRegion.size}
                className="h-full w-full object-contain"
              />
            </div>
            <p className="mt-2 text-center text-xs text-[var(--neu-text-muted)]">
              {clipRegion.size} x {clipRegion.size}px
            </p>
          </div>
        </div>

        {/* サイズコントロール */}
        <div className="px-4 pb-4">
          <label className="text-sm text-[var(--neu-text-secondary)]">
            サイズ: {clipRegion.size}px
          </label>
          <input
            type="range"
            min={CLIP_MIN_SIZE}
            max={CLIP_MAX_SIZE}
            value={clipRegion.size}
            onChange={(e) => handleSizeChange(Number(e.target.value))}
            className="w-full mt-1"
          />
          <div className="flex gap-2 mt-2">
            {[256, 384, 512, 640].map((size) => (
              <button
                key={size}
                onClick={() => handleSizeChange(size)}
                className={`neu-button neu-button-sm flex-1 ${
                  clipRegion.size === size ? "neu-button-primary" : ""
                }`}
              >
                {size}
              </button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {marginFields.map(({ edge, label }) => (
              <label key={edge} className="space-y-1">
                <span className="text-xs text-[var(--neu-text-muted)]">{label}余白</span>
                <input
                  type="number"
                  min="-120"
                  max="320"
                  step="1"
                  value={clipMargins[edge]}
                  onChange={(e) => handleMarginChange(edge, Number(e.target.value))}
                  className="neu-input !py-2 !px-2 text-sm"
                />
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[var(--neu-text-muted)]">
            角丸枠から最終出力枠までの距離です。正方形を維持するため、反対軸の余白は自動調整されます。
          </p>
        </div>

        {/* エクスポートボタン */}
        <div className="p-4 border-t border-[var(--neu-shadow-light)]">
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleExport("png")}
              disabled={isExporting}
              className="neu-button neu-button-sm flex items-center justify-center gap-2"
            >
              {isExporting && exportSuccess === null ? (
                <Spinner className="animate-spin" size={16} />
              ) : exportSuccess === "PNG" ? (
                <CheckCircle className="text-green-500" size={16} />
              ) : (
                <FileImage size={16} />
              )}
              PNG
            </button>
            <button
              onClick={() => handleExport("ico")}
              disabled={isExporting}
              className="neu-button neu-button-sm flex items-center justify-center gap-2"
            >
              {isExporting && exportSuccess === null ? (
                <Spinner className="animate-spin" size={16} />
              ) : exportSuccess === "ICO" ? (
                <CheckCircle className="text-green-500" size={16} />
              ) : (
                <AppWindow size={16} />
              )}
              ICO
            </button>
            <button
              onClick={handleExportBoth}
              disabled={isExporting}
              className="neu-button neu-button-primary flex items-center justify-center gap-2"
            >
              <DownloadSimple size={16} />
              両方
            </button>
          </div>
          <p className="text-xs text-center text-[var(--neu-text-muted)] mt-2">
            出力サイズ: {clipRegion.size} x {clipRegion.size}px
          </p>
        </div>
      </div>
    </div>
  );
}
