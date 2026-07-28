import type { Player, RawMessage } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { router, type CanceledResult } from "@kairo-js/router";
import { T } from "../constants/translate";
import { getCurrentSeason, getSeasonsThroughCurrent, type SeasonInfo } from "../game/seasons";
import { savePlayerProfiles } from "../persistence/gameManagerPersistence";
import { roleRegistry } from "../registry/roleRegistry";
import { playerProfiles } from "../state/playerProfiles";
import {
    createInitialTierProgress,
    getDisplayMatchmakingRate,
    getSeasonBestTierProgress,
    getSeasonTierProgress,
    getTierColorCode,
    getTierRequiredPoint,
} from "../tier/tierSystem";
import type { TierProgress } from "../tier/tierSystem";
import type { PlayerMatchHistoryRecord, PlayerProfile, RankTier, SeasonProfile, SeasonRoleAssignmentRecord } from "../types/playerProfile";
import { showActionForm } from "../ui/form";
import { rawtext, text, tr, trWith } from "../ui/text";

const HISTORY_PREVIEW_COUNT = 10;
const PROFILE_TAG_COUNT = 3;
const RANKING_DISPLAY_COUNT = 30;
const TIER_GAUGE_SEGMENTS = 95;
const DAY_MS = 24 * 60 * 60 * 1000;
const ROMAN_DIVISIONS = ["I", "II", "III", "IV", "V"] as const;

type RankingEntry = {
    readonly profile: PlayerProfile;
    readonly season: SeasonProfile;
};

type ProfileTarget = {
    readonly id: string;
    readonly name: string;
};

type ProfileFormContext = {
    readonly ranking?: {
        readonly target: ProfileTarget;
        readonly profile: PlayerProfile;
    };
};

type CompetitiveProfile = {
    readonly playerId: string;
    readonly name: string;
    readonly games: number;
    readonly wins: number;
    readonly losses: number;
    readonly draws: number;
    readonly tierPoints: number;
    readonly tier: RankTier;
    readonly division?: number;
    readonly matchmakingRate: number;
    readonly bestTier: RankTier;
    readonly bestDivision?: number;
    readonly bestTierPoints: number;
    readonly bestMatchmakingRate: number;
    readonly winStreak: number;
    readonly lossStreak: number;
    readonly demotionProtection: boolean;
    readonly seasonGames: number;
    readonly seasonWins: number;
    readonly seasonLosses: number;
    readonly seasonDraws: number;
    readonly peakBaseRate?: number;
    readonly peakRate?: number;
    readonly peakBestRate?: number;
    readonly peakPlacementMatches: number;
    readonly peakPlacementWins: number;
    readonly peakPlacementDone: boolean;
};

type CompetitiveLeaderboard = {
    readonly season: {
        readonly id: string;
        readonly name: string;
    };
    readonly entries: readonly {
        readonly rank: number;
        readonly playerId: string;
        readonly name: string;
        readonly tier: RankTier;
        readonly division?: number;
        readonly tierPoints: number;
        readonly displayRate: number;
        readonly wins: number;
        readonly games: number;
    }[];
};

type CompetitiveMatchHistoryEntry = {
    readonly matchId: string;
    readonly endedAt: string;
    readonly seasonId: string;
    readonly result: PlayerMatchHistoryRecord["result"];
    readonly roleId: string;
    readonly factionId: string;
    readonly winnerFactionIds: readonly string[];
    readonly playerCount: number;
    readonly survived: boolean;
    readonly enemyPlayerIds: readonly string[];
    readonly enemyTeamKey?: string;
};

type CompetitivePlayerSeason = {
    readonly seasonId: string;
    readonly seasonName: string;
    readonly seasonStartsAt: string;
    readonly games: number;
    readonly wins: number;
    readonly losses: number;
    readonly draws: number;
    readonly kills: number;
    readonly deaths: number;
    readonly lynched: number;
    readonly roleCounts: Readonly<Record<string, number>>;
    readonly tier: RankTier;
    readonly division?: number;
    readonly tierPoints: number;
    readonly matchmakingRate: number;
    readonly demotionProtection: boolean;
    readonly bestTier: RankTier;
    readonly bestDivision?: number;
    readonly bestTierPoints: number;
    readonly bestMatchmakingRate: number;
    readonly winStreak: number;
    readonly lossStreak: number;
    readonly peakBaseRate?: number;
    readonly peakRate?: number;
    readonly peakBestRate?: number;
    readonly peakPlacementMatches: number;
    readonly peakPlacementWins: number;
    readonly peakPlacementDone: boolean;
};

type RankedEntry = {
    readonly entry: RankingEntry;
    readonly rank: number;
};

