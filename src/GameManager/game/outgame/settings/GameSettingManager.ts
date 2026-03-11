import type { Player } from "@minecraft/server";
import { ROOT_SETTINGS, type SettingCategoryNode } from "../../../data/settings";
import { RoleCompositionManager } from "./RoleCompositionManager";
import { SettingTreeManager } from "./SettingTreeManager";
import { SettingUIManager } from "./SettingUIManager";
import type { OutGameManager } from "../OutGameManager";
import type { RoleDefinition } from "../../../data/roles";
import type { RoleCountMap } from "../../system/definitions/roles/RoleDefinitionRegistry";
import type { DefinitionType } from "../../system/definitions/DefinitionManager";

export class GameSettingManager {
    private readonly roleCompositionManager: RoleCompositionManager;
    private readonly settingTreeManager: SettingTreeManager;
    private readonly settingUIManager: SettingUIManager;
    private readonly rootSettingCategory: SettingCategoryNode;

    private constructor(private readonly outGameManager: OutGameManager) {
        this.roleCompositionManager = RoleCompositionManager.create(this);
        this.settingTreeManager = SettingTreeManager.create(this);
        this.settingUIManager = SettingUIManager.create(this);
        this.rootSettingCategory = ROOT_SETTINGS;
    }
    public static create(outGameManager: OutGameManager): GameSettingManager {
        return new GameSettingManager(outGameManager);
    }

    public async opneSettingsForm(player: Player): Promise<void> {
        return this.settingUIManager.open(player);
    }

    public async openFormRoleComposition(playerId: string): Promise<void> {
        return this.roleCompositionManager.open(playerId);
    }

    public getRoot(): SettingCategoryNode {
        return this.rootSettingCategory;
    }

    public compareRoleDefinitions(a: RoleDefinition, b: RoleDefinition): number {
        return this.outGameManager.compareRoleDefinitions(a, b);
    }

    public sortRoleDefinitions(roles: RoleDefinition[]): RoleDefinition[] {
        return this.outGameManager.sortRoleDefinitions(roles);
    }

    public getDefinitions<T>(type: DefinitionType): T[] {
        return this.outGameManager.getDefinitions<T>(type);
    }

    public getDefinitionsByAddon<T>(type: DefinitionType, addonId: string): T[] {
        return this.outGameManager.getDefinitionsByAddon<T>(type, addonId);
    }

    public getDefinitionsMap<T>(type: DefinitionType): Map<string, T[]> {
        return this.outGameManager.getDefinitionsMap<T>(type);
    }

    public getDefinitionById<T>(type: DefinitionType, id: string): T | undefined {
        return this.outGameManager.getDefinitionById<T>(type, id);
    }

    public getRoleCount(roleId: string): number {
        return this.outGameManager.getRoleCount(roleId);
    }

    public getAllRoleCounts(): Readonly<RoleCountMap> {
        return this.outGameManager.getAllRoleCounts();
    }

    public getEnabledRoleIds(): string[] {
        return this.outGameManager.getEnabledRoleIds();
    }

    public getEnabledRoles(): RoleDefinition[] {
        return this.outGameManager.getEnabledRoles();
    }

    public setRoleCount(roleId: string, amount: number): void {
        this.outGameManager.setRoleCount(roleId, amount);
    }

    public setAllRoleCounts(counts: Record<string, number>): void {
        this.outGameManager.setAllRoleCounts(counts);
    }
}
