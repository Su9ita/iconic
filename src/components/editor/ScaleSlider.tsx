"use client";

import { MagnifyingGlassMinus, MagnifyingGlassPlus } from "@phosphor-icons/react";
import { useEditorStore } from "@/stores/editorStore";

export function ScaleSlider() {
  const { imageScale, setImageScale } = useEditorStore();

  return (
    <div className="flex items-center gap-3 p-3 neu-card-sm">
      <button
        className="neu-button neu-button-sm neu-button-icon flex-shrink-0"
        onClick={() => setImageScale(imageScale - 0.1)}
        title="縮小"
      >
        <MagnifyingGlassMinus size={18} />
      </button>

      <div className="flex-1 flex items-center gap-2">
        <input
          type="range"
          min="10"
          max="500"
          value={imageScale * 100}
          onChange={(e) => setImageScale(Number(e.target.value) / 100)}
          className="neu-slider flex-1"
        />
        <span className="text-sm text-[var(--neu-text-primary)] w-14 text-right font-medium">
          {Math.round(imageScale * 100)}%
        </span>
      </div>

      <button
        className="neu-button neu-button-sm neu-button-icon flex-shrink-0"
        onClick={() => setImageScale(imageScale + 0.1)}
        title="拡大"
      >
        <MagnifyingGlassPlus size={18} />
      </button>
    </div>
  );
}
