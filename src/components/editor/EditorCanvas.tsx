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
import { pickColorFromImage } from "@/lib/colorRemoval";


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
  const [showPenActions, setShowPenActions] = useState(false);
  const [isPenDragging, setIsPenDragging] = useState(false);
  const [penDragStart, setPenDragStart] = useState<{ x: number; y: number } | null>(null);
  const [pendingPenPoint, setPendingPenPoint] = useState<{ x: number; y: number } | null>(null);

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
    penPoints,
    isPenPathClosed,
    isManualMode,
    setImagePosition,
    addOverflowStroke,
    updateLayerEraserMask,
    updateLayerImageUrl,
    saveHistory,
    setSelectedColor,
    setActiveTool,
    addPenPoint,
    updatePenPoint,
    closePenPath,
    clearPenPath,
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
  }, [sourceImage, processedImageUrl, imagePosition, imageScale, showOriginal, layers, loadedImages, getImageDrawParams]);

  // オーバーレイキャンバス描画（角丸マスク + ブラシ + 消しゴムプレビュー）
  const drawOverlay = useCallback(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, WORKSPACE_SIZE, WORKSPACE_SIZE);

    // カーソル追従用の一時ハンドルを描画するための状態を取得
    const currentMousePos = penDragStart;

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

    // squircle枠の位置（640pxキャンバス内の中央512px領域内）
    const squircleX = SQUIRCLE_OFFSET + ICON_PADDING;
    const squircleY = SQUIRCLE_OFFSET + ICON_PADDING;

    // 角丸外側のオーバーレイ（余白分オフセット）
    ctx.save();
    ctx.translate(squircleX, squircleY);
    drawSquircleOverlay(ctx, SQUIRCLE_SIZE, ROUNDNESS, "rgba(0, 0, 0, 0.3)");
    ctx.restore();

    // 角丸枠線（余白分オフセット）
    ctx.save();
    ctx.translate(squircleX, squircleY);
    drawSquircleOutline(ctx, SQUIRCLE_SIZE, ROUNDNESS, "rgba(99, 102, 241, 0.6)", 3);
    ctx.restore();

    // ペンツールのパス描画
    if (activeTool === "pen") {
      // 描画対象のポイント配列を作成（ドラッグ中の一時ポイントを含む）
      const drawPoints = [...penPoints];

      // ドラッグ中の一時ポイントを追加
      if (isPenDragging && pendingPenPoint && currentMousePos) {
        const dx = currentMousePos.x - pendingPenPoint.x;
        const dy = currentMousePos.y - pendingPenPoint.y;

        drawPoints.push({
          x: pendingPenPoint.x,
          y: pendingPenPoint.y,
          handleOut: { x: currentMousePos.x, y: currentMousePos.y },
          handleIn: { x: pendingPenPoint.x - dx, y: pendingPenPoint.y - dy }
        });
      }

      if (drawPoints.length > 0) {
        ctx.save();
        ctx.strokeStyle = isPenPathClosed ? "rgba(59, 130, 246, 0.8)" : "rgba(16, 185, 129, 0.8)";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // パスを描画（ベジェ曲線）
        ctx.beginPath();
        ctx.moveTo(drawPoints[0].x, drawPoints[0].y);

        for (let i = 1; i < drawPoints.length; i++) {
          const prev = drawPoints[i - 1];
          const curr = drawPoints[i];

          // ベジェ曲線で接続（ハンドルがある場合）
          if (prev.handleOut && curr.handleIn) {
            ctx.bezierCurveTo(
              prev.handleOut.x,
              prev.handleOut.y,
              curr.handleIn.x,
              curr.handleIn.y,
              curr.x,
              curr.y
            );
          } else if (prev.handleOut) {
            ctx.quadraticCurveTo(prev.handleOut.x, prev.handleOut.y, curr.x, curr.y);
          } else if (curr.handleIn) {
            ctx.quadraticCurveTo(curr.handleIn.x, curr.handleIn.y, curr.x, curr.y);
          } else {
            ctx.lineTo(curr.x, curr.y);
          }
        }

        // パスが閉じている場合は最初の点に戻る
        if (isPenPathClosed && drawPoints.length > 2) {
          const last = drawPoints[drawPoints.length - 1];
          const first = drawPoints[0];
          if (last.handleOut && first.handleIn) {
            ctx.bezierCurveTo(
              last.handleOut.x,
              last.handleOut.y,
              first.handleIn.x,
              first.handleIn.y,
              first.x,
              first.y
            );
          } else {
            ctx.lineTo(first.x, first.y);
          }
          ctx.closePath();

          // 閉じたパスは破線で表示
          ctx.setLineDash([5, 5]);
          ctx.fillStyle = "rgba(59, 130, 246, 0.1)";
          ctx.fill();
        }

        ctx.stroke();
        ctx.restore();

        // アンカーポイントを描画
        for (let i = 0; i < drawPoints.length; i++) {
          const point = drawPoints[i];
          const isTemporary = i === drawPoints.length - 1 && isPenDragging;

          // アンカーポイント
          ctx.save();
          ctx.fillStyle = isTemporary ? "rgba(16, 185, 129, 0.8)" : "rgba(59, 130, 246, 1)";
          ctx.strokeStyle = "white";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();

          // ハンドル描画
          if (point.handleIn) {
            ctx.save();
            ctx.strokeStyle = isTemporary ? "rgba(16, 185, 129, 0.5)" : "rgba(59, 130, 246, 0.6)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(point.x, point.y);
            ctx.lineTo(point.handleIn.x, point.handleIn.y);
            ctx.stroke();
            ctx.fillStyle = isTemporary ? "rgba(16, 185, 129, 0.8)" : "rgba(59, 130, 246, 0.8)";
            ctx.beginPath();
            ctx.arc(point.handleIn.x, point.handleIn.y, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          if (point.handleOut) {
            ctx.save();
            ctx.strokeStyle = isTemporary ? "rgba(16, 185, 129, 0.5)" : "rgba(59, 130, 246, 0.6)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(point.x, point.y);
            ctx.lineTo(point.handleOut.x, point.handleOut.y);
            ctx.stroke();
            ctx.fillStyle = isTemporary ? "rgba(16, 185, 129, 0.8)" : "rgba(59, 130, 246, 0.8)";
            ctx.beginPath();
            ctx.arc(point.handleOut.x, point.handleOut.y, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }

        // 最初の点をハイライト（閉じる候補として）
        if (penPoints.length > 2 && !isPenPathClosed && !isPenDragging) {
          const firstPoint = penPoints[0];
          ctx.save();
          ctx.strokeStyle = "rgba(16, 185, 129, 1)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(firstPoint.x, firstPoint.y, 8, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  }, [overflowStrokes, currentStroke, brushSize, activeTool, penPoints, isPenPathClosed, isPenDragging, pendingPenPoint, penDragStart]);

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

  // パスが閉じられたら選択UIを表示
  useEffect(() => {
    setShowPenActions(isPenPathClosed);
  }, [isPenPathClosed]);

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

  // スポイトで色を取得
  const handleEyedropper = useCallback((point: { x: number; y: number }) => {
    if (!sourceImage) return;

    const color = pickColorFromImage(
      sourceImage,
      point.x,
      point.y,
      imagePosition,
      imageScale,
      WORKSPACE_SIZE
    );

    if (color) {
      setSelectedColor(color);
      // スポイト使用後は移動ツールに戻す
      setActiveTool("move");
    }
  }, [sourceImage, imagePosition, imageScale, setSelectedColor, setActiveTool]);

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

  // ペンツールのパスを適用（画像を直接編集）
  const applyPenPathMask = useCallback((deleteOutside: boolean) => {
    if (!activeLayerId || penPoints.length < 3) return;

    const layer = layers.find((l: Layer) => l.id === activeLayerId);
    if (!layer) return;

    const img = loadedImages.get(layer.id);
    if (!img || !sourceImage) return;

    saveHistory(); // 履歴を保存

    // 画像の描画パラメータを取得
    const imgWidth = sourceImage.width;
    const imgHeight = sourceImage.height;
    const fitScale = Math.min(ICON_SIZE / imgWidth, ICON_SIZE / imgHeight);
    const scaledWidth = imgWidth * fitScale * imageScale;
    const scaledHeight = imgHeight * fitScale * imageScale;
    const drawX = (WORKSPACE_SIZE - scaledWidth) / 2 + imagePosition.x;
    const drawY = (WORKSPACE_SIZE - scaledHeight) / 2 + imagePosition.y;

    // キャンバス座標から画像ローカル座標への変換関数
    const canvasToImageLocal = (canvasX: number, canvasY: number) => {
      // キャンバス座標から画像上の相対位置を計算
      const localX = (canvasX - drawX) / scaledWidth;
      const localY = (canvasY - drawY) / scaledHeight;

      // 画像サイズに変換
      return {
        x: localX * img.width,
        y: localY * img.height
      };
    };

    // 新しい画像キャンバスを作成（元の画像サイズ）
    const newImageCanvas = document.createElement("canvas");
    newImageCanvas.width = img.width;
    newImageCanvas.height = img.height;
    const newImageCtx = newImageCanvas.getContext("2d")!;

    // 元の画像を描画
    newImageCtx.drawImage(img, 0, 0);

    // パスを画像ローカル座標に変換して描画する関数
    const drawPath = (ctx: CanvasRenderingContext2D) => {
      ctx.beginPath();

      const firstLocal = canvasToImageLocal(penPoints[0].x, penPoints[0].y);
      ctx.moveTo(firstLocal.x, firstLocal.y);

      for (let i = 1; i < penPoints.length; i++) {
        const prev = penPoints[i - 1];
        const curr = penPoints[i];
        const currLocal = canvasToImageLocal(curr.x, curr.y);

        if (prev.handleOut && curr.handleIn) {
          const handleOutLocal = canvasToImageLocal(prev.handleOut.x, prev.handleOut.y);
          const handleInLocal = canvasToImageLocal(curr.handleIn.x, curr.handleIn.y);
          ctx.bezierCurveTo(
            handleOutLocal.x, handleOutLocal.y,
            handleInLocal.x, handleInLocal.y,
            currLocal.x, currLocal.y
          );
        } else if (prev.handleOut) {
          const handleOutLocal = canvasToImageLocal(prev.handleOut.x, prev.handleOut.y);
          ctx.quadraticCurveTo(handleOutLocal.x, handleOutLocal.y, currLocal.x, currLocal.y);
        } else if (curr.handleIn) {
          const handleInLocal = canvasToImageLocal(curr.handleIn.x, curr.handleIn.y);
          ctx.quadraticCurveTo(handleInLocal.x, handleInLocal.y, currLocal.x, currLocal.y);
        } else {
          ctx.lineTo(currLocal.x, currLocal.y);
        }
      }

      // パスを閉じる
      const last = penPoints[penPoints.length - 1];
      const first = penPoints[0];
      const firstLocal2 = canvasToImageLocal(first.x, first.y);

      if (last.handleOut && first.handleIn) {
        const handleOutLocal = canvasToImageLocal(last.handleOut.x, last.handleOut.y);
        const handleInLocal = canvasToImageLocal(first.handleIn.x, first.handleIn.y);
        ctx.bezierCurveTo(
          handleOutLocal.x, handleOutLocal.y,
          handleInLocal.x, handleInLocal.y,
          firstLocal2.x, firstLocal2.y
        );
      } else {
        ctx.lineTo(firstLocal2.x, firstLocal2.y);
      }
      ctx.closePath();
    };

    // パスを使って切り抜き
    drawPath(newImageCtx);

    if (deleteOutside) {
      // 範囲外を削除: destination-in でパス内のみ残す
      newImageCtx.globalCompositeOperation = "destination-in";
    } else {
      // 範囲内を削除: destination-out でパス内を削除
      newImageCtx.globalCompositeOperation = "destination-out";
    }

    newImageCtx.fill();

    // 新しい画像をData URLとして取得
    const newDataUrl = newImageCanvas.toDataURL("image/png");

    // レイヤーの画像を更新
    updateLayerImageUrl(activeLayerId, newDataUrl);

    // eraserMaskをクリア（もう使わない）
    const emptyMask = newImageCtx.createImageData(WORKSPACE_SIZE, WORKSPACE_SIZE);
    updateLayerEraserMask(activeLayerId, emptyMask);

    // パスをクリア
    clearPenPath();
    setShowPenActions(false);
  }, [activeLayerId, layers, penPoints, updateLayerImageUrl, updateLayerEraserMask, clearPenPath, saveHistory, loadedImages, sourceImage, imagePosition, imageScale]);

  const handlePointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const point = getCanvasPoint(e);
      if (!point) return;

      // スポイトツールはクリックで即座に色を取得
      if (activeTool === "eyedropper") {
        handleEyedropper(point);
        return;
      }

      // ペンツールの処理
      if (activeTool === "pen") {
        // 最初の点をクリック/ドラッグしたらパスを閉じる
        if (penPoints.length > 2) {
          const firstPoint = penPoints[0];
          const distance = Math.sqrt(
            Math.pow(point.x - firstPoint.x, 2) + Math.pow(point.y - firstPoint.y, 2)
          );
          if (distance < 10) {
            // ドラッグの準備（最初の点にハンドルを設定するため）
            setIsPenDragging(true);
            setPenDragStart(point);
            setPendingPenPoint({ x: firstPoint.x, y: firstPoint.y });
            return;
          }
        }

        // ドラッグの準備（新しい点を追加する準備）
        setIsPenDragging(true);
        setPenDragStart(point);
        setPendingPenPoint({ x: point.x, y: point.y });
        return;
      }

      setIsDragging(true);

      if (activeTool === "move") {
        setDragStart({ x: point.x - imagePosition.x, y: point.y - imagePosition.y });
      } else if (activeTool === "brush" || activeTool === "eraser" || activeTool === "restore") {
        setCurrentStroke([point]);
      }
    },
    [activeTool, imagePosition, getCanvasPoint, handleEyedropper, penPoints, addPenPoint, closePenPath]
  );

  const handlePointerMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const point = getCanvasPoint(e);
      if (!point) return;

      // ペンツールのドラッグ処理
      if (activeTool === "pen" && isPenDragging) {
        setPenDragStart(point);
        return;
      }

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
    [isDragging, activeTool, dragStart, getCanvasPoint, setImagePosition, isPenDragging]
  );

  const handlePointerUp = useCallback(() => {
    // ペンツールのドラッグ終了処理
    if (activeTool === "pen" && isPenDragging && pendingPenPoint) {
      // 最初の点をクリックしてパスを閉じる場合
      if (penPoints.length > 2) {
        const firstPoint = penPoints[0];
        const distance = Math.sqrt(
          Math.pow(pendingPenPoint.x - firstPoint.x, 2) +
          Math.pow(pendingPenPoint.y - firstPoint.y, 2)
        );
        if (distance < 10) {
          // ドラッグしていた場合は最後の点にハンドルを設定
          if (penDragStart) {
            const dx = penDragStart.x - pendingPenPoint.x;
            const dy = penDragStart.y - pendingPenPoint.y;
            const moved = Math.sqrt(dx * dx + dy * dy) > 2;

            if (moved && penPoints.length > 0) {
              // 最後の点にハンドルを追加
              const lastPoint = penPoints[penPoints.length - 1];
              updatePenPoint(penPoints.length - 1, {
                ...lastPoint,
                handleOut: { x: penDragStart.x, y: penDragStart.y }
              });

              // 最初の点にもハンドルを追加（対称）
              updatePenPoint(0, {
                ...firstPoint,
                handleIn: { x: firstPoint.x - dx, y: firstPoint.y - dy }
              });
            }
          }

          closePenPath();
          setIsPenDragging(false);
          setPenDragStart(null);
          setPendingPenPoint(null);
          return;
        }
      }

      // 新しい点を追加（ドラッグしていた場合はハンドル付き）
      if (penDragStart) {
        const dx = penDragStart.x - pendingPenPoint.x;
        const dy = penDragStart.y - pendingPenPoint.y;
        const moved = Math.sqrt(dx * dx + dy * dy) > 2;

        if (moved) {
          // ハンドル付きの点を追加
          addPenPoint({
            x: pendingPenPoint.x,
            y: pendingPenPoint.y,
            handleOut: { x: penDragStart.x, y: penDragStart.y },
            handleIn: { x: pendingPenPoint.x - dx, y: pendingPenPoint.y - dy }
          });
        } else {
          // 直線の点を追加
          addPenPoint({ x: pendingPenPoint.x, y: pendingPenPoint.y });
        }
      }

      setIsPenDragging(false);
      setPenDragStart(null);
      setPendingPenPoint(null);
      return;
    }

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
    saveHistory,
    isPenDragging,
    pendingPenPoint,
    penDragStart,
    penPoints,
    addPenPoint,
    updatePenPoint,
    closePenPath
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
    if (activeTool === "eyedropper") return "crosshair";
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

      {/* ペンツールのアクションボタン */}
      {showPenActions && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 p-3 bg-white rounded-lg shadow-lg border border-[var(--neu-border)]">
          <button
            className="neu-button neu-button-sm neu-button-primary"
            onClick={() => applyPenPathMask(true)}
          >
            範囲外を削除
          </button>
          <button
            className="neu-button neu-button-sm neu-button-primary"
            onClick={() => applyPenPathMask(false)}
          >
            範囲内を削除
          </button>
          <button
            className="neu-button neu-button-sm"
            onClick={() => {
              clearPenPath();
              setShowPenActions(false);
            }}
          >
            キャンセル
          </button>
        </div>
      )}
    </div>
  );
}
