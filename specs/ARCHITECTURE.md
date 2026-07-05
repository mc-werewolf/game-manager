# game-manager アーキテクチャ

## 依存関係

```
kairo（インフラ）
  └─ kairo-database（永続化）
       └─ werewolf-gamemanager（ゲームループ・API 提供）  ← このパック
            ├─ vanilla-pack（村人・人狼・占い師など基本役職）
            ├─ additional-roles-*（追加役職パック）
            └─ 外部改造アドオン（誰でも作れる）
```

game-manager は kairo と database 以外に依存しない。役職・改造アドオンは
game-manager が公開する API・イベントを通じてゲームを拡張する。

---

## 拡張モデル

kairo-router が提供する3つの仕組みを使い分ける。

### 1. addonApi — 機能登録 / 呼び出し（双方向）

```typescript
// game-manager: API を定義する
ev.addonApi.register("werewolf:killPlayer", async ({ playerId }) => { ... });

// 外部アドオン: API を呼び出す
await router.request("werewolf-gamemanager", "werewolf:killPlayer", { playerId });
```

### 2. addonApi.hook — API への割り込み（インターセプト）

外部アドオンが game-manager のアクションを止めたり結果を変えたりできる。

```typescript
// 騎士アドオン（startup 内）: werewolf:killPlayer の前に割り込む
ev.addonApi.hook("werewolf-gamemanager", "werewolf:killPlayer", {
    priority: 10,           // 数値が大きいほど先に実行
    before: async (ctx) => {
        if (knightFlags.has(ctx.args.playerId)) {
            knightFlags.delete(ctx.args.playerId);
            ctx.cancel({ protected: true }); // kill をキャンセル
        }
    },
});
```

- `before`: 実行前に割り込む。`ctx.cancel(result)` で中断可能。
- `after`: 実行後に結果を書き換える。
- `rollback`: 後続処理が失敗したときの巻き戻し。
- `priority`: 複数フックの実行順を制御。

### 3. addonEvents — 一方向通知（fire-and-forget）

game-manager がゲーム状態の変化を外部に通知する。戻り値は不要。

```typescript
// game-manager: イベントを発信
router.emit("werewolf:playerKilled", { playerId, roleId });

// 外部アドオン: startup 内で購読を宣言
ev.addonEvents.on("werewolf-gamemanager", "werewolf:playerKilled", (payload) => { ... });
```

**addonEvents の購読は startup 内でのみ有効。** activation ハンドシェイク後に
`on()` を呼んでも kairo のルーティングテーブルに載らないため届かない。

---

## 外部アドオンが使える拡張ポイント（設計方針）

| やりたいこと             | 使う仕組み                      |
|--------------------------|-------------------------------|
| ゲーム状態を観察する       | `addonEvents.on()`            |
| ゲームアクションを止める    | `addonApi.hook()` の before   |
| 実行結果を書き換える        | `addonApi.hook()` の after    |
| 役職データを登録する        | `addonApi.register()` 経由    |
| 役職アドオンをさらに改造する | 役職パックの addonEvents を購読 |

---

## Minecraft イベントの一元管理

`router.beforeEvents.*` / `router.afterEvents.*`（Minecraft ネイティブイベント）は
**game-manager が一元的に subscribe する。**

外部アドオンは Minecraft ネイティブイベントを直接扱わず、game-manager の
API / hook / addonEvents を通じてゲームに関わる。これにより：

- ネイティブイベントの処理順が game-manager に集約されて予測しやすい
- 外部アドオンが直接 Minecraft イベントを触ることで起こる競合を防ぐ
