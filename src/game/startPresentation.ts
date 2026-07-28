import { world, type Player } from "@minecraft/server";
import { clearPlayerItems } from "./playerItems";
import { getWorldPlayers, type GameStartPlayer } from "./playerIdentity";

const TITLE_TEXT = "\u00a74\u30de\u30a4\u30af\u30e9\u4eba\u72fc \u00a7f/ \u00a74Minecraft Werewolf";
const SUBTITLE_TEXT = "created by sizuku86";

export function playGameStartPresentation(players: readonly GameStartPlayer[]): void {
    clearGameStartInventories(players);
    showGameStartTitle();
    fadeGameStartCamera();
}

function clearGameStartInventories(players: readonly GameStartPlayer[]): void {
    const seenPlayers = new Set<Player>();
    for (const player of players) {
        if (!player.player || seenPlayers.has(player.player)) continue;
        seenPlayers.add(player.player);
        clearPlayerItems(player.player);
    }

    runOverworldCommand("clear @a");
}

function showGameStartTitle(): void {
    for (const player of getWorldPlayers()) {
        try {
            player.onScreenDisplay.setTitle(TITLE_TEXT, {
                subtitle: SUBTITLE_TEXT,
                fadeInDuration: 0,
                stayDuration: 100,
                fadeOutDuration: 20,
            });
        } catch (err) {
            console.warn("[game-manager] Failed to show game start title:", err);
        }
    }

    runOverworldCommand("title @a times 0 100 20");
    runOverworldCommand(`title @a subtitle ${SUBTITLE_TEXT}`);
    runOverworldCommand(`title @a title ${TITLE_TEXT}`);
}

function fadeGameStartCamera(): void {
    runOverworldCommand("inputpermission set @a camera enabled");
    runOverworldCommand("camera @a fade time 2 1 1 color 0 0 0");
}

function runOverworldCommand(command: string): void {
    try {
        world.getDimension("overworld").runCommand(command);
    } catch (err) {
        console.warn(`[game-manager] Failed to run command "${command}":`, err);
    }
}