export async function openProfileForm(viewer: Player, target: ProfileTarget = viewer, context?: ProfileFormContext): Promise<void> {
    if (playerProfiles.applySeasonTransition()) {
        savePlayerProfiles();
    }
    const localProfile = playerProfiles.getOrCreate(target.id, target.name);
    savePlayerProfiles();
    const profile = await resolveDisplayedProfile(localProfile, target);
    const form = new ActionFormData()
        .title(tr(T.profile.title))
        .body(buildProfileHeader(profile, target.name, viewer.id !== target.id))
        .label(buildProfileBody(profile));

    form.button(tr(T.profile.statsButton));
    form.button(tr(T.profile.historyButton));
    form.button(tr(T.profile.achievementsButton));
    form.button(context?.ranking ? tr(T.setup.backButton) : tr(T.setup.closeButton));

    const response = await showActionForm(viewer, form);
    if (response.canceled || response.selection === undefined) return;

    if (response.selection === 0) {
        await openStatsForm(viewer, target, profile, context);
        return;
    }
    if (response.selection === 1) {
        await openMatchHistoryForm(viewer, target, profile, context);
        return;
    }
    if (response.selection === 2) {
        await openAchievementsForm(viewer, target, profile, context);
        return;
    }
    if (response.selection === 3 && context?.ranking) {
        await openRankingForm(viewer, context.ranking.target, context.ranking.profile);
    }
}

async function resolveDisplayedProfile(local: PlayerProfile, target: ProfileTarget): Promise<PlayerProfile> {
    try {
        const remote = await router.request<CompetitiveProfile>(
            "werewolf-bds-bridge",
            "werewolf-bds:competitive/v1/getProfile",
            { playerId: target.id },
            { timeout: 100 },
        );
        if (isCanceled(remote)) return local;
        const season = getCurrentSeason();
        const centralSeasons = await resolveCompetitiveSeasons(target.id, local.seasons);
        const localSeason = centralSeasons[season.seasonId]
            ?? createPreviewSeasonProfile(season.seasonId, season.seasonName);
        return {
            ...local,
            name: remote.name,
            rating: remote.matchmakingRate,
            bestRating: remote.bestMatchmakingRate,
            tier: remote.tier,
            bestTier: remote.bestTier,
            stats: {
                ...local.stats,
                games: remote.games,
                wins: remote.wins,
                losses: remote.losses,
                draws: remote.draws,
            },
            seasons: {
                ...centralSeasons,
                [season.seasonId]: {
                    ...localSeason,
                    games: remote.seasonGames,
                    wins: remote.seasonWins,
                    losses: remote.seasonLosses,
                    draws: remote.seasonDraws,
                    rating: remote.matchmakingRate,
                    bestRating: remote.bestMatchmakingRate,
                    tier: remote.tier,
                    division: remote.division,
                    tierPoint: remote.tierPoints,
                    bestTier: remote.bestTier,
                    bestDivision: remote.bestDivision,
                    bestTierPoint: remote.bestTierPoints,
                    matchmakingRate: remote.matchmakingRate,
                    bestMatchmakingRate: remote.bestMatchmakingRate,
                    demotionProtection: remote.demotionProtection,
                    winStreak: remote.winStreak,
                    lossStreak: remote.lossStreak,
                    peakBaseRate: remote.peakBaseRate,
                    peakRate: remote.peakRate,
                    peakBestRate: remote.peakBestRate,
                    peakPlacementMatches: remote.peakPlacementMatches,
                    peakPlacementWins: remote.peakPlacementWins,
                    peakPlacementDone: remote.peakPlacementDone,
                },
            },
        };
    } catch {
        return local;
    }
}

async function resolveCompetitiveSeasons(
    playerId: string,
    local: Readonly<Record<string, SeasonProfile>>,
): Promise<Record<string, SeasonProfile>> {
    try {
        const remote = await router.request<readonly CompetitivePlayerSeason[]>(
            "werewolf-bds-bridge",
            "werewolf-bds:competitive/v1/getPlayerSeasons",
            { playerId },
            { timeout: 100 },
        );
        if (isCanceled(remote)) return { ...local };
        const merged = { ...local };
        for (const entry of remote) {
            const previous = merged[entry.seasonId]
                ?? createPreviewSeasonProfile(entry.seasonId, entry.seasonName);
            merged[entry.seasonId] = {
                ...previous,
                seasonName: entry.seasonName,
                games: entry.games,
                wins: entry.wins,
                losses: entry.losses,
                draws: entry.draws,
                kills: entry.kills,
                deaths: entry.deaths,
                lynched: entry.lynched,
                roleAssignments: createCompetitiveRoleAssignments(entry.roleCounts, previous.roleAssignments),
                rating: entry.matchmakingRate,
                bestRating: entry.bestMatchmakingRate,
                tier: entry.tier,
                division: entry.division,
                tierPoint: entry.tierPoints,
                bestTier: entry.bestTier,
                bestDivision: entry.bestDivision,
                bestTierPoint: entry.bestTierPoints,
                matchmakingRate: entry.matchmakingRate,
                bestMatchmakingRate: entry.bestMatchmakingRate,
                demotionProtection: entry.demotionProtection,
                winStreak: entry.winStreak,
                lossStreak: entry.lossStreak,
                peakBaseRate: entry.peakBaseRate,
                peakRate: entry.peakRate,
                peakBestRate: entry.peakBestRate,
                peakPlacementMatches: entry.peakPlacementMatches,
                peakPlacementWins: entry.peakPlacementWins,
                peakPlacementDone: entry.peakPlacementDone,
            };
        }
        return merged;
    } catch {
        return { ...local };
    }
}

