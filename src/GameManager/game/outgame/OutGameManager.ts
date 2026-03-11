import { world, type Player } from "@minecraft/server";
import type { SystemManager } from "../SystemManager";
import { OutGameEventManager } from "./events/OutGameEventManager";
import { PlayerInitializer } from "./PlayerInitializer";
import { GameSettingManager } from "./settings/GameSettingManager";
import type { RoleDefinition } from "../../data/roles";
import type { DefinitionType } from "../system/definitions/DefinitionManager";
import type { RoleCountMap } from "../system/definitions/roles/RoleDefinitionRegistry";
import { KairoUtils } from "@kairo-js/router";

export class OutGameManager {
    private readonly gameSettingManager = GameSettingManager.create(this);
    private readonly outGameEventManager = OutGameEventManager.create(this);
    private readonly playerInitializer = PlayerInitializer.create(this);
    private constructor(private readonly systemManager: SystemManager) {
        this.init();
    }
    public static create(systemManager: SystemManager): OutGameManager {
        return new OutGameManager(systemManager);
    }

    public async init(): Promise<void> {
        world.gameRules.pvp = false;

        const players = world.getPlayers();
        const playersKairoData = await KairoUtils.getPlayersKairoData();

        const isSizuku86 = players.find((player) => player.name === "sizuku86") !== undefined;

        players
            .sort((a, b) => {
                const dataA = playersKairoData.find((data) => data.playerId === a.id);
                const dataB = playersKairoData.find((data) => data.playerId === b.id);
                if (!dataA || !dataB) return 0;
                return dataA.joinOrder - dataB.joinOrder;
            })
            .forEach((player, index) => {
                if (isSizuku86) this.initializePlayer(player, player.name === "sizuku86");
                else this.initializePlayer(player, index === 0);
            });
    }

    public startGame(): void {
        this.systemManager.startGame();
    }

    public getOutGameEventManager(): OutGameEventManager {
        return this.outGameEventManager;
    }

    public initializePlayer(player: Player, isHost: boolean): void {
        this.playerInitializer.initializePlayer(player, isHost);
    }

    public openSettingsForm(player: Player): void {
        this.gameSettingManager.opneSettingsForm(player);
    }

    public openFormRoleComposition(playerId: string): void {
        this.gameSettingManager.openFormRoleComposition(playerId);
    }

    public compareRoleDefinitions(a: RoleDefinition, b: RoleDefinition): number {
        return this.systemManager.compareRoleDefinitions(a, b);
    }

    public sortRoleDefinitions(roles: RoleDefinition[]): RoleDefinition[] {
        return this.systemManager.sortRoleDefinitions(roles);
    }

    public getDefinitions<T>(type: DefinitionType): T[] {
        return this.systemManager.getDefinitions<T>(type);
    }

    public getDefinitionsByAddon<T>(type: DefinitionType, addonId: string): T[] {
        return this.systemManager.getDefinitionsByAddon<T>(type, addonId);
    }

    public getDefinitionsMap<T>(type: DefinitionType): Map<string, T[]> {
        return this.systemManager.getDefinitionsMap<T>(type);
    }

    public getDefinitionById<T>(type: DefinitionType, id: string): T | undefined {
        return this.systemManager.getDefinitionById<T>(type, id);
    }

    public getRoleCount(roleId: string): number {
        return this.systemManager.getRoleCount(roleId);
    }

    public getAllRoleCounts(): Readonly<RoleCountMap> {
        return this.systemManager.getAllRoleCounts();
    }

    public getEnabledRoleIds(): string[] {
        return this.systemManager.getEnabledRoleIds();
    }

    public getEnabledRoles(): RoleDefinition[] {
        return this.systemManager.getEnabledRoles();
    }

    public setRoleCount(roleId: string, amount: number): void {
        this.systemManager.setRoleCount(roleId, amount);
    }

    public setAllRoleCounts(counts: Record<string, number>): void {
        this.systemManager.setAllRoleCounts(counts);
    }
}
