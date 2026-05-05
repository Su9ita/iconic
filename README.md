# iconic

画像から角丸アイコンを作成する Next.js アプリです。画像アップロード、背景除去、レイヤー編集、PNG/ICO 書き出しをブラウザ上で実行します。

## Web アプリとして公開する

Vercel にデプロイすると、ローカルで `npm run dev` を起動しなくても URL から開けます。

1. GitHub のこのリポジトリを Vercel に Import する
2. Framework Preset は `Next.js` を選ぶ
3. Build Command は `npm run build`
4. Output Directory は空欄のまま
5. Deploy を実行する

このアプリは `next.config.ts` で `Cross-Origin-Opener-Policy` と `Cross-Origin-Embedder-Policy` を設定しています。ブラウザ内 AI 背景除去で必要になるため、Vercel 以外に置く場合も同じ HTTP ヘッダーが必要です。

## ローカル開発

```bash
npm install
npm run dev
```

開発サーバー起動後、ブラウザで `http://localhost:3000` を開きます。

## 動作確認

```bash
npm run lint
npm run build
```

## 主な技術

- Next.js
- React
- Zustand
- Tailwind CSS
- @imgly/background-removal
