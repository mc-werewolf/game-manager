import { type Player, ItemLockMode, ItemStack } from "@minecraft/server";
import {
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
    SPECTATE_REGISTER_ITEM,
    SPECTATE_REGISTER_ITEM_SLOT,
} from "../constants/items";
import { participationState } from "../state/participationState";

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

    if (participationState.isParticipating(player.id)) {
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

export function clearPlayerItems(player: Player): void {
    const container = player.getComponent("minecraft:inventory")?.container;
    if (!container) return;

    container.clearAll();
}
