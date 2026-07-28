# Player Rank システム 仕様

策定中のドラフト。決定済みの項目から記述し、未確定の項目は TODO として残す。

## 概要

Player Rank は、シーズンをまたいで蓄積するプレイヤーの**累積成長**を表す仕組み。
`TIER_SYSTEM.md` で定義される Season Tier（勝敗・生存・陣営貢献など、シーズンごとに
リセットされる短期的な競技成績）とは独立した別物であり、両者のポイントは分離する。

> Season Tier のポイントは、Player Rank 用の score とは分離する。score は
> 個人スコア・累積成長（経験値など）に使い、Season Tier は勝敗・生存・陣営貢献・
> 短期的な競技成績を中心に計算する。（`TIER_SYSTEM.md` より）

Player Rank は競技的な強さの指標ではなく、**プレイ量・古参度を示す実績要素**
（「自慢」「これだけプレイした」の表明）として位置づける。そのため、
**ガチャの排出確率など、競技バランスに関わる要素には一切影響させない。**

シーズンをまたいでもリセットされない（永続的に積み上がる）。

### score の定義

score は試合中の行動によって獲得する行動点数。4 分類があり、各分類は
最大 3000pt、合計で最大 12000pt/試合。

```
score = pvpScore + skillScore + taskScore + reasoningScore
```

これは `TIER_SYSTEM.md`「10. MVP 判定（スコアベース）」で定義されている
`totalScore` と同じ形（4 分類・各 3000pt・合計 12000pt）。**Player Rank 用の
score は、この毎試合の `totalScore` を累積加算していく値**という前提で進める
（別物として個別に算出するわけではない）。各分類の具体的な獲得条件・ポイント
配分は後日決定する（`TIER_SYSTEM.md` 側の同 TODO と共通の課題）。

### Rank cap（プレイヤーランクの上限）

Rank が 1 つ上がるごとに報酬を用意する都合上、上限を無制限にはせず、
シーズンごとに拡張していく方式にする。

- Preseason（season1 開始前）の上限は **50**。
- Season1 開始（2027/1/1）と同時に +50 され、上限は **100** になる。
- 以降、シーズンが切り替わるたびに +50 されていく
  （season2 開始の 3/1 に 150、season3 開始の 5/1 に 200 ...）。

```
rankCap = 50 * (season + 1)
```

- `season` は `TIER_SYSTEM.md` のシーズン番号計算式をそのまま使う。ただし
  season1 開始前（preseason）は `season = 0` として扱う。

| 期間                       | season | rankCap |
| -------------------------- | -----: | ------: |
| ~2026/12/31（preseason）   |      0 |      50 |
| 2027/1 - 2027/2（season1） |      1 |     100 |
| 2027/3 - 2027/4（season2） |      2 |     150 |
| 2027/5 - 2027/6（season3） |      3 |     200 |
| 2027/7 - 2027/8（season4） |      4 |     250 |
| ...                        |    ... |     ... |

### 報酬

- Rank が 1 つ上がるごとに報酬を用意する（報酬内容は TBD）。

### ガチャ・Tier・お金機能との関係

- Player Rank は**ガチャの排出確率には影響しない**（確定）。
- Tier（Season Tier）・お金機能との連動有無は TODO。

### 現状の実装

- `PlayerProfile.playerRank: number` が既に存在する（初期値 `DEFAULT_PLAYER_RANK = 1`）。
  参照: `src/state/playerProfiles.ts`, `src/types/playerProfile.ts`
- **この既存実装は作りかけであるため、新仕様に合わせて作り直して良い**
  （後方互換を維持する必要はない）。
- score の算出ロジック・rank 上昇条件・cap 拡張処理・表示 UI は未実装。

## TODO（優先度別）

### 優先度 S（Player Rank の根幹）

- [ ] score の 4 分類（`pvpScore` / `skillScore` / `taskScore` /
      `reasoningScore`）が `TIER_SYSTEM.md` の MVP 用 `totalScore` と同一の値
      であることの最終確認、および算出ロジックの共通化方法
- [ ] 各分類の具体的な獲得条件・ポイント配分（後日決定、`TIER_SYSTEM.md` 側の
      TODO と共通）
- [ ] score → rank への変換ルール（1 rank あたりに必要な score 量）
- [ ] `rankCap` を超える score を獲得した場合の扱い
      （score 自体は超過分も保持しておき、次シーズンで cap が上がった瞬間に
      rank へ反映するのか／それとも cap で頭打ちにして超過分は切り捨てるのか）

### 優先度 A（バランス・連動）

- [ ] rank up 報酬の内容
- [ ] Tier（Season Tier）・お金機能との連動有無（ガチャとは無関係と確定済み）
- [ ] 既存 `playerRank` フィールドの作り直し方針（フィールド名・型を維持するか、
      score フィールドを新設するか）

### 優先度 B（体験・UI）

- [ ] rank 表示 UI（プロフィール画面等）
- [ ] rank アップ時の演出・通知
- [ ] cap 拡張タイミングでの UI 表現（「新しい上限が解放されました」等）
- [ ] rank と称号・実績の関係
