import { world } from "@minecraft/server";
import { router } from "@kairo-js/router";
import { giveSetupItems } from "./playerItems";
import { getWorldPlayers } from "./playerIdentity";
import { T } from "../constants/translate";
import { savePlayerProfiles } from "../persistence/gameManagerPersistence";
import { clearCurrentGameState } from "../state/gameState";
import { playerProfiles } from "../state/playerProfiles";
import type { GameState } from "../types/gameState";
import { rawtext, text, tr } from "../ui/text";

export function endGame(state: GameState, winnerFactionIds: readonly string[]): void {
    if (state.status === "ended") return;

    state.status = "ended";
    state.endedAtTick = router.currentTick;
    state.endedAtUnixMs = Date.now();
    state.winnerFactionIds = winnerFactionIds;
    playerProfiles.recordGameEnd(state, winnerFactionIds);
    savePlayerProfiles();

    const winnerNames = winnerFactionIds.map((factionId) => state.snapshot.factions[factionId]?.name ?? factionId);

    for (const player of getWorldPlayers()) {
        giveSetupItems(player);
        player.sendMessage(rawtext([
            tr(T.game.ended),
            text(": "),
            ...winnerNames.flatMap((winnerName, index) => [
                ...(index > 0 ? [text(", ")] : []),
                tr(winnerName),
            ]),
            text(" "),
            tr(T.game.winnerSuffix),
        ]));
    }

    router.emit("werewolf:gameEnded", {
        winnerFactionIds,
        state,
    });
}

export function forceEndGame(state: GameState, initiatorName?: string): void {
    if (state.status === "ended") return;

    state.status = "ended";
    state.endedAtTick = router.currentTick;
    state.endedAtUnixMs = Date.now();
    state.winnerFactionIds = [];
    unlockPlayers();
    clearCurrentGameState();

    for (const player of getWorldPlayers()) {
        giveSetupItems(player);
        player.sendMessage(tr("werewolf-gamemanager.game.forcequit.message"));
    }

    router.emit("werewolf:gameForceEnded", {
        state,
        initiatorName,
    });
}

function unlockPlayers(): void {
    runOverworldCommand("inputpermission set @a movement enabled");
    runOverworldCommand("inputpermission set @a camera enabled");
    runOverworldCommand("camera @a clear");
}

function runOverworldCommand(command: string): void {
    try {
        world.getDimension("overworld").runCommand(command);
    } catch (err) {
        console.warn(`[game-manager] Failed to run command "${command}":`, err);
    }
}
