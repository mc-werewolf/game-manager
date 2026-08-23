# 携帯品システム 仕様

策定中のドラフト。決定済みの項目から記述し、未確定の項目は TODO として残す。

## 概要

プレイヤーが試合中に携帯する（持ち込む・支給される）アイテムを扱うシステム。
`SEASON_GACHA_SYSTEM.md` のガチャ排出物としての携帯品獲得や、役職ごとの支給品
など、複数の入手経路を想定する。

### 現状の実装

- `PlayerSeasonProfile.carriedItems: Record<string, SeasonCarriedItemRecord>` が
  既に存在する。参照: `src/types/playerProfile.ts`
- `SeasonCarriedItemRecord`（`itemId` / `name` / `color` / `addonId` / `count`）は、
  シーズン中に**どの携帯品が何回割り当てられたか**を記録する統計用の構造体であり、
  `SeasonRoleAssignmentRecord`（役職の割り当て回数統計）と同様の形。
- プロフィール画面には「最も割り当てられた携帯品」を表示する文言が既にある
  （`RP/texts/ja_JP.lang` の `werewolf-gamemanager.profile.topCarriedItems` 等）。
- 携帯品そのものの定義（種類・効果）、入手経路（ガチャ／役職支給／購入など）は
  未策定。

## TODO（優先度別）

### 優先度 S（携帯品システムの根幹）

- [ ] 携帯品とは何か（試合中に使える道具か、見た目だけの装飾品か、両方あるか）
- [ ] 入手経路（ガチャのみか、役職固定支給や実績報酬もあるか）
- [ ] 効果がある場合、ゲームバランスへの影響範囲（陣営・役職ごとの公平性）

### 優先度 A（連動・拡張）

- [ ] `SEASON_GACHA_SYSTEM.md`・`MONEY_SYSTEM.md` との連動方法
- [ ] 役職ごとに携帯品を上書き・追加できる拡張可能な設計にするか
      （`TIER_SYSTEM.md` の役職拡張方針と同様の考え方が必要か）
- [ ] シーズン跨ぎでの携帯品の扱い（引き継ぎ／失効／統計のみリセット）

### 優先度 B（体験・UI）

- [ ] 携帯品の選択・装備 UI
- [ ] プロフィール画面での表示内容（既存の `topCarriedItems` 表示の拡張要否）
