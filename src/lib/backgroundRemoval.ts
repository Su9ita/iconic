import { removeBackground as imglyRemoveBackground } from "@imgly/background-removal";

export interface RemovalProgress {
  progress: number;
  message: string;
}

export type ProgressCallback = (info: RemovalProgress) => void;

/**
 * ブラウザ内AIで背景を除去
 */
export async function removeBackgroundAI(
  imageSource: string | Blob | HTMLImageElement,
  onProgress?: ProgressCallback
): Promise<Blob> {
  // HTMLImageElementの場合はsrcを使用
  let source: string | Blob;
  if (imageSource instanceof HTMLImageElement) {
    source = imageSource.src;
  } else {
    source = imageSource;
  }

  const blob = await imglyRemoveBackground(source, {
    progress: (key, current, total) => {
      if (onProgress && total > 0) {
        const progress = current / total;
        let message = "処理中...";

        if (key.includes("fetch") || key.includes("download")) {
          message = "AIモデルをダウンロード中...";
        } else if (key.includes("compute") || key.includes("inference")) {
          message = "背景を検出中...";
        } else if (key.includes("encode") || key.includes("decode")) {
          message = "画像を処理中...";
        }

        onProgress({ progress, message });
      }
    },
  });

  return blob;
}

/**
 * remove.bg APIで背景を除去
 */
export async function removeBackgroundAPI(
  imageSource: string | Blob | HTMLImageElement,
  apiKey: string,
  onProgress?: ProgressCallback
): Promise<Blob> {
  onProgress?.({ progress: 0.1, message: "APIに接続中..." });

  // HTMLImageElementまたはdata URLの場合はBlobに変換
  let imageBlob: Blob;

  if (imageSource instanceof HTMLImageElement) {
    const canvas = document.createElement("canvas");
    canvas.width = imageSource.naturalWidth;
    canvas.height = imageSource.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(imageSource, 0, 0);
    imageBlob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), "image/png");
    });
  } else if (typeof imageSource === "string") {
    // data URLの場合
    const response = await fetch(imageSource);
    imageBlob = await response.blob();
  } else {
    imageBlob = imageSource;
  }

  onProgress?.({ progress: 0.3, message: "画像を送信中..." });

  const formData = new FormData();
  formData.append("image_file", imageBlob);
  formData.append("size", "auto");

  const response = await fetch("https://api.remove.bg/v1.0/removebg", {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
    },
    body: formData,
  });

  onProgress?.({ progress: 0.8, message: "結果を取得中..." });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.errors?.[0]?.title || `API error: ${response.status}`
    );
  }

  onProgress?.({ progress: 1, message: "完了" });

  return await response.blob();
}

/**
 * BlobをオブジェクトURLに変換
 */
export function blobToObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

/**
 * オブジェクトURLを解放
 */
export function revokeObjectUrl(url: string): void {
  URL.revokeObjectURL(url);
}
