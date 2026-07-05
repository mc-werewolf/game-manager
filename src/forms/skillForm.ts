import type { Player } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { router } from "@kairo-js/router";
import { T } from "../constants/translate";
import { getCurrentGameState } from "../state/gameState";
import type { StoredSkill } from "../types/skill";
import type { SkillResult } from "../types/skillRuntime";
import { tr } from "../ui/text";

export async function openSkillForm(player: Player): Promise<void> {
    const state = getCurrentGameState();
    const playerState = state?.players[player.id];
    if (!state || !playerState) {
        player.sendMessage(tr(T.skill.notStarted));
        return;
    }
    if (state.status === "ended") {
        player.sendMessage(tr(T.skill.ended));
        return;
    }
    if (!playerState.isAlive) {
        player.sendMessage(tr(T.skill.dead));
        return;
    }

    const skills = Object.values(state.snapshot.skills)
        .filter((skill) => skill.roleId === playerState.roleId)
        .sort(compareSkills);

    if (skills.length === 0) {
        player.sendMessage(tr(T.skill.empty));
        return;
    }

    const skill = await selectSkill(player, skills);
    if (!skill) return;

    const targetIds = await selectTargets(player, skill);
    if (!targetIds) return;

    const result = await router.request<SkillResult>("werewolf-gamemanager", "werewolf:resolveSkill", {
        skillId: skill.skillId,
        actorId: player.id,
        targetIds,
    }).catch((err) => {
        player.sendMessage(tr(err instanceof Error ? err.message : T.skill.failed));
        return undefined;
    });
    if (!result) return;
    if (isCanceledResult(result)) {
        player.sendMessage(tr(T.skill.canceled));
    }
}

async function selectSkill(player: Player, skills: StoredSkill[]): Promise<StoredSkill | undefined> {
    const form = new ActionFormData()
        .title(tr(T.skill.title))
        .body(tr(T.skill.selectBody));

    for (const skill of skills) {
        form.button(tr(skill.name));
    }

    const response = await form.show(player);
    if (response.canceled || response.selection === undefined) return undefined;
    return skills[response.selection];
}

async function selectTargets(player: Player, skill: StoredSkill): Promise<string[] | undefined> {
    const targetRule = getTargetRule(skill.target);
    const count = targetRule?.count ?? 0;
    if (count <= 0) return [];

    const state = getCurrentGameState();
    if (!state) return undefined;

    const candidates = Object.values(state.players)
        .filter((candidate) => {
            if (targetRule?.aliveOnly && !candidate.isAlive) return false;
            if (targetRule?.deadOnly && candidate.isAlive) return false;
            if (targetRule?.excludeSelf && candidate.playerId === player.id) return false;
            return true;
        })
        .sort((a, b) => a.name.localeCompare(b.name));

    if (candidates.length === 0) {
        player.sendMessage(tr(T.skill.noTargets));
        return undefined;
    }

    const form = new ActionFormData()
        .title(tr(skill.name))
        .body(tr(T.skill.targetBody));

    for (const candidate of candidates) {
        form.button(tr(candidate.name));
    }

    const response = await form.show(player);
    if (response.canceled || response.selection === undefined) return undefined;
    const selected = candidates[response.selection];
    return selected ? [selected.playerId] : undefined;
}

function compareSkills(a: StoredSkill, b: StoredSkill): number {
    const ap = a.priority ?? 0;
    const bp = b.priority ?? 0;
    if (ap !== bp) return bp - ap;
    return a.name.localeCompare(b.name);
}

function getTargetRule(target: unknown): { count?: number; aliveOnly?: boolean; deadOnly?: boolean; excludeSelf?: boolean } | undefined {
    if (!target || typeof target !== "object" || Array.isArray(target)) return undefined;
    return target as { count?: number; aliveOnly?: boolean; deadOnly?: boolean; excludeSelf?: boolean };
}

function isCanceledResult(value: unknown): value is { canceled: true } {
    return typeof value === "object" && value !== null && "canceled" in value;
}
