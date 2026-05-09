import { create } from "zustand";
import { EditorStore, EditorState, Layer, HistoryEntry } from "@/types/editor";

const MAX_HISTORY = 50; // 履歴の最大数

const initialState: EditorState = {
  sourceImage: null,
  processedImageUrl: null,
  layers: [],
  activeLayerId: null,
  history: [],
  historyIndex: -1,
  imagePosition: { x: 0, y: 0 },
  imageScale: 1,
  activeTool: "move",
  brushSize: 30,
  overflowStrokes: [],
  showOriginal: false,
  clipRegion: { x: 64, y: 64, size: 512 },
  isExportModalOpen: false,
  roundness: 0.8,
};

/**
 * ImageDataをディープコピー
 */
function cloneImageData(imageData: ImageData | null): ImageData | null {
  if (!imageData) return null;
  const newData = new ImageData(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height
  );
  return newData;
}

/**
 * 現在の状態から履歴エントリを作成
 */
function createHistoryEntry(state: EditorState): HistoryEntry {
  const layerMasks = new Map<string, ImageData | null>();
  for (const layer of state.layers) {
    layerMasks.set(layer.id, cloneImageData(layer.eraserMask));
  }
  return {
    layerMasks,
    overflowStrokes: state.overflowStrokes.map(stroke => [...stroke]),
  };
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  ...initialState,

  setSourceImage: (img) => {
    // キャンバスを埋めるような初期スケールを計算
    // 横長なら高さ基準、縦長なら幅基準で拡大
    const canvasSize = 512;
    const fitScale = Math.max(canvasSize / img.width, canvasSize / img.height);

    set({
      sourceImage: img,
      imagePosition: { x: 0, y: 0 },
      imageScale: fitScale / Math.min(canvasSize / img.width, canvasSize / img.height),
      overflowStrokes: [],
      processedImageUrl: img.src,
      layers: [
        {
          id: "base",
          name: "ベース（元画像）",
          visible: true,
          imageUrl: img.src,
          eraserMask: null,
        },
        {
          id: "character",
          name: "上レイヤー",
          visible: true,
          imageUrl: img.src,
          eraserMask: null,
        },
      ],
      activeLayerId: "character",
      history: [],
      historyIndex: -1,
    });
  },

  setProcessedImageUrl: (url) => set({ processedImageUrl: url }),

  setImagePosition: (pos) => set({ imagePosition: pos }),

  setImageScale: (scale) => set({ imageScale: Math.max(0.1, Math.min(5, scale)) }),

  setActiveTool: (tool) => set({ activeTool: tool }),

  setBrushSize: (size) => set({ brushSize: Math.max(5, Math.min(100, size)) }),

  addOverflowStroke: (stroke) =>
    set((state) => ({
      overflowStrokes: [...state.overflowStrokes, stroke],
    })),

  clearOverflowStrokes: () => set({ overflowStrokes: [] }),

  toggleShowOriginal: () => set((state) => ({ showOriginal: !state.showOriginal })),

  reset: () => set(initialState),

  // レイヤー操作
  addLayer: (layer: Layer) =>
    set((state) => ({
      layers: [...state.layers, layer],
      activeLayerId: state.activeLayerId || layer.id,
    })),

  removeLayer: (id: string) =>
    set((state) => {
      const newLayers = state.layers.filter((l) => l.id !== id);
      return {
        layers: newLayers,
        activeLayerId:
          state.activeLayerId === id
            ? newLayers[0]?.id || null
            : state.activeLayerId,
      };
    }),

  setActiveLayer: (id: string | null) => set({ activeLayerId: id }),

  toggleLayerVisibility: (id: string) =>
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === id ? { ...l, visible: !l.visible } : l
      ),
    })),

  updateLayerEraserMask: (id: string, mask: ImageData) =>
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === id ? { ...l, eraserMask: mask } : l
      ),
    })),

  updateLayerImageUrl: (id: string, url: string) =>
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === id ? { ...l, imageUrl: url } : l
      ),
    })),

  /**
   * 2つのレイヤーを初期化
   * - 下: 元画像（アイコン内で見える）
   * - 上: 元画像（はみ出し部分の編集用）
   */
  initializeLayers: (sourceUrl: string, processedUrl: string | null) =>
    set({
      layers: [
        {
          id: "base",
          name: "ベース（元画像）",
          visible: true,
          imageUrl: sourceUrl,
          eraserMask: null,
        },
        {
          id: "character",
          name: "キャラクター",
          visible: true,
          imageUrl: processedUrl,
          eraserMask: null,
        },
      ],
      activeLayerId: "character",
    }),

  clearLayers: () => set({ layers: [], activeLayerId: null }),

  // 履歴操作（Undo/Redo）
  saveHistory: () =>
    set((state) => {
      const entry = createHistoryEntry(state);
      // 現在位置より後の履歴を削除（新しい操作をした場合）
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(entry);
      // 最大数を超えたら古いものを削除
      if (newHistory.length > MAX_HISTORY) {
        newHistory.shift();
      }
      return {
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    }),

  undo: () =>
    set((state) => {
      if (state.historyIndex < 0) return state;

      const entry = state.history[state.historyIndex];
      if (!entry) return state;

      // レイヤーのマスクを復元
      const newLayers = state.layers.map((layer) => {
        const mask = entry.layerMasks.get(layer.id);
        return {
          ...layer,
          eraserMask: mask !== undefined ? cloneImageData(mask) : layer.eraserMask,
        };
      });

      return {
        layers: newLayers,
        overflowStrokes: entry.overflowStrokes.map(stroke => [...stroke]),
        historyIndex: state.historyIndex - 1,
      };
    }),

  redo: () =>
    set((state) => {
      if (state.historyIndex >= state.history.length - 1) return state;

      const nextIndex = state.historyIndex + 1;
      // Redo時は次の状態の「後」の状態を適用するため+1
      const entry = state.history[nextIndex + 1];

      if (!entry) {
        // 最新の操作を再適用（履歴の最後の状態）
        const lastEntry = state.history[state.history.length - 1];
        if (!lastEntry) return state;

        // 最新状態を取得するには現在の状態をそのまま使う
        return {
          historyIndex: nextIndex,
        };
      }

      const newLayers = state.layers.map((layer) => {
        const mask = entry.layerMasks.get(layer.id);
        return {
          ...layer,
          eraserMask: mask !== undefined ? cloneImageData(mask) : layer.eraserMask,
        };
      });

      return {
        layers: newLayers,
        overflowStrokes: entry.overflowStrokes.map(stroke => [...stroke]),
        historyIndex: nextIndex,
      };
    }),

  canUndo: () => {
    const state = get();
    return state.historyIndex >= 0;
  },

  canRedo: () => {
    const state = get();
    return state.historyIndex < state.history.length - 1;
  },

  clearHistory: () => set({ history: [], historyIndex: -1 }),

  // クリッピング操作
  setClipRegion: (region) => set({ clipRegion: region }),
  setExportModalOpen: (open) => set({ isExportModalOpen: open }),
  resetClipRegion: () => set({ clipRegion: { x: 64, y: 64, size: 512 } }),

  setRoundness: (roundness) => set({ roundness: Math.max(0, Math.min(1, roundness)) }),
}));
