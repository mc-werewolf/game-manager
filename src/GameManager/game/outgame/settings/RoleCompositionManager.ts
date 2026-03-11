import { Player, world, type RawMessage } from "@minecraft/server";
import type { GameSettingManager } from "./GameSettingManager";
import { ActionFormData, MessageFormData, ModalFormData } from "@minecraft/server-ui";
import type { RoleDefinition } from "../../../data/roles";
import { WEREWOLF_GAMEMANAGER_TRANSLATE_IDS } from "../../../constants/translate";
import { SYSTEMS } from "../../../constants/systems";
import type { FactionDefinition } from "../../../data/factions";
import type { RoleCountMap } from "../../system/definitions/roles/RoleDefinitionRegistry";
import { ConsoleManager } from "@kairo-js/router";

// クラスが肥大化気味なので、UI部分と責務を分断したい
export class RoleCompositionManager {
    private constructor(private readonly gameSettingManager: GameSettingManager) {}
    public static create(gameSettingManager: GameSettingManager): RoleCompositionManager {
        return new RoleCompositionManager(gameSettingManager);
    }

    public async open(playerId: string): Promise<void> {
        const player = world.getPlayers().find((p) => p.id === playerId);
        if (player === undefined) {
            ConsoleManager.error("[RoleCompositionManager] Player not Found");
            return;
        }

        const registeredRoleDefinitions =
            this.gameSettingManager.getDefinitionsMap<RoleDefinition>("role");

        const workingRoleComposition: RoleCountMap = {
            ...this.gameSettingManager.getAllRoleCounts(),
        };

        this.openOverviewForm(player, registeredRoleDefinitions, workingRoleComposition);
    }

    private async openOverviewForm(
        player: Player,
        registeredRoleDefinitions: Map<string, RoleDefinition[]>,
        workingRoleComposition: RoleCountMap,
    ): Promise<void> {
        const addonIds = Array.from(registeredRoleDefinitions.keys()).sort((a, b) =>
            a.localeCompare(b, "en", { numeric: true }),
        );

        let roleCount = 0;
        const workingRolesList = [...registeredRoleDefinitions.values()]
            .flat()
            .filter((role) => (workingRoleComposition[role.id] ?? 0) > 0)
            .sort((a, b) => this.gameSettingManager.compareRoleDefinitions(a, b))
            .map((role): RawMessage => {
                const rawMessage: RawMessage[] = [];
                const faction = this.gameSettingManager.getDefinitionById<FactionDefinition>(
                    "faction",
                    role.factionId,
                );

                if (role.color !== undefined) rawMessage.push({ text: `\n${role.color}` });
                else if (faction !== undefined)
                    rawMessage.push({ text: `\n${faction.defaultColor}` });

                const amount = workingRoleComposition[role.id] ?? 0;

                rawMessage.push(role.name);
                rawMessage.push({ text: `${SYSTEMS.COLOR_CODE.RESET}: ${amount}` });

                roleCount += amount;

                return { rawtext: rawMessage };
            });

        const formBody: RawMessage[] = [];
        if (workingRolesList.length === 0)
            formBody.push({
                translate: WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_ROLE_COMPOSITION_NONE_ROLES,
            });
        else {
            formBody.push({
                translate:
                    WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_ROLE_COMPOSITION_SELECTED_ROLES,
            });

            workingRolesList.push(
                { text: "\n\n" },
                {
                    translate:
                        WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_ROLE_COMPOSITION_APPLIED_CHANGES_NOTICE_TOTAL,
                    with: [roleCount.toString()],
                },
            );

            formBody.push(...workingRolesList);
        }

        const form = new ActionFormData()
            .title({
                translate: WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_ROLE_COMPOSITION_TITLE,
            })
            .body({ rawtext: formBody })
            .divider()
            .button({
                translate: WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_ROLE_COMPOSITION_CONFIRM,
            })
            .divider()
            .button({
                translate:
                    WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_ROLE_COMPOSITION_ALL_ROLES_BUTTON,
            });
        for (const addonId of addonIds) {
            form.button({ translate: `${addonId}.name` });
        }
        const { selection, canceled, cancelationReason } = await form.show(player);
        if (canceled || selection === undefined) {
            if (this.hasRoleCompositionChanged(workingRoleComposition))
                return this.openCancelForm(
                    player,
                    registeredRoleDefinitions,
                    workingRoleComposition,
                );
            else return;
        }

        if (selection === 0) this.applyChanges(player, workingRoleComposition);
        else if (selection === 1)
            this.openEditorFormForAllAddons(
                player,
                registeredRoleDefinitions,
                workingRoleComposition,
            );
        else {
            const addonId = addonIds[selection - 2];
            if (addonId === undefined) return;
            return this.openEditorForm(
                player,
                registeredRoleDefinitions,
                workingRoleComposition,
                addonId,
            );
        }
    }

