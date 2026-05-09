"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { drawSquircleOverlay, drawSquircleOutline } from "@/lib/squircleMask";
import {
  WORKSPACE_SIZE,
  ICON_SIZE,
  ICON_PADDING,
  SQUIRCLE_SIZE,
  SQUIRCLE_OFFSET,
  ROUNDNESS,
} from "@/lib/constants";
import { Layer, Position } from "@/types/editor";


// 各レイヤーのキャンバスデータを保持
const layerCanvases = new Map<string, HTMLCanvasElement>();

export function EditorCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[]>([]);
  const [loadedImages, setLoadedImages] = useState<Map<string, HTMLImageElement>>(new Map());

  const {
    sourceImage,
    processedImageUrl,
    layers,
    activeLayerId,
    imagePosition,
    imageScale,
    activeTool,
    brushSize,
    overflowStrokes,
    showOriginal,
    clipRegion,
    roundness,
    setImagePosition,
    addOverflowStroke,
    updateLayerEraserMask,
    saveHistory,
  } = useEditorStore();

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

  // レイヤー用のオフスクリーンキャンバスを初期化
  useEffect(() => {
    for (const layer of layers) {
      if (!layerCanvases.has(layer.id)) {
        const canvas = document.createElement("canvas");
        canvas.width = WORKSPACE_SIZE;
        canvas.height = WORKSPACE_SIZE;
        layerCanvases.set(layer.id, canvas);
      }
    }

    // 不要なキャンバスを削除
    for (const id of layerCanvases.keys()) {
      if (!layers.find((l: Layer) => l.id === id)) {
        layerCanvases.delete(id);
      }
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

  // メインキャンバス描画
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

    // レイヤーシステムがある場合はレイヤーを描画
    if (layers.length > 0) {
      // 下から上の順で描画
      for (const layer of layers) {
        if (!layer.visible) continue;

        const img = loadedImages.get(layer.id);
        if (!img) continue;

        // オフスクリーンキャンバスに画像を描画
        const layerCanvas = layerCanvases.get(layer.id);
        if (!layerCanvas) continue;

        const layerCtx = layerCanvas.getContext("2d");
        if (!layerCtx) continue;

        layerCtx.clearRect(0, 0, WORKSPACE_SIZE, WORKSPACE_SIZE);
        layerCtx.drawImage(img, drawX, drawY, scaledWidth, scaledHeight);

        // 消しゴムマスクを適用（消された部分を透明に）
        if (layer.eraserMask) {
          // マスクを一時キャンバスに描画してからdrawImageで合成
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
    } else {
      // 旧方式（レイヤーなし）
      const imgSrc = showOriginal || !processedImageUrl ? sourceImage : null;
      const processedImg = !showOriginal && processedImageUrl ? processedImageUrl : null;

      if (imgSrc) {
        ctx.drawImage(imgSrc, drawX, drawY, scaledWidth, scaledHeight);
      } else if (processedImg) {
        const pImg = new Image();
        pImg.src = processedImg;
        if (pImg.complete) {
          ctx.drawImage(pImg, drawX, drawY, scaledWidth, scaledHeight);
        }
      }
    }
  }, [sourceImage, processedImageUrl, showOriginal, layers, loadedImages, getImageDrawParams]);

  // オーバーレイキャンバス描画（角丸マスク + ブラシ + 消しゴムプレビュー）
  const drawOverlay = useCallback(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, WORKSPACE_SIZE, WORKSPACE_SIZE);

    // オーバーフローストローク描画（緑色半透明）
    if (overflowStrokes.length > 0 || currentStroke.length > 0) {
      ctx.save();
      ctx.strokeStyle = "rgba(16, 185, 129, 0.5)";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = brushSize;

      const allStrokes = activeTool === "brush"
        ? [...overflowStrokes, currentStroke].filter((s: Position[]) => s.length > 0)
        : overflowStrokes.filter((s: Position[]) => s.length > 0);

      for (const stroke of allStrokes) {
        if (stroke.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        for (let i = 1; i < stroke.length; i++) {
          ctx.lineTo(stroke[i].x, stroke[i].y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    // 消しゴムの現在のストロークをプレビュー（赤色半透明）
    if (activeTool === "eraser" && currentStroke.length > 0) {
      ctx.save();
      ctx.strokeStyle = "rgba(239, 68, 68, 0.5)";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = brushSize;

      ctx.beginPath();
      ctx.moveTo(currentStroke[0].x, currentStroke[0].y);
      for (let i = 1; i < currentStroke.length; i++) {
        ctx.lineTo(currentStroke[i].x, currentStroke[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 復元ブラシの現在のストロークをプレビュー（青色半透明）
    if (activeTool === "restore" && currentStroke.length > 0) {
      ctx.save();
      ctx.strokeStyle = "rgba(59, 130, 246, 0.5)";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = brushSize;

      ctx.beginPath();
      ctx.moveTo(currentStroke[0].x, currentStroke[0].y);
      for (let i = 1; i < currentStroke.length; i++) {
        ctx.lineTo(currentStroke[i].x, currentStroke[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 最終アイコンの正方形キャンバス枠。枠外は書き出し時に切り落とされる。
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
    ctx.fillRect(0, 0, WORKSPACE_SIZE, WORKSPACE_SIZE);
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(clipRegion.x, clipRegion.y, clipRegion.size, clipRegion.size);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "rgba(96, 165, 250, 0.9)";
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 6]);
    ctx.strokeRect(clipRegion.x, clipRegion.y, clipRegion.size, clipRegion.size);
    ctx.restore();

    // squircle枠の位置（640pxキャンバス内の中央512px領域内）
    const squircleX = SQUIRCLE_OFFSET + ICON_PADDING;
    const squircleY = SQUIRCLE_OFFSET + ICON_PADDING;

    // 角丸外側のオーバーレイ（余白分オフセット）
    ctx.save();
    ctx.translate(squircleX, squircleY);
    drawSquircleOverlay(ctx, SQUIRCLE_SIZE, roundness, "rgba(0, 0, 0, 0.3)");
    ctx.restore();

    // 角丸枠線（余白分オフセット）
    ctx.save();
    ctx.translate(squircleX, squircleY);
    drawSquircleOutline(ctx, SQUIRCLE_SIZE, roundness, "rgba(99, 102, 241, 0.6)", 3);
    ctx.restore();

  }, [overflowStrokes, currentStroke, brushSize, activeTool, clipRegion, roundness]);

  useEffect(() => {
    drawMainCanvas();
  }, [drawMainCanvas]);

  useEffect(() => {
    drawOverlay();
  }, [drawOverlay]);

  // processedImageUrlが変わったら再描画
  useEffect(() => {
    if (processedImageUrl) {
      const img = new Image();
      img.onload = () => {
        drawMainCanvas();
      };
      img.src = processedImageUrl;
    }
  }, [processedImageUrl, drawMainCanvas]);

  // マウス/タッチイベント処理
  const getCanvasPoint = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = overlayRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = WORKSPACE_SIZE / rect.width;
    const scaleY = WORKSPACE_SIZE / rect.height;

    let clientX: number, clientY: number;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, []);

  // 消しゴムストロークを適用
  const applyEraserStroke = useCallback((stroke: { x: number; y: number }[]) => {
    if (!activeLayerId || stroke.length < 2) return;

    const layer = layers.find((l: Layer) => l.id === activeLayerId);
    if (!layer) return;

    // 既存のマスクを取得または新規作成
    let maskCanvas: HTMLCanvasElement;
    let maskCtx: CanvasRenderingContext2D;

    if (layer.eraserMask) {
      maskCanvas = document.createElement("canvas");
      maskCanvas.width = WORKSPACE_SIZE;
      maskCanvas.height = WORKSPACE_SIZE;
      maskCtx = maskCanvas.getContext("2d")!;
      maskCtx.putImageData(layer.eraserMask, 0, 0);
    } else {
      maskCanvas = document.createElement("canvas");
      maskCanvas.width = WORKSPACE_SIZE;
      maskCanvas.height = WORKSPACE_SIZE;
      maskCtx = maskCanvas.getContext("2d")!;
    }

    // ストロークを白で描画（白い部分が消される）
    maskCtx.strokeStyle = "white";
    maskCtx.lineCap = "round";
    maskCtx.lineJoin = "round";
    maskCtx.lineWidth = brushSize;

    maskCtx.beginPath();
    maskCtx.moveTo(stroke[0].x, stroke[0].y);
    for (let i = 1; i < stroke.length; i++) {
      maskCtx.lineTo(stroke[i].x, stroke[i].y);
    }
    maskCtx.stroke();

    // 新しいマスクを保存
    const newMask = maskCtx.getImageData(0, 0, WORKSPACE_SIZE, WORKSPACE_SIZE);
    updateLayerEraserMask(activeLayerId, newMask);
  }, [activeLayerId, layers, brushSize, updateLayerEraserMask]);

  // 復元ブラシストロークを適用（消しゴムの逆）
  const applyRestoreStroke = useCallback((stroke: { x: number; y: number }[]) => {
    if (!activeLayerId || stroke.length < 2) return;

    const layer = layers.find((l: Layer) => l.id === activeLayerId);
    if (!layer || !layer.eraserMask) return;

    // 既存のマスクをコピー
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = WORKSPACE_SIZE;
    maskCanvas.height = WORKSPACE_SIZE;
    const maskCtx = maskCanvas.getContext("2d")!;
    maskCtx.putImageData(layer.eraserMask, 0, 0);

    // ストロークを黒で描画（黒い部分は消しゴムが適用されない = 復元）
    // destination-outでマスクから削除
    maskCtx.globalCompositeOperation = "destination-out";
    maskCtx.strokeStyle = "white";
    maskCtx.lineCap = "round";
    maskCtx.lineJoin = "round";
    maskCtx.lineWidth = brushSize;

    maskCtx.beginPath();
    maskCtx.moveTo(stroke[0].x, stroke[0].y);
    for (let i = 1; i < stroke.length; i++) {
      maskCtx.lineTo(stroke[i].x, stroke[i].y);
    }
    maskCtx.stroke();

    // 新しいマスクを保存
    const newMask = maskCtx.getImageData(0, 0, WORKSPACE_SIZE, WORKSPACE_SIZE);
    updateLayerEraserMask(activeLayerId, newMask);
  }, [activeLayerId, layers, brushSize, updateLayerEraserMask]);

  const handlePointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const point = getCanvasPoint(e);
      if (!point) return;

      setIsDragging(true);

      if (activeTool === "move") {
        setDragStart({ x: point.x - imagePosition.x, y: point.y - imagePosition.y });
      } else if (activeTool === "brush" || activeTool === "eraser" || activeTool === "restore") {
        setCurrentStroke([point]);
      }
    },
    [activeTool, imagePosition, getCanvasPoint]
  );

  const handlePointerMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const point = getCanvasPoint(e);
      if (!point) return;

      if (!isDragging) return;

      if (activeTool === "move") {
        setImagePosition({
          x: point.x - dragStart.x,
          y: point.y - dragStart.y,
        });
      } else if (activeTool === "brush" || activeTool === "eraser" || activeTool === "restore") {
        setCurrentStroke((prev) => [...prev, point]);
      }
    },
    [isDragging, activeTool, dragStart, getCanvasPoint, setImagePosition]
  );

  const handlePointerUp = useCallback(() => {
    if (activeTool === "brush" && currentStroke.length > 0) {
      saveHistory(); // 履歴を保存
      addOverflowStroke(currentStroke);
    } else if (activeTool === "eraser" && currentStroke.length > 0) {
      saveHistory(); // 履歴を保存
      applyEraserStroke(currentStroke);
    } else if (activeTool === "restore" && currentStroke.length > 0) {
      saveHistory(); // 履歴を保存
      applyRestoreStroke(currentStroke);
    }
    setCurrentStroke([]);
    setIsDragging(false);
  }, [
    activeTool,
    currentStroke,
    addOverflowStroke,
    applyEraserStroke,
    applyRestoreStroke,
    saveHistory
  ]);

  // ホイールでズーム
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      useEditorStore.getState().setImageScale(imageScale + delta);
    },
    [imageScale]
  );

  // キーボードショートカット（Ctrl+Z / Ctrl+Y）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        useEditorStore.getState().undo();
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key === "y") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z")
      ) {
        e.preventDefault();
        useEditorStore.getState().redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // カーソルスタイルを決定
  const getCursorStyle = () => {
    if (activeTool === "move") return "grab";
    if (activeTool === "eraser") return "crosshair";
    if (activeTool === "restore") return "crosshair";
    return "crosshair";
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-[640px] aspect-square mx-auto neu-card-sm overflow-hidden"
      style={{ touchAction: "none" }}
    >
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
        className="absolute inset-0 w-full h-full"
        style={{ cursor: getCursorStyle() }}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
        onWheel={handleWheel}
      />

    </div>
  );
}
