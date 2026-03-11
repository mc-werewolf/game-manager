import { KairoUtils, type KairoCommand, type KairoResponse } from "@kairo-js/router";
import type { RoleDefinition } from "../../../data/roles";
import type { SystemManager } from "../../SystemManager";
import { FactionDefinitionRegistry } from "./factions/FactionDefinitionRegistry";
import { RoleGroupDefinitionRegistry } from "./rolegroups/RoleGroupDefinitionRegistry";
import { RoleComparator } from "./roles/RoleComparator";
import { RoleDefinitionRegistry, type RoleCountMap } from "./roles/RoleDefinitionRegistry";
import { SettingDefinitionRegistry } from "./settings/SettingDefinitionRegistry";

export const definitionTypeValues = ["role", "faction", "roleGroup", "setting"] as const;
export type DefinitionType = (typeof definitionTypeValues)[number];

export class DefinitionManager {
    private readonly roleComparator = RoleComparator.create(this);
    private readonly roleDefinitionRegistry = RoleDefinitionRegistry.create(this);
    private readonly factionDefinitionRegistry = FactionDefinitionRegistry.create(this);
    private readonly roleGroupDefinitionRegistry = RoleGroupDefinitionRegistry.create(this);
    private readonly settingDefinitionRegistry = SettingDefinitionRegistry.create(this);
    private constructor(private readonly systemManager: SystemManager) {}
    public static create(systemManager: SystemManager): DefinitionManager {
        return new DefinitionManager(systemManager);
    }

    public async requestRegistrationDefinitions(command: KairoCommand): Promise<KairoResponse> {
        const definitionType: DefinitionType = command.data.definitionType;
        if (definitionType === undefined || !definitionTypeValues.includes(definitionType)) {
            return KairoUtils.buildKairoResponse({}, false);
        }

        const definitions: unknown[] = command.data.definitions;

        switch (definitionType) {
            case "role":
                return this.roleDefinitionRegistry.register(command.sourceAddonId, definitions);

            case "faction":
                return this.factionDefinitionRegistry.register(command.sourceAddonId, definitions);
            case "roleGroup":
                return this.roleGroupDefinitionRegistry.register(
                    command.sourceAddonId,
                    definitions,
                );
            case "setting":
                return this.settingDefinitionRegistry.register(command.sourceAddonId, definitions);
            default:
                return KairoUtils.buildKairoResponse({}, false);
        }
    }

    public compareRoleDefinitions(a: RoleDefinition, b: RoleDefinition): number {
        return this.roleComparator.compare(a, b);
    }

    public sortRoleDefinitions(roles: RoleDefinition[]): RoleDefinition[] {
        return this.roleComparator.sort(roles);
    }

    public getDefinitions<T>(type: DefinitionType): T[] {
        switch (type) {
            case "role":
                return this.roleDefinitionRegistry.getAll() as T[];
            case "faction":
                return this.factionDefinitionRegistry.getAll() as T[];
            case "roleGroup":
                return this.roleGroupDefinitionRegistry.getAll() as T[];
            case "setting":
                return this.settingDefinitionRegistry.getAll() as T[];
            default:
                return [];
        }
    }

    public getDefinitionsByAddon<T>(type: DefinitionType, addonId: string): T[] {
        switch (type) {
            case "role":
                return this.roleDefinitionRegistry.getByAddon(addonId) as T[];
            case "faction":
                return this.factionDefinitionRegistry.getByAddon(addonId) as T[];
            case "roleGroup":
                return this.roleGroupDefinitionRegistry.getByAddon(addonId) as T[];
            case "setting":
                return this.settingDefinitionRegistry.getByAddon(addonId) as T[];
            default:
                return [];
        }
    }

    public getDefinitionsMap<T>(type: DefinitionType): Map<string, T[]> {
        switch (type) {
            case "role":
                return this.roleDefinitionRegistry.getMap() as Map<string, T[]>;
            case "faction":
                return this.factionDefinitionRegistry.getMap() as Map<string, T[]>;
            case "roleGroup":
                return this.roleGroupDefinitionRegistry.getMap() as Map<string, T[]>;
            case "setting":
                return this.settingDefinitionRegistry.getMap() as Map<string, T[]>;
            default:
                return new Map();
        }
    }

    public getDefinitionById<T>(type: DefinitionType, id: string): T | undefined {
        switch (type) {
            case "role":
                return this.roleDefinitionRegistry.getById(id) as T | undefined;
            case "faction":
                return this.factionDefinitionRegistry.getById(id) as T | undefined;
            case "roleGroup":
                return this.roleGroupDefinitionRegistry.getById(id) as T | undefined;
            case "setting":
                return this.settingDefinitionRegistry.getById(id) as T | undefined;
            default:
                return undefined;
        }
    }

    public getRoleCount(roleId: string): number {
        return this.roleDefinitionRegistry.getRoleCount(roleId);
    }

    public getAllRoleCounts(): Readonly<RoleCountMap> {
        return this.roleDefinitionRegistry.getAllRoleCounts();
    }

    public getEnabledRoleIds(): string[] {
        return this.roleDefinitionRegistry.getEnabledRoleIds();
    }

    public getEnabledRoles(): RoleDefinition[] {
        return this.roleDefinitionRegistry.getEnabledRoles();
    }

    public setRoleCount(roleId: string, amount: number): void {
        this.roleDefinitionRegistry.setRoleCount(roleId, amount);
    }

    public setAllRoleCounts(counts: Record<string, number>): void {
        this.roleDefinitionRegistry.setAllRoleCounts(counts);
    }
}
