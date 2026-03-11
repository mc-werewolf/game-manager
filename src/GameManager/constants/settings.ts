import type { InGameItem } from "../game/ingame/game/gameplay/ItemManager";

export const DEFAULT_SETTINGS = {
    VERBOSE_COUNTDOWN: true,
    GAME_PREPARATION_TIME: 10, // in seconds
};

export const IN_GAME_PLAYER_HELD_ITEMS: InGameItem[] = [
    {
        typeId: "minecraft:bow",
        slot: 0,
        amount: 1,
    },
    {
        typeId: "minecraft:arrow",
        slot: 9,
        amount: 1,
    },
];
