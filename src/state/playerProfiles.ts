import { getCurrentSeason, getTierSeasonForMatch, isSeasonResetOpen, type SeasonInfo } from "../game/seasons";
import {
    applyTierPointChange,
    applySeasonSoftReset,
    calculatePeakBaseRate,
    calculatePeakRateChange,
    calculateTierPointResult,
    compareTierProgress,
    createInitialTierProgress,
    getDisplayMatchmakingRate,
    getRankTier,
    getSeasonBestTierProgress,
    getSeasonTierProgress,
    recordPeakPlacementMatch,
    tierProgressFromLegacyRating,
} from "../tier/tierSystem";
import { roleRegistry } from "../registry/roleRegistry";
import type { GameState } from "../types/gameState";
import type { PeakRateLog, PlayerMatchHistoryRecord, PlayerMatchResult, PlayerProfile, PlayerStats, RankTier, SeasonCarriedItemRecord, SeasonProfile, SeasonRandomItemRecord, SeasonRoleAssignmentRecord } from "../types/playerProfile";
import type { TierProgress } from "../tier/tierSystem";

type PeakRateContext = {
    readonly opponentRate: number | undefined;
    readonly playerCount: number;
    readonly enemyPlayerIds: readonly string[];
    readonly enemyTeamKey: string | undefined;
    readonly reachedAtUnixMs: number;
    readonly roleId: string;
    readonly kills: number;
    readonly deaths: number;
    readonly lynched: number;
};

const MAX_HISTORY_RECORDS = 50;
const MAX_PROFILE_TAGS = 3;
const DEFAULT_PLAYER_RANK = 1;
const DEFAULT_RATING = createInitialTierProgress().matchmakingRate;
const DISPLAY_ID_DIGITS = 6;
const profiles = new Map<string, PlayerProfile>();

export const playerProfiles = {
    get(playerId: string): PlayerProfile | undefined {
        return profiles.get(playerId);
    },

    getOrCreate(playerId: string, name: string): PlayerProfile {
        const existing = profiles.get(playerId);
        if (existing) {
            existing.name = name;
            return existing;
        }

        const created = createProfile(playerId, name);
        profiles.set(playerId, created);
        return created;
    },

    ensureCurrentSeason(playerId: string, name: string): boolean {
        const profile = this.getOrCreate(playerId, name);
        const season = getCurrentSeason();
        const hadSeason = profile.seasons[season.seasonId] !== undefined;
        getOrCreateSeasonProfile(profile, season.seasonId, season.seasonName);
        return !hadSeason;
    },

    getAll(): PlayerProfile[] {
        return [...profiles.values()];
    },

    replaceAll(records: readonly PlayerProfile[]): void {
        profiles.clear();
        for (const record of records) {
            profiles.set(record.playerId, normalizeProfile(record, getUsedDisplayIds()));
        }
    },

    applySeasonTransition(nowUnixMs = Date.now()): boolean {
        if (!isSeasonResetOpen(nowUnixMs)) return false;
        const currentSeason = getCurrentSeason(new Date(nowUnixMs));
        let changed = false;
        for (const profile of profiles.values()) {
            if (profile.seasons[currentSeason.seasonId]) continue;
            const previousSeason = getLatestSeasonBefore(profile, currentSeason.seasonId);
            if (!previousSeason) continue;

            const resetProgress = applySeasonSoftReset(getSeasonTierProgress(previousSeason));
            profile.seasons[currentSeason.seasonId] = createSeasonProfile(currentSeason, resetProgress);
            syncProfileCurrentProgress(profile, resetProgress);
            changed = true;
        }
        return changed;
    },

    recordGameEnd(state: GameState, winnerFactionIds: readonly string[]): void {
        const endedAtUnixMs = state.endedAtUnixMs ?? Date.now();
        const historySeason = getCurrentSeason(new Date(endedAtUnixMs));
        const tierSeason = getTierSeasonForMatch(state.startedAtUnixMs, endedAtUnixMs);
        const playerCount = Object.keys(state.players).length;
        const isDraw = winnerFactionIds.length === 0;
        const now = endedAtUnixMs;
        const matchmakingRates = tierSeason ? createMatchmakingRateSnapshot(state, tierSeason) : new Map<string, number>();

        for (const playerState of Object.values(state.players)) {
            const profile = this.getOrCreate(playerState.playerId, playerState.name);
            const result: PlayerMatchResult = isDraw
                ? "draw"
                : winnerFactionIds.includes(playerState.factionId) ? "win" : "loss";

            mutateStats(profile.stats, playerState.roleId, playerState.factionId, result);
            let peakRateLog: PeakRateLog | undefined;
            if (tierSeason) {
                const seasonProfile = getOrCreateSeasonProfile(profile, tierSeason.seasonId, tierSeason.seasonName);
                const tierPointResult = calculateTierPointResult({
                    result,
                    playerFactionId: playerState.factionId,
                    winnerFactionIds,
                    survived: playerState.isAlive,
                    playerCount,
                    winningFactionCategory: getWinningFactionCategory(winnerFactionIds),
                    isPerfectWin: isPerfectWin(state, winnerFactionIds),
                    enemyKills: countKillsByFaction(state, playerState.playerId, "enemy"),
                    teamKills: countKillsByFaction(state, playerState.playerId, "team"),
                    currentWinStreak: seasonProfile.winStreak,
                    currentLossStreak: seasonProfile.lossStreak,
                });
                peakRateLog = mutateSeasonProfile(profile, seasonProfile, result, tierPointResult.totalPointChange, {
                    opponentRate: getOpponentRate(state, playerState.playerId, matchmakingRates),
                    playerCount,
                    enemyPlayerIds: getEnemyPlayerIds(state, playerState.playerId),
                    enemyTeamKey: getEnemyTeamKey(state, playerState.playerId),
                    reachedAtUnixMs: endedAtUnixMs,
                    roleId: playerState.roleId,
                    kills: countKillsByPlayer(state, playerState.playerId),
                    deaths: countDeathsByPlayer(state, playerState.playerId),
                    lynched: countLynchedByPlayer(state, playerState.playerId),
                });
                syncProfileCurrentTier(profile, seasonProfile);
            }

            profile.history.unshift({
                id: `${now}-${playerState.playerId}`,
                recordedAtUnixMs: now,
                recordedAtIso: new Date(now).toISOString(),
                seasonId: historySeason.seasonId,
                seasonName: historySeason.seasonName,
                result,
                roleId: playerState.roleId,
                factionId: playerState.factionId,
                winnerFactionIds: [...winnerFactionIds],
                playerCount,
                survived: playerState.isAlive,
                enemyPlayerIds: getEnemyPlayerIds(state, playerState.playerId),
                enemyTeamKey: getEnemyTeamKey(state, playerState.playerId),
                peakRateLog,
            });
            profile.history.splice(MAX_HISTORY_RECORDS);
        }
    },
};

