import { GameWorldState, type SystemManager } from "../SystemManager";
import { SCRIPT_EVENT_COMMAND_IDS, SCRIPT_EVENT_MESSAGES } from "../../constants/scriptevent";
import { KAIRO_COMMAND_TARGET_ADDON_IDS } from "../../constants/systems";
import type { IngameConstants } from "../ingame/InGameManager";
import { ConsoleManager, KairoUtils } from "@kairo-js/router";

export class WorldStateChangeBroadcaster {
    private constructor(private readonly systemManager: SystemManager) {}
    public static create(systemManager: SystemManager): WorldStateChangeBroadcaster {
        return new WorldStateChangeBroadcaster(systemManager);
    }

    public broadcast(next: GameWorldState, ingameConstants: IngameConstants | null): void {
        ConsoleManager.log(`Broadcasting world state change... New state: ${next}`);

        const nextState =
            next === GameWorldState.InGame
                ? SCRIPT_EVENT_MESSAGES.IN_GAME
                : SCRIPT_EVENT_MESSAGES.OUT_GAME;

        KairoUtils.sendKairoCommand(
            KAIRO_COMMAND_TARGET_ADDON_IDS.BROADCAST,
            SCRIPT_EVENT_COMMAND_IDS.WORLD_STATE_CHANGE,
            {
                newState: nextState,
                ingameConstants,
            },
        );
    }
}
