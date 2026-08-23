import { GameMode, type Player } from "@minecraft/server";
import { participationState } from "../state/participationState";
import type { GameState } from "../types/gameState";
import { getGamePlayerId, getWorldPlayers, matchesGamePlayerId } from "./playerIdentity";

export function applyGameStartGameModes(state: GameState): void {
    for (const player of getWorldPlayers()) {
        const playerId = getGamePlayerId(player);
        if (state.players[playerId] !== undefined) {
            setPlayerGameMode(player, GameMode.Adventure, "game start participant");
        } else if (participationState.isSpectating(playerId)) {
            setPlayerGameMode(player, GameMode.Spectator, "game start spectator");
        }
    }
}

export function setDeadPlayerSpectator(playerId: string): void {
    const player = getWorldPlayers().find((candidate) => matchesGamePlayerId(candidate, playerId));
    if (!player) return;
    setPlayerGameMode(player, GameMode.Spectator, "player death");
}

export function applyRunningGameSpawnGameMode(state: GameState, player: Player): void {
    const playerId = getGamePlayerId(player);
    const playerState = state.players[playerId];
    if (playerState?.isAlive) {
        setPlayerGameMode(player, GameMode.Adventure, "running game alive spawn");
        return;
    }
    if (playerState || participationState.isSpectating(playerId)) {
        setPlayerGameMode(player, GameMode.Spectator, "running game spectator spawn");
    }
}

export function setAllPlayersAdventure(): void {
    for (const player of getWorldPlayers()) {
        setPlayerGameMode(player, GameMode.Adventure, "game end return");
    }
}

function setPlayerGameMode(player: Player, gameMode: GameMode, context: string): void {
    try {
        if (player.getGameMode() === gameMode) return;
        player.setGameMode(gameMode);
    } catch (err) {
        console.warn(`[game-manager] Failed to set ${context} game mode for "${player.name}":`, err);
    }
}
