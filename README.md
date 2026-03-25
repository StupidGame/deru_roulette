# 出ちゃうルーレット

`roulette-config.json` で単語と特殊演出を設定できる、2語組み合わせルーレットの静的サイトです。

## 使い方

1. `index.html` をブラウザで開く
2. 画面の `JSON設定を読み込む` から `roulette-config.json` を選ぶ
3. `ルーレット開始` を押す

## JSON設定

```json
{
  "startWords": ["最初の単語", "候補2"],
  "endWords": ["最後の単語", "候補2"],
  "specialCombinations": [
    {
      "startWord": "最初の単語",
      "endWord": "最後の単語",
      "message": "表示したい演出メッセージ",
      "palette": ["#ff5d8f", "#5ef2ff", "#d8ff62"]
    }
  ]
}
```

- `startWords` から1つ選ばれます
- `endWords` から1つ選ばれます
- `specialCombinations` は `startWord` と `endWord` の完全一致で判定します
- `palette` は紙吹雪の色です
