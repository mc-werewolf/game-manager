import { router, type CanceledResult } from "@kairo-js/router";
import { skillOperationRegistry } from "../registry/skillOperationRegistry";
import { skillRegistry } from "../registry/skillRegistry";
import { createGameConfigSnapshot, getCurrentGameConfigSnapshot } from "../state/gameConfigSnapshot";
import { getCurrentGameState } from "../state/gameState";
import { skillUsageState } from "../state/skillUsageState";
import type { GameConfigSnapshot } from "../types/gameConfigSnapshot";
import type { StoredSkill } from "../types/skill";
import type { SkillPatch, SkillWrapperContext, StoredSkillOperation, StoredWrapSkillOperation } from "../types/skillOperation";
import type { ApplyActionsResult, ResolveSkillArgs, SkillContext, SkillResult } from "../types/skillRuntime";

type ResolvedSkillOperations = {
    readonly skill: StoredSkill;
    readonly disabledBy: StoredSkillOperation | undefined;
    readonly wrappers: readonly StoredWrapSkillOperation[];
};

export async function handleResolveSkill(args: ResolveSkillArgs): Promise<SkillResult | CanceledResult> {
    const snapshot = args.snapshot ?? getCurrentGameConfigSnapshot() ?? createGameConfigSnapshot();
    const game = getCurrentGameState();
    if (game?.status === "ended") {
        throw new Error("[game-manager] Cannot resolve skill after the game has ended");
    }
    const skill = snapshot.skills[args.skillId] ?? skillRegistry.get(args.skillId);
    if (!skill) {
        throw new Error(`[game-manager] Skill "${args.skillId}" is not registered`);
    }
    const resolved = resolveSkillOperations(skill);
    if (!resolved.disabledBy) {
        assertSkillUsable(resolved.skill, args.actorId);
    }

    const context: SkillContext = {
        skillId: resolved.skill.skillId,
        actorId: args.actorId,
        targetIds: args.targetIds ?? [],
        snapshot,
        game,
        ...(args.metadata === undefined ? {} : { metadata: args.metadata }),
    };

    router.emit("werewolf:skillRequested", context);
    router.emit("werewolf:skillUsed", context);

    if (resolved.disabledBy) {
        const disabledResult = normalizeSkillResult({
            actions: [],
            metadata: {
                disabled: true,
                disabledBy: resolved.disabledBy.addonId,
                targetSkillId: resolved.disabledBy.targetId,
            },
        });
        router.emit("werewolf:skillResolved", {
            context,
            result: disabledResult,
        });
        return disabledResult;
    }

    const result = await resolveSkillHandler(resolved.skill, context, resolved.wrappers);
    if (isCanceledResult(result)) return result;

    const normalized = normalizeSkillResult(result);
    skillUsageState.consume(args.actorId, resolved.skill.skillId, router.currentTick);
    router.emit("werewolf:skillResolved", {
        context,
        result: normalized,
    });

    await router.request<ApplyActionsResult>("werewolf-gamemanager", "werewolf:applyActions", {
        actions: normalized.actions,
        context,
    });
    return normalized;
}

async function resolveSkillHandler(
    skill: StoredSkill,
    context: SkillContext,
    wrappers: readonly StoredWrapSkillOperation[],
): Promise<SkillResult | CanceledResult> {
    const result = await router.request<SkillResult>(skill.handler.addonId, skill.handler.apiName, context);
    if (isCanceledResult(result)) return result;

    let current = normalizeSkillResult(result);
    for (const operation of wrappers) {
        const wrapperContext: SkillWrapperContext = {
            ...context,
            wrapperId: operation.wrapper.id,
            targetSkillId: operation.targetId,
            originalResult: current,
        };
        const wrapped = await router.request<SkillResult>(
            operation.wrapper.handler.addonId,
            operation.wrapper.handler.apiName,
            wrapperContext,
        );
        if (isCanceledResult(wrapped)) return wrapped;
        current = normalizeSkillResult(wrapped);
    }
    return current;
}

function normalizeSkillResult(result: SkillResult | undefined): SkillResult {
    return {
        actions: result?.actions ?? [],
        ...(result?.messages === undefined ? {} : { messages: result.messages }),
        ...(result?.metadata === undefined ? {} : { metadata: result.metadata }),
    };
}

function isCanceledResult(value: SkillResult | CanceledResult | undefined): value is CanceledResult {
    return typeof value === "object" && value !== null && "canceled" in value;
}

function resolveSkillOperations(baseSkill: StoredSkill): ResolvedSkillOperations {
    const operations = sortOperations(skillOperationRegistry.getForTarget(baseSkill.skillId));
    const terminal = operations.find((operation) => operation.op === "disable" || operation.op === "replace");
    if (terminal?.op === "disable") {
        return {
            skill: baseSkill,
            disabledBy: terminal,
            wrappers: [],
        };
    }

    let skill = terminal?.op === "replace" ? terminal.entry : baseSkill;
    const patches = operations
        .filter((operation) => operation.op === "patch")
        .sort(compareOperationsAscending);
    for (const operation of patches) {
        skill = applySkillPatch(skill, operation.patch);
    }

    const wrappers = operations
        .filter((operation): operation is StoredWrapSkillOperation => operation.op === "wrap")
        .sort(compareOperationsAscending);

    return {
        skill,
        disabledBy: undefined,
        wrappers,
    };
}

function applySkillPatch(skill: StoredSkill, patch: SkillPatch): StoredSkill {
    return {
        ...skill,
        ...("name" in patch ? { name: patch.name ?? skill.name } : {}),
        ...("description" in patch ? { description: patch.description } : {}),
        ...("roleId" in patch ? { roleId: patch.roleId } : {}),
        ...("phaseId" in patch ? { phaseId: patch.phaseId } : {}),
        ...("timing" in patch ? { timing: patch.timing } : {}),
        ...("target" in patch ? { target: patch.target } : {}),
        ...("handler" in patch && patch.handler !== undefined ? { handler: patch.handler } : {}),
        ...("cooldownTicks" in patch ? { cooldownTicks: patch.cooldownTicks } : {}),
        ...("uses" in patch ? { uses: patch.uses } : {}),
        ...("priority" in patch ? { priority: patch.priority } : {}),
        ...("tags" in patch ? { tags: patch.tags } : {}),
    };
}

function sortOperations(operations: readonly StoredSkillOperation[]): StoredSkillOperation[] {
    return [...operations].sort(compareOperationsDescending);
}

function compareOperationsDescending(a: StoredSkillOperation, b: StoredSkillOperation): number {
    return b.priority - a.priority || a.addonId.localeCompare(b.addonId) || a.order - b.order;
}

function compareOperationsAscending(a: StoredSkillOperation, b: StoredSkillOperation): number {
    return a.priority - b.priority || b.addonId.localeCompare(a.addonId) || b.order - a.order;
}

function assertSkillUsable(skill: StoredSkill, actorId: string): void {
    const usage = skillUsageState.get(actorId, skill.skillId);
    if (skill.uses !== undefined && usage.uses >= skill.uses) {
        throw new Error(`[game-manager] Skill "${skill.skillId}" has no uses remaining`);
    }

    if (skill.cooldownTicks === undefined || usage.lastUsedTick === undefined) return;
    const elapsedTicks = router.currentTick - usage.lastUsedTick;
    if (elapsedTicks < skill.cooldownTicks) {
        throw new Error(`[game-manager] Skill "${skill.skillId}" is on cooldown for ${skill.cooldownTicks - elapsedTicks} more ticks`);
    }
}
