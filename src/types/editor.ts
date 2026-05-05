export type Tool = "move" | "brush" | "eraser" | "eyedropper" | "restore" | "pen";
export type BgRemovalMethod = "ai" | "api" | "none" | "color" | "manual";

/**
 * RGB色
 */
export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

/**
 * ペンツールのベジェ曲線点
 */
export interface PenPoint {
  x: number;
  y: number;
  handleIn?: Position;
  handleOut?: Position;
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
  processedImageUrl: string | null; // 背景除去済み画像のURL

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

  // 背景除去
  bgRemovalMethod: BgRemovalMethod;
  removeBgApiKey: string | null;
  isProcessing: boolean;
  processingProgress: number;
  processingMessage: string;

  // 色指定による背景除去
  selectedColor: RGBColor | null;
  colorTolerance: number; // 許容範囲 0-100

  // UI
  showOriginal: boolean;

  // ペンツール
  penPoints: PenPoint[];
  currentPenPoint: PenPoint | null;
  isPenPathClosed: boolean;
  isManualMode: boolean;

  // クリッピング
  clipRegion: ClipRegion;
  isExportModalOpen: boolean;
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
  setBgRemovalMethod: (method: BgRemovalMethod) => void;
  setRemoveBgApiKey: (key: string | null) => void;
  setIsProcessing: (processing: boolean) => void;
  setProcessingProgress: (progress: number, message?: string) => void;
  toggleShowOriginal: () => void;
  reset: () => void;

  // 色指定による背景除去
  setSelectedColor: (color: RGBColor | null) => void;
  setColorTolerance: (tolerance: number) => void;

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

  // ペンツール操作
  addPenPoint: (point: PenPoint) => void;
  updatePenPoint: (index: number, point: PenPoint) => void;
  closePenPath: () => void;
  clearPenPath: () => void;
  setCurrentPenPoint: (point: PenPoint | null) => void;
  setIsManualMode: (isManual: boolean) => void;
}

export type EditorStore = EditorState & EditorActions;
