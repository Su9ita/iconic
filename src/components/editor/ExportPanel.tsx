"use client";

import { DownloadSimple } from "@phosphor-icons/react";
import { useEditorStore } from "@/stores/editorStore";
import { ExportModal } from "./ExportModal";

export function ExportPanel() {
  const { sourceImage, setExportModalOpen } = useEditorStore();

  if (!sourceImage) return null;

  return (
    <>
      <div className="flex flex-col gap-4 p-4 neu-card-sm">
        <h3 className="text-sm font-medium text-[var(--neu-text-primary)]">
          エクスポート
        </h3>

        <button
          className="neu-button neu-button-primary w-full flex items-center justify-center gap-2"
          onClick={() => setExportModalOpen(true)}
        >
          <DownloadSimple size={20} />
          エクスポート
        </button>

        <p className="text-xs text-[var(--neu-text-muted)] text-center">
          クリッピング範囲を調整してエクスポート
        </p>
      </div>

      <ExportModal />
    </>
  );
}
