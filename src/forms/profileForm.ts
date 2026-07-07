import type { Player, RawMessage } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { T } from "../constants/translate";
import { getCurrentSeason } from "../game/seasons";
import { savePlayerProfiles } from "../persistence/gameManagerPersistence";
import { playerProfiles, getRankTier } from "../state/playerProfiles";
import type { PlayerMatchHistoryRecord, PlayerProfile, SeasonProfile } from "../types/playerProfile";
import { showActionForm } from "../ui/form";
import { rawtext, text, tr, trWith } from "../ui/text";

const HISTORY_PREVIEW_COUNT = 10;
const PROFILE_TAG_COUNT = 3;
const TIER_GAUGE_SEGMENTS = 95;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function openProfileForm(viewer: Player, target: Player = viewer): Promise<void> {
    const profile = playerProfiles.getOrCreate(target.id, target.name);
    savePlayerProfiles();
    const form = new ActionFormData()
        .title(tr(T.profile.title))
        .body(buildProfileHeader(profile, target.name, viewer.id !== target.id))
        .label(buildProfileBody(profile));

    form.button(tr(T.profile.statsButton));
    form.button(tr(T.profile.historyButton));
    form.button(tr(T.profile.achievementsButton));
    form.button(tr(T.setup.closeButton));

    const response = await showActionForm(viewer, form);
    if (response.canceled || response.selection === undefined) return;

    if (response.selection === 0) {
        await openStatsForm(viewer, target, profile);
        return;
    }
    if (response.selection === 1) {
        await openMatchHistoryForm(viewer, target, profile);
        return;
    }
    if (response.selection === 2) {
        await openAchievementsForm(viewer, target, profile);
    }
}

function buildProfileHeader(profile: PlayerProfile, targetName: string, viewingOtherPlayer: boolean) {
    return rawtext([
        ...(viewingOtherPlayer ? [trWith(T.profile.bodyViewing, [targetName]), text("\n\n")] : []),
        text(`§6${targetName}§r §7(${profile.playerRank})§r\n`),
        text(`§7ID: ${profile.displayId}§r`),
    ]);
}

function buildProfileBody(profile: PlayerProfile) {
    const season = getCurrentSeason();
    const seasonProfile = profile.seasons[season.seasonId] ?? createPreviewSeasonProfile(season.seasonId, season.seasonName);
    const winRate = getWinRate(profile);

    return rawtext([
        tr(T.profile.labelsTitle),
        text("\n"),
        ...formatTags(profile.tags),
        text("\n\n"),
        tr(T.profile.currentTier),
        text("\n"),
        ...formatTierValue(seasonProfile),
        text("\n"),
        trWith(T.profile.next, [String(getNextTierValue(seasonProfile.rating))]),
        text("\n"),
        text(formatTierGauge(seasonProfile.rating)),
        text("\n"),
        trWith(T.profile.winRate, [String(winRate)]),
        text("\n"),
        trWith(T.profile.wins, [String(profile.stats.wins)]),
        text("\n"),
        trWith(T.profile.rounds, [String(profile.stats.games)]),
    ]);
}

async function openStatsForm(viewer: Player, target: Player, profile: PlayerProfile): Promise<void> {
    const season = getCurrentSeason();
    const seasonProfile = profile.seasons[season.seasonId] ?? createPreviewSeasonProfile(season.seasonId, season.seasonName);
    const bestSeason = getBestSeason(profile) ?? seasonProfile;
    const winRate = getWinRate(profile);
    const form = new ActionFormData()
        .title(tr(T.profile.statsTitle))
        .body(trWith(T.profile.playerStatsTitle, [profile.name]))
        .label(rawtext([
            tr(T.profile.playerRankTitle),
            text("\n"),
            text(`(${profile.playerRank})`),
            text("\n"),
            trWith(T.profile.next, [String(getNextPlayerRankValue(profile.playerRank))]),
            text("\n"),
            text(formatPlayerRankGauge(profile.playerRank)),
            text("\n\n"),
            trWith(T.profile.stats, [
                String(profile.stats.games),
                String(profile.stats.wins),
                String(profile.stats.losses),
                String(profile.stats.draws),
                String(winRate),
            ]),
    ]));

    form.divider();
    form.label(rawtext([
        tr(T.profile.currentTier),
        text("\n"),
        ...formatTierValue(seasonProfile),
        text("\n"),
        trWith(T.profile.next, [String(getNextTierValue(seasonProfile.rating))]),
        text("\n"),
        text(formatTierGauge(seasonProfile.rating)),
        text("\n\n"),
        tr(T.profile.allTimeHigh),
        text("\n"),
        ...formatTierValueCompact(bestSeason.bestTier, bestSeason.bestRating),
    ]));
    form.button(tr(T.profile.rankingButton));
    form.divider();
    form.label(rawtext([
        text("§7"),
        trWith(T.profile.seasonPeriod, rawtext([
            seasonName(season.seasonId, season.seasonName),
            text(formatDate(season.startsAtUnixMs)),
            text(formatDate((season.endsAtUnixMs ?? season.startsAtUnixMs) - DAY_MS)),
        ])),
        text("\n"),
        trWith(T.profile.seasonDaysRemaining, [String(getDaysRemaining(season.endsAtUnixMs))]),
        text("§r"),
    ]));
    form.button(tr(T.profile.seasonHistoryButton));
    form.button(tr(T.setup.backButton));

    const response = await showActionForm(viewer, form);
    if (response.canceled || response.selection === undefined) return;
    if (response.selection === 0) {
        await openRankingForm(viewer, target, profile);
        return;
    }
    if (response.selection === 1) {
        await openSeasonHistoryForm(viewer, target, profile);
        return;
    }
    if (response.selection === 2) {
        await openProfileForm(viewer, target);
    }
}

