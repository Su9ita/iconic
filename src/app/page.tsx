"use client";

import {
  ArrowLeft,
  DownloadSimple,
  ImageSquare,
  SlidersHorizontal,
} from "@phosphor-icons/react";
import { useEditorStore } from "@/stores/editorStore";
import { EditorStore } from "@/types/editor";
import {
  ImageUploader,
  EditorCanvas,
  ToolPanel,
  ScaleSlider,
  ExportPanel,
  LayerPanel,
  BalancePreview,
} from "@/components/editor";

const steps = [
  { label: "画像", icon: ImageSquare },
  { label: "調整", icon: SlidersHorizontal },
  { label: "保存", icon: DownloadSimple },
];

export default function Home() {
  const sourceImage = useEditorStore((s: EditorStore) => s.sourceImage);
  const layers = useEditorStore((s: EditorStore) => s.layers);
  const reset = useEditorStore((s: EditorStore) => s.reset);
  const activeStep = !sourceImage ? 0 : layers.length > 0 ? 1 : 0;

  return (
    <main className="min-h-screen px-4 py-5 md:px-8 md:py-7">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="app-header">
          <div className="flex min-w-0 items-center gap-3">
            {sourceImage && (
              <button
                className="neu-button neu-button-sm neu-button-icon"
                onClick={reset}
                title="最初からやり直す"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-[var(--neu-text-primary)]">
                iconic
              </h1>
              <p className="text-sm text-[var(--neu-text-muted)]">
                角丸アイコン作成ツール
              </p>
            </div>
          </div>

          <nav className="step-nav" aria-label="作業ステップ">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === activeStep;
              const isDone = index < activeStep;

              return (
                <div
                  key={step.label}
                  className={`step-item ${isActive ? "active" : ""} ${isDone ? "done" : ""}`}
                >
                  <Icon size={18} weight={isActive || isDone ? "fill" : "regular"} />
                  <span>{step.label}</span>
                </div>
              );
            })}
          </nav>
        </header>

        {!sourceImage ? (
          <section className="upload-layout">
            <div className="upload-copy">
              <p className="eyebrow">ICON EXPORTER</p>
              <h2>画像からすぐにアプリアイコンを作成</h2>
              <p>
                角丸マスク、レイヤー調整、PNG/ICO 書き出しまでをブラウザ上で完結できます。
              </p>
            </div>
            <ImageUploader />
          </section>
        ) : (
          <section className="editor-layout">
            <div className="workspace-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">PREVIEW</p>
                  <h2>アイコンプレビュー</h2>
                </div>
              </div>
              <EditorCanvas />
              <ScaleSlider />

              <div className="lg:hidden">
                <ToolPanel />
              </div>
            </div>

            <aside className="control-panel">
              <div className="hidden lg:block">
                <ToolPanel />
              </div>
              <LayerPanel />
              <BalancePreview />
              <ExportPanel />
            </aside>
          </section>
        )}

        <footer className="app-footer" />
      </div>
    </main>
  );
}