function createProfile(playerId: string, name: string): PlayerProfile {
    const initialTier = createInitialTierProgress();
    return {
        playerId,
        displayId: createUniqueDisplayId(),
        name,
        playerRank: DEFAULT_PLAYER_RANK,
        rating: initialTier.matchmakingRate,
        bestRating: initialTier.matchmakingRate,
        tier: initialTier.tier,
        bestTier: initialTier.tier,
        tags: [],
        stats: createStats(),
        seasons: {},
        history: [],
        achievements: [],
    };
}

function createStats(): PlayerStats {
    return {
        games: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        roleCounts: {},
        factionCounts: {},
    };
}

function normalizeProfile(profile: PlayerProfile, usedDisplayIds = getUsedDisplayIds()): PlayerProfile {
    const displayId = isValidDisplayId(profile.displayId) && !usedDisplayIds.has(profile.displayId)
        ? profile.displayId
        : createUniqueDisplayId(usedDisplayIds);
    usedDisplayIds.add(displayId);
    const rating = finiteNumber(profile.rating, DEFAULT_RATING);
    const bestRating = finiteNumber(profile.bestRating, rating);

    return {
        ...profile,
        displayId,
        playerRank: profile.playerRank ?? DEFAULT_PLAYER_RANK,
        rating,
        bestRating,
        tier: getRankTier(rating),
        bestTier: getRankTier(bestRating),
        tags: Array.isArray(profile.tags) ? profile.tags.slice(0, MAX_PROFILE_TAGS) : [],
        stats: profile.stats ?? createStats(),
        seasons: normalizeSeasonProfiles(profile.seasons),
        history: Array.isArray(profile.history) ? profile.history.slice(0, MAX_HISTORY_RECORDS) : [],
        achievements: Array.isArray(profile.achievements) ? profile.achievements : [],
    };
}

