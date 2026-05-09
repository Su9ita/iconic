"use client";

import {
  Hand,
  PaintBrush,
  Eraser,
  Trash,
  ArrowUUpLeft,
  ArrowUUpRight,
  ArrowCounterClockwise,
  Path,
  FrameCorners,
  SelectionForeground,
} from "@phosphor-icons/react";
import { useEditorStore } from "@/stores/editorStore";
import { getClipMargins, updateClipMargin, ClipMarginEdge } from "@/lib/clipRegion";
import { createSquirclePath } from "@/lib/squircleMask";
import {
  WORKSPACE_SIZE,
  SQUIRCLE_OFFSET,
  ICON_PADDING,
  SQUIRCLE_SIZE,
} from "@/lib/constants";

export function ToolPanel() {
  const {
    activeTool,
    brushSize,
    layers,
    isManualMode,
    clipRegion,
    roundness,
    setActiveTool,
    setBrushSize,
    clearOverflowStrokes,
    setClipRegion,
    setRoundness,
    updateLayerEraserMask,
    saveHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    clearPenPath,
  } = useEditorStore();
  const clipMargins = getClipMargins(clipRegion);
  const marginFields: { edge: ClipMarginEdge; label: string }[] = [
    { edge: "top", label: "上" },
    { edge: "right", label: "右" },
    { edge: "bottom", label: "下" },
    { edge: "left", label: "左" },
  ];

  const handleMarginChange = (edge: ClipMarginEdge, value: number) => {
    setClipRegion(updateClipMargin(clipRegion, edge, value));
  };

  const handleClipBaseOutsideRound = () => {
    const baseLayer = layers.find((layer) => layer.id === "base");
    if (!baseLayer) return;

    saveHistory();

    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = WORKSPACE_SIZE;
    maskCanvas.height = WORKSPACE_SIZE;
    const maskCtx = maskCanvas.getContext("2d");
    if (!maskCtx) return;

    if (baseLayer.eraserMask) {
      maskCtx.putImageData(baseLayer.eraserMask, 0, 0);
    }

    const outsideCanvas = document.createElement("canvas");
    outsideCanvas.width = WORKSPACE_SIZE;
    outsideCanvas.height = WORKSPACE_SIZE;
    const outsideCtx = outsideCanvas.getContext("2d");
    if (!outsideCtx) return;

    outsideCtx.fillStyle = "#ffffff";
    outsideCtx.fillRect(0, 0, WORKSPACE_SIZE, WORKSPACE_SIZE);
    outsideCtx.globalCompositeOperation = "destination-out";
    outsideCtx.translate(SQUIRCLE_OFFSET + ICON_PADDING, SQUIRCLE_OFFSET + ICON_PADDING);
    createSquirclePath(outsideCtx, SQUIRCLE_SIZE, roundness);
    outsideCtx.fill();

    maskCtx.drawImage(outsideCanvas, 0, 0);
    updateLayerEraserMask("base", maskCtx.getImageData(0, 0, WORKSPACE_SIZE, WORKSPACE_SIZE));
  };

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

      {layers.some((layer) => layer.id === "base") && (
        <button
          className="neu-button neu-button-sm flex items-center justify-center gap-2"
          onClick={handleClipBaseOutsideRound}
          title="ベースレイヤーだけ角丸の外側を削除"
        >
          <SelectionForeground size={18} />
          ベースを角丸で切り抜く
        </button>
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


      {/* 角丸スライダー */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 text-[var(--neu-text-muted)]">
            <FrameCorners size={16} />
            角丸
          </span>
          <span className="text-[var(--neu-text-primary)]">{Math.round(roundness * 100)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(roundness * 100)}
          onChange={(e) => setRoundness(Number(e.target.value) / 100)}
          className="neu-slider"
        />
      </div>

      {/* 最終アイコン枠 */}
      <div className="space-y-3 border-t border-[var(--neu-border)] pt-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--neu-text-muted)]">正方形アイコン枠</span>
          <span className="text-[var(--neu-text-primary)]">{clipRegion.size}px</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
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
        <p className="text-xs leading-relaxed text-[var(--neu-text-muted)]">
          角丸枠から最終出力枠までの距離です。正方形を維持するため、反対軸の余白は自動調整されます。
        </p>
      </div>
    </div>
  );
}