    public async openEditorForm(
        player: Player,
        registeredRoleDefinitions: Map<string, RoleDefinition[]>,
        workingRoleComposition: RoleCountMap,
        addonId: string,
    ): Promise<void> {
        const form = new ModalFormData().title({ translate: `${addonId}.name` });

        const registeredRolesForAddon = registeredRoleDefinitions.get(addonId);
        if (registeredRolesForAddon === undefined) return;

        for (const role of registeredRolesForAddon) {
            const faction = this.gameSettingManager.getDefinitionById<FactionDefinition>(
                "faction",
                role.factionId,
            );
            if (faction === undefined) continue;

            const color = role.color ?? faction.defaultColor;
            const maxValue = role.count?.max ?? 4;
            const defaultValue = workingRoleComposition[role.id] ?? 0;
            const valueStep = role.count?.step ?? 1;
            const tooltip = {
                rawtext: [
                    { text: color },
                    role.name,
                    { text: `${SYSTEMS.COLOR_CODE.RESET}\n` },
                    role.description,
                    { text: "\n\n" },
                    /**
                     * Name:
                     * Faction:
                     * Count:
                     * Fortune Result:
                     * Medium Result:
                     */
                ],
            };
            form.slider(
                { rawtext: [{ text: color }, role.name, { text: SYSTEMS.COLOR_CODE.RESET }] },
                0,
                maxValue,
                { defaultValue, tooltip, valueStep },
            );
        }

        const { formValues, canceled, cancelationReason } = await form.show(player);
        if (canceled || formValues === undefined) {
            return this.openOverviewForm(player, registeredRoleDefinitions, workingRoleComposition);
        }

        registeredRolesForAddon.forEach((role, index) => {
            const newValue = formValues[index];
            if (typeof newValue !== "number") return;
            workingRoleComposition[role.id] = newValue;
        });

        return this.openOverviewForm(player, registeredRoleDefinitions, workingRoleComposition);
    }

    public async openEditorFormForAllAddons(
        player: Player,
        registeredRoleDefinitions: Map<string, RoleDefinition[]>,
        workingRoleComposition: RoleCountMap,
    ): Promise<void> {
        const form = new ModalFormData().title({
            translate:
                WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_ROLE_COMPOSITION_ALL_ROLES_BUTTON,
        });

        const registeredAllRoles: RoleDefinition[] = [...registeredRoleDefinitions.values()]
            .flat()
            .sort((a, b) => this.gameSettingManager.compareRoleDefinitions(a, b))
            .map((role) => {
                const faction = this.gameSettingManager.getDefinitionById<FactionDefinition>(
                    "faction",
                    role.factionId,
                );
                if (faction === undefined) return null;

                const color = role.color ?? faction.defaultColor;
                const maxValue = role.count?.max ?? 4;
                const defaultValue = workingRoleComposition[role.id] ?? 0;
                const valueStep = role.count?.step ?? 1;
                const tooltip = {
                    rawtext: [
                        { text: color },
                        role.name,
                        { text: `${SYSTEMS.COLOR_CODE.RESET}\n` },
                        role.description,
                        { text: "\n\n" },
                        /**
                         * Name:
                         * Faction:
                         * Count:
                         * Fortune Result:
                         * Medium Result:
                         */
                    ],
                };
                form.slider(
                    { rawtext: [{ text: color }, role.name, { text: SYSTEMS.COLOR_CODE.RESET }] },
                    0,
                    maxValue,
                    { defaultValue, tooltip, valueStep },
                );

                return role;
            })
            .filter((role) => role !== null);

        const { formValues, canceled, cancelationReason } = await form.show(player);
        if (canceled || formValues === undefined) {
            return this.openOverviewForm(player, registeredRoleDefinitions, workingRoleComposition);
        }

        registeredAllRoles.forEach((role, index) => {
            const newValue = formValues[index];
            if (typeof newValue !== "number") return;
            workingRoleComposition[role.id] = newValue;
        });

        return this.openOverviewForm(player, registeredRoleDefinitions, workingRoleComposition);
    }

