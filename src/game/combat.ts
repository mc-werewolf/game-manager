import { world, type Entity, type EntityDieAfterEvent, type EntityHurtBeforeEvent, type Player, type ProjectileHitBlockAfterEvent, type ProjectileHitEntityAfterEvent } from "@minecraft/server";
import { router } from "@kairo-js/router";
import { handleApplyActions } from "../api/applyActions";
import { GAME_COMBAT_ARROW_ITEM, GAME_COMBAT_BOW_ITEM } from "../constants/items";
import { getCurrentGameState } from "../state/gameState";
import type { GameState } from "../types/gameState";
import { ensureCombatArrow, giveCombatCooldownBow, giveCombatItems, removeCombatItems } from "./playerItems";
import { getGamePlayerId, getWorldPlayers, matchesGamePlayerId } from "./playerIdentity";

const ARROW_KILL_REASON = "arrow";
const BOW_KILL_COOLDOWN_SECONDS = 15;
const TICKS_PER_SECOND = 20;

let arrowRefillIntervalId: number | undefined;
let postGameArrowRefillIntervalId: number | undefined;
let cleanupPostGameArrowProjectiles = false;
let bowCooldownIntervalId: number | undefined;
const bowCooldowns = new Map<string, number>();
const consumedArrowProjectiles = new WeakSet<Entity>();
const consumedArrowProjectileIds = new Set<string>();

export function clearArrowProjectiles(): void {
    removeArrowProjectiles();
}

export function suppressArrowProjectilesUntilGameStartViewReturn(state: GameState): void {
    cleanupPostGameArrowProjectiles = true;
    removeArrowProjectiles();
    ensurePostGameArrowRefillInterval(state);
}

export function allowArrowProjectiles(): void {
    const wasCleaningPostGameArrows = cleanupPostGameArrowProjectiles;
    cleanupPostGameArrowProjectiles = false;
    clearPostGameArrowRefillInterval();
    if (wasCleaningPostGameArrows) {
        removeArrowProjectiles();
    }
    clearBowCooldowns();
}

export function giveCombatItemsToAlivePlayers(state: GameState): void {
    for (const player of getWorldPlayers()) {
        if (!isAliveGamePlayer(state, player)) continue;
        giveCombatItems(player);
    }
    ensureArrowRefillInterval();
}

export function giveCombatItemsIfAlive(player: Player): void {
    const state = getCurrentGameState();
    if (state?.status !== "running") return;
    if (!isAliveGamePlayer(state, player)) return;
    if (updateCombatBowCooldownForPlayer(state, getGamePlayerId(player), player)) {
        ensureCombatArrow(player);
        return;
    }
    giveCombatItems(player);
    ensureArrowRefillInterval();
}

export function handleCombatItemUse(player: Player, itemTypeId: string): void {
    if (itemTypeId !== GAME_COMBAT_BOW_ITEM) return;
    const state = getCurrentGameState();
    if (state?.status !== "running" || !isAliveGamePlayer(state, player)) return;

    for (const delay of [0, 1, 2, 3, 5]) {
        router.runTimeout(() => {
            const currentState = getCurrentGameState();
            if (currentState?.status !== "running" || !isAliveGamePlayer(currentState, player)) return;
            ensureCombatArrow(player);
        }, delay);
    }
}

export function handleCombatEntityHurt(ev: EntityHurtBeforeEvent): void {
    const state = getCurrentGameState();
    if (state?.status !== "running") return;

    const projectile = ev.damageSource.damagingProjectile;
    if (projectile?.typeId !== GAME_COMBAT_ARROW_ITEM) return;
    if (isArrowProjectileConsumed(projectile)) {
        ev.cancel = true;
        return;
    }

    const targetId = resolveGamePlayerId(state, ev.hurtEntity);
    const shooterId = resolveGamePlayerId(state, ev.damageSource.damagingEntity);
    if (!targetId) return;
    if (!shooterId) {
        consumeArrowProjectile(projectile, "combat arrow hurt without shooter");
        ev.cancel = true;
        return;
    }

    if (targetId === shooterId) {
        consumeArrowProjectile(projectile, "combat arrow self hit");
        ev.cancel = true;
        return;
    }

    const targetState = state.players[targetId];
    const shooterState = state.players[shooterId];
    if (!targetState?.isAlive || !shooterState?.isAlive) {
        consumeArrowProjectile(projectile, "combat arrow invalid target");
        ev.cancel = true;
        return;
    }

    if (!consumeArrowProjectile(projectile, "combat arrow hurt")) {
        ev.cancel = true;
        return;
    }
    ev.cancel = true;
    router.runTimeout(() => applyArrowKill(state, shooterId, targetId, asPlayer(ev.hurtEntity)), 0);
}

export function handleCombatProjectileHitBlock(ev: ProjectileHitBlockAfterEvent): void {
    if (schedulePostGameArrowProjectileRemoval(ev.projectile)) return;

    const state = getCurrentGameState();
    if (state?.status !== "running") return;
    if (ev.projectile.typeId !== GAME_COMBAT_ARROW_ITEM) return;
    const sourceId = resolveGamePlayerId(state, ev.source);
    if (!sourceId || !state.players[sourceId]?.isAlive) return;

    const projectile = ev.projectile;
    router.runTimeout(() => {
        try {
            if (projectile.isValid) {
                projectile.remove();
            }
        } catch (err) {
            console.warn("[game-manager] Failed to remove arrow projectile:", err);
        }
    }, 3);
}