function isCanceled(value: unknown): value is CanceledResult {
    return typeof value === "object" && value !== null && "canceled" in value;
}

function createCompetitiveRoleAssignments(
    roleCounts: Readonly<Record<string, number>>,
    previous: Readonly<Record<string, SeasonRoleAssignmentRecord>>,
): Record<string, SeasonRoleAssignmentRecord> {
    const assignments: Record<string, SeasonRoleAssignmentRecord> = {};

    for (const [roleId, count] of Object.entries(roleCounts)) {
        const existing = previous[roleId];
        const role = roleRegistry.get(roleId);
        assignments[roleId] = {
            roleId,
            name: existing?.name ?? role?.name ?? roleId,
            color: existing?.color ?? role?.color ?? "§f",
            addonId: existing?.addonId ?? role?.addonId ?? "",
            count,
        };
    }

    return assignments;
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
        ...formatCurrentTierBlock(seasonProfile),
        text("\n"),
        trWith(T.profile.winRate, [String(winRate)]),
        text("\n"),
        trWith(T.profile.wins, [String(profile.stats.wins)]),
        text("\n"),
        trWith(T.profile.rounds, [String(profile.stats.games)]),
    ]);
}

async function openStatsForm(viewer: Player, target: ProfileTarget, profile: PlayerProfile, context?: ProfileFormContext): Promise<void> {
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
            trWith(T.profile.playerRankNext, [String(getNextPlayerRankValue(profile.playerRank))]),
            text("\n"),
            text(formatPlayerRankGauge(profile.playerRank)),
            text("\n\n"),
            tr(T.profile.stats),
            text("\n"),
            trWith(T.profile.totalWinRate, [String(winRate)]),
            text("\n"),
            trWith(T.profile.totalWins, [String(profile.stats.wins)]),
            text("\n"),
            trWith(T.profile.totalMatches, [String(profile.stats.games)]),
    ]));

    const actions: Array<"detailedStats" | "ranking" | "seasonHistory" | "back"> = [];
    form.button(tr(T.profile.detailedStatsButton));
    actions.push("detailedStats");
    form.divider();
    form.label(rawtext([
        tr(T.profile.currentTier),
        text("\n"),
        ...formatCurrentTierBlock(seasonProfile),
        text("\n"),
        trWith(T.profile.seasonWinRate, [String(getSeasonWinRate(seasonProfile))]),
        text("\n"),
        trWith(T.profile.seasonWins, [String(seasonProfile.wins)]),
        text("\n"),
        trWith(T.profile.seasonMatches, [String(seasonProfile.games)]),
        text("\n\n"),
        tr(T.profile.allTimeHigh),
        text("\n"),
        ...formatTierValueCompact(getSeasonBestTierProgress(bestSeason)),
    ]));
    if (!context?.ranking) {
        form.button(tr(T.profile.rankingButton));
        actions.push("ranking");
    }
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
    actions.push("seasonHistory");
    form.divider();
    form.button(tr(T.setup.backButton));
    actions.push("back");

    const response = await showActionForm(viewer, form);
    if (response.canceled || response.selection === undefined) return;
    const action = actions[response.selection];
    if (action === "detailedStats") {
        await openDetailedStatsForm(viewer, target, profile, context);
        return;
    }
    if (action === "ranking") {
        await openRankingForm(viewer, target, profile);
        return;
    }
    if (action === "seasonHistory") {
        await openSeasonHistoryForm(viewer, target, profile, context);
        return;
    }
    if (action === "back") {
        await openProfileForm(viewer, target, context);
    }
}

async function openDetailedStatsForm(viewer: Player, target: ProfileTarget, profile: PlayerProfile, context?: ProfileFormContext): Promise<void> {
    const form = new ActionFormData()
        .title(tr(T.profile.detailedStatsTitle))
        .label(tr(T.profile.detailedStatsComingSoon));

    form.button(tr(T.setup.backButton));
    const response = await showActionForm(viewer, form);
    if (response.canceled || response.selection === undefined) return;
    if (response.selection === 0) {
        await openStatsForm(viewer, target, profile, context);
    }
}

