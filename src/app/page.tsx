"use client";

import { ArrowLeft, Info } from "@phosphor-icons/react";
import { useEditorStore } from "@/stores/editorStore";
import { EditorStore } from "@/types/editor";
import {
  ImageUploader,
  EditorCanvas,
  ToolPanel,
  ScaleSlider,
  BackgroundRemovalPanel,
  ExportPanel,
  LayerPanel,
} from "@/components/editor";

export default function Home() {
  const sourceImage = useEditorStore((s: EditorStore) => s.sourceImage);
  const reset = useEditorStore((s: EditorStore) => s.reset);

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* ヘッダー */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {sourceImage && (
              <button
                className="neu-button neu-button-sm neu-button-icon"
                onClick={reset}
                title="最初からやり直す"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <h1 className="text-2xl font-bold text-[var(--neu-text-primary)]">
              iconic
            </h1>
            <span className="text-sm text-[var(--neu-text-muted)]">
              角丸アイコン作成ツール
            </span>
          </div>

          <button
            className="neu-button neu-button-sm neu-button-icon"
            title="使い方"
          >
            <Info size={20} />
          </button>
        </header>

        {/* メインコンテンツ */}
        {!sourceImage ? (
          // アップローダー表示
          <div className="flex flex-col items-center gap-6 py-12">
            <ImageUploader />

            <div className="text-center max-w-md">
              <h2 className="text-lg font-medium text-[var(--neu-text-primary)] mb-2">
                角丸アイコンを簡単作成
              </h2>
              <p className="text-sm text-[var(--neu-text-muted)]">
                1. 画像をアップロード<br />
                2. AIで背景を自動除去<br />
                3. はみ出し部分をブラシで指定<br />
                4. PNG/ICO形式でダウンロード
              </p>
            </div>
          </div>
        ) : (
          // エディター表示
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            {/* キャンバスエリア */}
            <div className="flex flex-col gap-4">
              <EditorCanvas />
              <ScaleSlider />

              {/* モバイル用ツール（小画面で表示） */}
              <div className="lg:hidden">
                <ToolPanel />
              </div>
            </div>

            {/* サイドパネル */}
            <div className="flex flex-col gap-4">
              {/* デスクトップ用ツール */}
              <div className="hidden lg:block">
                <ToolPanel />
              </div>

              <LayerPanel />
              <BackgroundRemovalPanel />
              <ExportPanel />
            </div>
          </div>
        )}

        {/* フッター */}
        <footer className="mt-12 pt-6 border-t border-[var(--neu-shadow-dark)] text-center">
          <p className="text-xs text-[var(--neu-text-muted)]">
            背景除去には
            <a
              href="https://github.com/imgly/background-removal-js"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--neu-accent)] hover:underline mx-1"
            >
              @imgly/background-removal
            </a>
            を使用しています
          </p>
        </footer>
      </div>
    </main>
  );
}
