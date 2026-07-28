import { world, type Player } from "@minecraft/server";

export function getWorldPlayers(): Player[] {
    return (world.getPlayers() as readonly (Player | undefined)[]).filter(isResolvedPlayer);
}

export function getGamePlayerId(player: Player): string {
    const id = (player as { readonly id?: unknown }).id;
    if (typeof id === "string" && id.trim().length > 0) {
        return id;
    }
    const name = (player as { readonly name?: unknown }).name;
    if (typeof name === "string" && name.trim().length > 0) {
        return name;
    }
    throw new Error("[game-manager] Cannot resolve player identity");
}

export function matchesGamePlayerId(player: Player, playerId: string): boolean {
    const id = (player as { readonly id?: unknown }).id;
    if (typeof id === "string" && id === playerId) return true;
    return player.name === playerId || getGamePlayerId(player) === playerId;
}

function isResolvedPlayer(player: Player | undefined): player is Player {
    if (!player) return false;
    const id = (player as { readonly id?: unknown }).id;
    if (typeof id === "string" && id.trim().length > 0) return true;
    const name = (player as { readonly name?: unknown }).name;
    return typeof name === "string" && name.trim().length > 0;
}
