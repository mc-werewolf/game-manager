# Modding Runtime 仕様草案

## 目的

Minecraft Werewolf は「改造可能であること」を中核価値にする。

統合版 Minecraft の通常のアドオンは、別アドオンから柔軟に改造される前提ではない。
このプロジェクトでは Kairo/router を使い、外部アドオンが役職・スキル・設定・フェーズ・イベントを追加、
変更、削除、置換できる modding runtime を game-manager 上に構築する。

目指す体験は Among Us の mod 文化に近い。

- 役職を追加できる
- スキルを追加・変更・削除できる
- フェーズやゲームイベントを追加・変更・削除できる
- 既存役職や既存スキルに hook して、追加効果・妨害・置換を実装できる
- 設定項目を外部アドオンが追加し、その設定値でゲーム進行を変えられる

---

## 基本方針

`werewolf-gamemanager` は「人狼ゲームの閉じた実装」ではなく、
**人狼用 modding runtime / orchestration layer** として振る舞う。

game-manager が知るべきもの:

- player
- game state
- phase
- turn
- alive/dead
- faction
- role registration
- skill registration
- skill timing
- target selection
- action application
- setting registry
- win condition
- priority
- visibility
- message

game-manager が個別に知るべきでないもの:

- 占い師
- 霊媒師
- 騎士
- 人狼
- 妖狐
- 狼憑き
- 占い
- 呪殺
- 護衛
- 襲撃

個別役職・個別スキル・個別ルールの意味は `vanilla-pack` や追加役職パックが持つ。

---

## 名前空間

world に複数のミニゲームが同居する可能性があるため、API / event / skill id に
汎用的な `game:` prefix は使わない。

基本 prefix は `werewolf:` とする。

例:

```text
werewolf:registerRole
werewolf:registerFaction
werewolf:registerSkill
werewolf:registerSetting
werewolf:registerPhase
werewolf:resolveSkill
werewolf:resolveGameConfig
werewolf:skillUsed
werewolf:skillResolved
werewolf:actionApplied
werewolf:playerKilled
```

`mc-werewolf:` は、より強いブランド prefix が必要になった場合の候補として残す。
通常の API / event 名は短さと可読性を優先して `werewolf:` を使う。

---

## 責務分離

### werewolf-gamemanager

- registry を持つ
- 設定 UI を表示する
- 設定値を保持する
- `kairo-database` に設定値を保存・復元する
- ゲーム開始時に config snapshot を確定する
- phase を進行する
- skill の発動タイミングを管理する
- target selection を実行する
- skill resolution pipeline を実行する
- action を適用する
- addonEvents で観測用イベントを通知する

### vanilla-pack / additional roles / third-party addons

- role / faction / skill / setting / phase / event patch を登録する
- skill handler の実体を持つ
- setting の意味づけを持つ
- GameManager の phase / skill / action に hook して改造する
- 他 addon が定義した skill を置換・wrap できる

---

## Registry Model

game-manager は複数の registry を持つ。

```text
RoleRegistry
FactionRegistry
SkillRegistry
SettingRegistry
PhaseRegistry
ActionRegistry
GameEventRegistry
```

各 registry entry は、登録元 addon を保持する。

```typescript
type RegistryEntryBase = {
    id: string;
    addonId: string;
    enabled: boolean;
    priority?: number;
};
```

同一 id の扱いは registry ごとに明示する。

- `add`: 未登録 id を追加する
- `replace`: 既存 id の entry を置き換える
- `patch`: 既存 id の一部を変更する
- `disable`: 既存 id を無効化する
- `wrap`: 既存 id の解決処理を包む

単純な上書きは禁止する。
既存要素を変更する場合は operation として明示する。

---

## Operation Model

外部アドオンは registry entry を直接変更しない。
game-manager が公開する API に operation を送る。

```typescript
type RegistryOperation<TEntry, TPatch = Partial<TEntry>> =
    | { op: "add"; entry: TEntry }
    | { op: "replace"; targetId: string; entry: TEntry; priority?: number }
    | { op: "patch"; targetId: string; patch: TPatch; priority?: number }
    | { op: "disable"; targetId: string; priority?: number }
    | { op: "wrap"; targetId: string; wrapper: WrapperDefinition; priority?: number };
```

operation は addon activation 後に game-manager へ登録される。
最終的な解決順は game-manager が `priority` と依存関係から決める。

priority の基本方針:

- 数値が大きいほど強い
- 同 priority の場合は addonId の辞書順など決定的な順序にする
- 解決結果はログまたは UI で確認できるようにする

---

## Skill Model

skill は role に紐づくが、game-manager は skill の意味を知らない。

```typescript
type SkillDefinition = {
    id: string;
    name: string;
    description?: string;
    roleId?: string;
    phaseId?: string;
    timing?: string;
    target?: TargetRule;
    handler: SkillHandlerRef;
    cooldownTicks?: number;
    uses?: number;
    priority?: number;
    tags?: string[];
};

type SkillHandlerRef = {
    addonId: string;
    apiName: string;
};
```

