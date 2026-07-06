import type { StoredSkill } from "../types/skill";

const skills = new Map<string, StoredSkill>();

export const skillRegistry = {
    register(skill: StoredSkill): void {
        if (skills.has(skill.skillId)) {
            throw new Error(`[game-manager] Skill "${skill.skillId}" is already registered`);
        }
        skills.set(skill.skillId, skill);
    },

    get(skillId: string): StoredSkill | undefined {
        return skills.get(skillId);
    },

    getAll(): ReadonlyMap<string, StoredSkill> {
        return skills;
    },

    clear(): void {
        skills.clear();
    },
};