function normalizeSeasonProfiles(seasons: Record<string, SeasonProfile> | undefined): Record<string, SeasonProfile> {
    const normalized: Record<string, SeasonProfile> = {};
    for (const [seasonId, season] of Object.entries(seasons ?? {})) {
        if (!season || typeof season !== "object") continue;
        const rating = finiteNumber(season.rating, DEFAULT_RATING);
        const bestRating = finiteNumber(season.bestRating, rating);
        const hasTierPointState = season.division !== undefined
            || season.tierPoint !== undefined
            || season.matchmakingRate !== undefined;
        const legacyProgress = tierProgressFromLegacyRating(rating);
        const progress = hasTierPointState
            ? getSeasonTierProgress({
                ...season,
                tier: season.tier ?? legacyProgress.tier,
                division: season.division ?? legacyProgress.division,
                tierPoint: season.tierPoint ?? legacyProgress.point,
                matchmakingRate: season.matchmakingRate ?? legacyProgress.matchmakingRate,
                demotionProtection: season.demotionProtection ?? legacyProgress.demotionProtection,
            })
            : legacyProgress;
        const legacyBestProgress = tierProgressFromLegacyRating(bestRating);
        const bestProgress = season.bestDivision !== undefined || season.bestTierPoint !== undefined || season.bestMatchmakingRate !== undefined
            ? getSeasonBestTierProgress({
                ...season,
                bestTier: season.bestTier ?? legacyBestProgress.tier,
                bestDivision: season.bestDivision ?? legacyBestProgress.division,
                bestTierPoint: season.bestTierPoint ?? legacyBestProgress.point,
                bestMatchmakingRate: season.bestMatchmakingRate ?? legacyBestProgress.matchmakingRate,
            })
            : legacyBestProgress;
        normalized[seasonId] = {
            ...season,
            seasonId: season.seasonId ?? seasonId,
            seasonName: season.seasonName ?? seasonId,
            games: season.games ?? 0,
            wins: season.wins ?? 0,
            losses: season.losses ?? 0,
            draws: season.draws ?? 0,
            kills: season.kills ?? 0,
            deaths: season.deaths ?? 0,
            lynched: season.lynched ?? 0,
            roleAssignments: normalizeRoleAssignments(season.roleAssignments),
            carriedItems: normalizeCarriedItems(season.carriedItems),
            randomItems: normalizeRandomItems(season.randomItems),
            rating: progress.matchmakingRate,
            bestRating: bestProgress.matchmakingRate,
            tier: progress.tier,
            division: progress.division,
            tierPoint: progress.point,
            bestTier: bestProgress.tier,
            bestDivision: bestProgress.division,
            bestTierPoint: bestProgress.point,
            matchmakingRate: progress.matchmakingRate,
            bestMatchmakingRate: bestProgress.matchmakingRate,
            tierProgressReachedAtUnixMs: season.tierProgressReachedAtUnixMs ?? season.peakReachedAtUnixMs ?? 0,
            demotionProtection: progress.demotionProtection,
            winStreak: season.winStreak ?? 0,
            lossStreak: season.lossStreak ?? 0,
            peakBaseRate: season.peakBaseRate,
            peakRate: season.peakRate,
            peakBestRate: season.peakBestRate,
            peakPlacementMatches: season.peakPlacementMatches ?? 0,
            peakPlacementWins: season.peakPlacementWins ?? 0,
            peakPlacementDone: season.peakPlacementDone ?? false,
            peakReachedAtUnixMs: season.peakReachedAtUnixMs,
        };
    }
    return normalized;
}

function createUniqueDisplayId(usedDisplayIds = getUsedDisplayIds()): string {
    for (let attempts = 0; attempts < 1000; attempts++) {
        const candidate = String(Math.floor(Math.random() * 10 ** DISPLAY_ID_DIGITS)).padStart(DISPLAY_ID_DIGITS, "0");
        if (!usedDisplayIds.has(candidate)) return candidate;
    }

    for (let value = 0; value < 10 ** DISPLAY_ID_DIGITS; value++) {
        const candidate = String(value).padStart(DISPLAY_ID_DIGITS, "0");
        if (!usedDisplayIds.has(candidate)) return candidate;
    }

    throw new Error("[game-manager] Exhausted profile display IDs");
}

function getUsedDisplayIds(): Set<string> {
    return new Set([...profiles.values()].map((profile) => profile.displayId).filter(isValidDisplayId));
}

function isValidDisplayId(value: unknown): value is string {
    return typeof value === "string" && /^\d{6}$/.test(value);
}

