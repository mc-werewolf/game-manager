import type { FactionDefinition } from "../../../../data/factions";
import type { RoleDefinition } from "../../../../data/roles";
import type { DefinitionManager } from "../DefinitionManager";

export class RoleComparator {
    private constructor(private readonly definitionManager: DefinitionManager) {}

    public static create(definitionManager: DefinitionManager): RoleComparator {
        return new RoleComparator(definitionManager);
    }

    public compare(a: RoleDefinition, b: RoleDefinition): number {
        // 1. 陣営順
        const aFaction = this.definitionManager.getDefinitionById<FactionDefinition>(
            "faction",
            a.factionId,
        );
        const bFaction = this.definitionManager.getDefinitionById<FactionDefinition>(
            "faction",
            b.factionId,
        );

        if (aFaction === undefined && bFaction !== undefined) return 1;
        if (aFaction !== undefined && bFaction === undefined) return -1;
        if (aFaction !== undefined && bFaction !== undefined) {
            const diff = aFaction.sortIndex - bFaction.sortIndex;
            if (diff !== 0) return diff;
        }

        // 2. 狂人・非狂人
        const aIsMad = a.isExcludedFromSurvivalCheck === true ? 1 : 0;
        const bIsMad = b.isExcludedFromSurvivalCheck === true ? 1 : 0;
        if (aIsMad !== bIsMad) return aIsMad - bIsMad;

        // 4. sortIndex
        return a.sortIndex - b.sortIndex;
    }
    public sort(roles: readonly RoleDefinition[]): RoleDefinition[] {
        return [...roles].sort((a, b) => this.compare(a, b));
    }
}
