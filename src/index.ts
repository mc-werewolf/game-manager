import { world } from "@minecraft/server";
import { router } from "@kairo-js/router";
import { properties } from "./properties";
import { GAME_START_ITEM, GAME_SETUP_ITEM, JOIN_REGISTER_ITEM, PLAYER_SKILL_ITEM, SPECTATE_REGISTER_ITEM } from "./constants/items";
import { T } from "./constants/translate";
import { WEREWOLF_GAMERULES } from "./constants/gamerules";
import { handleRegisterFaction } from "./api/registerFaction";
import { handleRegisterRole } from "./api/registerRole";
import { handleRegisterSetting } from "./api/registerSetting";
import { handleRegisterSkill } from "./api/registerSkill";
import { handleRegisterSkillOperation } from "./api/registerSkillOperation";
import { handleRegisterPhase } from "./api/registerPhase";
import { handleApplyActions } from "./api/applyActions";
import { handleDevClearSkillOperations, handleDevGetGameState, handleDevSetRoleComposition, handleDevStartGame } from "./api/devTools";
import { handleResolveGameConfig } from "./api/resolveGameConfig";
import { handleResolveSkill } from "./api/resolveSkill";
import { handleGetSettings, handleResetSettings, handleSetSetting } from "./api/settings";
import { isDevModeEnabled } from "./dev/devMode";
import { giveSetupItems } from "./game/playerItems";
import { prepareGameStart } from "./game/startGame";
import { participationState } from "./state/participationState";
import { getCurrentGameState } from "./state/gameState";
import { openSetupForm } from "./forms/setupForm";
import { openSkillForm } from "./forms/skillForm";
import { restoreGameManagerState } from "./persistence/gameManagerPersistence";
import { tr } from "./ui/text";

router.init(properties);

router.beforeEvents.startup.subscribe((ev) => {
    ev.addonApi.register("werewolf:registerFaction", handleRegisterFaction);
    ev.addonApi.register("werewolf:registerRole", handleRegisterRole);
    ev.addonApi.register("werewolf:registerSkill", handleRegisterSkill);
    ev.addonApi.register("werewolf:registerSkillOperation", handleRegisterSkillOperation);
    ev.addonApi.register("werewolf:registerPhase", handleRegisterPhase);
    ev.addonApi.register("werewolf:registerSetting", handleRegisterSetting);
    ev.addonApi.register("werewolf:getSettings", handleGetSettings);
    ev.addonApi.register("werewolf:setSetting", handleSetSetting);
    ev.addonApi.register("werewolf:resetSettings", handleResetSettings);
    ev.addonApi.register("werewolf:resolveGameConfig", handleResolveGameConfig);
    ev.addonApi.register("werewolf:resolveSkill", handleResolveSkill);
    ev.addonApi.register("werewolf:applyActions", handleApplyActions);

    if (isDevModeEnabled()) {
        ev.addonApi.register("werewolf:devSetRoleComposition", handleDevSetRoleComposition);
        ev.addonApi.register("werewolf:devStartGame", handleDevStartGame);
        ev.addonApi.register("werewolf:devGetGameState", handleDevGetGameState);
        ev.addonApi.register("werewolf:devClearSkillOperations", handleDevClearSkillOperations);
    }
});

if (isDevModeEnabled()) {
    import("./dev/gametests").then(({ registerDevGameTests }) => {
        registerDevGameTests();
    }).catch((err) => {
        console.error("[game-manager] Failed to register dev GameTests:", err);
    });
}

router.afterEvents.addonActivate.subscribe((_ev) => {
    Object.assign(world.gameRules, WEREWOLF_GAMERULES);
    restoreGameManagerState().catch((err) => {
        console.error("[game-manager] Failed to restore state:", err);
    });

    for (const player of world.getPlayers()) {
        giveSetupItems(player);
    }

    router.afterEvents.playerSpawn.subscribe((ev) => {
        if (getCurrentGameState()?.status === "running") return;
        giveSetupItems(ev.player);
    });

    router.afterEvents.itemUse.subscribe((ev) => {
        if (ev.itemStack.typeId === GAME_SETUP_ITEM) {
            openSetupForm(ev.source);
            return;
        }
        if (ev.itemStack.typeId === JOIN_REGISTER_ITEM) {
            participationState.join(ev.source.id);
            ev.source.sendMessage(tr(T.participation.joined));
            return;
        }
        if (ev.itemStack.typeId === SPECTATE_REGISTER_ITEM) {
            participationState.spectate(ev.source.id);
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
        if (ev.itemStack.typeId === PLAYER_SKILL_ITEM) {
            openSkillForm(ev.source).catch((err) => {
                console.error("[game-manager] Failed to open skill form:", err);
            });
        }
    });
});