function getOrCreateSeasonProfile(profile: PlayerProfile, seasonId: string, seasonName: string): SeasonProfile {
    const existing = profile.seasons[seasonId];
    if (existing) return existing;

    const initialTier = createInitialTierProgress();
    const created: SeasonProfile = {
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
    profile.seasons[seasonId] = created;
    return created;
}

function createSeasonProfile(season: SeasonInfo, progress: TierProgress): SeasonProfile {
    return {
        seasonId: season.seasonId,
        seasonName: season.seasonName,
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
        rating: progress.matchmakingRate,
        bestRating: progress.matchmakingRate,
        tier: progress.tier,
        division: progress.division,
        tierPoint: progress.point,
        bestTier: progress.tier,
        bestDivision: progress.division,
        bestTierPoint: progress.point,
        matchmakingRate: progress.matchmakingRate,
        bestMatchmakingRate: progress.matchmakingRate,
        tierProgressReachedAtUnixMs: season.startsAtUnixMs,
        demotionProtection: progress.demotionProtection,
        winStreak: 0,
        lossStreak: 0,
        peakBaseRate: progress.tier === "Peak Legend" ? progress.matchmakingRate : undefined,
        peakRate: progress.tier === "Peak Legend" ? progress.matchmakingRate : undefined,
        peakBestRate: progress.tier === "Peak Legend" ? progress.matchmakingRate : undefined,
        peakPlacementMatches: 0,
        peakPlacementWins: 0,
        peakPlacementDone: progress.tier !== "Peak Legend",
        peakReachedAtUnixMs: progress.tier === "Peak Legend" ? season.startsAtUnixMs : undefined,
    };
}

function getLatestSeasonBefore(profile: PlayerProfile, currentSeasonId: string): SeasonProfile | undefined {
    const currentOrder = getSeasonOrder(currentSeasonId);
    return Object.values(profile.seasons)
        .filter((season) => getSeasonOrder(season.seasonId) < currentOrder)
        .sort((a, b) => getSeasonOrder(b.seasonId) - getSeasonOrder(a.seasonId))
        [0];
}

function getSeasonOrder(seasonId: string): number {
    const preseason = /^2026-preseason-(\d+)$/.exec(seasonId);
    if (preseason?.[1]) return Number(preseason[1]) - 100;

    const season = /^season-(\d+)$/.exec(seasonId);
    if (season?.[1]) return Number(season[1]);

    const legacySeason = /^(\d{4})-s(\d+)$/.exec(seasonId);
    if (legacySeason?.[1] && legacySeason[2]) {
        return ((Number(legacySeason[1]) - 2027) * 6) + Number(legacySeason[2]);
    }

    return Number.NEGATIVE_INFINITY;
}

function calculateLegendPercentile(playerId: string, currentSeason: SeasonProfile): number {
    const legendPlayers = [...profiles.values()]
        .map((profile) => ({
            playerId: profile.playerId,
            season: profile.seasons[currentSeason.seasonId],
        }))
        .filter((entry): entry is { readonly playerId: string; readonly season: SeasonProfile } => entry.season?.tier === "Legend")
        .sort((a, b) => {
            const divisionDiff = (a.season.division ?? 5) - (b.season.division ?? 5);
            if (divisionDiff !== 0) return divisionDiff;
            const pointDiff = b.season.tierPoint - a.season.tierPoint;
            if (pointDiff !== 0) return pointDiff;
            const winsDiff = b.season.wins - a.season.wins;
            if (winsDiff !== 0) return winsDiff;
            return a.playerId.localeCompare(b.playerId);
        });

    const rankIndex = legendPlayers.findIndex((entry) => entry.playerId === playerId);
    if (rankIndex < 0) return 1;
    return rankIndex / Math.max(legendPlayers.length - 1, 1);
}

function getLastPeakRate(profile: PlayerProfile, currentSeasonId: string): number | undefined {
    return Object.values(profile.seasons)
        .filter((season) => getSeasonOrder(season.seasonId) < getSeasonOrder(currentSeasonId))
        .filter((season) => season.peakPlacementDone && season.peakRate !== undefined)
        .sort((a, b) => getSeasonOrder(b.seasonId) - getSeasonOrder(a.seasonId))
        [0]?.peakRate;
}

function createMatchmakingRateSnapshot(state: GameState, season: SeasonInfo): Map<string, number> {
    const rates = new Map<string, number>();
    for (const playerState of Object.values(state.players)) {
        const profile = playerProfiles.getOrCreate(playerState.playerId, playerState.name);
        const seasonProfile = getOrCreateSeasonProfile(profile, season.seasonId, season.seasonName);
        rates.set(playerState.playerId, seasonProfile.matchmakingRate);
    }
    return rates;
}

function getOpponentRate(state: GameState, playerId: string, matchmakingRates: ReadonlyMap<string, number>): number | undefined {
    const playerState = state.players[playerId];
    if (!playerState) return undefined;

    const enemyRates = Object.values(state.players)
        .filter((candidate) => candidate.playerId !== playerId && candidate.factionId !== playerState.factionId)
        .map((candidate) => matchmakingRates.get(candidate.playerId))
        .filter((rate): rate is number => rate !== undefined);
    if (enemyRates.length === 0) return undefined;

    return enemyRates.reduce((sum, rate) => sum + rate, 0) / enemyRates.length;
}

function getEnemyPlayerIds(state: GameState, playerId: string): string[] {
    const playerState = state.players[playerId];
    if (!playerState) return [];
    return Object.values(state.players)
        .filter((candidate) => candidate.playerId !== playerId && candidate.factionId !== playerState.factionId)
        .map((candidate) => candidate.playerId)
        .sort();
}

function getEnemyTeamKey(state: GameState, playerId: string): string | undefined {
    const enemyPlayerIds = getEnemyPlayerIds(state, playerId);
    return enemyPlayerIds.length > 0 ? enemyPlayerIds.join(":") : undefined;
}

function getRepeatWeight(profile: PlayerProfile, enemyPlayerIds: readonly string[], enemyTeamKey: string | undefined): number {
    const recent = profile.history.slice(0, 10);
    const enemyRepeatCounts = enemyPlayerIds.map((enemyPlayerId) => recent.filter((record) => record.enemyPlayerIds?.includes(enemyPlayerId)).length);
    const averageEnemyRepeats = enemyRepeatCounts.length > 0
        ? enemyRepeatCounts.reduce((sum, count) => sum + count, 0) / enemyRepeatCounts.length
        : 0;
    const enemyPlayerRepeatWeight = getEnemyPlayerRepeatWeight(averageEnemyRepeats);
    const enemyTeamRepeatCount = enemyTeamKey === undefined
        ? 0
        : recent.filter((record) => record.enemyTeamKey === enemyTeamKey).length;
    const enemyTeamRepeatWeight = getEnemyTeamRepeatWeight(enemyTeamRepeatCount);
    return Math.max(0.50, enemyPlayerRepeatWeight * enemyTeamRepeatWeight);
}

function getEnemyPlayerRepeatWeight(averageRepeats: number): number {
    if (averageRepeats >= 4) return 0.72;
    if (averageRepeats >= 3) return 0.78;
    if (averageRepeats >= 2) return 0.85;
    if (averageRepeats >= 1) return 0.92;
    return 1.00;
}

function getEnemyTeamRepeatWeight(repeatCount: number): number {
    if (repeatCount >= 3) return 0.60;
    if (repeatCount >= 2) return 0.72;
    if (repeatCount >= 1) return 0.85;
    return 1.00;
}

function mutateStats(stats: PlayerStats, roleId: string, factionId: string, result: PlayerMatchResult): void {
    const writable = stats as {
        games: number;
        wins: number;
        losses: number;
        draws: number;
        roleCounts: Record<string, number>;
        factionCounts: Record<string, number>;
    };
    writable.games++;
    if (result === "win") writable.wins++;
    if (result === "loss") writable.losses++;
    if (result === "draw") writable.draws++;
    writable.roleCounts[roleId] = (writable.roleCounts[roleId] ?? 0) + 1;
    writable.factionCounts[factionId] = (writable.factionCounts[factionId] ?? 0) + 1;
}

function normalizeRoleAssignments(
    roleAssignments: Record<string, SeasonRoleAssignmentRecord> | undefined,
): Record<string, SeasonRoleAssignmentRecord> {
    const normalized: Record<string, SeasonRoleAssignmentRecord> = {};
    const roleIds = Object.keys(roleAssignments ?? {});

    for (const roleId of roleIds) {
        const existing = roleAssignments?.[roleId];
        normalized[roleId] = {
            roleId,
            name: existing?.name ?? roleRegistry.get(roleId)?.name ?? roleId,
            color: existing?.color ?? roleRegistry.get(roleId)?.color ?? "§f",
            addonId: existing?.addonId ?? roleRegistry.get(roleId)?.addonId ?? "",
            count: existing?.count ?? 0,
        };
    }

    return normalized;
}

function incrementRoleAssignment(
    existing: SeasonRoleAssignmentRecord | undefined,
    roleId: string,
): SeasonRoleAssignmentRecord {
    const role = roleRegistry.get(roleId);
    return {
        roleId,
        name: role?.name ?? existing?.name ?? roleId,
        color: role?.color ?? existing?.color ?? "§f",
        addonId: role?.addonId ?? existing?.addonId ?? "",
        count: (existing?.count ?? 0) + 1,
    };
}

function normalizeCarriedItems(
    carriedItems: Record<string, SeasonCarriedItemRecord> | undefined,
): Record<string, SeasonCarriedItemRecord> {
    const normalized: Record<string, SeasonCarriedItemRecord> = {};
    for (const [itemId, existing] of Object.entries(carriedItems ?? {})) {
        normalized[itemId] = {
            itemId,
            name: existing.name ?? itemId,
            color: existing.color ?? "§f",
            addonId: existing.addonId ?? "",
            count: existing.count ?? 0,
        };
    }
    return normalized;
}

function normalizeRandomItems(
    randomItems: Record<string, SeasonRandomItemRecord> | undefined,
): Record<string, SeasonRandomItemRecord> {
    const normalized: Record<string, SeasonRandomItemRecord> = {};
    for (const [itemId, existing] of Object.entries(randomItems ?? {})) {
        normalized[itemId] = {
            itemId,
            name: existing.name ?? itemId,
            color: existing.color ?? "§f",
            addonId: existing.addonId ?? "",
            count: existing.count ?? 0,
        };
    }
    return normalized;
}

function mutateSeasonProfile(
    profile: PlayerProfile,
    season: SeasonProfile,
    result: PlayerMatchResult,
    tierPointChange: number,
    peakRateContext: PeakRateContext,
): PeakRateLog | undefined {
    const writable = season as {
        games: number;
        wins: number;
        losses: number;
        draws: number;
        kills: number;
        deaths: number;
        lynched: number;
        roleAssignments: Record<string, SeasonRoleAssignmentRecord>;
        rating: number;
        bestRating: number;
        tier: RankTier;
        division: number | undefined;
        tierPoint: number;
        bestTier: RankTier;
        bestDivision: number | undefined;
        bestTierPoint: number;
        matchmakingRate: number;
        bestMatchmakingRate: number;
        tierProgressReachedAtUnixMs: number;
        demotionProtection: boolean;
        winStreak: number;
        lossStreak: number;
        peakBaseRate: number | undefined;
        peakRate: number | undefined;
        peakBestRate: number | undefined;
        peakPlacementMatches: number;
        peakPlacementWins: number;
        peakPlacementDone: boolean;
        peakReachedAtUnixMs: number | undefined;
    };
    const beforeProgress = getSeasonTierProgress(season);
    writable.games++;
    if (result === "win") writable.wins++;
    if (result === "loss") writable.losses++;
    if (result === "draw") writable.draws++;
    writable.kills += peakRateContext.kills;
    writable.deaths += peakRateContext.deaths;
    writable.lynched += peakRateContext.lynched;
    writable.roleAssignments[peakRateContext.roleId] = incrementRoleAssignment(
        writable.roleAssignments[peakRateContext.roleId],
        peakRateContext.roleId,
    );

    if (result === "win") {
        writable.winStreak++;
        writable.lossStreak = 0;
    } else if (result === "loss") {
        writable.lossStreak++;
        writable.winStreak = 0;
    } else {
        writable.winStreak = 0;
        writable.lossStreak = 0;
    }

    if (beforeProgress.tier === "Peak Legend") {
        return mutatePeakLegendSeason(writable, result, peakRateContext, profile);
    }

    const nextProgress = applyTierPointChange(beforeProgress, tierPointChange);
    if (nextProgress.tier === "Peak Legend") {
        initializePeakLegendSeason(profile, season, writable, peakRateContext.reachedAtUnixMs);
        return undefined;
    }

    writable.rating = nextProgress.matchmakingRate;
    writable.tier = nextProgress.tier;
    writable.division = nextProgress.division;
    writable.tierPoint = nextProgress.point;
    writable.matchmakingRate = nextProgress.matchmakingRate;
    writable.demotionProtection = nextProgress.demotionProtection;
    if (hasRankingTierBucketChanged(beforeProgress, nextProgress)) {
        writable.tierProgressReachedAtUnixMs = peakRateContext.reachedAtUnixMs;
    }

    const currentProgress = getSeasonTierProgress(season);
    const bestProgress = getSeasonBestTierProgress(season);
    if (compareTierProgress(currentProgress, bestProgress) > 0) {
        writable.bestRating = currentProgress.matchmakingRate;
        writable.bestTier = currentProgress.tier;
        writable.bestDivision = currentProgress.division;
        writable.bestTierPoint = currentProgress.point;
        writable.bestMatchmakingRate = currentProgress.matchmakingRate;
    }
    return undefined;
}

function initializePeakLegendSeason(
    profile: PlayerProfile,
    season: SeasonProfile,
    writable: {
        rating: number;
        bestRating: number;
        tier: RankTier;
        division: number | undefined;
        tierPoint: number;
        bestTier: RankTier;
        bestDivision: number | undefined;
        bestTierPoint: number;
        matchmakingRate: number;
        bestMatchmakingRate: number;
        tierProgressReachedAtUnixMs: number;
        demotionProtection: boolean;
        peakBaseRate: number | undefined;
        peakRate: number | undefined;
        peakBestRate: number | undefined;
        peakPlacementMatches: number;
        peakPlacementWins: number;
        peakPlacementDone: boolean;
        peakReachedAtUnixMs: number | undefined;
    },
    reachedAtUnixMs: number,
): void {
    const baseRate = calculatePeakBaseRate({
        legendPercentile: calculateLegendPercentile(profile.playerId, season),
        lastPeakRate: getLastPeakRate(profile, season.seasonId),
    });
    writable.rating = baseRate;
    writable.bestRating = baseRate;
    writable.tier = "Peak Legend";
    writable.division = undefined;
    writable.tierPoint = 0;
    writable.bestTier = "Peak Legend";
    writable.bestDivision = undefined;
    writable.bestTierPoint = 0;
    writable.matchmakingRate = baseRate;
    writable.bestMatchmakingRate = baseRate;
    writable.tierProgressReachedAtUnixMs = reachedAtUnixMs;
    writable.demotionProtection = false;
    writable.peakBaseRate = baseRate;
    writable.peakRate = undefined;
    writable.peakBestRate = undefined;
    writable.peakPlacementMatches = 0;
    writable.peakPlacementWins = 0;
    writable.peakPlacementDone = false;
    writable.peakReachedAtUnixMs = reachedAtUnixMs;
}

function mutatePeakLegendSeason(
    writable: {
        rating: number;
        bestRating: number;
        matchmakingRate: number;
        bestMatchmakingRate: number;
        tierProgressReachedAtUnixMs: number;
        peakBaseRate: number | undefined;
        peakRate: number | undefined;
        peakBestRate: number | undefined;
        peakPlacementMatches: number;
        peakPlacementWins: number;
        peakPlacementDone: boolean;
        winStreak: number;
    },
    result: PlayerMatchResult,
    context: PeakRateContext,
    profile: PlayerProfile,
): PeakRateLog | undefined {
    if (!writable.peakPlacementDone) {
        const placement = recordPeakPlacementMatch({
            baseRate: writable.peakBaseRate ?? writable.matchmakingRate,
            matches: writable.peakPlacementMatches,
            wins: writable.peakPlacementWins,
        }, result === "win");
        writable.peakPlacementMatches = placement.matches;
        writable.peakPlacementWins = placement.wins;
        writable.peakPlacementDone = placement.done;

        if (placement.confirmedRate === undefined) return undefined;
        setPeakRate(writable, placement.confirmedRate, context.reachedAtUnixMs);
        return undefined;
    }

    if (context.opponentRate === undefined || result === "draw") return undefined;

    const currentRate = writable.peakRate ?? writable.matchmakingRate;
    const repeatWeight = getRepeatWeight(profile, context.enemyPlayerIds, context.enemyTeamKey);
    const rateChange = calculatePeakRateChange({
        playerRate: currentRate,
        opponentRate: context.opponentRate,
        result,
        playerCount: context.playerCount,
        winStreak: writable.winStreak,
        repeatWeight,
    });
    const afterRate = currentRate + rateChange.totalChange;
    setPeakRate(writable, afterRate, context.reachedAtUnixMs);
    return {
        beforeRate: currentRate,
        opponentRate: context.opponentRate,
        expected: rateChange.expected,
        baseChange: rateChange.baseChange,
        playerCountWeight: rateChange.playerCountWeight,
        repeatWeight: rateChange.repeatWeight,
        rateBandWeight: rateChange.rateBandWeight,
        winStreakMultiplier: rateChange.winStreakMultiplier,
        totalChange: rateChange.totalChange,
        afterRate,
    };
}

function setPeakRate(
    writable: {
        rating: number;
        bestRating: number;
        matchmakingRate: number;
        bestMatchmakingRate: number;
        tierProgressReachedAtUnixMs: number;
        peakRate: number | undefined;
        peakBestRate: number | undefined;
    },
    rate: number,
    reachedAtUnixMs: number,
): void {
    const beforeDisplayRate = getDisplayMatchmakingRate(writable.matchmakingRate);
    const afterDisplayRate = getDisplayMatchmakingRate(rate);
    writable.peakRate = rate;
    writable.peakBestRate = Math.max(writable.peakBestRate ?? rate, rate);
    writable.rating = rate;
    writable.bestRating = Math.max(writable.bestRating, rate);
    writable.matchmakingRate = rate;
    writable.bestMatchmakingRate = Math.max(writable.bestMatchmakingRate, rate);
    if (afterDisplayRate !== beforeDisplayRate) {
        writable.tierProgressReachedAtUnixMs = reachedAtUnixMs;
    }
}

function hasRankingTierBucketChanged(before: TierProgress, after: TierProgress): boolean {
    if (before.tier !== after.tier) return true;
    if (before.tier === "Peak Legend" || after.tier === "Peak Legend") {
        return getDisplayMatchmakingRate(before.matchmakingRate) !== getDisplayMatchmakingRate(after.matchmakingRate);
    }
    return before.division !== after.division;
}

function syncProfileCurrentTier(profile: PlayerProfile, season: SeasonProfile): void {
    profile.rating = season.matchmakingRate;
    profile.bestRating = Math.max(profile.bestRating, season.bestMatchmakingRate);
    profile.tier = season.tier;
    profile.bestTier = getRankTier(profile.bestRating);
}

function syncProfileCurrentProgress(profile: PlayerProfile, progress: TierProgress): void {
    profile.rating = progress.matchmakingRate;
    profile.tier = progress.tier;
}

function isPerfectWin(state: GameState, winnerFactionIds: readonly string[]): boolean {
    if (winnerFactionIds.length === 0) return false;
    return Object.values(state.players)
        .filter((player) => winnerFactionIds.includes(player.factionId))
        .every((player) => player.isAlive);
}

function countKillsByFaction(state: GameState, playerId: string, relation: "enemy" | "team"): number {
    const killer = state.players[playerId];
    if (!killer) return 0;

    return state.deathRecords.filter((record) => {
        if (record.killerId !== playerId || record.targetId === playerId) return false;
        const target = state.players[record.targetId];
        if (!target) return false;
        const sameFaction = target.factionId === killer.factionId;
        return relation === "team" ? sameFaction : !sameFaction;
    }).length;
}

function countKillsByPlayer(state: GameState, playerId: string): number {
    return state.deathRecords.filter((record) =>
        record.killerId === playerId
        && record.targetId !== playerId
    ).length;
}

function countDeathsByPlayer(state: GameState, playerId: string): number {
    return state.deathRecords.filter((record) => record.targetId === playerId).length;
}

function countLynchedByPlayer(state: GameState, playerId: string): number {
    return state.deathRecords.filter((record) =>
        record.targetId === playerId
        && isLynchReason(record.reason)
    ).length;
}

function isLynchReason(reason: string | undefined): boolean {
    if (reason === undefined) return false;
    const normalized = reason.toLowerCase();
    return normalized.includes("lynch")
        || normalized.includes("vote")
        || normalized.includes("execution")
        || normalized.includes("execute")
        || normalized.includes("\u540a");
}

function getWinningFactionCategory(winnerFactionIds: readonly string[]): "villager" | "werewolf" | "third" | undefined {
    if (winnerFactionIds.length !== 1) return undefined;
    const factionId = winnerFactionIds[0];
    if (factionId === undefined) return undefined;
    if (factionId === "village" || factionId === "villager" || factionId.endsWith(":village") || factionId.endsWith(":villager")) {
        return "villager";
    }
    if (factionId === "werewolf" || factionId.endsWith(":werewolf")) {
        return "werewolf";
    }
    return "third";
}

function finiteNumber(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