async function openMatchHistoryForm(viewer: Player, target: Player, profile: PlayerProfile): Promise<void> {
    const form = new ActionFormData().title(tr(T.profile.historyTitle));

    if (profile.history.length === 0) {
        form.label(tr(T.profile.historyEmpty));
    } else {
        form.label(rawtext(profile.history.slice(0, HISTORY_PREVIEW_COUNT).flatMap((record, index) => [
            ...(index > 0 ? [text("\n")] : []),
            ...formatHistoryRecord(record),
        ])));
    }

    form.button(tr(T.setup.backButton));
    const response = await showActionForm(viewer, form);
    if (response.canceled || response.selection === undefined) return;
    if (response.selection === 0) {
        await openProfileForm(viewer, target);
    }
}

async function openAchievementsForm(viewer: Player, target: Player, profile: PlayerProfile): Promise<void> {
    const form = new ActionFormData().title(tr(T.profile.achievementsTitle));
    form.label(profile.achievements.length === 0
        ? tr(T.profile.achievementsEmpty)
        : rawtext(profile.achievements.flatMap((achievement) => [text("§e"), tr(achievement), text("§r\n")])));
    form.button(tr(T.setup.backButton));
    const response = await showActionForm(viewer, form);
    if (response.canceled || response.selection === undefined) return;
    if (response.selection === 0) {
        await openProfileForm(viewer, target);
    }
}

async function openSeasonHistoryForm(viewer: Player, target: Player, profile: PlayerProfile): Promise<void> {
    const seasons = Object.values(profile.seasons)
        .sort((a, b) => b.seasonId.localeCompare(a.seasonId));
    const form = new ActionFormData().title(tr(T.profile.seasonHistoryTitle));

    form.label(seasons.length === 0
        ? tr(T.profile.seasonHistoryEmpty)
        : rawtext(seasons.flatMap((season, index) => [
            ...(index > 0 ? [text("\n")] : []),
            seasonName(season.seasonId, season.seasonName),
            text(" "),
            ...formatTierValueCompact(season.bestTier, season.bestRating),
        ])));
    form.button(tr(T.setup.backButton));
    const response = await showActionForm(viewer, form);
    if (response.canceled || response.selection === undefined) return;
    if (response.selection === 0) {
        await openStatsForm(viewer, target, profile);
    }
}

async function openRankingForm(viewer: Player, target: Player, profile: PlayerProfile): Promise<void> {
    const form = new ActionFormData()
        .title(tr(T.profile.rankingTitle))
        .label(tr(T.profile.rankingComingSoon));
    form.button(tr(T.setup.backButton));
    const response = await showActionForm(viewer, form);
    if (response.canceled || response.selection === undefined) return;
    if (response.selection === 0) {
        await openStatsForm(viewer, target, profile);
    }
}

function formatHistoryRecord(record: PlayerMatchHistoryRecord): RawMessage[] {
    return [
        text("§7"),
        seasonName(record.seasonId, record.seasonName),
        text("§r "),
        matchResult(record.result),
        text(" | "),
        tr(record.roleId),
        text(" | "),
        record.survived ? tr(T.profile.survived) : tr(T.profile.dead),
    ];
}

function createPreviewSeasonProfile(seasonId: string, seasonName: string): SeasonProfile {
    return {
        seasonId,
        seasonName,
        games: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        rating: 1000,
        bestRating: 1000,
        tier: getRankTier(1000),
        bestTier: getRankTier(1000),
    };
}

function getBestSeason(profile: PlayerProfile): SeasonProfile | undefined {
    return Object.values(profile.seasons)
        .sort((a, b) => b.bestRating - a.bestRating)
        [0];
}

