import type { GameState } from "../types/gameState";

let currentGameState: GameState | undefined;

export function getCurrentGameState(): GameState | undefined {
    return currentGameState;
}

export function setCurrentGameState(state: GameState): void {
    currentGameState = state;
}

export function clearCurrentGameState(): void {
    currentGameState = undefined;
}

