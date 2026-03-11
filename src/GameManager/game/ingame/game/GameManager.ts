import { world, type RawMessage } from "@minecraft/server";
import { InGameManager } from "../InGameManager";
import { IntervalManager } from "../utils/IntervalManager";
import { ItemManager } from "./gameplay/ItemManager";
import { GameTerminationEvaluator } from "./gameplay/GameTerminationEvaluator";
import { ActionBarManager } from "./gameplay/ActionBarManager";
import { PlayerData } from "./gameplay/PlayerData";
import type { GameOutcome } from "../../../data/types/conditions";
import { defaultGameOutcomeRules, type GameOutcomeRule } from "../../../data/outcome";
import { MinecraftEffectTypes } from "@minecraft/vanilla-data";
import { GamePhase } from "../GamePhase";
import type { DefinitionType } from "../../system/definitions/DefinitionManager";
import type { RoleDefinition } from "../../../data/roles";

export interface ResolvedGameOutcome {
    type: "resolved";
    ruleId: string;
    outcome: GameOutcome;
    presentation: {
        title: RawMessage;
        message: RawMessage;
    };
}

export class GameManager {
    private readonly actionBarManager: ActionBarManager;
    private readonly intervalManager: IntervalManager;
    private readonly itemManager: ItemManager;
    private readonly gameTerminationEvaluator: GameTerminationEvaluator;

    private isRunning = false;
    private resolveFn: (() => void) | null = null;
    private rejectFn: ((reason?: any) => void) | null = null;

    private _gameResult: ResolvedGameOutcome | null = null;

    private constructor(private readonly inGameManager: InGameManager) {
        this.actionBarManager = ActionBarManager.create(this);
        this.intervalManager = IntervalManager.create();
        this.itemManager = ItemManager.create(this);
        this.gameTerminationEvaluator = GameTerminationEvaluator.create(this);
    }

    public static create(inGameManager: InGameManager): GameManager {
        return new GameManager(inGameManager);
    }

    public async startGameAsync(): Promise<void> {
        if (this.isRunning) return;
        this.isRunning = true;

        world.gameRules.pvp = true;

        this.inGameManager.setCurrentPhase(GamePhase.InGame);

        return new Promise<void>((resolve, reject) => {
            this.resolveFn = resolve;
            this.rejectFn = reject;

            this.intervalManager.tick.subscribe(this.onTickUpdate);
            this.intervalManager.second.subscribe(this.onSecondUpdate);
            this.intervalManager.startAll();
        });
    }

    public stopGame(): void {
        if (!this.isRunning) return;
        this.rejectFn?.(new Error("Game cancelled"));
        this.cleanup();
    }

    public finishGame(): void {
        if (!this.isRunning) return;
        this.resolveFn?.();
        this.cleanup();
    }

    private onTickUpdate = (): void => {
        if (!this.isRunning) return;
        this.inGameManager.getWerewolfGameDataManager().updateRemainingTicks();

        const players = world.getPlayers();
        const playersData = this.getPlayersData();

        this.actionBarManager.showActionBarToPlayers(players);
        this.itemManager.replaceItemToPlayers(players);

        // エフェクト付与 (仮)
        players.forEach((player) => {
            player.addEffect(MinecraftEffectTypes.Weakness, 2, {
                amplifier: 255,
                showParticles: false,
            });
            player.addEffect(MinecraftEffectTypes.Regeneration, 2, {
                amplifier: 255,
                showParticles: false,
            });
        });

        // 終了判定
        const result = this.gameTerminationEvaluator.evaluate(playersData);
        if (result.type === "none") return;

        this._gameResult = result;
        playersData.forEach((playerData) => {
            if (result.outcome.type === "victory") {
                playerData.isVictory = result.outcome.factionId === playerData.role?.factionId;
            }
        });

        this.finishGame();
    };

    private onSecondUpdate = (): void => {
        if (!this.isRunning) return;

        const playersData = this.getPlayersData();

        playersData.forEach((playerData) => {
            playerData.skillStates.forEach((skillState) => {
                if (skillState.cooldownRemaining > 0) {
                    skillState.cooldownRemaining -= 1;
                }
            });

            if (playerData.tmpArrowCooldown > 0) {
                playerData.tmpArrowCooldown--;
            }
        });
    };

    public get gameResult(): ResolvedGameOutcome | null {
        return this._gameResult;
    }

    private cleanup(): void {
        this.intervalManager.clearAll();
        this.isRunning = false;
        this.resolveFn = null;
        this.rejectFn = null;
    }

    public getPlayerData(playerId: string) {
        return this.inGameManager.getPlayerData(playerId);
    }

    public getPlayersData(): readonly PlayerData[] {
        return this.inGameManager.getPlayersData();
    }

    public getDefinitionsMap<T>(type: DefinitionType): ReadonlyMap<string, readonly T[]> {
        return this.inGameManager.getDefinitionsMap<T>(type);
    }

    public getDefinitions<T>(type: DefinitionType): readonly T[] {
        return this.inGameManager.getDefinitions<T>(type);
    }

    public getDefinitionsByAddon<T>(type: DefinitionType, addonId: string): readonly T[] {
        return this.inGameManager.getDefinitionsByAddon<T>(type, addonId);
    }

    public getDefinitionById<T extends { id: string }>(
        type: DefinitionType,
        id: string,
    ): T | undefined {
        return this.inGameManager.getDefinitionById<T>(type, id);
    }

    public getRoleCount(roleId: string): number {
        return this.inGameManager.getRoleCount(roleId);
    }

    public getEnabledRoleIds(): string[] {
        return this.inGameManager.getEnabledRoleIds();
    }

    public getEnabledRoles(): RoleDefinition[] {
        return this.inGameManager.getEnabledRoles();
    }

    public getDefaultOutcomeRules(): GameOutcomeRule[] {
        return defaultGameOutcomeRules;
    }

    public getRemainingTicks(): number {
        return this.inGameManager.getWerewolfGameDataManager().remainingTicks;
    }
}
