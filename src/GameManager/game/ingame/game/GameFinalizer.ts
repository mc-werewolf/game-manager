import { GameMode, InputPermissionCategory, world, type Player } from "@minecraft/server";
import type { InGameManager } from "../InGameManager";
import { SYSTEMS } from "../../../constants/systems";

export class GameFinalizer {
    private constructor(private readonly inGameManager: InGameManager) {}
    public static create(inGameManager: InGameManager) {
        return new GameFinalizer(inGameManager);
    }

    public runFinalization() {
        const players = world.getPlayers();

        this.resetPlayersState(players);
        this.teleportPlayers(players);

        this.inGameManager.gameFinalize();
    }

    private resetPlayersState(players: Player[]): void {
        players.forEach((player) => {
            player.setGameMode(GameMode.Adventure);
            player.inputPermissions.setPermissionCategory(InputPermissionCategory.Camera, true);
            player.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, true);
        });
    }

    private teleportPlayers(players: Player[]): void {
        players.forEach((player) => {
            player.teleport(
                {
                    x: SYSTEMS.DEFAULT_STAGE_SPAWNPOINT.X,
                    y: SYSTEMS.DEFAULT_STAGE_SPAWNPOINT.Y,
                    z: SYSTEMS.DEFAULT_STAGE_SPAWNPOINT.Z,
                },
                {
                    checkForBlocks: SYSTEMS.DEFAULT_STAGE_TELEPORT_OPTIONS.CHECK_FOR_BLOCKS,
                    dimension: world.getDimension(SYSTEMS.DEFAULT_STAGE_TELEPORT_OPTIONS.DIMENSION),
                    // facingLocation: { x: 0, y: -58, z: 0 }, // rotationを指定しているため不要
                    keepVelocity: SYSTEMS.DEFAULT_STAGE_TELEPORT_OPTIONS.KEEP_VELOCITY,
                    rotation: {
                        x: SYSTEMS.DEFAULT_STAGE_TELEPORT_OPTIONS.ROTATION_X,
                        y: SYSTEMS.DEFAULT_STAGE_TELEPORT_OPTIONS.ROTATION_Y,
                    },
                },
            );
        });
    }
}
