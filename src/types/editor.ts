export type Tool = "move" | "brush" | "eraser" | "restore";

/**
 * RGB色
 */
export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export interface Position {
  x: number;
  y: number;
}

/**
 * クリッピング領域
 */
export interface ClipRegion {
  x: number;      // クリップ領域の左上X座標（ワークスペース座標系）
  y: number;      // クリップ領域の左上Y座標
  size: number;   // クリップ領域のサイズ（正方形）
}

/**
 * レイヤー
 * - 各レイヤーは独自のキャンバスデータ（ImageData）を持つ
 * - eraserMaskはそのレイヤーで消された部分を記録
 */
export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  imageUrl: string | null; // 画像データのObject URL
  eraserMask: ImageData | null; // 消しゴムで消した部分のマスク
}

/**
 * 履歴エントリ（Undo/Redo用）
 * 各レイヤーのeraserMaskのスナップショットを保存
 */
export interface HistoryEntry {
  layerMasks: Map<string, ImageData | null>;
  overflowStrokes: Position[][];
}

export interface EditorState {
  // 画像
  sourceImage: HTMLImageElement | null;
  processedImageUrl: string | null; // レイヤー初期化用の画像URL

  // レイヤー
  layers: Layer[];
  activeLayerId: string | null;

  // 履歴（Undo/Redo）
  history: HistoryEntry[];
  historyIndex: number; // 現在の履歴位置（-1 = 初期状態）

  // 位置・変形
  imagePosition: Position;
  imageScale: number;

  // ツール
  activeTool: Tool;
  brushSize: number;

  // オーバーフローマスク（ブラシで塗ったエリア）- 旧方式、互換性のため残す
  overflowStrokes: Position[][];

  // UI
  showOriginal: boolean;

  // クリッピング
  clipRegion: ClipRegion;
  isExportModalOpen: boolean;

  // 角丸
  roundness: number;
}

export interface EditorActions {
  setSourceImage: (img: HTMLImageElement) => void;
  setProcessedImageUrl: (url: string | null) => void;
  setImagePosition: (pos: Position) => void;
  setImageScale: (scale: number) => void;
  setActiveTool: (tool: Tool) => void;
  setBrushSize: (size: number) => void;
  addOverflowStroke: (stroke: Position[]) => void;
  clearOverflowStrokes: () => void;
  toggleShowOriginal: () => void;
  reset: () => void;

  // レイヤー操作
  addLayer: (layer: Layer) => void;
  removeLayer: (id: string) => void;
  setActiveLayer: (id: string | null) => void;
  toggleLayerVisibility: (id: string) => void;
  updateLayerEraserMask: (id: string, mask: ImageData) => void;
  updateLayerImageUrl: (id: string, url: string) => void;
  initializeLayers: (sourceUrl: string, processedUrl: string | null) => void;
  clearLayers: () => void;

  // 履歴操作（Undo/Redo）
  saveHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;

  // クリッピング操作
  setClipRegion: (region: ClipRegion) => void;
  setExportModalOpen: (open: boolean) => void;
  resetClipRegion: () => void;

  setRoundness: (roundness: number) => void;
}

export type EditorStore = EditorState & EditorActions;
