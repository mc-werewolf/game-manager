import { world, type Player, type RawMessage } from "@minecraft/server";
import { router } from "@kairo-js/router";
import { giveSetupItems } from "./playerItems";
import { getGamePlayerId, getWorldPlayers } from "./playerIdentity";
import { removeCountdownEffects } from "./countdownEffects";
import { allowArrowProjectiles, suppressArrowProjectilesUntilGameStartViewReturn } from "./combat";
import { setAllPlayersAdventure } from "./gameModes";
import { stopRoleActionBar } from "./roleActionBar";
import { T } from "../constants/translate";
import { savePlayerProfiles } from "../persistence/gameManagerPersistence";
import { clearCurrentGameState } from "../state/gameState";
import { playerProfiles } from "../state/playerProfiles";
import type { StoredFaction } from "../types/faction";
import type { GamePlayerState, GameState } from "../types/gameState";
import { CHAT_DIVIDER } from "../ui/chat";
import { rawtext, text, tr } from "../ui/text";
import { playPlayerSound } from "../ui/sounds";

const GAME_END_TITLE_KEY = "werewolf-gamemanager.game.termination.title";
const GAME_END_SOUND = "random.anvil_use";
const GAME_END_TITLE_RAWTEXT_COMMAND = `titleraw @a title {"rawtext":[{"translate":"${GAME_END_TITLE_KEY}"}]}`;
const FINAL_RESULT_DELAY_TICKS = 60;
const FINAL_RESULT_RETURN_DELAY_TICKS = 100;
const FINAL_RESULT_INPUT_LOCK_TICKS = 5;
const FINAL_RESULT_VICTORY_SOUND = "random.levelup";
const FINAL_RESULT_OTHER_SOUND = "random.explode";
const GAME_START_VIEW_TELEPORT_COMMAND = "tp @a 0 -59 24 facing 0 -59 0";

type PlayerResult = "victory" | "defeat" | "draw";

