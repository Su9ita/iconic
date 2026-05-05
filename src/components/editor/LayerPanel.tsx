"use client";

import { Eye, EyeSlash } from "@phosphor-icons/react";
import { useEditorStore } from "@/stores/editorStore";

export function LayerPanel() {
  const {
    layers,
    activeLayerId,
    setActiveLayer,
    toggleLayerVisibility,
  } = useEditorStore();

  if (layers.length === 0) {
    return null;
  }

  // レイヤーは上から下の順で表示（配列の後ろが上）
  const reversedLayers = [...layers].reverse();

  return (
    <div className="flex flex-col gap-2 p-4 neu-card-sm">
      <div className="mb-1">
        <p className="eyebrow">LAYERS</p>
        <h3 className="text-base font-semibold text-[var(--neu-text-primary)]">
          レイヤー
        </h3>
      </div>

      <div className="flex flex-col gap-1">
        {reversedLayers.map((layer) => (
          <div
            key={layer.id}
            className={`
              flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all
              ${activeLayerId === layer.id
                ? "bg-[var(--neu-accent)] bg-opacity-20 border border-[var(--neu-accent)]"
                : "border border-transparent hover:bg-[var(--neu-surface-subtle)]"
              }
            `}
            onClick={() => setActiveLayer(layer.id)}
          >
            {/* 可視性トグル */}
            <button
              className="p-1 rounded hover:bg-[var(--neu-bg-tertiary)] transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                toggleLayerVisibility(layer.id);
              }}
              title={layer.visible ? "非表示にする" : "表示する"}
            >
              {layer.visible ? (
                <Eye size={18} className="text-[var(--neu-text-primary)]" />
              ) : (
                <EyeSlash size={18} className="text-[var(--neu-text-muted)]" />
              )}
            </button>

            {/* レイヤー名 */}
            <span
              className={`
                text-sm flex-1
                ${layer.visible
                  ? "text-[var(--neu-text-primary)]"
                  : "text-[var(--neu-text-muted)]"
                }
              `}
            >
              {layer.name}
            </span>

            {/* 選択インジケーター */}
            {activeLayerId === layer.id && (
              <span className="text-xs text-[var(--neu-accent)]">編集中</span>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-[var(--neu-text-muted)] mt-2">
        消しゴムで消すレイヤーを選択してください
      </p>
    </div>
  );
}
