import * as gameTest from "@minecraft/server-gametest";
import { router, type CanceledResult } from "@kairo-js/router";
import type { GameState } from "../types/gameState";
import type { SkillWrapperContext } from "../types/skillOperation";
import type { ApplyActionsResult, SkillResult } from "../types/skillRuntime";

let registered = false;

export function registerDevGameTests(): void {
    if (registered) return;
    registered = true;

    router.beforeEvents.startup.subscribe((ev) => {
        ev.addonApi.register("dev:resolvePatchedDivination", resolvePatchedDivination);
        ev.addonApi.register("dev:resolveReplacementDivination", resolveReplacementDivination);
        ev.addonApi.register("dev:wrapDivination", wrapDivination);
    });

    gameTest
        .registerAsync("WerewolfDev", "startGameWithSimulatedPlayers", async (test) => {
            const players = [
                test.spawnSimulatedPlayer({ x: 1, y: 2, z: 1 }, "WerewolfDev_Seer"),
                test.spawnSimulatedPlayer({ x: 3, y: 2, z: 1 }, "WerewolfDev_Wolf"),
                test.spawnSimulatedPlayer({ x: 5, y: 2, z: 1 }, "WerewolfDev_Villager"),
            ];

            await router.request("werewolf-gamemanager", "werewolf:devSetRoleComposition", {
                roleComposition: {
                    seer: 1,
                    werewolf: 1,
                    villager: 1,
                },
            });

            const result = await router.request<GameState>("werewolf-gamemanager", "werewolf:devStartGame", {
                playerIds: players.map((player) => player.id),
            });

            if (isCanceledResult(result)) {
                test.fail("devStartGame was canceled");
                return;
            }

            const assignedPlayers = Object.values(result.players);
            if (assignedPlayers.length !== 3) {
                test.fail(`Expected 3 game players, got ${assignedPlayers.length}`);
                return;
            }

            const roles = new Set(assignedPlayers.map((player) => player.roleId));
            for (const roleId of ["seer", "werewolf", "villager"]) {
                if (!roles.has(roleId)) {
                    test.fail(`Expected role "${roleId}" to be assigned`);
                    return;
                }
            }

            test.succeed();
        })
        .maxTicks(200)
        .structureName("gametests:mediumglass");

    gameTest
        .registerAsync("WerewolfDev", "resolveVanillaSkillsWithSimulatedPlayers", async (test) => {
            const players = [
                test.spawnSimulatedPlayer({ x: 1, y: 2, z: 1 }, "WerewolfDev_Seer"),
                test.spawnSimulatedPlayer({ x: 3, y: 2, z: 1 }, "WerewolfDev_Knight"),
                test.spawnSimulatedPlayer({ x: 5, y: 2, z: 1 }, "WerewolfDev_Wolf"),
                test.spawnSimulatedPlayer({ x: 7, y: 2, z: 1 }, "WerewolfDev_Villager"),
            ];

            await router.request("werewolf-gamemanager", "werewolf:devSetRoleComposition", {
                roleComposition: {
                    seer: 1,
                    knight: 1,
                    werewolf: 1,
                    villager: 1,
                },
            });

            const state = await router.request<GameState>("werewolf-gamemanager", "werewolf:devStartGame", {
                playerIds: players.map((player) => player.id),
            });
            if (isCanceledResult(state)) {
                test.fail("devStartGame was canceled");
                return;
            }

            const seer = findPlayerByRole(state, "seer");
            const knight = findPlayerByRole(state, "knight");
            const werewolf = findPlayerByRole(state, "werewolf");
            const villager = findPlayerByRole(state, "villager");
            if (!seer || !knight || !werewolf || !villager) {
                test.fail("Expected seer, knight, werewolf, and villager assignments");
                return;
            }

            const divination = await router.request<SkillResult>("werewolf-gamemanager", "werewolf:resolveSkill", {
                skillId: "vanilla:divination",
                actorId: seer.playerId,
                targetIds: [werewolf.playerId],
            });
            if (isCanceledResult(divination)) {
                test.fail("divination was canceled");
                return;
            }
            const reveal = divination.actions.find((action) => action.type === "reveal");
            if (!reveal || reveal.value !== "werewolf") {
                test.fail(`Expected divination to reveal werewolf, got ${String(reveal?.value)}`);
                return;
            }

            await router.request<SkillResult>("werewolf-gamemanager", "werewolf:resolveSkill", {
                skillId: "vanilla:guard",
                actorId: knight.playerId,
                targetIds: [villager.playerId],
            });

            const guardedAttack = await router.request<ApplyActionsResult>("werewolf-gamemanager", "werewolf:applyActions", {
                actions: [
                    {
                        type: "kill",
                        targetId: villager.playerId,
                        reason: "dev:testGuardedAttack",
                    },
                ],
            });
            if (isCanceledResult(guardedAttack)) {
                test.fail("guarded attack was canceled");
                return;
            }
            if (guardedAttack.applied[0]?.applied !== false || state.players[villager.playerId]?.isAlive !== true) {
                test.fail("Expected guarded attack to be skipped and villager to stay alive");
                return;
            }

            const finalAttack = await router.request<ApplyActionsResult>("werewolf-gamemanager", "werewolf:applyActions", {
                actions: [
                    {
                        type: "kill",
                        targetId: villager.playerId,
                        reason: "dev:testFinalAttack",
                    },
                ],
            });
            if (isCanceledResult(finalAttack)) {
                test.fail("final attack was canceled");
                return;
            }
            if (finalAttack.applied[0]?.applied !== true || state.players[villager.playerId]?.isAlive !== false) {
                test.fail("Expected final attack to kill villager");
                return;
            }

            await router.request<ApplyActionsResult>("werewolf-gamemanager", "werewolf:applyActions", {
                actions: [
                    {
                        type: "kill",
                        targetId: knight.playerId,
                        reason: "dev:testWerewolfWin",
                    },
                ],
            });

            const endedState = await router.request<GameState>("werewolf-gamemanager", "werewolf:devGetGameState");
            if (isCanceledResult(endedState)) {
                test.fail("devGetGameState was canceled");
                return;
            }
            if (endedState.status !== "ended" || !endedState.winnerFactionIds.includes("werewolf")) {
                test.fail(`Expected werewolf win, got status=${endedState.status}, winners=${endedState.winnerFactionIds.join(",")}`);
                return;
            }

            test.succeed();
        })
        .maxTicks(300)
        .structureName("gametests:mediumglass");

    gameTest
        .registerAsync("WerewolfDev", "resolveSkillOperations", async (test) => {
            const actorId = "WerewolfDev_OperationActor";
            const targetId = "WerewolfDev_OperationTarget";

            await clearSkillOperations();

            await router.request("werewolf-gamemanager", "werewolf:registerSkillOperation", {
                op: "patch",
                targetId: "vanilla:divination",
                patch: {
                    handler: {
                        apiName: "dev:resolvePatchedDivination",
                    },
                },
                priority: 10,
            });
            const patched = await resolveDivination(actorId, targetId);
            if (isCanceledResult(patched)) {
                test.fail("patched divination was canceled");
                return;
            }
            if (getRevealValue(patched) !== "patched") {
                test.fail(`Expected patched divination, got ${String(getRevealValue(patched))}`);
                return;
            }

            await clearSkillOperations();

            await router.request("werewolf-gamemanager", "werewolf:registerSkillOperation", {
                op: "replace",
                targetId: "vanilla:divination",
                entry: {
                    id: "vanilla:divination",
                    name: "Dev Replacement Divination",
                    roleId: "seer",
                    handler: {
                        apiName: "dev:resolveReplacementDivination",
                    },
                    uses: 1,
                },
                priority: 10,
            });
            const replaced = await resolveDivination(`${actorId}_Replace`, targetId);
            if (isCanceledResult(replaced)) {
                test.fail("replaced divination was canceled");
                return;
            }
            if (getRevealValue(replaced) !== "replaced") {
                test.fail(`Expected replaced divination, got ${String(getRevealValue(replaced))}`);
                return;
            }

            await clearSkillOperations();

            await router.request("werewolf-gamemanager", "werewolf:registerSkillOperation", {
                op: "wrap",
                targetId: "vanilla:divination",
                wrapper: {
                    id: "dev:wrapDivination",
                    handler: {
                        apiName: "dev:wrapDivination",
                    },
                },
                priority: 10,
            });
            const wrapped = await resolveDivination(`${actorId}_Wrap`, targetId);
            if (isCanceledResult(wrapped)) {
                test.fail("wrapped divination was canceled");
                return;
            }
            if (getRevealValue(wrapped) !== "wrapped") {
                test.fail(`Expected wrapped divination, got ${String(getRevealValue(wrapped))}`);
                return;
            }

            await clearSkillOperations();

            await router.request("werewolf-gamemanager", "werewolf:registerSkillOperation", {
                op: "disable",
                targetId: "vanilla:divination",
                priority: 10,
            });
            const disabled = await resolveDivination(`${actorId}_Disable`, targetId);
            if (isCanceledResult(disabled)) {
                test.fail("disabled divination was canceled");
                return;
            }
            if (disabled.actions.length !== 0 || disabled.metadata?.disabled !== true) {
                test.fail("Expected disabled divination to return empty actions with disabled metadata");
                return;
            }

            await clearSkillOperations();
            test.succeed();
        })
        .maxTicks(300)
        .structureName("gametests:mediumglass");
}

