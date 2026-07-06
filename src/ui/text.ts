import type { RawMessage } from "@minecraft/server";

export function tr(value: string): RawMessage {
    return { translate: value };
}

export function trWith(value: string, withArgs: string[]): RawMessage {
    return { translate: value, with: withArgs };
}

export function text(value: string): RawMessage {
    return { text: value };
}

export function rawtext(parts: RawMessage[]): RawMessage {
    return { rawtext: parts };
}

export function trLine(title: string, description?: string): RawMessage {
    if (!description) return tr(title);
    return rawtext([
        tr(title),
        text("\n§7"),
        tr(description),
        text("§r"),
    ]);
}
