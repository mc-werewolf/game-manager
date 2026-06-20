# ダメージ・死亡パイプライン

## 設計方針

Minecraft のネイティブ死亡処理は使わない。
`beforeEvents.entityHurt` でダメージをキャンセルし、game-manager 独自の
死亡パイプラインに通すことで、外部アドオンが hook で介入できるようにする。

---

## 処理フロー

```
Minecraft: beforeEvents.entityHurt
  │
  ├─ ゲーム対象外（NPCなど）→ スルー（ネイティブに任せる）
  │
  └─ ゲームプレイヤー
       │
       ├─ 致死ダメージでない → ev.damage = 0 でキャンセル（ゲーム中は HP 管理しない）
       │
       └─ 致死ダメージ → ev.damage = 0 でキャンセル
              │
              └─ game-manager 内部で game:killPlayer API を呼ぶ
                     │
                     ├─ [hook: before] 騎士・ボディガード等が割り込む
                     │       フラグあり → ctx.cancel() で死をキャンセル
                     │
                     └─ フラグなし → 実際に kill 処理
                            └─ router.emit("game:playerDie", { playerId, ... })
```

---

## コードイメージ

### game-manager 側

```typescript
// addonActivate 内
router.beforeEvents.entityHurt.subscribe((ev) => {
    if (!isGamePlayer(ev.hurtEntity)) return;

    ev.damage = 0; // ネイティブダメージは常にキャンセル

    if (isLethal(ev.hurtEntity, ev.damage)) {
        // 非同期なので system.run でラップ
        system.run(async () => {
            await router.request("werewolf-gamemanager", "game:killPlayer", {
                playerId: ev.hurtEntity.id,
            });
        });
    }
});

// startup 内
ev.addonApi.register("game:killPlayer", async ({ playerId }) => {
    killPlayerActually(playerId);
    router.emit("game:playerDie", { playerId });
});
```

### 騎士（外部アドオン）側

```typescript
// startup 内
ev.addonApi.hook("werewolf-gamemanager", "game:killPlayer", {
    priority: 10,
    before: async (ctx) => {
        if (knightFlags.has(ctx.args.playerId)) {
            knightFlags.delete(ctx.args.playerId); // フラグ消費（1回限り）
            ctx.cancel({ protected: true });
        }
    },
});
```

---

## 致死判定

ゲーム中は HP をゲーム側で管理する（Minecraft の HP には依存しない）ため、
「致死ダメージかどうか」の判定ロジックは game-manager が保持する。

- ゲーム開始時にプレイヤーの HP を最大値に設定
- `beforeEvents.entityHurt` 時点で `entity.getComponent("health").currentValue <= damage`
  を見れば致死かどうか判定できる（ただし即死効果など要注意）

---

## game:playerDie ペイロード（暫定）

```typescript
type PlayerDiePayload = {
    playerId: string;
    roleId: string;       // 役職ID（外部アドオンがフィルタリングに使う）
    cause?: string;       // 死因（将来の拡張用）
};
```