export function handleCombatProjectileHitEntity(ev: ProjectileHitEntityAfterEvent): void {
    if (schedulePostGameArrowProjectileRemoval(ev.projectile)) return;

    const state = getCurrentGameState();
    if (state?.status !== "running") return;
    if (ev.projectile.typeId !== GAME_COMBAT_ARROW_ITEM) return;
    if (isArrowProjectileConsumed(ev.projectile)) return;

    const target = ev.getEntityHit().entity;
    const targetId = resolveGamePlayerId(state, target);
    const shooterId = resolveGamePlayerId(state, ev.source);
    if (!targetId || !shooterId || targetId === shooterId) return;
    if (!state.players[targetId]?.isAlive || !state.players[shooterId]?.isAlive) return;
    if (!markArrowProjectileConsumed(ev.projectile)) return;

    removeArrowProjectile(ev.projectile, "combat arrow entity hit");
    router.runTimeout(() => applyArrowKill(state, shooterId, targetId, asPlayer(target)), 0);
}

export function handleCombatEntityDie(ev: EntityDieAfterEvent): void {
    const state = getCurrentGameState();
    if (state?.status !== "running") return;

    const projectile = ev.damageSource.damagingProjectile;
    if (projectile?.typeId !== GAME_COMBAT_ARROW_ITEM) return;

    const targetId = resolveGamePlayerId(state, ev.deadEntity);
    const shooterId = resolveGamePlayerId(state, ev.damageSource.damagingEntity);
    if (!targetId || !shooterId || targetId === shooterId) return;

    router.runTimeout(() => applyArrowKill(state, shooterId, targetId, undefined), 0);
}

function applyArrowKill(state: GameState, shooterId: string, targetId: string, target: Player | undefined): void {
    if (getCurrentGameState() !== state || state.status !== "running") return;
    if (!state.players[shooterId]?.isAlive || !state.players[targetId]?.isAlive) return;

    const result = handleApplyActions({
        actions: [{ type: "kill", targetId, reason: ARROW_KILL_REASON }],
        context: {
            skillId: "werewolf:combat_arrow",
            actorId: shooterId,
            targetIds: [targetId],
            snapshot: state.snapshot,
            game: state,
            metadata: { source: "combat_arrow" },
        },
    });

    if (result.applied[0]?.applied) {
        console.warn(`[game-manager] Combat arrow kill applied: ${shooterId} -> ${targetId}`);
        startBowKillCooldown(state, shooterId);
        if (target) {
            removeCombatItems(target);
        }
    }
}

function startBowKillCooldown(state: GameState, playerId: string): void {
    if (getCurrentGameState() !== state || state.status !== "running") return;
    if (!state.players[playerId]?.isAlive) return;

    const endTick = router.currentTick + BOW_KILL_COOLDOWN_SECONDS * TICKS_PER_SECOND;
    bowCooldowns.set(playerId, endTick);
    ensureBowCooldownInterval();

    const player = findWorldPlayer(playerId);
    if (player) {
        giveCombatCooldownBow(player, BOW_KILL_COOLDOWN_SECONDS);
        ensureCombatArrow(player);
    }
}

function ensureBowCooldownInterval(): void {
    if (bowCooldownIntervalId !== undefined) return;
    bowCooldownIntervalId = router.runInterval(updateCombatBowCooldowns, TICKS_PER_SECOND);
}

function updateCombatBowCooldowns(): void {
    const state = getCurrentGameState();
    if (state?.status !== "running") {
        clearBowCooldowns();
        return;
    }

    for (const [playerId] of bowCooldowns) {
        updateCombatBowCooldownForPlayer(state, playerId, findWorldPlayer(playerId));
    }

    if (bowCooldowns.size === 0 && bowCooldownIntervalId !== undefined) {
        router.clearRun(bowCooldownIntervalId);
        bowCooldownIntervalId = undefined;
    }
}

function updateCombatBowCooldownForPlayer(
    state: GameState,
    playerId: string,
    player: Player | undefined,
): boolean {
    const endTick = bowCooldowns.get(playerId);
    if (endTick === undefined) return false;

    const playerState = state.players[playerId];
    const remainingTicks = endTick - router.currentTick;
    if (!playerState?.isAlive || remainingTicks <= 0) {
        bowCooldowns.delete(playerId);
        if (player && playerState?.isAlive) {
            giveCombatItems(player);
        }
        return false;
    }

    if (player) {
        giveCombatCooldownBow(player, Math.ceil(remainingTicks / TICKS_PER_SECOND));
    }
    return true;
}

function clearBowCooldowns(): void {
    bowCooldowns.clear();
    if (bowCooldownIntervalId !== undefined) {
        router.clearRun(bowCooldownIntervalId);
        bowCooldownIntervalId = undefined;
    }
}

