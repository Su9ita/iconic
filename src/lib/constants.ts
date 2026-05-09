/**
 * iconic 共通定数
 */

// 編集キャンバス（ワークスペース）
export const WORKSPACE_SIZE = 640; // 編集用キャンバスサイズ

// アイコン出力領域
export const ICON_SIZE = 512; // アイコンの最終出力サイズ
export const ICON_PADDING = 25; // squircle内側余白
export const SQUIRCLE_SIZE = ICON_SIZE - ICON_PADDING * 2; // 462px

// 角丸の曲率
export const ROUNDNESS = 0.8;

// クリッピング設定
export const CLIP_MIN_SIZE = 256; // 最小クリップサイズ
export const CLIP_MAX_SIZE = 640; // 最大クリップサイズ
export const CLIP_DEFAULT_SIZE = 512; // デフォルトクリップサイズ

// squircle枠のオフセット（640pxキャンバス内での位置）
export const SQUIRCLE_OFFSET = (WORKSPACE_SIZE - ICON_SIZE) / 2; // 64px
