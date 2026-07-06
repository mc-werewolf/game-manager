import { world } from "@minecraft/server";
import { router } from "@kairo-js/router";
import { checkAndEndGame } from "../game/winConditions";
import { getCurrentGameState } from "../state/gameState";
import type { AppliedGameAction, ApplyActionsArgs, ApplyActionsResult, GameAction } from "../types/skillRuntime";
import { rawtext, text, tr } from "../ui/text";

export function handleApplyActions(args: ApplyActionsArgs): ApplyActionsResult {
    const applied: AppliedGameAction[] = [];
    for (const action of args.actions) {
        const result = applyAction(action);
        applied.push(result);
        router.emit("werewolf:actionApplied", {
            action,
            applied: result.applied,
            reason: result.reason,
            context: args.context,
        });

        if (action.type === "kill" && result.applied) {
            router.emit("werewolf:playerKilled", {
                playerId: action.targetId,
                reason: action.reason,
                context: args.context,
            });
            checkAndEndGame();
        }
    }

    return { applied };
}

function applyAction(action: GameAction): AppliedGameAction {
    switch (action.type) {
        case "sendMessage": {
            const player = findPlayer(action.toPlayerId);
            if (!player) return skipped(action, `Player "${action.toPlayerId}" was not found`);
            player.sendMessage(tr(action.message));
            return applied(action);
        }
        case "reveal": {
            const player = findPlayer(action.toPlayerId);
            if (!player) return skipped(action, `Player "${action.toPlayerId}" was not found`);
            player.sendMessage(rawtext([
                tr(action.key),
                text(": "),
                tr(String(action.value)),
            ]));
            return applied(action);
        }
        case "kill":
            if (consumeProtection(action.targetId)) {
                return skipped(action, `Player "${action.targetId}" was protected`);
            }
            if (!markDead(action.targetId)) {
                return skipped(action, `Player "${action.targetId}" was not found in game state`);
            }
            return applied(action);
        case "protect":
            protectPlayer(action.targetId);
            return applied(action);
        case "setStatus":
            setPlayerStatus(action.targetId, action.statusId, action.value);
            return applied(action);
        case "custom":
            console.warn(`[game-manager] GameAction "${action.type}" is not applied yet`);
            return skipped(action, "GameAction type is not implemented yet");
    }
}

function markDead(playerId: string): boolean {
    const state = getCurrentGameState();
    const playerState = state?.players[playerId];
    if (!playerState) return false;
    playerState.isAlive = false;
    return true;
}

function protectPlayer(playerId: string): void {
    setPlayerStatus(playerId, "protected", true);
}

function consumeProtection(playerId: string): boolean {
    const state = getCurrentGameState();
    const playerState = state?.players[playerId];
    if (!playerState?.statuses.protected) return false;
    delete playerState.statuses.protected;
    return true;
}

function setPlayerStatus(playerId: string, statusId: string, value: unknown): void {
    const state = getCurrentGameState();
    const playerState = state?.players[playerId];
    if (!playerState) return;
    playerState.statuses[statusId] = value;
}

function findPlayer(playerId: string) {
    return world.getPlayers().find((player) => player.id === playerId || player.name === playerId);
}

function applied(action: GameAction): AppliedGameAction {
    return { action, applied: true };
}

function skipped(action: GameAction, reason: string): AppliedGameAction {
    return { action, applied: false, reason };
}