export function endGame(state: GameState, winnerFactionIds: readonly string[]): void {
    if (state.status === "ended") return;

    state.status = "ended";
    state.endedAtTick = router.currentTick;
    state.endedAtUnixMs = Date.now();
    state.winnerFactionIds = winnerFactionIds;
    disablePvp();
    removeCountdownEffects(state);
    suppressArrowProjectilesUntilGameStartViewReturn(state);
    stopRoleActionBar();
    showGameEndPresentation();
    playerProfiles.recordGameEnd(state, winnerFactionIds);
    savePlayerProfiles();
    router.runTimeout(() => showFinalResultPresentation(state, winnerFactionIds), FINAL_RESULT_DELAY_TICKS);
    router.runTimeout(
        () => returnPlayersToGameStartView(),
        FINAL_RESULT_DELAY_TICKS + FINAL_RESULT_RETURN_DELAY_TICKS,
    );

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
    disablePvp();
    removeCountdownEffects(state);
    suppressArrowProjectilesUntilGameStartViewReturn(state);
    allowArrowProjectiles();
    stopRoleActionBar();
    unlockPlayers();
    setAllPlayersAdventure();
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

function showGameEndPresentation(): void {
    for (const player of getWorldPlayers()) {
        try {
            playPlayerSound(player, GAME_END_SOUND, undefined, "game end sound");
            player.onScreenDisplay.setTitle(tr(GAME_END_TITLE_KEY), {
                fadeInDuration: 0,
                stayDuration: 60,
                fadeOutDuration: 20,
            });
        } catch (err) {
            console.warn("[game-manager] Failed to show game end presentation:", err);
        }
    }

    runOverworldCommand("title @a times 0 60 20");
    runOverworldCommand(GAME_END_TITLE_RAWTEXT_COMMAND);
}

function showFinalResultPresentation(state: GameState, winnerFactionIds: readonly string[]): void {
    const title = buildWinnerTitle(state, winnerFactionIds);
    const message = buildWinnerMessage(state, winnerFactionIds);

    for (const player of getWorldPlayers()) {
        const result = getPlayerResult(state, winnerFactionIds, player);
        const resultTitle = getPlayerResultTitle(result);
        const resultMessage = getPlayerResultMessage(result);

        try {
            playPlayerSound(
                player,
                result === "victory" ? FINAL_RESULT_VICTORY_SOUND : FINAL_RESULT_OTHER_SOUND,
                undefined,
                "final result sound",
            );
            player.onScreenDisplay.setTitle(title, {
                subtitle: resultTitle,
                fadeInDuration: 0,
                stayDuration: 100,
                fadeOutDuration: 20,
            });
        } catch (err) {
            console.warn("[game-manager] Failed to show final game result:", err);
        }

        player.sendMessage(buildFinalResultChatMessage(message, resultMessage, state));
    }
}

function disablePvp(): void {
    try {
        world.gameRules.pvp = false;
    } catch (err) {
        console.warn("[game-manager] Failed to disable PvP:", err);
    }
}

function returnPlayersToGameStartView(): void {
    runOverworldCommand("inputpermission set @a camera disabled");
    runOverworldCommand("inputpermission set @a movement disabled");
    setAllPlayersAdventure();
    runOverworldCommand(GAME_START_VIEW_TELEPORT_COMMAND);
    allowArrowProjectiles();
    for (const player of getWorldPlayers()) {
        giveSetupItems(player);
    }
    router.runTimeout(() => {
        runOverworldCommand("inputpermission set @a movement enabled");
        runOverworldCommand("inputpermission set @a camera enabled");
    }, FINAL_RESULT_INPUT_LOCK_TICKS);
}

function buildWinnerTitle(state: GameState, winnerFactionIds: readonly string[]): RawMessage {
    const winner = getSingleWinnerFaction(state, winnerFactionIds);
    if (winner?.victoryTitle) return tr(winner.victoryTitle);
    if (winnerFactionIds.length === 0) return tr(T.game.resultDraw);
    return buildFallbackWinnerMessage(state, winnerFactionIds);
}

function buildWinnerMessage(state: GameState, winnerFactionIds: readonly string[]): RawMessage {
    const winner = getSingleWinnerFaction(state, winnerFactionIds);
    if (winner?.victoryMessage) return tr(winner.victoryMessage);
    if (winnerFactionIds.length === 0) return tr(T.game.resultDrawMessage);
    return buildFallbackWinnerMessage(state, winnerFactionIds);
}

function getSingleWinnerFaction(state: GameState, winnerFactionIds: readonly string[]): StoredFaction | undefined {
    if (winnerFactionIds.length !== 1) return undefined;
    return state.snapshot.factions[winnerFactionIds[0]!];
}

function buildFallbackWinnerMessage(state: GameState, winnerFactionIds: readonly string[]): RawMessage {
    const winnerNames = winnerFactionIds.map((factionId) => state.snapshot.factions[factionId]?.name ?? factionId);
    return rawtext([
        tr(T.game.ended),
        text(": "),
        ...winnerNames.flatMap((winnerName, index) => [
            ...(index > 0 ? [text(", ")] : []),
            tr(winnerName),
        ]),
        text(" "),
        tr(T.game.winnerSuffix),
    ]);
}

function getPlayerResult(state: GameState, winnerFactionIds: readonly string[], player: Player): PlayerResult {
    if (winnerFactionIds.length === 0) return "draw";

    let playerState = state.players[getGamePlayerId(player)];
    if (!playerState) {
        playerState = Object.values(state.players).find((candidate) => candidate.name === player.name);
    }

    if (!playerState) return "draw";
    return winnerFactionIds.includes(playerState.factionId) ? "victory" : "defeat";
}

function getPlayerResultTitle(result: PlayerResult): RawMessage {
    if (result === "victory") return tr(T.game.resultVictory);
    if (result === "defeat") return tr(T.game.resultDefeat);
    return tr(T.game.resultDraw);
}

function getPlayerResultMessage(result: PlayerResult): RawMessage {
    if (result === "victory") return tr(T.game.resultVictoryMessage);
    if (result === "defeat") return tr(T.game.resultDefeatMessage);
    return tr(T.game.resultDrawMessage);
}

function buildFinalResultChatMessage(
    message: RawMessage,
    resultMessage: RawMessage,
    state: GameState,
): RawMessage {
    return rawtext([
        text(CHAT_DIVIDER),
        text("\n"),
        message,
        text("\n"),
        resultMessage,
        text("\n"),
        text(CHAT_DIVIDER),
        text("\n"),
        ...formatPlayerResultLines(state),
    ]);
}

function formatPlayerResultLines(state: GameState): RawMessage[] {
    return getSortedResultPlayers(state).flatMap((playerState, index) => [
        ...(index > 0 ? [text("\n")] : []),
        ...formatPlayerResultLine(state, playerState),
    ]);
}

function formatPlayerResultLine(
    state: GameState,
    playerState: GamePlayerState,
): RawMessage[] {
    const role = state.snapshot.roles[playerState.roleId];
    const roleColor = role?.color ?? state.snapshot.factions[playerState.factionId]?.color ?? "\u00a7f";
    return [
        text(roleColor),
        tr(role?.name ?? playerState.roleId),
        text("\u00a7r\u00a7f: "),
        text(playerState.name),
        text(" "),
        formatPlayerLifeStatus(playerState),
        ...formatPlayerResultLineExtra(state, playerState),
    ];
}

function formatPlayerLifeStatus(playerState: GameState["players"][string]): RawMessage {
    if (playerState.isLeft) return tr(T.game.resultLeft);
    if (playerState.isAlive) return tr(T.game.resultAlive);
    return tr(T.game.resultDead);
}

function formatPlayerResultLineExtra(
    _state: GameState,
    _playerState: GamePlayerState,
): RawMessage[] {
    return [];
}

function getSortedResultPlayers(state: GameState): GamePlayerState[] {
    return Object.values(state.players).sort((a, b) => compareResultPlayers(state, a, b));
}

function compareResultPlayers(state: GameState, a: GamePlayerState, b: GamePlayerState): number {
    const factionDiff = getFactionSortIndex(state, a.factionId) - getFactionSortIndex(state, b.factionId);
    if (factionDiff !== 0) return factionDiff;
    const factionIdDiff = a.factionId.localeCompare(b.factionId);
    if (factionIdDiff !== 0) return factionIdDiff;

    const roleDiff = getRoleSortIndex(state, a.roleId) - getRoleSortIndex(state, b.roleId);
    if (roleDiff !== 0) return roleDiff;
    const roleIdDiff = a.roleId.localeCompare(b.roleId);
    if (roleIdDiff !== 0) return roleIdDiff;

    return a.name.localeCompare(b.name);
}

function getFactionSortIndex(state: GameState, factionId: string): number {
    return state.snapshot.factions[factionId]?.sortIndex ?? Number.POSITIVE_INFINITY;
}

function getRoleSortIndex(state: GameState, roleId: string): number {
    const role = state.snapshot.roles[roleId];
    return role?.sortIndex ?? role?.index ?? Number.POSITIVE_INFINITY;
}

function runOverworldCommand(command: string): void {
    try {
        world.getDimension("overworld").runCommand(command);
    } catch (err) {
        console.warn(`[game-manager] Failed to run command "${command}":`, err);
    }
}
