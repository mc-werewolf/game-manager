import type { StoredFaction } from "./faction";
import type { StoredPhase } from "./phase";
import type { StoredRole } from "./role";
import type { SettingValue } from "./setting";
import type { StoredSkill } from "./skill";

export type GameConfigSnapshot = {
    readonly settings: Record<string, SettingValue>;
    readonly roles: Record<string, StoredRole>;
    readonly factions: Record<string, StoredFaction>;
    readonly skills: Record<string, StoredSkill>;
    readonly phases: readonly StoredPhase[];
    readonly roleComposition: Record<string, number>;
};

