import type { RawMessage } from "@minecraft/server";
import { getWorldPlayers } from "../game/playerIdentity";
import { rawtext, text } from "./text";

export const CHAT_DIVIDER = "\u00a76--------------------------\u00a7r";

export function borderedChatMessage(parts: readonly RawMessage[]): RawMessage {
    return rawtext([
        text(CHAT_DIVIDER),
        text("\n"),
        ...parts,
        text("\n"),
        text(CHAT_DIVIDER),
    ]);
}

export function sendMessageForAll(message: string | RawMessage): void {
    for (const player of getWorldPlayers()) {
        try {
            player.sendMessage(message);
        } catch (err) {
            console.warn(`[game-manager] Failed to send chat message to "${player.name}":`, err);
        }
    }
}
