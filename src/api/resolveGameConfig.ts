import { createGameConfigSnapshot } from "../state/gameConfigSnapshot";
import type { GameConfigSnapshot } from "../types/gameConfigSnapshot";

export function handleResolveGameConfig(): GameConfigSnapshot {
    return createGameConfigSnapshot();
}

