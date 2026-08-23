import { type Container, type Player, ItemLockMode, ItemStack } from "@minecraft/server";
import { router } from "@kairo-js/router";
import {
    GAME_COMBAT_ARROW_ITEM,
    GAME_COMBAT_ARROW_ITEM_SLOT,
    GAME_COMBAT_BOW_ITEM,
    GAME_COMBAT_BOW_ITEM_SLOT,
    GAME_COMBAT_COOLDOWN_BOW_ITEM,
    GAME_FORCE_TERMINATOR_ITEM,
    GAME_FORCE_TERMINATOR_ITEM_SLOT,
    GAME_SETUP_ITEM,
    GAME_SETUP_ITEM_SLOT,
    GAME_START_ITEM,
    GAME_START_ITEM_SLOT,
    JOIN_REGISTER_ITEM,
    JOIN_REGISTER_ITEM_SLOT,
    PERSONAL_SETTINGS_ITEM,
    PERSONAL_SETTINGS_ITEM_SLOT,
    PROFILE_ITEM,
    PROFILE_ITEM_SLOT,
    SKILL_BOOK_ITEM,
    SKILL_BOOK_ITEM_SLOT,
    SKILL_COOLDOWN_ITEM,
    SPECTATE_REGISTER_ITEM,
    SPECTATE_REGISTER_ITEM_SLOT,
} from "../constants/items";
import { getGamePlayerId, getWorldPlayers } from "./playerIdentity";
import { getCurrentGameState } from "../state/gameState";
import { participationState } from "../state/participationState";
import { skillUsageState } from "../state/skillUsageState";
import type { GameState } from "../types/gameState";

const TICKS_PER_SECOND = 20;

let skillItemRefreshIntervalId: number | undefined;

export function giveSetupItems(player: Player): void {
    const container = player.getComponent("minecraft:inventory")?.container;
    if (!container) return;

    container.clearAll();

    const profileItem = new ItemStack(PROFILE_ITEM);
    profileItem.lockMode = ItemLockMode.slot;
    container.setItem(PROFILE_ITEM_SLOT, profileItem);

    const personalSettingsItem = new ItemStack(PERSONAL_SETTINGS_ITEM);
    personalSettingsItem.lockMode = ItemLockMode.slot;
    container.setItem(PERSONAL_SETTINGS_ITEM_SLOT, personalSettingsItem);

    const setupItem = new ItemStack(GAME_SETUP_ITEM);
    setupItem.lockMode = ItemLockMode.slot;
    container.setItem(GAME_SETUP_ITEM_SLOT, setupItem);

    if (participationState.isParticipating(getGamePlayerId(player))) {
        const spectateItem = new ItemStack(SPECTATE_REGISTER_ITEM);
        spectateItem.lockMode = ItemLockMode.inventory;
        container.setItem(SPECTATE_REGISTER_ITEM_SLOT, spectateItem);
    } else {
        const joinItem = new ItemStack(JOIN_REGISTER_ITEM);
        joinItem.lockMode = ItemLockMode.slot;
        container.setItem(JOIN_REGISTER_ITEM_SLOT, joinItem);
    }

    const startItem = new ItemStack(GAME_START_ITEM);
    startItem.lockMode = ItemLockMode.slot;
    container.setItem(GAME_START_ITEM_SLOT, startItem);
}

export function giveGameItems(player: Player): void {
    giveForceTerminatorItem(player);
    updateSkillItem(player);
    ensureSkillItemRefreshInterval();
}

export function giveForceTerminatorItem(player: Player): void {
    const container = player.getComponent("minecraft:inventory")?.container;
    if (!container) return;

    const forceTerminatorItem = new ItemStack(GAME_FORCE_TERMINATOR_ITEM);
    forceTerminatorItem.lockMode = ItemLockMode.inventory;
    container.setItem(GAME_FORCE_TERMINATOR_ITEM_SLOT, forceTerminatorItem);
}

export function giveCombatItems(player: Player): void {
    giveCombatBow(player);
    ensureCombatArrow(player);
}

export function giveCombatBow(player: Player): void {
    const container = player.getComponent("minecraft:inventory")?.container;
    if (!container) return;

    const bow = new ItemStack(GAME_COMBAT_BOW_ITEM);
    bow.lockMode = ItemLockMode.slot;
    container.setItem(GAME_COMBAT_BOW_ITEM_SLOT, bow);
}

export function giveCombatCooldownBow(player: Player, remainingSeconds: number): void {
    const container = player.getComponent("minecraft:inventory")?.container;
    if (!container) return;

    const amount = Math.max(1, Math.min(64, Math.ceil(remainingSeconds)));
    const nameTag = formatBowCooldownName(Math.ceil(remainingSeconds));
    const current = container.getItem(GAME_COMBAT_BOW_ITEM_SLOT);
    if (
        current?.typeId === GAME_COMBAT_COOLDOWN_BOW_ITEM
        && current.amount === amount
        && current.lockMode === ItemLockMode.slot
        && current.nameTag === nameTag
    ) {
        return;
    }

    const cooldownBow = new ItemStack(GAME_COMBAT_COOLDOWN_BOW_ITEM, amount);
    cooldownBow.lockMode = ItemLockMode.slot;
    cooldownBow.nameTag = nameTag;
    container.setItem(GAME_COMBAT_BOW_ITEM_SLOT, cooldownBow);
}

