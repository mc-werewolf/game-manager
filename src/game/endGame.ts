import { router } from "@kairo-js/router";
import { giveSetupItems } from "./playerItems";
import { getWorldPlayers } from "./playerIdentity";
import { T } from "../constants/translate";
import { savePlayerProfiles } from "../persistence/gameManagerPersistence";
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
