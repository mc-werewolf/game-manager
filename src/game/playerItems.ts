import { type Player, ItemLockMode, ItemStack } from "@minecraft/server";
import { GAME_SETUP_ITEM, GAME_SETUP_ITEM_SLOT, GAME_START_ITEM, GAME_START_ITEM_SLOT, JOIN_REGISTER_ITEM, JOIN_REGISTER_ITEM_SLOT, PLAYER_SKILL_ITEM, PLAYER_SKILL_ITEM_SLOT, SPECTATE_REGISTER_ITEM, SPECTATE_REGISTER_ITEM_SLOT } from "../constants/items";

export function giveSetupItems(player: Player): void {
    const container = player.getComponent("minecraft:inventory")?.container;
    if (!container) return;

    container.clearAll();

    const setupItem = new ItemStack(GAME_SETUP_ITEM);
    setupItem.lockMode = ItemLockMode.slot;
    container.setItem(GAME_SETUP_ITEM_SLOT, setupItem);

    const joinItem = new ItemStack(JOIN_REGISTER_ITEM);
    joinItem.lockMode = ItemLockMode.slot;
    container.setItem(JOIN_REGISTER_ITEM_SLOT, joinItem);

    const spectateItem = new ItemStack(SPECTATE_REGISTER_ITEM);
    spectateItem.lockMode = ItemLockMode.slot;
    container.setItem(SPECTATE_REGISTER_ITEM_SLOT, spectateItem);

    const startItem = new ItemStack(GAME_START_ITEM);
    startItem.lockMode = ItemLockMode.slot;
    container.setItem(GAME_START_ITEM_SLOT, startItem);
}

export function givePlayerSkillItem(player: Player): void {
    const container = player.getComponent("minecraft:inventory")?.container;
    if (!container) return;

    container.clearAll();

    const item = new ItemStack(PLAYER_SKILL_ITEM);
    item.lockMode = ItemLockMode.slot;
    container.setItem(PLAYER_SKILL_ITEM_SLOT, item);
}
