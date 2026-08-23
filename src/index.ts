import { world, type Player } from "@minecraft/server";
import { router } from "@kairo-js/router";
import { properties } from "./properties";
import { GAME_COMBAT_COOLDOWN_BOW_ITEM, GAME_FORCE_TERMINATOR_ITEM, GAME_START_ITEM, GAME_SETUP_ITEM, JOIN_REGISTER_ITEM, PROFILE_ITEM, SKILL_BOOK_ITEM, SKILL_COOLDOWN_ITEM, SPECTATE_REGISTER_ITEM } from "./constants/items";
import { T } from "./constants/translate";
import { WEREWOLF_GAMERULES } from "./constants/gamerules";
import { handleRegisterFaction } from "./api/registerFaction";
import { handleRegisterRole } from "./api/registerRole";
import { handleRegisterSetting } from "./api/registerSetting";
import { handleRegisterSetupFormAction } from "./api/registerSetupFormAction";
import { handleRegisterGameStartPresentationStep } from "./api/registerGameStartPresentationStep";
import { handleRegisterSkill } from "./api/registerSkill";
import { handleRegisterSkillOperation } from "./api/registerSkillOperation";
import { handleRegisterPhase } from "./api/registerPhase";
import { handleApplyActions } from "./api/applyActions";
import { handleDevClearSkillOperations, handleDevGetGameState, handleDevSetRoleComposition, handleDevStartGame } from "./api/devTools";
import { handleResolveGameConfig } from "./api/resolveGameConfig";
import { handleResolveSkill } from "./api/resolveSkill";
import { handleGetSettings, handleResetSettings, handleSetSetting } from "./api/settings";
import { handleGetPublicServerSnapshot } from "./api/getPublicServerSnapshot";
import { isDevModeEnabled } from "./dev/devMode";
import { getCurrentSkillCooldownSeconds, giveForceTerminatorItem, giveGameItems, giveSetupItems } from "./game/playerItems";
import { prepareGameStart } from "./game/startGame";
import { forceEndGame } from "./game/endGame";
import { giveCombatItemsIfAlive, handleCombatEntityDie, handleCombatEntityHurt, handleCombatItemUse, handleCombatProjectileHitBlock, handleCombatProjectileHitEntity } from "./game/combat";
import { getGamePlayerId, getWorldPlayers, matchesGamePlayerId } from "./game/playerIdentity";
import { handlePlayerLeave } from "./game/playerLeave";
import { applyRunningGameSpawnGameMode } from "./game/gameModes";
import { participationState } from "./state/participationState";
import { getCurrentGameState } from "./state/gameState";
import { openSetupForm } from "./forms/setupForm";
import { openProfileForm } from "./forms/profileForm";
import { openSkillForm } from "./forms/skillForm";
import { restoreGameManagerState, saveParticipation, savePlayerProfiles } from "./persistence/gameManagerPersistence";
import { playerProfiles } from "./state/playerProfiles";
import { tr, trWith } from "./ui/text";
import { playPlayerSound } from "./ui/sounds";

const ARROW_COOLDOWN_ERROR_MESSAGE_COOLDOWN_TICKS = 60;
const arrowCooldownErrorMessageTicks = new Map<string, number>();
const skillCooldownErrorMessageSeconds = new Map<string, number>();

router.init(properties);

router.beforeEvents.startup.subscribe((ev) => {
    ev.addonApi.register("werewolf:registerFaction", handleRegisterFaction);
    ev.addonApi.register("werewolf:registerRole", handleRegisterRole);
    ev.addonApi.register("werewolf:registerSkill", handleRegisterSkill);
    ev.addonApi.register("werewolf:registerSkillOperation", handleRegisterSkillOperation);
    ev.addonApi.register("werewolf:registerPhase", handleRegisterPhase);
    ev.addonApi.register("werewolf:registerSetting", handleRegisterSetting);
    ev.addonApi.register("werewolf:registerSetupFormAction", handleRegisterSetupFormAction);
    ev.addonApi.register("werewolf:registerGameStartPresentationStep", handleRegisterGameStartPresentationStep);
    ev.addonApi.register("werewolf:getSettings", handleGetSettings);
    ev.addonApi.register("werewolf:setSetting", handleSetSetting);
    ev.addonApi.register("werewolf:resetSettings", handleResetSettings);
    ev.addonApi.register("werewolf:resolveGameConfig", handleResolveGameConfig);
    ev.addonApi.register("werewolf:resolveSkill", handleResolveSkill);
    ev.addonApi.register("werewolf:applyActions", handleApplyActions);
    ev.addonApi.register("werewolf:getPublicServerSnapshot", handleGetPublicServerSnapshot);

    if (isDevModeEnabled()) {
        ev.addonApi.register("werewolf:devSetRoleComposition", handleDevSetRoleComposition);
        ev.addonApi.register("werewolf:devStartGame", handleDevStartGame);
        ev.addonApi.register("werewolf:devGetGameState", handleDevGetGameState);
        ev.addonApi.register("werewolf:devClearSkillOperations", handleDevClearSkillOperations);
    }
});

