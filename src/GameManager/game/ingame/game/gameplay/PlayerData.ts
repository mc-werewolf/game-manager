import type { Player, RawMessage } from "@minecraft/server";
import type { RoleDefinition } from "../../../../data/roles";
import type { PlayersDataManager } from "./PlayersDataManager";
import type { FactionDefinition } from "../../../../data/factions";

export type ParticipationState = "participant" | "spectator";
export interface PlayerSkillState {
    name: RawMessage;
    cooldownRemaining: number;
    remainingUses: number;
}

export class PlayerData {
    public name: string;
    public isAlive: boolean = true;
    public isLeave: boolean = false;
    public isVictory: boolean = false;
    public role: RoleDefinition | null = null;
    public readonly skillStates = new Map<string, PlayerSkillState>();

    public tmpArrowCooldown: number = 0; // 仮襲撃クールタイム

    constructor(
        private readonly playerDataManager: PlayersDataManager,
        public readonly player: Player,
        public state: ParticipationState = "participant",
    ) {
        this.name = player.name;
    }

    public get isParticipating(): boolean {
        return this.state === "participant";
    }

    public setRole(role: RoleDefinition): void {
        this.role = role;

        this.initSkillStates();

        const faction = this.playerDataManager
            .getInGameManager()
            .getDefinitionById<FactionDefinition>("faction", this.role.factionId);
        if (!faction) return;

        if (this.role.color === undefined) {
            this.role.color = faction.defaultColor;
        }
    }

    private initSkillStates(): void {
        this.skillStates.clear();

        if (!this.role?.skills) return;

        const gameManager = this.playerDataManager.getInGameManager();

        for (const skill of this.role.skills) {
            // number | string なので、string の場合の解決を後に作る必要がある
            // const cooldown = gameManager.resolveSkillValue(skill.cooldown);
            // const maxUses = gameManager.resolveSkillValue(skill.maxUses);

            const uses = skill.maxUses as number;
            this.skillStates.set(skill.id, {
                name: skill.name,
                cooldownRemaining: 0,
                remainingUses: uses, // とりあえずnumberで固定
            });
        }
    }
}
