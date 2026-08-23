import { ButtonState, InputButton, type Player, type RawMessage } from "@minecraft/server";
import { router } from "@kairo-js/router";
import { T } from "../constants/translate";
import { getCurrentGameState } from "../state/gameState";
import type { GameConfigSnapshot } from "../types/gameConfigSnapshot";
import type { GameState } from "../types/gameState";
import { rawtext, text, tr, trWith } from "../ui/text";
import { getGamePlayerId, getWorldPlayers } from "./playerIdentity";

const ROLE_ACTION_BAR_INTERVAL_TICKS = 20;
const IDLE_SUPPRESSION_TICKS = 20 * 30;
const MOVEMENT_INPUT_EPSILON_SQUARED = 0.0001;

let roleActionBarIntervalId: number | undefined;
const playerMotionStates = new Map<string, PlayerMotionState>();

type PlayerMotionState = {
    readonly lastActiveTick: number;
    readonly suppressing: boolean;
};

export function startRoleActionBar(state: GameState): void {
    if (roleActionBarIntervalId !== undefined) {
        router.clearRun(roleActionBarIntervalId);
    }
    showRoleActionBar(state);
    roleActionBarIntervalId = router.runInterval(() => {
        if (getCurrentGameState() !== state || state.status !== "running") {
            stopRoleActionBar();
            return;
        }
        showRoleActionBar(state);
    }, ROLE_ACTION_BAR_INTERVAL_TICKS);
}

export function stopRoleActionBar(): void {
    if (roleActionBarIntervalId === undefined) return;
    router.clearRun(roleActionBarIntervalId);
    roleActionBarIntervalId = undefined;
    playerMotionStates.clear();
}

function showRoleActionBar(state: GameState): void {
    const activePlayerIds = new Set<string>();
    for (const player of getWorldPlayers()) {
        const playerId = getGamePlayerId(player);
        activePlayerIds.add(playerId);
        const playerState = state.players[playerId];
        if (!playerState) continue;
        if (shouldSuppressActionBar(player, playerId)) continue;
        try {
            player.onScreenDisplay.setActionBar(trWith(
                T.game.actionbarRoleName,
                roleName(state.snapshot, playerState.roleId),
            ));
        } catch (err) {
            console.warn(`[game-manager] Failed to show role action bar for "${player.name}":`, err);
        }
    }
    pruneMotionStates(activePlayerIds);
}

function shouldSuppressActionBar(player: Player, playerId: string): boolean {
    const previous = playerMotionStates.get(playerId);
    if (!previous || isPlayerMoving(player)) {
        playerMotionStates.set(playerId, {
            lastActiveTick: router.currentTick,
            suppressing: false,
        });
        return false;
    }

    const suppressing = previous.suppressing || router.currentTick - previous.lastActiveTick >= IDLE_SUPPRESSION_TICKS;
    playerMotionStates.set(playerId, {
        lastActiveTick: previous.lastActiveTick,
        suppressing,
    });
    return suppressing;
}

function isPlayerMoving(player: Player): boolean {
    try {
        const movement = player.inputInfo.getMovementVector();
        if (movement.x * movement.x + movement.y * movement.y > MOVEMENT_INPUT_EPSILON_SQUARED) return true;
        return player.inputInfo.getButtonState(InputButton.Jump) === ButtonState.Pressed
            || player.inputInfo.getButtonState(InputButton.Sneak) === ButtonState.Pressed;
    } catch (err) {
        console.warn(`[game-manager] Failed to read movement input for "${player.name}":`, err);
        return true;
    }
}

function pruneMotionStates(activePlayerIds: ReadonlySet<string>): void {
    for (const playerId of playerMotionStates.keys()) {
        if (!activePlayerIds.has(playerId)) {
            playerMotionStates.delete(playerId);
        }
    }
}

function roleName(snapshot: GameConfigSnapshot, roleId: string): RawMessage {
    const role = snapshot.roles[roleId];
    const color = role?.color ?? (role?.faction ? snapshot.factions[role.faction]?.color : undefined) ?? "\u00a7f";
    return rawtext([
        text(color),
        tr(role?.name ?? roleId),
        text("\u00a7r"),
    ]);
}