function getWinRate(profile: PlayerProfile): number {
    return profile.stats.games > 0
        ? Math.round((profile.stats.wins / profile.stats.games) * 100)
        : 0;
}

function getNextPlayerRankValue(playerRank: number): number {
    return Math.max(0, getNextPlayerRank(playerRank) - playerRank);
}

function getNextPlayerRank(playerRank: number): number {
    return Math.floor(playerRank / 10) * 10 + 10;
}

function formatPlayerRankGauge(playerRank: number): string {
    const currentRankStart = Math.floor(playerRank / 10) * 10;
    const nextRank = getNextPlayerRank(playerRank);
    return formatGauge(getProgressRatio(playerRank, currentRankStart, nextRank));
}

function formatTags(tags: readonly string[]): RawMessage[] {
    return Array.from({ length: PROFILE_TAG_COUNT }).flatMap((_, index) => [
        ...(index > 0 ? [text("\n")] : []),
        text("- "),
        tags[index] ? tr(tags[index]) : tr(T.profile.tagUnset),
    ]);
}

function matchResult(result: PlayerMatchHistoryRecord["result"]): RawMessage {
    if (result === "win") return tr(T.profile.resultWin);
    if (result === "loss") return tr(T.profile.resultLoss);
    return tr(T.profile.resultDraw);
}

function rankTier(tier: string): RawMessage {
    switch (tier) {
        case "Bronze": return tr(T.profile.tierBronze);
        case "Silver": return tr(T.profile.tierSilver);
        case "Gold": return tr(T.profile.tierGold);
        case "Platinum": return tr(T.profile.tierPlatinum);
        case "Diamond": return tr(T.profile.tierDiamond);
        case "Master": return tr(T.profile.tierMaster);
        default: return tr(tier);
    }
}

function formatTierValue(season: SeasonProfile): RawMessage[] {
    return [
        rankTier(season.tier),
        text(` - ${getTierDivision(season.rating)}`),
    ];
}

function formatTierValueCompact(tier: string, rating: number): RawMessage[] {
    return [
        rankTier(tier),
        text(`-${getTierDivision(rating)}`),
    ];
}

function getTierDivision(rating: number): string {
    const { min, max } = getTierBounds(rating);
    const progress = getProgressRatio(rating, min, max);
    if (progress >= 2 / 3) return "I";
    if (progress >= 1 / 3) return "II";
    return "III";
}

function formatTierGauge(rating: number): string {
    const { min, max } = getTierBounds(rating);
    return formatGauge(getProgressRatio(rating, min, max));
}

function formatGauge(progress: number, segments = TIER_GAUGE_SEGMENTS): string {
    const filled = Math.max(0, Math.min(segments, Math.floor(progress * segments)));
    return `§a${"|".repeat(filled)}§7${"|".repeat(segments - filled)}§r`;
}

function getNextTierValue(rating: number): number {
    const { max } = getTierBounds(rating);
    return Math.max(0, max - rating);
}

function getDaysRemaining(endsAtUnixMs: number | undefined): number {
    if (endsAtUnixMs === undefined) return 0;
    return Math.max(0, Math.ceil((endsAtUnixMs - Date.now()) / DAY_MS));
}

function formatDate(unixMs: number): string {
    const date = new Date(unixMs);
    return `${date.getUTCFullYear()}/${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
}

function getProgressRatio(rating: number, min: number, max: number): number {
    if (max <= min) return 1;
    return Math.max(0, Math.min(1, (rating - min) / (max - min)));
}

function getTierBounds(rating: number): { readonly min: number; readonly max: number } {
    if (rating >= 1800) return { min: 1800, max: 2000 };
    if (rating >= 1600) return { min: 1600, max: 1800 };
    if (rating >= 1400) return { min: 1400, max: 1600 };
    if (rating >= 1200) return { min: 1200, max: 1400 };
    if (rating >= 1000) return { min: 1000, max: 1200 };
    return { min: 0, max: 1000 };
}

function seasonName(seasonId: string, fallback: string): RawMessage {
    if (seasonId === "2026-preseason") return tr(T.profile.seasonPreseason2026);

    const preseason = /^2026-preseason-(\d+)$/.exec(seasonId);
    if (preseason?.[1]) {
        return trWith(T.profile.seasonPreseason2026Indexed, [preseason[1]]);
    }

    const regularSeason = /^(\d{4})-s(\d+)$/.exec(seasonId);
    if (regularSeason) {
        const year = regularSeason[1];
        const seasonIndex = regularSeason[2];
        if (year !== undefined && seasonIndex !== undefined) {
            return trWith(T.profile.seasonRegular, [year, seasonIndex]);
        }
    }

    return tr(fallback);
}
