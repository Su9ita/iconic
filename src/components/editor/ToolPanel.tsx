"use client";

import {
  Hand,
  PaintBrush,
  Eraser,
  Trash,
  Eye,
  EyeSlash,
  ArrowUUpLeft,
  ArrowUUpRight,
  ArrowCounterClockwise,
  Path,
} from "@phosphor-icons/react";
import { useEditorStore } from "@/stores/editorStore";

export function ToolPanel() {
  const {
    activeTool,
    brushSize,
    showOriginal,
    processedImageUrl,
    layers,
    isManualMode,
    setActiveTool,
    setBrushSize,
    clearOverflowStrokes,
    toggleShowOriginal,
    undo,
    redo,
    canUndo,
    canRedo,
    clearPenPath,
  } = useEditorStore();

  return (
    <div className="flex flex-col gap-4 p-4 neu-card-sm">
      <div>
        <p className="eyebrow">TOOLS</p>
        <h3 className="text-base font-semibold text-[var(--neu-text-primary)]">
          編集ツール
        </h3>
      </div>

      {/* ツール選択 */}
      <div className="grid grid-cols-5 gap-2">
        <button
          className={`neu-tool ${activeTool === "move" ? "active" : ""}`}
          onClick={() => setActiveTool("move")}
          title="移動ツール"
        >
          <Hand size={24} weight={activeTool === "move" ? "fill" : "regular"} />
        </button>
        {layers.length > 0 && (
          <>
            <button
              className={`neu-tool ${activeTool === "eraser" ? "active" : ""}`}
              onClick={() => setActiveTool("eraser")}
              title="消しゴムツール"
            >
              <Eraser size={24} weight={activeTool === "eraser" ? "fill" : "regular"} />
            </button>
            <button
              className={`neu-tool ${activeTool === "restore" ? "active" : ""}`}
              onClick={() => setActiveTool("restore")}
              title="復元ブラシ（消しすぎた部分を戻す）"
            >
              <ArrowCounterClockwise size={24} weight={activeTool === "restore" ? "fill" : "regular"} />
            </button>
          </>
        )}
        {isManualMode && layers.length > 0 && (
          <button
            className={`neu-tool ${activeTool === "pen" ? "active" : ""}`}
            onClick={() => setActiveTool("pen")}
            title="ペンツール（範囲選択）"
          >
            <Path size={24} weight={activeTool === "pen" ? "fill" : "regular"} />
          </button>
        )}
        <button
          className={`neu-tool ${activeTool === "brush" ? "active" : ""}`}
          onClick={() => setActiveTool("brush")}
          title="はみ出しブラシ"
        >
          <PaintBrush size={24} weight={activeTool === "brush" ? "fill" : "regular"} />
        </button>
        <button
          className="neu-tool"
          onClick={() => {
            clearOverflowStrokes();
            clearPenPath();
          }}
          title="ブラシ・パスをクリア"
        >
          <Trash size={24} />
        </button>
      </div>

      {/* Undo/Redo */}
      {layers.length > 0 && (
        <div className="flex gap-2">
          <button
            className={`neu-button neu-button-sm flex-1 ${!canUndo() ? "opacity-40" : ""}`}
            onClick={undo}
            disabled={!canUndo()}
            title="元に戻す (Ctrl+Z)"
          >
            <ArrowUUpLeft size={20} />
            <span className="text-xs ml-1">戻す</span>
          </button>
          <button
            className={`neu-button neu-button-sm flex-1 ${!canRedo() ? "opacity-40" : ""}`}
            onClick={redo}
            disabled={!canRedo()}
            title="やり直す (Ctrl+Y)"
          >
            <ArrowUUpRight size={20} />
            <span className="text-xs ml-1">やり直す</span>
          </button>
        </div>
      )}

      {/* ブラシ/消しゴム/復元ブラシサイズ */}
      {(activeTool === "brush" || activeTool === "eraser" || activeTool === "restore") && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--neu-text-muted)]">
              {activeTool === "eraser" ? "消しゴムサイズ" : activeTool === "restore" ? "復元ブラシサイズ" : "ブラシサイズ"}
            </span>
            <span className="text-[var(--neu-text-primary)]">{brushSize}px</span>
          </div>
          <input
            type="range"
            min="5"
            max="100"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="neu-slider"
          />
        </div>
      )}


      {/* オリジナル表示切替 */}
      {processedImageUrl && (
        <button
          className={`neu-button neu-button-sm w-full ${showOriginal ? "" : "neu-button-primary"}`}
          onClick={toggleShowOriginal}
        >
          {showOriginal ? (
            <>
              <EyeSlash size={18} className="mr-2" />
              背景あり表示中
            </>
          ) : (
            <>
              <Eye size={18} className="mr-2" />
              背景除去済み
            </>
          )}
        </button>
      )}
    </div>
  );
}
