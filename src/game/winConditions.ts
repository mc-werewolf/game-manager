import { endGame } from "./endGame";
import { getCurrentGameState } from "../state/gameState";
import type { GameState } from "../types/gameState";

type AliveCounts = Record<string, number>;

export function evaluateWinConditions(state: GameState): string[] {
    const alive = countAliveByFaction(state);
    const winners = Object.values(state.snapshot.factions)
        .filter((faction) => evaluateWinExpression(faction.winCondition.expr, alive))
        .sort((a, b) => b.winCondition.priority - a.winCondition.priority || a.factionId.localeCompare(b.factionId));

    if (winners.length === 0) return [];

    const topPriority = winners[0]!.winCondition.priority;
    return winners
        .filter((winner) => winner.winCondition.priority === topPriority)
        .map((winner) => winner.factionId);
}

export function checkAndEndGame(): void {
    const state = getCurrentGameState();
    if (!state || state.status === "ended") return;

    const winnerFactionIds = evaluateWinConditions(state);
    if (winnerFactionIds.length === 0) return;

    endGame(state, winnerFactionIds);
}

function countAliveByFaction(state: GameState): AliveCounts {
    const alive: AliveCounts = {};
    for (const factionId of Object.keys(state.snapshot.factions)) {
        alive[factionId] = 0;
    }
    for (const player of Object.values(state.players)) {
        if (!player.isAlive) continue;
        alive[player.factionId] = (alive[player.factionId] ?? 0) + 1;
    }
    return alive;
}

function evaluateWinExpression(expr: string, alive: AliveCounts): boolean {
    return expr
        .split("&&")
        .map((part) => part.trim())
        .filter((part) => part.length > 0)
        .every((part) => evaluateComparison(part, alive));
}

function evaluateComparison(expr: string, alive: AliveCounts): boolean {
    const match = expr.match(/^alive\.([a-zA-Z0-9_-]+)\s*(>=|<=|==|>|<)\s*(alive\.([a-zA-Z0-9_-]+)|-?\d+)$/);
    if (!match) {
        throw new Error(`[game-manager] Unsupported win condition expression: ${expr}`);
    }

    const left = alive[match[1]!] ?? 0;
    const op = match[2]!;
    const rightToken = match[3]!;
    const rightFactionId = match[4];
    const right = rightFactionId ? (alive[rightFactionId] ?? 0) : Number(rightToken);

    switch (op) {
        case ">": return left > right;
        case ">=": return left >= right;
        case "<": return left < right;
        case "<=": return left <= right;
        case "==": return left === right;
        default: throw new Error(`[game-manager] Unsupported win condition operator: ${op}`);
    }
}
