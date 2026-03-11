import { ConsoleManager, KairoUtils } from "@kairo-js/router";
import { KAIRO_DATAVAULT_SAVE_KEYS } from "../../../../constants/systems";
import type { RoleDefinition } from "../../../../data/roles";
import { BaseDefinitionRegistry } from "../BaseDefinitionRegistry";
import type { DefinitionManager } from "../DefinitionManager";
import { RoleDefinitionValidator } from "./RoleDefinitionValidator";

export type RoleCountMap = Record<string, number>;

export class RoleDefinitionRegistry extends BaseDefinitionRegistry<RoleDefinition> {
    private readonly _validator = RoleDefinitionValidator.create(this);
    private readonly roleCounts: RoleCountMap = {};

    private constructor(definitionManager: DefinitionManager) {
        super(definitionManager, "role");
        this.init();
    }

    public static create(definitionManager: DefinitionManager) {
        return new RoleDefinitionRegistry(definitionManager);
    }

    private async init() {
        KairoUtils.loadFromDataVault(KAIRO_DATAVAULT_SAVE_KEYS.ROLE_COMPOSITION)
            .then((loaded) => {
                const roleComposition: RoleCountMap =
                    typeof loaded === "string" ? JSON.parse(loaded) : {};

                for (const [roleId, amount] of Object.entries(roleComposition)) {
                    if (amount > 0) {
                        this.roleCounts[roleId] = amount;
                    }
                }
            })
            .catch((err) => {
                ConsoleManager.warn(
                    `[RoleDefinitionRegistry] Failed to load role composition: ${err}`,
                );
            });
    }

    protected get validator() {
        return this._validator;
    }

    public getDefinitionManager(): DefinitionManager {
        return this.definitionManager;
    }

    public getRoleCount(roleId: string): number {
        return this.roleCounts[roleId] ?? 0;
    }

    public getAllRoleCounts(): Readonly<RoleCountMap> {
        return { ...this.roleCounts };
    }

    public getEnabledRoleIds(): string[] {
        return Object.keys(this.roleCounts);
    }

    public getEnabledRoles(): RoleDefinition[] {
        return Object.entries(this.roleCounts)
            .map(([roleId]) => this.getById(roleId))
            .filter((r): r is RoleDefinition => r !== undefined);
    }

    public setRoleCount(roleId: string, amount: number): void {
        if (amount <= 0) {
            delete this.roleCounts[roleId];
            return;
        }

        this.roleCounts[roleId] = amount;
    }

    public setAllRoleCounts(counts: Record<string, number>): void {
        for (const key of Object.keys(this.roleCounts)) {
            delete this.roleCounts[key];
        }

        for (const [roleId, amount] of Object.entries(counts)) {
            if (amount > 0) {
                this.roleCounts[roleId] = amount;
            }
        }

        KairoUtils.saveToDataVault(
            KAIRO_DATAVAULT_SAVE_KEYS.ROLE_COMPOSITION,
            JSON.stringify(this.roleCounts),
        );
    }
}