router.afterEvents.addonActivate.subscribe((_ev) => {
    Object.assign(world.gameRules, WEREWOLF_GAMERULES);
    restoreGameManagerState().then(() => {
        registerCurrentSeasonPlayers(getWorldPlayers());
        for (const player of getWorldPlayers()) {
            giveSetupItems(player);
        }
    }).catch((err) => {
        console.error("[game-manager] Failed to restore state:", err);
    });

    router.afterEvents.playerJoin.subscribe((ev) => {
        const player = getJoinedPlayer(ev);
        if (player) {
            registerCurrentSeasonPlayers([player]);
        }
    });
    router.afterEvents.playerLeave.subscribe(handlePlayerLeave);

    router.afterEvents.playerSpawn.subscribe((ev) => {
        const state = getCurrentGameState();
        if (state?.status === "running") {
            applyRunningGameSpawnGameMode(state, ev.player);
            if (!state.gameplayStarted) {
                giveForceTerminatorItem(ev.player);
                return;
            }
            giveGameItems(ev.player);
            giveCombatItemsIfAlive(ev.player);
            return;
        }
        giveSetupItems(ev.player);
    });

    router.beforeEvents.entityHurt.subscribe(handleCombatEntityHurt);
    router.afterEvents.entityDie.subscribe(handleCombatEntityDie);
    router.afterEvents.projectileHitBlock.subscribe(handleCombatProjectileHitBlock);
    router.afterEvents.projectileHitEntity.subscribe(handleCombatProjectileHitEntity);

    router.afterEvents.itemUse.subscribe((ev) => {
        if (ev.itemStack.typeId === GAME_COMBAT_COOLDOWN_BOW_ITEM) {
            showArrowCooldownError(ev.source, ev.itemStack.amount);
            return;
        }

        if (ev.itemStack.typeId === SKILL_COOLDOWN_ITEM) {
            const remainingSeconds = getCurrentSkillCooldownSeconds(ev.source) ?? ev.itemStack.amount;
            showSkillCooldownError(ev.source, remainingSeconds);
            return;
        }

        if (ev.itemStack.typeId === SKILL_BOOK_ITEM) {
            skillCooldownErrorMessageSeconds.delete(getGamePlayerId(ev.source));
            openSkillForm(ev.source).catch((err) => {
                console.error("[game-manager] Failed to open skill form:", err);
            });
            return;
        }

        handleCombatItemUse(ev.source, ev.itemStack.typeId);

        if (ev.itemStack.typeId === GAME_FORCE_TERMINATOR_ITEM) {
            const state = getCurrentGameState();
            if (state?.status === "running") {
                forceEndGame(state, ev.source.name);
            }
            return;
        }
        if (ev.itemStack.typeId === PROFILE_ITEM) {
            openProfileForm(ev.source).catch((err) => {
                console.error("[game-manager] Failed to open profile form:", err);
            });
            return;
        }
        if (ev.itemStack.typeId === GAME_SETUP_ITEM) {
            openSetupForm(ev.source);
            return;
        }
        if (ev.itemStack.typeId === JOIN_REGISTER_ITEM) {
            participationState.join(getGamePlayerId(ev.source));
            saveParticipation();
            giveSetupItems(ev.source);
            ev.source.sendMessage(tr(T.participation.joined));
            return;
        }
        if (ev.itemStack.typeId === SPECTATE_REGISTER_ITEM) {
            participationState.spectate(getGamePlayerId(ev.source));
            saveParticipation();
            giveSetupItems(ev.source);
            ev.source.sendMessage(tr(T.participation.spectating));
            return;
        }
        if (ev.itemStack.typeId === GAME_START_ITEM) {
            prepareGameStart().catch((err) => {
                console.error("[game-manager] Failed to prepare game start:", err);
                ev.source.sendMessage(tr(err instanceof Error ? err.message : T.game.startFailed));
            });
            return;
        }
    });

    router.afterEvents.playerInteractWithEntity.subscribe((ev) => {
        if (getCurrentGameState()?.status === "running") return;
        if (ev.target.typeId !== "minecraft:player") return;
        if (ev.target.id === ev.player.id) return;

        openProfileForm(ev.player, ev.target as Player).catch((err) => {
            console.error("[game-manager] Failed to open target profile form:", err);
        });
    });
});

function showArrowCooldownError(player: Player, remainingSeconds: number): void {
    const playerId = getGamePlayerId(player);
    const currentTick = router.currentTick;
    const nextAvailableTick = arrowCooldownErrorMessageTicks.get(playerId) ?? 0;
    if (currentTick < nextAvailableTick) return;

    arrowCooldownErrorMessageTicks.set(playerId, currentTick + ARROW_COOLDOWN_ERROR_MESSAGE_COOLDOWN_TICKS);
    player.sendMessage(trWith(T.game.arrowCooldownError, [String(remainingSeconds)]));
    playPlayerSound(player, "note.bass", undefined, "arrow cooldown error sound");
}

function showSkillCooldownError(player: Player, remainingSeconds: number): void {
    const playerId = getGamePlayerId(player);
    if (skillCooldownErrorMessageSeconds.get(playerId) === remainingSeconds) return;

    skillCooldownErrorMessageSeconds.set(playerId, remainingSeconds);
    player.sendMessage(trWith(T.skill.onCooldown, [String(remainingSeconds)]));
    playPlayerSound(player, "note.bass", undefined, "skill cooldown error sound");
}

function registerCurrentSeasonPlayers(players: readonly Player[]): void {
    let changed = false;
    for (const player of players) {
        changed = playerProfiles.ensureCurrentSeason(getGamePlayerId(player), player.name) || changed;
    }
    if (changed) {
        savePlayerProfiles();
    }
}

function getJoinedPlayer(ev: unknown): Player | undefined {
    const candidate = ev as { readonly player?: Player; readonly playerId?: string; readonly playerName?: string };
    if (candidate.player) return candidate.player;
    return getWorldPlayers().find((player) =>
        (candidate.playerId !== undefined && matchesGamePlayerId(player, candidate.playerId))
        || player.name === candidate.playerName
    );
}