async function openMatchHistoryForm(viewer: Player, target: ProfileTarget, profile: PlayerProfile, context?: ProfileFormContext): Promise<void> {
    const history = await resolveMatchHistory(target.id, profile.history);
    const form = new ActionFormData().title(tr(T.profile.historyTitle));

    if (history.length === 0) {
        form.label(tr(T.profile.historyEmpty));
    } else {
        form.label(rawtext(history.slice(0, HISTORY_PREVIEW_COUNT).flatMap((record, index) => [
            ...(index > 0 ? [text("\n")] : []),
            ...formatHistoryRecord(record),
        ])));
    }

    form.button(tr(T.setup.backButton));
    const response = await showActionForm(viewer, form);
    if (response.canceled || response.selection === undefined) return;
    if (response.selection === 0) {
        await openProfileForm(viewer, target, context);
    }
}

async function resolveMatchHistory(
    playerId: string,
    local: readonly PlayerMatchHistoryRecord[],
): Promise<readonly PlayerMatchHistoryRecord[]> {
    try {
        const remote = await router.request<readonly CompetitiveMatchHistoryEntry[]>(
            "werewolf-bds-bridge",
            "werewolf-bds:competitive/v1/getMatchHistory",
            { playerId },
            { timeout: 100 },
        );
        if (isCanceled(remote)) return local;
        return remote.map((entry) => {
            const recordedAtUnixMs = Date.parse(entry.endedAt);
            return {
                id: entry.matchId,
                recordedAtUnixMs,
                recordedAtIso: entry.endedAt,
                seasonId: entry.seasonId,
                seasonName: entry.seasonId,
                result: entry.result,
                roleId: entry.roleId,
                factionId: entry.factionId,
                winnerFactionIds: entry.winnerFactionIds,
                playerCount: entry.playerCount,
                survived: entry.survived,
                enemyPlayerIds: entry.enemyPlayerIds,
                enemyTeamKey: entry.enemyTeamKey,
            };
        });
    } catch {
        return local;
    }
}

async function openAchievementsForm(viewer: Player, target: ProfileTarget, profile: PlayerProfile, context?: ProfileFormContext): Promise<void> {
    const form = new ActionFormData().title(tr(T.profile.achievementsTitle));
    form.label(profile.achievements.length === 0
        ? tr(T.profile.achievementsEmpty)
        : rawtext(profile.achievements.flatMap((achievement) => [text("§e"), tr(achievement), text("§r\n")])));
    form.button(tr(T.setup.backButton));
    const response = await showActionForm(viewer, form);
    if (response.canceled || response.selection === undefined) return;
    if (response.selection === 0) {
        await openProfileForm(viewer, target, context);
    }
}

async function openSeasonHistoryForm(viewer: Player, target: ProfileTarget, profile: PlayerProfile, context?: ProfileFormContext): Promise<void> {
    const seasons = getSeasonsThroughCurrent()
        .slice()
        .reverse();
    const form = new ActionFormData().title(tr(T.profile.seasonHistoryTitle));
    const actions: Array<
        | { readonly type: "season"; readonly season: SeasonInfo }
        | { readonly type: "back" }
    > = [];

    seasons.forEach((season) => {
        form.button(formatSeasonHistoryButton(season, profile.seasons[season.seasonId]));
        actions.push({ type: "season", season });
    });
    form.divider();
    form.button(tr(T.setup.backButton));
    actions.push({ type: "back" });

    const response = await showActionForm(viewer, form);
    if (response.canceled || response.selection === undefined) return;
    const action = actions[response.selection];
    if (action?.type === "back") {
        await openStatsForm(viewer, target, profile, context);
        return;
    }
    if (action?.type === "season") {
        await openSeasonDetailForm(viewer, target, profile, context, action.season);
    }
}

