import { world, type Player } from "@minecraft/server";
import { clearPlayerItems } from "./playerItems";
import { getWorldPlayers, type GameStartPlayer } from "./playerIdentity";
import { tr } from "../ui/text";

const TITLE_KEY = "werewolf-gamemanager.game.start.presentation.title";
const SUBTITLE_KEY = "werewolf-gamemanager.game.start.presentation.subtitle";
const TITLE_RAWTEXT_COMMAND = `titleraw @a title {"rawtext":[{"translate":"${TITLE_KEY}"}]}`;
const SUBTITLE_RAWTEXT_COMMAND = `titleraw @a subtitle {"rawtext":[{"translate":"${SUBTITLE_KEY}"}]}`;

export function playGameStartPresentation(players: readonly GameStartPlayer[]): void {
    clearGameStartInventories(players);
    showGameStartTitle();
    playGameStartSound();
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
            player.onScreenDisplay.setTitle(tr(TITLE_KEY), {
                subtitle: tr(SUBTITLE_KEY),
                fadeInDuration: 0,
                stayDuration: 100,
                fadeOutDuration: 20,
            });
        } catch (err) {
            console.warn("[game-manager] Failed to show game start title:", err);
        }
    }

    runOverworldCommand("title @a times 0 100 20");
    runOverworldCommand(SUBTITLE_RAWTEXT_COMMAND);
    runOverworldCommand(TITLE_RAWTEXT_COMMAND);
}

function playGameStartSound(): void {
    for (const player of getWorldPlayers()) {
        try {
            player.playSound("mob.wolf.death");
        } catch (err) {
            console.warn("[game-manager] Failed to play game start sound:", err);
        }
    }
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
