import { KairoUtils } from "@kairo-js/router";
import type { RoleDefinition } from "../../../../data/roles";
import { BaseDefinitionValidator } from "../BaseDefinitionValidator";
import type { RoleDefinitionRegistry } from "./RoleDefinitionRegistry";

export class RoleDefinitionValidator extends BaseDefinitionValidator<
    RoleDefinition,
    RoleDefinitionRegistry
> {
    private constructor(registry: RoleDefinitionRegistry) {
        super(registry);
    }
    public static create(roleDefinitionRegistry: RoleDefinitionRegistry) {
        return new RoleDefinitionValidator(roleDefinitionRegistry);
    }

    public isDefinition(data: unknown): data is RoleDefinition {
        if (!this.isObject(data)) return false;

        if (typeof data.id !== "string") return false;
        if (!KairoUtils.isRawMessage(data.name)) return false;
        if (!KairoUtils.isRawMessage(data.description)) return false;
        if (typeof data.factionId !== "string") return false;
        if (typeof data.sortIndex !== "number") return false;

        if (data.roleGroup !== undefined) {
            if (!this.isRoleGroup(data.roleGroup)) return false;
        }

        if (data.count !== undefined && !this.isValidCount(data.count)) return false;
        if (data.color !== undefined && !this.isColorType(data.color)) return false;
        if (data.divinationResult !== undefined && !this.isResultType(data.divinationResult))
            return false;
        if (data.clairvoyanceResult !== undefined && !this.isResultType(data.clairvoyanceResult))
            return false;
        if (data.revealTo !== undefined) {
            if (!this.isRevealTo(data.revealTo)) return false;
        }

        if (data.skills !== undefined) {
            if (!Array.isArray(data.skills)) return false;
            if (!data.skills.every((s) => this.isSkillDefinition(s))) return false;
        }

        if (data.handleGameEvents !== undefined) {
            if (!this.isObject(data.handleGameEvents)) return false;

            for (const [eventType, binding] of Object.entries(data.handleGameEvents)) {
                if (!this.isGameEventType(eventType)) return false;
                if (!this.isSkillEventBinding(binding)) return false;
            }
        }

        if (data.appearance !== undefined) {
            if (!this.isObject(data.appearance)) return false;
            const ap = data.appearance as Record<string, unknown>;
            if (ap.toSelf !== undefined && !this.isRoleRef(ap.toSelf)) return false;
            if (ap.toOthers !== undefined && !this.isRoleRef(ap.toOthers)) return false;
            if (ap.toWerewolves !== undefined && !this.isRoleRef(ap.toWerewolves)) return false;
        }

        return true;
    }

    private isStringArray(x: unknown): x is string[] {
        return Array.isArray(x) && x.every((v) => typeof v === "string");
    }

    private isRoleGroup(x: unknown): boolean {
        if (!this.isObject(x)) return false;

        if (typeof x.id !== "string") return false;
        if (!KairoUtils.isRawMessage(x.name)) return false;
        if (typeof x.color !== "string") return false;

        return true;
    }

    private isRevealTo(x: unknown): boolean {
        if (!this.isObject(x)) return false;

        if (x.roles !== undefined && !this.isStringArray(x.roles)) return false;
        if (x.factions !== undefined && !this.isStringArray(x.factions)) return false;
        if (x.roleGroups !== undefined && !this.isStringArray(x.roleGroups)) return false;

        return true;
    }

    private isValidCount(x: unknown): boolean {
        if (!this.isObject(x)) return false;
        if (x.max !== undefined && typeof x.max !== "number") return false;
        if (x.step !== undefined && typeof x.step !== "number") return false;
        return true;
    }

    private isRoleRef(x: unknown): x is { addonId: string; roleId: string } {
        return this.isObject(x) && typeof x.addonId === "string" && typeof x.roleId === "string";
    }

    private isResultType(x: unknown): x is string {
        return typeof x === "string";
    }

    private isColorType(x: unknown): x is string {
        return typeof x === "string";
    }

    private isGameEventType(x: unknown): x is string {
        return typeof x === "string";
    }

    private isSkillDefinition(x: unknown): boolean {
        if (!this.isObject(x)) return false;

        if (typeof x.id !== "string") return false;
        if (!KairoUtils.isRawMessage(x.name)) return false;

        if (
            x.cooldown !== undefined &&
            typeof x.cooldown !== "number" &&
            typeof x.cooldown !== "string"
        )
            return false;

        if (
            x.maxUses !== undefined &&
            typeof x.maxUses !== "number" &&
            typeof x.maxUses !== "string"
        )
            return false;

        return true;
    }

    private isSkillEventBinding(x: unknown): boolean {
        return this.isObject(x) && typeof x.skillId === "string";
    }
}