async function openSeasonDetailForm(
    viewer: Player,
    target: ProfileTarget,
    profile: PlayerProfile,
    context: ProfileFormContext | undefined,
    season: SeasonInfo,
): Promise<void> {
    const seasonProfile = profile.seasons[season.seasonId];
    const form = new ActionFormData()
        .title(tr(T.profile.seasonHistoryTitle))
        .body(seasonName(season.seasonId, season.seasonName))
        .label(seasonProfile === undefined
            ? tr(T.profile.seasonNotParticipated)
            : rawtext([
                tr(T.profile.currentTier),
                text("\n"),
                ...formatCurrentTierBlock(seasonProfile),
                text("\n\n"),
                trWith(T.profile.winRate, [String(getSeasonWinRate(seasonProfile))]),
                text("\n"),
                trWith(T.profile.wins, [String(seasonProfile.wins)]),
                text("\n"),
                trWith(T.profile.rounds, [String(seasonProfile.games)]),
                text("\n\n"),
                trWith(T.profile.kills, [String(seasonProfile.kills)]),
                text("\n"),
                trWith(T.profile.deaths, [String(seasonProfile.deaths)]),
                text("\n"),
                trWith(T.profile.lynched, [String(seasonProfile.lynched)]),
                text("\n\n"),
                tr(T.profile.topRoles),
                text("\n"),
                ...formatTopSeasonRoles(seasonProfile),
                text("\n\n"),
                tr(T.profile.topRandomItems),
                text("\n"),
                ...formatTopRandomItems(seasonProfile),
                text("\n\n"),
                tr(T.profile.topCarriedItems),
                text("\n"),
                ...formatTopCarriedItems(seasonProfile),
            ]));

    form.button(tr(T.setup.backButton));
    const response = await showActionForm(viewer, form);
    if (response.canceled || response.selection === undefined) return;
    if (response.selection === 0) {
        await openSeasonHistoryForm(viewer, target, profile, context);
    }
}

async function openRankingForm(viewer: Player, target: ProfileTarget, profile: PlayerProfile): Promise<void> {
    const season = getCurrentSeason();
    const centralRankings = await getCentralRankings(profile, season.seasonId, season.seasonName);
    const localRankings = getCurrentSeasonRankings(season.seasonId, season.seasonName);
    const rankings = centralRankings ?? localRankings.map((entry, index) => ({
        entry,
        rank: getCompetitionRank(localRankings, index),
    }));
    const targetRankIndex = rankings.findIndex(({ entry }) => entry.profile.playerId === target.id);
    const fallbackTargetEntry = {
        profile,
        season: profile.seasons[season.seasonId] ?? createPreviewSeasonProfile(season.seasonId, season.seasonName),
    };
    const targetEntry = targetRankIndex >= 0
        ? rankings[targetRankIndex]?.entry ?? fallbackTargetEntry
        : fallbackTargetEntry;
    const targetRank = targetRankIndex >= 0 ? rankings[targetRankIndex]?.rank ?? 0 : 0;
    const form = new ActionFormData()
        .title(tr(T.profile.rankingTitle))
        .body(tr(T.profile.rankingYourRank));

    const actions: Array<
        | { readonly kind: "profile"; readonly target: ProfileTarget }
        | { readonly kind: "back" }
    > = [];
    form.button(formatRankingButton(targetEntry, targetRank));
    actions.push({ kind: "profile", target: profileTargetFromProfile(targetEntry.profile) });
    form.divider();
    form.label(tr(T.profile.rankingOverall));

    rankings.slice(0, RANKING_DISPLAY_COUNT).forEach(({ entry, rank }) => {
        form.button(formatRankingButton(entry, rank));
        actions.push({ kind: "profile", target: profileTargetFromProfile(entry.profile) });
    });

    form.divider();
    form.button(tr(T.setup.backButton));
    actions.push({ kind: "back" });

    const response = await showActionForm(viewer, form);
    if (response.canceled || response.selection === undefined) return;
    const action = actions[response.selection];
    if (action?.kind === "back") {
        await openStatsForm(viewer, target, profile);
        return;
    }
    if (action?.kind === "profile") {
        await openProfileForm(viewer, action.target, {
            ranking: {
                target,
                profile,
            },
        });
    }
}

async function getCentralRankings(
    fallbackProfile: PlayerProfile,
    seasonId: string,
    seasonName: string,
): Promise<RankedEntry[] | undefined> {
    try {
        const remote = await router.request<CompetitiveLeaderboard>(
            "werewolf-bds-bridge",
            "werewolf-bds:competitive/v1/getLeaderboard",
            undefined,
            { timeout: 100 },
        );
        if (isCanceled(remote)) return undefined;
        return remote.entries.map((entry) => ({
            entry: createCentralRankingEntry(entry, fallbackProfile, seasonId, seasonName),
            rank: entry.rank,
        }));
    } catch {
        return undefined;
    }
}