export function updateSkillItem(player: Player): void {
    const state = getCurrentGameState();
    const container = player.getComponent("minecraft:inventory")?.container;
    if (!container) return;

    if (state?.status !== "running" || !hasRegisteredSkill(state, player)) {
        removeSkillItem(container);
        return;
    }

    const remainingSeconds = state?.status === "running" ? getSkillCooldownSeconds(state, player) : undefined;
    if (remainingSeconds !== undefined) {
        const amount = Math.max(1, Math.min(64, remainingSeconds));
        const current = container.getItem(SKILL_BOOK_ITEM_SLOT);
        if (
            current?.typeId === SKILL_COOLDOWN_ITEM
            && current.amount === amount
            && current.lockMode === ItemLockMode.slot
            && current.nameTag === formatSkillCooldownName(remainingSeconds)
        ) {
            return;
        }

        const cooldownItem = new ItemStack(SKILL_COOLDOWN_ITEM, amount);
        cooldownItem.lockMode = ItemLockMode.slot;
        cooldownItem.nameTag = formatSkillCooldownName(remainingSeconds);
        container.setItem(SKILL_BOOK_ITEM_SLOT, cooldownItem);
        return;
    }

    const current = container.getItem(SKILL_BOOK_ITEM_SLOT);
    if (current?.typeId === SKILL_BOOK_ITEM && current.amount === 1 && current.lockMode === ItemLockMode.slot) return;

    const skillBookItem = new ItemStack(SKILL_BOOK_ITEM);
    skillBookItem.lockMode = ItemLockMode.slot;
    container.setItem(SKILL_BOOK_ITEM_SLOT, skillBookItem);
}

export function getCurrentSkillCooldownSeconds(player: Player): number | undefined {
    const state = getCurrentGameState();
    return state?.status === "running" ? getSkillCooldownSeconds(state, player) : undefined;
}

export function ensureCombatArrow(player: Player): void {
    const container = player.getComponent("minecraft:inventory")?.container;
    if (!container) return;

    const current = container.getItem(GAME_COMBAT_ARROW_ITEM_SLOT);
    if (current?.typeId === GAME_COMBAT_ARROW_ITEM && current.amount === 1 && current.lockMode === ItemLockMode.slot) return;

    const arrow = new ItemStack(GAME_COMBAT_ARROW_ITEM, 1);
    arrow.lockMode = ItemLockMode.slot;
    container.setItem(GAME_COMBAT_ARROW_ITEM_SLOT, arrow);
}

export function removeCombatItems(player: Player): void {
    const container = player.getComponent("minecraft:inventory")?.container;
    if (!container) return;

    const bow = container.getItem(GAME_COMBAT_BOW_ITEM_SLOT);
    if (bow?.typeId === GAME_COMBAT_BOW_ITEM || bow?.typeId === GAME_COMBAT_COOLDOWN_BOW_ITEM) {
        container.setItem(GAME_COMBAT_BOW_ITEM_SLOT, undefined);
    }

    const arrow = container.getItem(GAME_COMBAT_ARROW_ITEM_SLOT);
    if (arrow?.typeId === GAME_COMBAT_ARROW_ITEM) {
        container.setItem(GAME_COMBAT_ARROW_ITEM_SLOT, undefined);
    }
}

export function clearPlayerItems(player: Player): void {
    const container = player.getComponent("minecraft:inventory")?.container;
    if (!container) return;

    container.clearAll();
}

function ensureSkillItemRefreshInterval(): void {
    if (skillItemRefreshIntervalId !== undefined) return;
    skillItemRefreshIntervalId = router.runInterval(() => {
        const state = getCurrentGameState();
        if (state?.status !== "running") {
            clearSkillItemRefreshInterval();
            return;
        }
        for (const player of getWorldPlayers()) {
            updateSkillItem(player);
        }
    }, TICKS_PER_SECOND);
}

function clearSkillItemRefreshInterval(): void {
    if (skillItemRefreshIntervalId === undefined) return;
    router.clearRun(skillItemRefreshIntervalId);
    skillItemRefreshIntervalId = undefined;
}

function getSkillCooldownSeconds(state: GameState, player: Player): number | undefined {
    const playerId = getGamePlayerId(player);
    const playerState = state.players[playerId];
    if (!playerState?.isAlive) return undefined;

    let remainingTicks = 0;
    for (const skill of Object.values(state.snapshot.skills)) {
        if (skill.roleId !== playerState.roleId) continue;
        if (skill.cooldownTicks === undefined) continue;

        const lastUsedTick = skillUsageState.get(playerId, skill.skillId).lastUsedTick;
        if (lastUsedTick === undefined) continue;

        remainingTicks = Math.max(remainingTicks, skill.cooldownTicks - (router.currentTick - lastUsedTick));
    }

    return remainingTicks > 0 ? Math.ceil(remainingTicks / TICKS_PER_SECOND) : undefined;
}

function hasRegisteredSkill(state: GameState, player: Player): boolean {
    const playerState = state.players[getGamePlayerId(player)];
    if (!playerState?.isAlive) return false;
    return Object.values(state.snapshot.skills).some((skill) => skill.roleId === playerState.roleId);
}

function removeSkillItem(container: Container): void {
    const current = container.getItem(SKILL_BOOK_ITEM_SLOT);
    if (current?.typeId === SKILL_BOOK_ITEM || current?.typeId === SKILL_COOLDOWN_ITEM) {
        container.setItem(SKILL_BOOK_ITEM_SLOT, undefined);
    }
}

function formatBowCooldownName(remainingSeconds: number): string {
    return `§cBow Cooldown: ${remainingSeconds}s§r`;
}

function formatSkillCooldownName(remainingSeconds: number): string {
    return `§cSkill Cooldown: ${remainingSeconds}s§r`;
}