`handler` は関数そのものではなく、`addonId + apiName` の参照にする。
game-manager は発動時に `router.request(handler.addonId, handler.apiName, context)` を呼ぶ。

これにより、skill の処理は外部アドオン側に置ける。

---

## Skill Resolution

skill 発動時、game-manager は `werewolf:resolveSkill` 相当の汎用 pipeline を通す。

処理イメージ:

```text
phase / timing が skill 発動を要求
  |
  |-- target selection
  |
  |-- skill entry を取得
  |
  |-- disable / replace / patch / wrap を解決
  |
  |-- before hooks
  |
  |-- wrapper chain
  |     |
  |     |-- original skill handler
  |     |
  |     `-- wrapper が result/actions を加工
  |
  |-- after hooks
  |
  |-- actions を適用
  |
  `-- addonEvents を emit
```

`cancel` は発動不能、対象無効、妨害などの中断用途に寄せる。
通常の改造は result/actions の変更・追加で表現する。

### 置換

B addon が A addon の skill を完全に置き換える例:

```typescript
await router.request("werewolf-gamemanager", "werewolf:registerSkillOperation", {
    op: "replace",
    targetId: "vanilla:divination",
    entry: {
        id: "vanilla:divination",
        name: "占い",
        roleId: "vanilla:seer",
        phaseId: "vanilla:night",
        handler: {
            addonId: "b-addon",
            apiName: "b:resolveDivination",
        },
    },
    priority: 50,
});
```

### wrap

B addon が A addon の結果を呼び出して加工する例:

```typescript
await router.request("werewolf-gamemanager", "werewolf:registerSkillOperation", {
    op: "wrap",
    targetId: "vanilla:divination",
    wrapper: {
        id: "b:wrapDivination",
        handler: {
            addonId: "b-addon",
            apiName: "b:wrapDivination",
        },
    },
    priority: 50,
});
```

wrapper handler には original result または original を呼ぶための delegate 情報を渡す。
どちらにするかは実装時に決める。

候補:

```typescript
type SkillWrapperContext = {
    skillId: string;
    actorId: string;
    targetIds: string[];
    snapshot: GameConfigSnapshot;
    originalResult?: SkillResult;
};
```

または:

```typescript
type SkillWrapperContext = {
    skillId: string;
    actorId: string;
    targetIds: string[];
    snapshot: GameConfigSnapshot;
    callOriginal: true;
};
```

Script API 上で関数を直接渡せないため、`callOriginal` は game-manager 側の再入可能 API として表現する必要がある。
初期実装では `originalResult` を先に計算して wrapper に渡す方式が簡単。

---

## GameAction Model

skill handler は直接 game state を破壊的に変更しない。
基本的には `GameAction[]` を返し、game-manager が適用する。

```typescript
type SkillResult = {
    actions: GameAction[];
    messages?: MessageGameAction[];
    metadata?: Record<string, unknown>;
};

type GameAction =
    | KillGameAction
    | ProtectGameAction
    | RevealGameAction
    | SetStatusGameAction
    | SendMessageGameAction
    | CustomGameAction;
```

例:

```typescript
type KillGameAction = {
    type: "kill";
    targetId: string;
    reason?: string;
};

type RevealGameAction = {
    type: "reveal";
    toPlayerId: string;
    targetId: string;
    key: string;
    value: unknown;
};
```

game-manager は action の適用責務を持つ。
ただし「なぜその action が発生したか」は外部 skill 側の責務にする。

custom action は将来の拡張用。
最初から無制限に許すと game-manager が解釈できないため、初期実装では logging のみ、または専用 hook へ流す。

---

## Role Traits

外部 skill 同士が参照できる情報として、role には traits / tags を持たせる。

```typescript
type RoleDefinition = {
    id: string;
    name: string;
    faction: string;
    traits?: Record<string, unknown>;
    tags?: string[];
};
```

例:

```typescript
{
    id: "third-party:wolf-possessed",
    name: "狼憑き",
    faction: "village",
    traits: {
        "vanilla:divinationResult": "werewolf",
    },
}
```

game-manager は `vanilla:divinationResult` の意味を知らない。
vanilla-pack の占い skill がこの trait を読んで結果を決める。

---

## Setting Model

設定項目も外部アドオンが登録する。

game-manager が持つ責務:

- setting definition の registry
- 設定 UI
- 選択状態
- database 保存・復元
- game start 時の snapshot 作成

外部アドオンが持つ責務:

- setting definition の登録
- setting value の意味づけ
- setting value に応じた skill / phase / event / action の変更

```typescript
type SettingDefinition =
    | ToggleSettingDefinition
    | SliderSettingDefinition
    | DropdownSettingDefinition;

type SettingBase = {
    id: string;
    name: string;
    description?: string;
    category?: string;
    order?: number;
};

type ToggleSettingDefinition = SettingBase & {
    type: "toggle";
    defaultValue: boolean;
};

type SliderSettingDefinition = SettingBase & {
    type: "slider";
    min: number;
    max: number;
    step: number;
    defaultValue: number;
};

type DropdownSettingDefinition = SettingBase & {
    type: "dropdown";
    options: { value: string; label: string }[];
    defaultValue: string;
};
```