function createCentralRankingEntry(
    entry: CompetitiveLeaderboard["entries"][number],
    fallbackProfile: PlayerProfile,
    seasonId: string,
    seasonName: string,
): RankingEntry {
    const local = playerProfiles.get(entry.playerId) ?? fallbackProfile;
    const losses = Math.max(0, entry.games - entry.wins);
    const preview = createPreviewSeasonProfile(seasonId, seasonName);
    const season: SeasonProfile = {
        ...preview,
        games: entry.games,
        wins: entry.wins,
        losses,
        tier: entry.tier,
        division: entry.division,
        tierPoint: entry.tierPoints,
        bestTier: entry.tier,
        bestDivision: entry.division,
        bestTierPoint: entry.tierPoints,
        rating: entry.displayRate,
        bestRating: entry.displayRate,
        matchmakingRate: entry.displayRate,
        bestMatchmakingRate: entry.displayRate,
        peakRate: entry.tier === "Peak Legend" ? entry.displayRate : undefined,
        peakBestRate: entry.tier === "Peak Legend" ? entry.displayRate : undefined,
        peakPlacementDone: entry.tier === "Peak Legend",
    };
    return {
        profile: {
            ...local,
            playerId: entry.playerId,
            name: entry.name,
            rating: entry.displayRate,
            bestRating: entry.displayRate,
            tier: entry.tier,
            bestTier: entry.tier,
            stats: {
                ...local.stats,
                games: entry.games,
                wins: entry.wins,
                losses,
                draws: 0,
            },
            seasons: {
                ...local.seasons,
                [seasonId]: season,
            },
        },
        season,
    };
}

function profileTargetFromProfile(profile: PlayerProfile): ProfileTarget {
    return {
        id: profile.playerId,
        name: profile.name,
    };
}

function formatRankingButton(
    entry: RankingEntry | undefined,
    rank: number,
): RawMessage {
    if (entry === undefined) return tr(T.profile.rankingEmpty);
    const tierProgress = getSeasonTierProgress(entry.season);
    return rawtext([
        text(rank > 0 ? `[#${rank}] ` : "[#-] "),
        text(entry.profile.name),
        text("\n"),
        ...formatRankingTierValue(entry.season, getRankingButtonTierColor(tierProgress)),
    ]);
}

function getRankingButtonTierColor(progress: TierProgress): string | undefined {
    return progress.tier === "Silver" ? "§j" : undefined;
}

function getCurrentSeasonRankings(seasonId: string, seasonName: string): RankingEntry[] {
    return playerProfiles.getAll()
        .map((profile) => ({
            profile,
            season: profile.seasons[seasonId] ?? createPreviewSeasonProfile(seasonId, seasonName),
        }))
        .sort(compareRankingEntries);
}

function compareRankingEntries(
    a: RankingEntry,
    b: RankingEntry,
): number {
    const rankingTierDiff = compareRankingTierBuckets(b.season, a.season);
    if (rankingTierDiff !== 0) return rankingTierDiff;

    const reachedAtDiff = a.season.tierProgressReachedAtUnixMs - b.season.tierProgressReachedAtUnixMs;
    if (reachedAtDiff !== 0) return reachedAtDiff;

    return a.profile.name.localeCompare(b.profile.name);
}

function getCompetitionRank(rankings: readonly RankingEntry[], index: number): number {
    if (index < 0 || index >= rankings.length) return 0;
    let rank = 1;
    for (let current = 1; current <= index; current++) {
        const previousEntry = rankings[current - 1];
        const currentEntry = rankings[current];
        if (previousEntry !== undefined && currentEntry !== undefined && !isSameRankingGroup(previousEntry, currentEntry)) {
            rank = current + 1;
        }
    }
    return rank;
}

function isSameRankingGroup(a: RankingEntry, b: RankingEntry): boolean {
    return compareRankingTierBuckets(a.season, b.season) === 0
        && a.season.tierProgressReachedAtUnixMs === b.season.tierProgressReachedAtUnixMs;
}

function compareRankingTierBuckets(a: SeasonProfile, b: SeasonProfile): number {
    const aProgress = getSeasonTierProgress(a);
    const bProgress = getSeasonTierProgress(b);
    const tierDiff = getRankingTierIndex(aProgress) - getRankingTierIndex(bProgress);
    if (tierDiff !== 0) return tierDiff;

    if (aProgress.tier === "Peak Legend" || bProgress.tier === "Peak Legend") {
        return getPeakRankingScore(a) - getPeakRankingScore(b);
    }

    return getRankingDivisionScore(aProgress) - getRankingDivisionScore(bProgress);
}

function getRankingTierIndex(progress: TierProgress): number {
    const order: readonly RankTier[] = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Master", "Legend", "Peak Legend"];
    return order.indexOf(progress.tier);
}

function getRankingDivisionScore(progress: TierProgress): number {
    if (progress.division === undefined) return 0;
    return 6 - progress.division;
}

