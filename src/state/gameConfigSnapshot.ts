import { factionRegistry } from "../registry/factionRegistry";
import { phaseRegistry } from "../registry/phaseRegistry";
import { roleRegistry } from "../registry/roleRegistry";
import { skillRegistry } from "../registry/skillRegistry";
import { roleCountSettings } from "./roleCountSettings";
import { settingValues } from "./settingValues";
import type { GameConfigSnapshot } from "../types/gameConfigSnapshot";
import type { StoredFaction } from "../types/faction";
import type { StoredRole } from "../types/role";
import type { StoredSkill } from "../types/skill";

let currentSnapshot: GameConfigSnapshot | undefined;

export function createGameConfigSnapshot(): GameConfigSnapshot {
    return {
        settings: settingValues.getResolvedValues(),
        roles: mapToRecord(roleRegistry.getAll(), (role) => role.roleId),
        factions: mapToRecord(factionRegistry.getAll(), (faction) => faction.factionId),
        skills: mapToRecord(skillRegistry.getAll(), (skill) => skill.skillId),
        phases: phaseRegistry.getOrdered(),
        roleComposition: roleCountSettings.toRecord(),
    };
}

export function getCurrentGameConfigSnapshot(): GameConfigSnapshot | undefined {
    return currentSnapshot;
}

export function setCurrentGameConfigSnapshot(snapshot: GameConfigSnapshot): void {
    currentSnapshot = snapshot;
}

function mapToRecord<TValue extends StoredRole | StoredFaction | StoredSkill>(
    source: ReadonlyMap<string, TValue>,
    getKey: (value: TValue) => string,
): Record<string, TValue> {
    const record: Record<string, TValue> = {};
    for (const value of source.values()) {
        record[getKey(value)] = value;
    }
    return record;
}