function findPlayerByRole(state: GameState, roleId: string) {
    return Object.values(state.players).find((player) => player.roleId === roleId);
}

function isCanceledResult<T>(value: T | CanceledResult): value is CanceledResult {
    return typeof value === "object" && value !== null && "canceled" in value;
}

async function clearSkillOperations(): Promise<void> {
    await router.request("werewolf-gamemanager", "werewolf:devClearSkillOperations");
}

async function resolveDivination(actorId: string, targetId: string): Promise<SkillResult | CanceledResult> {
    return router.request<SkillResult>("werewolf-gamemanager", "werewolf:resolveSkill", {
        skillId: "vanilla:divination",
        actorId,
        targetIds: [targetId],
    });
}

function getRevealValue(result: SkillResult): unknown {
    return result.actions.find((action) => action.type === "reveal")?.value;
}

function resolvePatchedDivination(context: { actorId: string; targetIds: readonly string[] }): SkillResult {
    return createRevealResult(context.actorId, context.targetIds[0], "patched");
}

function resolveReplacementDivination(context: { actorId: string; targetIds: readonly string[] }): SkillResult {
    return createRevealResult(context.actorId, context.targetIds[0], "replaced");
}

function wrapDivination(context: SkillWrapperContext): SkillResult {
    return {
        ...context.originalResult,
        actions: context.originalResult.actions.map((action) => {
            if (action.type !== "reveal") return action;
            return {
                ...action,
                value: "wrapped",
            };
        }),
    };
}

function createRevealResult(actorId: string, targetId: string | undefined, value: string): SkillResult {
    if (!targetId) return { actions: [] };
    return {
        actions: [
            {
                type: "reveal",
                toPlayerId: actorId,
                targetId,
                key: "dev:divinationResult",
                value,
            },
        ],
    };
}