function getPeakRankingScore(season: SeasonProfile): number {
    if (isPeakPlacementSeason(season)) return -1;
    return getDisplayMatchmakingRate(season.peakRate ?? season.matchmakingRate);
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

function formatSeasonHistoryButton(season: SeasonInfo, seasonProfile: SeasonProfile | undefined): RawMessage {
    return rawtext([
        seasonName(season.seasonId, season.seasonName),
        text("\n"),
        seasonProfile !== undefined
            ? rawtext(formatTierValueCompact(getSeasonTierProgress(seasonProfile)))
            : tr(T.profile.seasonNotParticipated),
    ]);
}

function formatTopSeasonRoles(season: SeasonProfile): RawMessage[] {
    const roles = Object.values(season.roleAssignments)
        .filter((record) => record.count > 0)
        .sort((a, b) => {
            const countDiff = b.count - a.count;
            if (countDiff !== 0) return countDiff;
            return a.roleId.localeCompare(b.roleId);
        })
        .slice(0, 3);

    if (roles.length === 0) return [tr(T.profile.noRoleRecords)];

    return roles.flatMap((role, index) => [
        ...(index > 0 ? [text("\n")] : []),
        text(role.color),
        tr(role.name),
        text(`§r: ${role.count}`),
    ]);
}

function formatTopCarriedItems(season: SeasonProfile): RawMessage[] {
    const items = Object.values(season.carriedItems)
        .filter((record) => record.count > 0)
        .sort((a, b) => {
            const countDiff = b.count - a.count;
            if (countDiff !== 0) return countDiff;
            return a.itemId.localeCompare(b.itemId);
        })
        .slice(0, 3);

    if (items.length === 0) return [tr(T.profile.noCarriedItemRecords)];

    return items.flatMap((item, index) => [
        ...(index > 0 ? [text("\n")] : []),
        text(item.color),
        tr(item.name),
        text(`§r: ${item.count}`),
    ]);
}

function formatTopRandomItems(season: SeasonProfile): RawMessage[] {
    const items = Object.values(season.randomItems)
        .filter((record) => record.count > 0)
        .sort((a, b) => {
            const countDiff = b.count - a.count;
            if (countDiff !== 0) return countDiff;
            return a.itemId.localeCompare(b.itemId);
        })
        .slice(0, 3);

    if (items.length === 0) return [tr(T.profile.noRandomItemRecords)];

    return items.flatMap((item, index) => [
        ...(index > 0 ? [text("\n")] : []),
        text(item.color),
        tr(item.name),
        text(`§r: ${item.count}`),
    ]);
}

function createPreviewSeasonProfile(seasonId: string, seasonName: string): SeasonProfile {
    const initialTier = createInitialTierProgress();
    return {
        seasonId,
        seasonName,
        games: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        kills: 0,
        deaths: 0,
        lynched: 0,
        roleAssignments: {},
        carriedItems: {},
        randomItems: {},
        rating: initialTier.matchmakingRate,
        bestRating: initialTier.matchmakingRate,
        tier: initialTier.tier,
        division: initialTier.division,
        tierPoint: initialTier.point,
        bestTier: initialTier.tier,
        bestDivision: initialTier.division,
        bestTierPoint: initialTier.point,
        matchmakingRate: initialTier.matchmakingRate,
        bestMatchmakingRate: initialTier.matchmakingRate,
        tierProgressReachedAtUnixMs: 0,
        demotionProtection: initialTier.demotionProtection,
        winStreak: 0,
        lossStreak: 0,
        peakBaseRate: undefined,
        peakRate: undefined,
        peakBestRate: undefined,
        peakPlacementMatches: 0,
        peakPlacementWins: 0,
        peakPlacementDone: false,
        peakReachedAtUnixMs: undefined,
    };
}

function getBestSeason(profile: PlayerProfile): SeasonProfile | undefined {
    return Object.values(profile.seasons)
        .sort((a, b) => b.bestMatchmakingRate - a.bestMatchmakingRate)
        [0];
}

function getWinRate(profile: PlayerProfile): number {
    const decisiveMatches = profile.stats.wins + profile.stats.losses;
    return decisiveMatches > 0
        ? Math.round((profile.stats.wins / decisiveMatches) * 100)
        : 0;
}

function getSeasonWinRate(season: SeasonProfile): number {
    const decisiveMatches = season.wins + season.losses;
    return decisiveMatches > 0
        ? Math.round((season.wins / decisiveMatches) * 100)
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

function rankTier(tier: RankTier): RawMessage {
    switch (tier) {
        case "Bronze": return tr(T.profile.tierBronze);
        case "Silver": return tr(T.profile.tierSilver);
        case "Gold": return tr(T.profile.tierGold);
        case "Platinum": return tr(T.profile.tierPlatinum);
        case "Diamond": return tr(T.profile.tierDiamond);
        case "Master": return tr(T.profile.tierMaster);
        case "Legend": return tr(T.profile.tierLegend);
        case "Peak Legend": return tr(T.profile.tierPeakLegend);
        default: return tr(tier);
    }
}

function formatCurrentTierBlock(season: SeasonProfile): RawMessage[] {
    if (season.tier === "Peak Legend") {
        return [
            ...formatPeakTierValue(season),
            text("\n"),
            isPeakPlacementSeason(season)
                ? trWith(T.profile.peakRate, rawtext([tr(T.profile.peakMeasuring)]))
                : trWith(T.profile.peakRate, [String(getDisplayMatchmakingRate(season.peakRate ?? season.matchmakingRate))]),
            text("\n"),
            text(formatPeakTierGauge()),
        ];
    }

    return [
        ...formatTierValue(season),
        text("\n"),
        trWith(T.profile.tierNext, [String(getNextTierValue(season))]),
        text("\n"),
        text(formatTierGauge(season)),
    ];
}

function formatTierValue(season: SeasonProfile): RawMessage[] {
    if (season.tier === "Peak Legend") {
        return formatPeakTierValue(season);
    }
    return formatTierProgressValue(getSeasonTierProgress(season), " - ");
}

function formatTierValueCompact(progress: TierProgress, colorOverride?: string): RawMessage[] {
    return formatTierProgressValue(progress, "-", colorOverride);
}

function formatRankingTierValue(season: SeasonProfile, colorOverride?: string): RawMessage[] {
    if (isPeakPlacementSeason(season)) {
        return [
            text(colorOverride ?? getTierColorCode("Peak Legend")),
            rankTier("Peak Legend"),
            text("-"),
            tr(T.profile.peakMeasuring),
            text("§r"),
        ];
    }
    return formatTierValueCompact(getSeasonTierProgress(season), colorOverride);
}

function formatTierProgressValue(progress: TierProgress, separator: string, colorOverride?: string): RawMessage[] {
    const color = colorOverride ?? getTierColorCode(progress.tier);
    if (progress.tier === "Peak Legend" || progress.division === undefined) {
        return [
            text(color),
            rankTier(progress.tier),
            text(`${separator}${getDisplayMatchmakingRate(progress.matchmakingRate)}`),
            text("§r"),
        ];
    }

    return [
        text(color),
        rankTier(progress.tier),
        text(`${separator}${formatDivision(progress.division)}§r`),
    ];
}

function formatPeakTierValue(season: SeasonProfile): RawMessage[] {
    return [
        text(getTierColorCode("Peak Legend")),
        rankTier("Peak Legend"),
        text("§r"),
    ];
}

function formatDivision(division: number): string {
    return ROMAN_DIVISIONS[division - 1] ?? String(division);
}

function formatTierGauge(season: SeasonProfile): string {
    const progress = getSeasonTierProgress(season);
    if (progress.tier === "Peak Legend") return formatPeakTierGauge();
    return formatGauge(progress.point / getTierRequiredPoint(progress.tier));
}

function formatPeakTierGauge(): string {
    return `§m${"|".repeat(TIER_GAUGE_SEGMENTS)}§r`;
}

function isPeakPlacementSeason(season: SeasonProfile): boolean {
    return season.tier === "Peak Legend" && !season.peakPlacementDone;
}

function formatGauge(progress: number, segments = TIER_GAUGE_SEGMENTS): string {
    const filled = Math.max(0, Math.min(segments, Math.floor(progress * segments)));
    return `§a${"|".repeat(filled)}§7${"|".repeat(segments - filled)}§r`;
}

function getNextTierValue(season: SeasonProfile): number {
    const progress = getSeasonTierProgress(season);
    if (progress.tier === "Peak Legend") return 0;
    return Math.max(0, getTierRequiredPoint(progress.tier) - progress.point);
}

function getDaysRemaining(endsAtUnixMs: number | undefined): number {
    if (endsAtUnixMs === undefined) return 0;
    return Math.max(0, Math.ceil((endsAtUnixMs - Date.now()) / DAY_MS));
}

function formatDate(unixMs: number): string {
    const date = new Date(unixMs + 9 * 60 * 60 * 1000);
    return `${date.getUTCFullYear()}/${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
}

function getProgressRatio(rating: number, min: number, max: number): number {
    if (max <= min) return 1;
    return Math.max(0, Math.min(1, (rating - min) / (max - min)));
}

function seasonName(seasonId: string, fallback: string): RawMessage {
    if (seasonId === "2026-preseason") return tr(T.profile.seasonPreseason2026);

    const preseason = /^2026-preseason-(\d+)$/.exec(seasonId);
    if (preseason?.[1]) {
        return trWith(T.profile.seasonPreseason2026Indexed, [preseason[1]]);
    }

    const absoluteSeason = /^season-(\d+)$/.exec(seasonId);
    if (absoluteSeason?.[1]) {
        return trWith(T.profile.seasonRegular, [absoluteSeason[1]]);
    }

    const regularSeason = /^(\d{4})-s(\d+)$/.exec(seasonId);
    if (regularSeason) {
        const year = regularSeason[1];
        const seasonIndex = regularSeason[2];
        if (year !== undefined && seasonIndex !== undefined) {
            return trWith(T.profile.seasonRegular, [`${year}-${seasonIndex}`]);
        }
    }

    return tr(fallback);
}