function ensureArrowRefillInterval(): void {
    if (arrowRefillIntervalId !== undefined) return;
    arrowRefillIntervalId = router.runInterval(() => {
        const state = getCurrentGameState();
        if (state?.status !== "running") {
            if (arrowRefillIntervalId !== undefined) {
                router.clearRun(arrowRefillIntervalId);
                arrowRefillIntervalId = undefined;
            }
            return;
        }
        for (const player of getWorldPlayers()) {
            if (!isAliveGamePlayer(state, player)) continue;
            ensureCombatArrow(player);
        }
    }, 1);
}

function ensurePostGameArrowRefillInterval(state: GameState): void {
    if (postGameArrowRefillIntervalId !== undefined) return;
    postGameArrowRefillIntervalId = router.runInterval(() => {
        if (!cleanupPostGameArrowProjectiles || getCurrentGameState() !== state || state.status !== "ended") {
            clearPostGameArrowRefillInterval();
            return;
        }
        for (const player of getWorldPlayers()) {
            if (!isGamePlayer(state, player)) continue;
            ensureCombatArrow(player);
        }
    }, 1);
}

function clearPostGameArrowRefillInterval(): void {
    if (postGameArrowRefillIntervalId === undefined) return;
    router.clearRun(postGameArrowRefillIntervalId);
    postGameArrowRefillIntervalId = undefined;
}

function schedulePostGameArrowProjectileRemoval(entity: Entity): boolean {
    if (!cleanupPostGameArrowProjectiles || entity.typeId !== GAME_COMBAT_ARROW_ITEM) return false;
    const projectile = entity;
    router.runTimeout(() => {
        removeEntity(projectile, "post-game arrow projectile");
    }, 3);
    return true;
}

function removeArrowProjectiles(): void {
    for (const dimensionId of ["overworld", "nether", "the_end"]) {
        let arrows: Entity[];
        try {
            arrows = world.getDimension(dimensionId).getEntities({ type: GAME_COMBAT_ARROW_ITEM });
        } catch {
            continue;
        }
        for (const arrow of arrows) {
            removeArrowProjectile(arrow, "arrow projectile cleanup");
        }
    }
}

function consumeArrowProjectile(entity: Entity, context: string): boolean {
    if (!markArrowProjectileConsumed(entity)) return false;
    router.runTimeout(() => {
        removeArrowProjectile(entity, context);
    }, 0);
    return true;
}

function markArrowProjectileConsumed(entity: Entity): boolean {
    if (isArrowProjectileConsumed(entity)) return false;
    consumedArrowProjectiles.add(entity);
    const id = getEntityId(entity);
    if (id) consumedArrowProjectileIds.add(id);
    return true;
}

function isArrowProjectileConsumed(entity: Entity): boolean {
    if (consumedArrowProjectiles.has(entity)) return true;
    const id = getEntityId(entity);
    return id !== undefined && consumedArrowProjectileIds.has(id);
}

function removeArrowProjectile(entity: Entity, context: string): void {
    removeEntity(entity, context);
}

function removeEntity(entity: Entity, context: string): void {
    try {
        if (entity.isValid) {
            entity.remove();
        }
    } catch (err) {
        console.warn(`[game-manager] Failed to remove ${context}:`, err);
    }
}

function isAliveGamePlayer(state: GameState, player: Player): boolean {
    const playerId = resolveGamePlayerId(state, player);
    return playerId !== undefined && state.players[playerId]?.isAlive === true;
}

function isGamePlayer(state: GameState, player: Player): boolean {
    const playerId = resolveGamePlayerId(state, player);
    return playerId !== undefined && state.players[playerId] !== undefined;
}

function asPlayer(entity: Entity | undefined): Player | undefined {
    return entity?.typeId === "minecraft:player" ? entity as Player : undefined;
}

function resolveGamePlayerId(state: GameState, entity: Entity | undefined): string | undefined {
    if (!entity || entity.typeId !== "minecraft:player") return undefined;

    const candidateIds = new Set<string>();
    try {
        candidateIds.add(getGamePlayerId(entity as Player));
    } catch {
        // Fall back to the loose properties below. Simulated players do not always behave exactly like Player.
    }

    const id = (entity as { readonly id?: unknown }).id;
    if (typeof id === "string" && id.trim().length > 0) {
        candidateIds.add(id);
    }

    const name = (entity as { readonly name?: unknown }).name;
    if (typeof name === "string" && name.trim().length > 0) {
        candidateIds.add(name);
    }

    for (const candidateId of candidateIds) {
        if (state.players[candidateId]) return candidateId;
    }

    for (const candidateId of candidateIds) {
        const player = Object.values(state.players).find((playerState) => playerState.name === candidateId);
        if (player) return player.playerId;
    }

    return undefined;
}

function findWorldPlayer(playerId: string): Player | undefined {
    return getWorldPlayers().find((player) => matchesGamePlayerId(player, playerId));
}

function getEntityId(entity: Entity): string | undefined {
    const id = (entity as { readonly id?: unknown }).id;
    return typeof id === "string" && id.length > 0 ? id : undefined;
}
