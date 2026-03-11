import { type Player } from "@minecraft/server";
import { InGameManager, type IngameConstants } from "./ingame/InGameManager";
import { OutGameManager } from "./outgame/OutGameManager";
import { SystemEventManager } from "./system/events/SystemEventManager";
import { ScriptEventReceiver } from "./system/ScriptEventReceiver";
import { WorldStateChangeBroadcaster } from "./system/WorldStateChangeBroadcaster";
import { WorldStateChanger } from "./system/WorldStateChanger";
import { SystemMonitor } from "./system/SystemMonitor";
import { DefinitionManager, type DefinitionType } from "./system/definitions/DefinitionManager";
import type { RoleCountMap } from "./system/definitions/roles/RoleDefinitionRegistry";
import type { RoleDefinition } from "../data/roles";
import { KairoUtils, type KairoCommand, type KairoResponse } from "@kairo-js/router";

export enum GameWorldState {
    OutGame = "OutGame",
    InGame = "InGame",
}

export class SystemManager {
    private readonly definitionManager = DefinitionManager.create(this);
    private readonly scriptEventReceiver = ScriptEventReceiver.create(this);
    private readonly systemEventManager = SystemEventManager.create(this);
    private readonly systemMonitor = SystemMonitor.create(this);
    private readonly worldStateChanger = WorldStateChanger.create(this);
    private readonly worldStateChangeBroadcaster = WorldStateChangeBroadcaster.create(this);
    private inGameManager: InGameManager | null = null;
    private outGameManager: OutGameManager | null = null;
    private currentWorldState: GameWorldState | null = null;

    private constructor() {}

    // アドオン初期化時の処理
    public init(): void {
        this.changeWorldState(GameWorldState.OutGame);
    }

    private static instance: SystemManager | null = null;

    public static getInstance(): SystemManager {
        if (this.instance === null) {
            this.instance = new SystemManager();
        }
        return this.instance;
    }

    public static destroy(): void {
        this.instance = null;
    }

    public async handleScriptEvent(data: KairoCommand): Promise<void | KairoResponse> {
        return this.scriptEventReceiver.handleScriptEvent(data);
    }

    public subscribeEvents(): void {
        this.systemEventManager.subscribeAll();
    }

    public unsubscribeEvents(): void {
        this.systemEventManager.unsubscribeAll();
    }

    public startGame(): void {
        if (this.currentWorldState !== GameWorldState.OutGame) return;
        this.changeWorldState(GameWorldState.InGame);
        this.inGameManager?.gameStart();
    }

    public resetGame(): void {
        if (this.currentWorldState !== GameWorldState.InGame) return;
        this.inGameManager?.gameReset();
        this.changeWorldState(GameWorldState.OutGame);
    }

    public changeWorldState(nextState: GameWorldState): void {
        this.worldStateChanger.change(nextState);
    }

    public getWorldState(): GameWorldState | null {
        return this.currentWorldState;
    }
    public setWorldState(state: GameWorldState): void {
        this.currentWorldState = state;
    }

    public getInGameManager(): InGameManager | null {
        return this.inGameManager;
    }
    public setInGameManager(v: InGameManager | null) {
        this.inGameManager = v;
    }

    public getOutGameManager(): OutGameManager | null {
        return this.outGameManager;
    }
    public setOutGameManager(v: OutGameManager | null) {
        this.outGameManager = v;
    }

    public createInGameManager(): InGameManager {
        return InGameManager.create(this);
    }

    public createOutGameManager(): OutGameManager {
        return OutGameManager.create(this);
    }

    public broadcastWorldStateChange(
        next: GameWorldState,
        ingameConstants: IngameConstants | null,
    ): void {
        this.worldStateChangeBroadcaster.broadcast(next, ingameConstants);
    }

    public openSettingsForm(player: Player): void {
        this.outGameManager?.openSettingsForm(player);
    }

    public openFormRoleComposition(playerId: string): void {
        this.outGameManager?.openFormRoleComposition(playerId);
    }

    public async requestRegistrationDefinitions(command: KairoCommand): Promise<KairoResponse> {
        return this.definitionManager.requestRegistrationDefinitions(command);
    }

    public getWerewolfGameDataDTO(): KairoResponse {
        if (!this.inGameManager)
            return KairoUtils.buildKairoResponse(
                {},
                false,
                "The game is not currently in progress.",
            );
        return this.inGameManager.getWerewolfGameDataDTO();
    }

    public monitorSystem(): void {
        this.systemMonitor.monitor();
    }

    public compareRoleDefinitions(a: RoleDefinition, b: RoleDefinition): number {
        return this.definitionManager.compareRoleDefinitions(a, b);
    }

    public sortRoleDefinitions(roles: RoleDefinition[]): RoleDefinition[] {
        return this.definitionManager.sortRoleDefinitions(roles);
    }

    public getDefinitions<T>(type: DefinitionType): T[] {
        return this.definitionManager.getDefinitions<T>(type);
    }

    public getDefinitionsByAddon<T>(type: DefinitionType, addonId: string): T[] {
        return this.definitionManager.getDefinitionsByAddon<T>(type, addonId);
    }

    public getDefinitionsMap<T>(type: DefinitionType): Map<string, T[]> {
        return this.definitionManager.getDefinitionsMap<T>(type);
    }

    public getDefinitionById<T>(type: DefinitionType, id: string): T | undefined {
        return this.definitionManager.getDefinitionById<T>(type, id);
    }

    public getRoleCount(roleId: string): number {
        return this.definitionManager.getRoleCount(roleId);
    }

    public getAllRoleCounts(): Readonly<RoleCountMap> {
        return this.definitionManager.getAllRoleCounts();
    }

    public getEnabledRoleIds(): string[] {
        return this.definitionManager.getEnabledRoleIds();
    }

    public getEnabledRoles(): RoleDefinition[] {
        return this.definitionManager.getEnabledRoles();
    }

    public setRoleCount(roleId: string, amount: number): void {
        this.definitionManager.setRoleCount(roleId, amount);
    }

    public setAllRoleCounts(counts: Record<string, number>): void {
        this.definitionManager.setAllRoleCounts(counts);
    }
}