    public async openCancelForm(
        player: Player,
        registeredRoleDefinitions: Map<string, RoleDefinition[]>,
        workingRoleComposition: RoleCountMap,
    ): Promise<void> {
        const form = new MessageFormData()
            .title({
                translate:
                    WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_ROLE_COMPOSITION_CANCEL_FORM_TITLE,
            })
            .body({
                translate:
                    WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_ROLE_COMPOSITION_CANCEL_FORM_MESSAGE,
            })
            .button1({
                translate:
                    WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_ROLE_COMPOSITION_CANCEL_FORM_DISCARD_BUTTON,
            })
            .button2({
                translate:
                    WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_ROLE_COMPOSITION_CANCEL_FORM_BACK_BUTTON,
            });

        const { selection, canceled, cancelationReason } = await form.show(player);
        if (canceled || selection === undefined) {
            return this.openOverviewForm(player, registeredRoleDefinitions, workingRoleComposition);
        }

        switch (selection) {
            case 0:
                return;
            case 1:
                return this.openOverviewForm(
                    player,
                    registeredRoleDefinitions,
                    workingRoleComposition,
                );
        }
    }

    public async applyChanges(player: Player, workingRoleComposition: RoleCountMap): Promise<void> {
        if (!this.hasRoleCompositionChanged(workingRoleComposition)) return;

        this.gameSettingManager.setAllRoleCounts(workingRoleComposition);
        const roleDefinitionsAfterApply = this.gameSettingManager.getEnabledRoles();

        world.sendMessage({
            translate:
                WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_ROLE_COMPOSITION_APPLIED_CHANGES_NOTICE,
            with: [player.name],
        });
        const roleListMessage: RawMessage[] = [];
        roleListMessage.push({ text: SYSTEMS.SEPARATOR.LINE_CYAN + "\n" });

        let roleCount = 0;
        for (const role of this.gameSettingManager.sortRoleDefinitions(roleDefinitionsAfterApply)) {
            const rawMessage: RawMessage[] = [];
            const faction = this.gameSettingManager.getDefinitionById<FactionDefinition>(
                "faction",
                role.factionId,
            );

            if (role.color !== undefined) rawMessage.push({ text: `${role.color}` });
            else if (faction !== undefined) rawMessage.push({ text: `${faction.defaultColor}` });

            const amount = this.gameSettingManager.getRoleCount(role.id);

            rawMessage.push(role.name);
            rawMessage.push({ text: `${SYSTEMS.COLOR_CODE.RESET}: ${amount}\n` });

            roleCount += amount;

            roleListMessage.push({ rawtext: rawMessage });
        }
        roleListMessage.push(
            { text: "\n" },
            {
                translate:
                    WEREWOLF_GAMEMANAGER_TRANSLATE_IDS.WEREWOLF_ROLE_COMPOSITION_APPLIED_CHANGES_NOTICE_TOTAL,
                with: [roleCount.toString()],
            },
        );
        roleListMessage.push({ text: "\n" + SYSTEMS.SEPARATOR.LINE_CYAN });
        world.sendMessage({ rawtext: roleListMessage });

        for (const player of world.getPlayers()) {
            player.playSound(SYSTEMS.ROLE_COMPOSITION_NOTIFICATION.SOUND_ID, {
                pitch: SYSTEMS.ROLE_COMPOSITION_NOTIFICATION.SOUND_PITCH,
                volume: SYSTEMS.ROLE_COMPOSITION_NOTIFICATION.SOUND_VOLUME,
                location: player.location,
            });
        }

        return;
    }

    private hasRoleCompositionChanged(working: RoleCountMap): boolean {
        const original = this.gameSettingManager.getAllRoleCounts();

        const roleIds = new Set([...Object.keys(original), ...Object.keys(working)]);

        for (const roleId of roleIds) {
            if ((original[roleId] ?? 0) !== (working[roleId] ?? 0)) {
                return true;
            }
        }

        return false;
    }
}