例:

```typescript
await router.request("werewolf-gamemanager", "werewolf:registerSetting", {
    id: "vanilla:seerShortensDay",
    name: "占い師がいる場合は昼を短縮",
    description: "占い師が編成に含まれる場合、昼フェーズの制限時間を短くします。",
    type: "toggle",
    defaultValue: false,
});
```

game-manager はこの設定の意味を知らない。
vanilla-pack が `werewolf:resolveGameConfig` などに hook し、設定値と役職編成を見て phase を patch する。

---

## Phase Model

phase も固定実装ではなく registry に置く。

```typescript
type PhaseDefinition = {
    id: string;
    name: string;
    order: number;
    durationTicks?: number;
    enterEvent?: string;
    tickEvent?: string;
    exitEvent?: string;
    tags?: string[];
};
```

vanilla-pack が標準 phase を登録する。

例:

```text
vanilla:preparation
vanilla:night
vanilla:day
vanilla:meeting
vanilla:result
```

追加アドオンは phase operation を送れる。

- `add`: 特殊 phase を挿入する
- `patch`: duration を変更する
- `disable`: phase を消す
- `replace`: phase の定義を差し替える

設定値に応じた phase 改変は `werewolf:resolveGameConfig` の hook で行う。

---

## Game Config Snapshot

ゲーム開始直前に、game-manager は registry と設定値から snapshot を作る。

```typescript
type GameConfigSnapshot = {
    settings: Record<string, unknown>;
    roles: Record<string, RoleDefinition>;
    factions: Record<string, FactionDefinition>;
    skills: Record<string, SkillDefinition>;
    phases: PhaseDefinition[];
    roleComposition: Record<string, number>;
};
```

snapshot はゲーム中の基準になる。
ゲーム中に registry が変わっても、進行中ゲームには原則反映しない。

反映したい場合は専用 operation が必要。
初期実装では「次ゲームから反映」とする。

---

## API 草案

startup で game-manager が登録する API:

```text
werewolf:registerRole
werewolf:registerFaction
werewolf:registerSkill
werewolf:registerSkillOperation
werewolf:registerSetting
werewolf:registerPhase
werewolf:registerPhaseOperation
werewolf:getSettings
werewolf:setSetting
werewolf:resetSettings
werewolf:resolveGameConfig
werewolf:resolveSkill
werewolf:applyActions
```

`resolveGameConfig`, `resolveSkill`, `applyActions` は hook point として重要。

---

## Event 草案

game-manager が emit する addonEvents:

```text
werewolf:settingsChanged
werewolf:gameConfigResolved
werewolf:beforeGameStart
werewolf:afterGameStart
werewolf:phaseStarted
werewolf:phaseTick
werewolf:phaseEnded
werewolf:skillRequested
werewolf:skillUsed
werewolf:skillResolved
werewolf:actionApplied
werewolf:playerKilled
werewolf:gameEnded
```

addonEvents は観測用を基本とする。
結果を変えたい場合は addonApi hook を使う。

---

## Persistence

game-manager は `kairo-database` に以下を保存する。

- setting values
- 前回の role composition
- 必要になれば preset

保存キー案:

```text
settings
role-composition
presets/{presetId}
```

設定定義そのものは保存しない。
definition は active addon から毎回登録される。
保存済み setting value に対応する definition が存在しない場合は、値を保持しても UI には表示しない。

---

## VanillaPack の位置づけ

vanilla-pack は「標準ルールを持つ外部アドオン」として扱う。

vanilla-pack が持つもの:

- 標準 role
- 標準 faction
- 標準 skill
- 標準 phase
- 標準 setting
- 標準 skill handler

game-manager は vanilla-pack を特別扱いしない。
vanilla-pack が無効なら、標準役職も標準 phase も登録されない。

将来的に最低限の phase がないとゲーム開始できない場合も、game-manager は
「必要な phase がないため開始不能」という validation error を出すだけにする。

---

## 実装ステップ案

1. API prefix を `game:` から `werewolf:` へ移行する
2. `SettingRegistry` と database 保存を実装する
3. `SkillDefinition` / `SkillRegistry` を実装する
4. `PhaseDefinition` / `PhaseRegistry` を実装する
5. `GameConfigSnapshot` を作る
6. `werewolf-module` に `defineSkill`, `defineSetting`, `definePhase` を追加する
7. vanilla-pack に標準 skill / setting / phase を移す
8. `resolveSkill` pipeline を実装する
9. `replace` / `wrap` / `disable` operation を段階的に追加する

最初から全 operation を完成させる必要はない。
ただし型と API は、後から replace/wrap を追加しても破綻しない形にしておく。

---

## Current Implementation Note

- `werewolf:registerSkillOperation` exists.
- Initial `patch` / `disable` / `replace` / `wrap` resolution runs inside `werewolf:resolveSkill`.
- Initial `wrap` computes the original `SkillResult` first and passes it as `SkillWrapperContext.originalResult`.