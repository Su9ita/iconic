"use client";

import { useState, useCallback } from "react";
import { Robot, Cloud, X, Spinner, WarningCircle, Eyedropper, Hand } from "@phosphor-icons/react";
import { useEditorStore } from "@/stores/editorStore";
import {
  removeBackgroundAI,
  removeBackgroundAPI,
  blobToObjectUrl,
} from "@/lib/backgroundRemoval";
import { removeColorFromImageAsync, rgbToHex } from "@/lib/colorRemoval";

export function BackgroundRemovalPanel() {
  const [error, setError] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");

  const {
    sourceImage,
    bgRemovalMethod,
    removeBgApiKey,
    isProcessing,
    processingProgress,
    processingMessage,
    selectedColor,
    colorTolerance,
    setBgRemovalMethod,
    setRemoveBgApiKey,
    setIsProcessing,
    setProcessingProgress,
    setProcessedImageUrl,
    initializeLayers,
    setColorTolerance,
    setActiveTool,
    setIsManualMode,
  } = useEditorStore();

  const handleRemoveBackground = useCallback(async () => {
    if (!sourceImage) return;

    setError(null);
    setIsProcessing(true);

    try {
      let blob: Blob;
      let isManual = false;

      if (bgRemovalMethod === "ai") {
        blob = await removeBackgroundAI(sourceImage, ({ progress, message }) => {
          setProcessingProgress(progress, message);
        });
      } else if (bgRemovalMethod === "api") {
        if (!removeBgApiKey) {
          throw new Error("APIキーを入力してください");
        }
        blob = await removeBackgroundAPI(
          sourceImage,
          removeBgApiKey,
          ({ progress, message }) => {
            setProcessingProgress(progress, message);
          }
        );
      } else if (bgRemovalMethod === "color") {
        if (!selectedColor) {
          throw new Error("スポイトで背景色を選択してください");
        }
        blob = await removeColorFromImageAsync(
          sourceImage,
          selectedColor,
          colorTolerance,
          true,
          (progress, message) => {
            setProcessingProgress(progress, message);
          }
        );
      } else if (bgRemovalMethod === "manual") {
        // 手動モード: 元画像をそのまま使う
        const sourceCanvas = document.createElement("canvas");
        sourceCanvas.width = sourceImage.width;
        sourceCanvas.height = sourceImage.height;
        const sourceCtx = sourceCanvas.getContext("2d")!;
        sourceCtx.drawImage(sourceImage, 0, 0);
        blob = await new Promise<Blob>((resolve) => {
          sourceCanvas.toBlob((b) => resolve(b!), "image/png");
        });
        isManual = true;
      } else {
        // 背景除去なし
        setIsProcessing(false);
        return;
      }

      const url = blobToObjectUrl(blob);
      setProcessedImageUrl(url);

      // 元画像をObject URLに変換
      const sourceCanvas = document.createElement("canvas");
      sourceCanvas.width = sourceImage.width;
      sourceCanvas.height = sourceImage.height;
      const sourceCtx = sourceCanvas.getContext("2d")!;
      sourceCtx.drawImage(sourceImage, 0, 0);
      const sourceBlob = await new Promise<Blob>((resolve) => {
        sourceCanvas.toBlob((b) => resolve(b!), "image/png");
      });
      const sourceUrl = blobToObjectUrl(sourceBlob);

      // 手動モードフラグを設定
      setIsManualMode(isManual);

      // レイヤーを初期化（下: 元画像、上: 背景削除済み or 元画像）
      initializeLayers(sourceUrl, url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "背景除去に失敗しました");
    } finally {
      setIsProcessing(false);
    }
  }, [
    sourceImage,
    bgRemovalMethod,
    removeBgApiKey,
    selectedColor,
    colorTolerance,
    setIsProcessing,
    setProcessingProgress,
    setProcessedImageUrl,
    initializeLayers,
    setIsManualMode,
  ]);

  const handleSaveApiKey = useCallback(() => {
    setRemoveBgApiKey(apiKeyInput);
    setApiKeyInput("");
  }, [apiKeyInput, setRemoveBgApiKey]);

  const handleStartEyedropper = useCallback(() => {
    setBgRemovalMethod("color");
    setActiveTool("eyedropper");
  }, [setBgRemovalMethod, setActiveTool]);

  if (!sourceImage) return null;

  return (
    <div className="flex flex-col gap-4 p-4 neu-card-sm">
      <div>
        <p className="eyebrow">BACKGROUND</p>
        <h3 className="text-base font-semibold text-[var(--neu-text-primary)]">
          背景処理
        </h3>
      </div>

      {/* 方式選択 */}
      <div className="grid grid-cols-2 gap-2">
        <button
          className={`neu-button neu-button-sm ${
            bgRemovalMethod === "ai" ? "neu-button-primary" : ""
          }`}
          onClick={() => setBgRemovalMethod("ai")}
          disabled={isProcessing}
        >
          <Robot size={18} className="mr-1" />
          AI
        </button>
        <button
          className={`neu-button neu-button-sm ${
            bgRemovalMethod === "api" ? "neu-button-primary" : ""
          }`}
          onClick={() => setBgRemovalMethod("api")}
          disabled={isProcessing}
        >
          <Cloud size={18} className="mr-1" />
          API
        </button>
        <button
          className={`neu-button neu-button-sm ${
            bgRemovalMethod === "color" ? "neu-button-primary" : ""
          }`}
          onClick={() => setBgRemovalMethod("color")}
          disabled={isProcessing}
        >
          <Eyedropper size={18} className="mr-1" />
          色指定
        </button>
        <button
          className={`neu-button neu-button-sm ${
            bgRemovalMethod === "manual" ? "neu-button-primary" : ""
          }`}
          onClick={() => setBgRemovalMethod("manual")}
          disabled={isProcessing}
          title="手動モード"
        >
          <Hand size={18} className="mr-1" />
          手動
        </button>
        <button
          className={`neu-button neu-button-sm col-span-2 ${
            bgRemovalMethod === "none" ? "neu-button-primary" : ""
          }`}
          onClick={() => setBgRemovalMethod("none")}
          disabled={isProcessing}
          title="背景除去なし"
        >
          <X size={18} />
        </button>
      </div>

      {/* 色指定モード */}
      {bgRemovalMethod === "color" && (
        <div className="space-y-3">
          {/* スポイトボタンと選択色表示 */}
          <div className="flex items-center gap-2">
            <button
              className="neu-button neu-button-sm flex items-center gap-1"
              onClick={handleStartEyedropper}
              disabled={isProcessing}
            >
              <Eyedropper size={16} />
              色を選択
            </button>
            {selectedColor && (
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded border-2 border-[var(--neu-border)]"
                  style={{ backgroundColor: rgbToHex(selectedColor) }}
                />
                <span className="text-xs text-[var(--neu-text-muted)]">
                  {rgbToHex(selectedColor)}
                </span>
              </div>
            )}
          </div>

          {/* 許容範囲スライダー */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--neu-text-muted)]">許容範囲</span>
              <span className="text-[var(--neu-text-primary)]">{colorTolerance}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={colorTolerance}
              onChange={(e) => setColorTolerance(Number(e.target.value))}
              className="neu-slider"
            />
            <p className="text-xs text-[var(--neu-text-muted)]">
              値が大きいほど類似色も除去されます
            </p>
          </div>
        </div>
      )}

      {/* API キー入力 */}
      {bgRemovalMethod === "api" && !removeBgApiKey && (
        <div className="space-y-2">
          <input
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder="remove.bg APIキー"
            className="neu-input text-sm"
          />
          <button
            className="neu-button neu-button-sm w-full"
            onClick={handleSaveApiKey}
            disabled={!apiKeyInput}
          >
            キーを保存
          </button>
        </div>
      )}

      {/* APIキー設定済み表示 */}
      {bgRemovalMethod === "api" && removeBgApiKey && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--neu-text-muted)]">APIキー設定済み</span>
          <button
            className="text-[var(--neu-danger)] hover:underline"
            onClick={() => setRemoveBgApiKey(null)}
          >
            削除
          </button>
        </div>
      )}

      {/* 実行ボタン */}
      {bgRemovalMethod !== "none" && (
        <button
          className="neu-button neu-button-primary w-full"
          onClick={handleRemoveBackground}
          disabled={
            isProcessing ||
            (bgRemovalMethod === "api" && !removeBgApiKey) ||
            (bgRemovalMethod === "color" && !selectedColor)
          }
        >
          {isProcessing ? (
            <>
              <Spinner size={18} className="mr-2 animate-spin" />
              処理中...
            </>
          ) : bgRemovalMethod === "manual" ? (
            "手動モードで開始"
          ) : (
            "背景を除去"
          )}
        </button>
      )}

      {/* プログレスバー */}
      {isProcessing && (
        <div className="space-y-2">
          <div className="neu-progress">
            <div
              className="neu-progress-bar"
              style={{ width: `${processingProgress * 100}%` }}
            />
          </div>
          <p className="text-xs text-[var(--neu-text-muted)] text-center">
            {processingMessage || "処理中..."}
          </p>
        </div>
      )}

      {/* エラー表示 */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
          <WarningCircle size={20} className="flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
