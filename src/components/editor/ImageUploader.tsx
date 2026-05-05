"use client";

import { useCallback, useState } from "react";
import { UploadSimple, Image as ImageIcon } from "@phosphor-icons/react";
import { useEditorStore } from "@/stores/editorStore";
import { EditorStore } from "@/types/editor";

export function ImageUploader() {
  const [isDragging, setIsDragging] = useState(false);
  const setSourceImage = useEditorStore((s: EditorStore) => s.setSourceImage);

  const loadImage = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          setSourceImage(img);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    },
    [setSourceImage]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) loadImage(file);
    },
    [loadImage]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) loadImage(file);
    },
    [loadImage]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) loadImage(file);
          break;
        }
      }
    },
    [loadImage]
  );

  return (
    <div
      className={`
        relative w-full aspect-square max-w-[512px] mx-auto
        flex flex-col items-center justify-center gap-4
        neu-pressed cursor-pointer
        transition-all duration-200
        ${isDragging ? "scale-[1.02] ring-4 ring-[var(--neu-accent)] ring-opacity-50" : ""}
      `}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onPaste={handlePaste}
      tabIndex={0}
    >
      <input
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="absolute inset-0 opacity-0 cursor-pointer"
      />

      <div
        className={`
          w-20 h-20 rounded-lg flex items-center justify-center
          ${isDragging ? "bg-[var(--neu-accent)]" : "neu-raised"}
          transition-all duration-200
        `}
      >
        {isDragging ? (
          <UploadSimple size={40} weight="bold" className="text-white" />
        ) : (
          <ImageIcon size={40} weight="light" className="text-[var(--neu-text-muted)]" />
        )}
      </div>

      <div className="text-center px-8">
        <p className="text-lg text-[var(--neu-text-primary)] font-semibold mb-1">
          {isDragging ? "ここにドロップ" : "画像を選択"}
        </p>
        <p className="text-[var(--neu-text-muted)] text-sm">
          ドラッグ、クリック、ペーストに対応
        </p>
      </div>
    </div>
  );
}
