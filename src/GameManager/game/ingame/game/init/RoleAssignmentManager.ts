import type { Player } from "@minecraft/server";
import type { GameInitializer } from "./GameInitializer";
import { defaultRole, type RoleDefinition } from "../../../../data/roles";

export class RoleAssignmentManager {
    private constructor(private readonly gameInitializer: GameInitializer) {}
    public static create(gameInitializer: GameInitializer): RoleAssignmentManager {
        return new RoleAssignmentManager(gameInitializer);
    }

    public assign(players: Player[]): void {
        const rolePool = this.buildRolePool(
            this.gameInitializer.getInGameManager().getEnabledRoles(),
            players.length,
        );
        this.shuffle(rolePool);

        players.forEach((player, index) => {
            const role = rolePool[index];
            if (!role) return;

            this.assignRoleToPlayer(player, role);
        });
    }

    private assignRoleToPlayer(player: Player, role: RoleDefinition): void {
        const playerData = this.gameInitializer.getInGameManager().getPlayerData(player.id);
        playerData.setRole(role);
    }

    private buildRolePool(
        roleComposition: RoleDefinition[],
        playerCount: number,
    ): RoleDefinition[] {
        const pool: RoleDefinition[] = [];

        for (const role of roleComposition) {
            const amount = this.gameInitializer.getInGameManager().getRoleCount(role.id);
            for (let i = 0; i < amount; i++) {
                pool.push(role);
            }
        }

        while (pool.length < playerCount) {
            // StandardRoles から、村人をデフォルト役職として定義してGameManagerに保存し、
            // それをここで利用するに今後する
            // GameManager でデフォルト役職を定義するのはなんか違う気がするので一旦保留
            pool.push(defaultRole);
        }

        return pool;
    }

    private shuffle<T>(array: Array<T | undefined>): void {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
}
