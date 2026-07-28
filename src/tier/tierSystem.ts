import type { PlayerMatchResult, RankTier, SeasonProfile } from "../types/playerProfile";

export type TierDivision = 1 | 2 | 3 | 4 | 5;
type NonPeakTier = Exclude<RankTier, "Peak Legend">;

export type TierDefinition = {
    readonly tier: RankTier;
    readonly colorCode: string;
    readonly divisionCount: number | undefined;
    readonly requiredPoint: number | undefined;
    readonly minRate: number | undefined;
    readonly maxRate: number | undefined;
};

export type TierProgress = {
    readonly tier: RankTier;
    readonly division: TierDivision | undefined;
    readonly point: number;
    readonly matchmakingRate: number;
    readonly demotionProtection: boolean;
};

export type TierPointResultInput = {
    readonly result: PlayerMatchResult;
    readonly playerFactionId: string;
    readonly winnerFactionIds: readonly string[];
    readonly survived: boolean;
    readonly playerCount: number;
    readonly winningFactionCategory: "villager" | "werewolf" | "third" | undefined;
    readonly isPerfectWin: boolean;
    readonly enemyKills?: number;
    readonly teamKills?: number;
    readonly currentWinStreak?: number;
    readonly currentLossStreak?: number;
};

export type TierPointResult = {
    readonly basePointChange: number;
    readonly weightedPointChange: number;
    readonly teamKillPenalty: number;
    readonly totalPointChange: number;
};

export type PeakBaseRateInput = {
    readonly legendPercentile: number;
    readonly lastPeakRate?: number | undefined;
};

export type PeakPlacementState = {
    readonly baseRate: number;
    readonly matches: number;
    readonly wins: number;
};

export type PeakRateChangeInput = {
    readonly playerRate: number;
    readonly opponentRate: number;
    readonly result: PlayerMatchResult;
    readonly playerCount: number;
    readonly winStreak: number;
    readonly repeatWeight?: number | undefined;
};

export type PeakRateChangeResult = {
    readonly expected: number;
    readonly baseChange: number;
    readonly playerCountWeight: number;
    readonly repeatWeight: number;
    readonly rateBandWeight: number;
    readonly winStreakMultiplier: number;
    readonly totalChange: number;
};

const HISTORY_CARRY_RATE = 0.4;
const BASE_RATE_LEGEND_WEIGHT = 0.7;
const BASE_RATE_HISTORY_WEIGHT = 0.3;
const PEAK_PLACEMENT_MATCHES = 5;
const PEAK_K = 32;

const NON_PEAK_TIERS: readonly NonPeakTier[] = [
    "Bronze",
    "Silver",
    "Gold",
    "Platinum",
    "Diamond",
    "Master",
    "Legend",
];

export const INITIAL_TIER_PROGRESS: TierProgress = {
    tier: "Bronze",
    division: 3,
    point: 0,
    matchmakingRate: 1000,
    demotionProtection: false,
};

export const TIER_DEFINITIONS: readonly TierDefinition[] = [
    { tier: "Bronze", colorCode: "§n", divisionCount: 3, requiredPoint: 25, minRate: 1000, maxRate: 1200 },
    { tier: "Silver", colorCode: "§i", divisionCount: 4, requiredPoint: 30, minRate: 1200, maxRate: 1450 },
    { tier: "Gold", colorCode: "§g", divisionCount: 5, requiredPoint: 40, minRate: 1450, maxRate: 1700 },
    { tier: "Platinum", colorCode: "§h", divisionCount: 5, requiredPoint: 50, minRate: 1700, maxRate: 1775 },
    { tier: "Diamond", colorCode: "§w", divisionCount: 5, requiredPoint: 55, minRate: 1775, maxRate: 1850 },
    { tier: "Master", colorCode: "§u", divisionCount: 5, requiredPoint: 55, minRate: 1850, maxRate: 1925 },
    { tier: "Legend", colorCode: "§v", divisionCount: 5, requiredPoint: 55, minRate: 1925, maxRate: 2000 },
    { tier: "Peak Legend", colorCode: "§m", divisionCount: undefined, requiredPoint: undefined, minRate: undefined, maxRate: undefined },
];

export function getTierDefinition(tier: RankTier): TierDefinition {
    const definition = TIER_DEFINITIONS.find((candidate) => candidate.tier === tier);
    if (!definition) throw new Error(`[game-manager] Unknown tier "${tier}"`);
    return definition;
}

export function getTierColorCode(tier: RankTier): string {
    return getTierDefinition(tier).colorCode;
}

export function getTierDivisionCount(tier: RankTier): number {
    return getTierDefinition(tier).divisionCount ?? 0;
}

export function getTierRequiredPoint(tier: RankTier): number {
    const requiredPoint = getTierDefinition(tier).requiredPoint;
    if (requiredPoint === undefined) throw new Error(`[game-manager] Tier "${tier}" does not use division points`);
    return requiredPoint;
}

export function getRankTier(matchmakingRate: number): RankTier {
    if (matchmakingRate >= 2000) return "Peak Legend";
    if (matchmakingRate >= 1925) return "Legend";
    if (matchmakingRate >= 1850) return "Master";
    if (matchmakingRate >= 1775) return "Diamond";
    if (matchmakingRate >= 1700) return "Platinum";
    if (matchmakingRate >= 1450) return "Gold";
    if (matchmakingRate >= 1200) return "Silver";
    return "Bronze";
}

export function getDisplayMatchmakingRate(matchmakingRate: number): number {
    return Math.floor(finiteNumber(matchmakingRate, 0));
}

export function normalizeTierProgress(value: Partial<TierProgress> | undefined, fallbackRate = 1000): TierProgress {
    const tier = isRankTier(value?.tier) ? value.tier : getRankTier(fallbackRate);
    if (tier === "Peak Legend") {
        const matchmakingRate = finiteNumber(value?.matchmakingRate, Math.max(2000, fallbackRate));
        return {
            tier,
            division: undefined,
            point: 0,
            matchmakingRate,
            demotionProtection: value?.demotionProtection === true,
        };
    }

    const definition = getTierDefinition(tier);
    const divisionCount = definition.divisionCount ?? INITIAL_TIER_PROGRESS.division ?? 3;
    const division = clampDivision(value?.division, divisionCount);
    const requiredPoint = definition.requiredPoint ?? 1;
    const point = clampNumber(Math.floor(finiteNumber(value?.point, 0)), 0, requiredPoint);
    const progress: TierProgress = {
        tier,
        division,
        point,
        matchmakingRate: 0,
        demotionProtection: value?.demotionProtection === true,
    };

    return {
        ...progress,
        matchmakingRate: calculateMatchmakingRate(progress),
    };
}

export function createInitialTierProgress(): TierProgress {
    return { ...INITIAL_TIER_PROGRESS };
}

export function tierProgressFromLegacyRating(rating: number): TierProgress {
    const tier = getRankTier(rating);
    if (tier === "Peak Legend") {
        return normalizeTierProgress({ tier, matchmakingRate: rating }, rating);
    }

    const definition = getTierDefinition(tier);
    const divisionCount = definition.divisionCount ?? 1;
    const minRate = definition.minRate ?? rating;
    const maxRate = definition.maxRate ?? rating;
    const progressRatio = maxRate > minRate ? clampNumber((rating - minRate) / (maxRate - minRate), 0, 1) : 0;
    const completedDivisions = Math.min(divisionCount - 1, Math.floor(progressRatio * divisionCount));
    const division = clampDivision(divisionCount - completedDivisions, divisionCount);
    const requiredPoint = definition.requiredPoint ?? 1;
    const pointProgress = (progressRatio * divisionCount) - completedDivisions;
    const point = Math.min(requiredPoint, Math.floor(pointProgress * requiredPoint));
    return normalizeTierProgress({ tier, division, point }, rating);
}

export function getSeasonTierProgress(season: SeasonProfile): TierProgress {
    return normalizeTierProgress({
        tier: season.tier,
        division: season.division as TierDivision | undefined,
        point: season.tierPoint,
        matchmakingRate: season.matchmakingRate,
        demotionProtection: season.demotionProtection,
    }, season.rating);
}

export function getSeasonBestTierProgress(season: SeasonProfile): TierProgress {
    return normalizeTierProgress({
        tier: season.bestTier,
        division: season.bestDivision as TierDivision | undefined,
        point: season.bestTierPoint,
        matchmakingRate: season.bestMatchmakingRate,
    }, season.bestRating);
}

export function calculateMatchmakingRate(progress: Pick<TierProgress, "tier" | "division" | "point" | "matchmakingRate">): number {
    if (progress.tier === "Peak Legend") return finiteNumber(progress.matchmakingRate, 2000);

    const definition = getTierDefinition(progress.tier);
    const divisionCount = definition.divisionCount ?? 1;
    const requiredPoint = definition.requiredPoint ?? 1;
    const minRate = definition.minRate ?? 1000;
    const maxRate = definition.maxRate ?? minRate;
    const division = clampDivision(progress.division, divisionCount);
    const completedDivisions = divisionCount - division;
    const tierProgress = (completedDivisions + clampNumber(progress.point, 0, requiredPoint) / requiredPoint) / divisionCount;
    return Math.round(minRate + (maxRate - minRate) * tierProgress);
}

export function compareTierProgress(a: TierProgress, b: TierProgress): number {
    return calculateProgressScore(a) - calculateProgressScore(b);
}

export function applyTierPointChange(current: TierProgress, pointChange: number): TierProgress {
    if (current.tier === "Peak Legend") return current;
    if (pointChange === 0) return normalizeTierProgress(current);

    let tier: NonPeakTier = current.tier as NonPeakTier;
    let division = clampDivision(current.division, getTierDivisionCount(tier));
    let point = current.point;
    let demotionProtection = current.demotionProtection;

    if (pointChange > 0) {
        demotionProtection = false;
        point += pointChange;
        while (true) {
            const definition = getTierDefinition(tier);
            const requiredPoint = definition.requiredPoint ?? 0;
            if (point < requiredPoint) break;
            point -= requiredPoint;

            if (division > 1) {
                division = clampDivision(division - 1, getTierDivisionCount(tier));
                continue;
            }

            const nextTier = getNextNonPeakTier(tier);
            if (!nextTier) {
                return normalizeTierProgress({ tier: "Peak Legend", matchmakingRate: 2000 });
            }
            tier = nextTier;
            division = clampDivision(getTierDivisionCount(tier), getTierDivisionCount(tier));
        }
        return normalizeTierProgress({ tier, division, point, demotionProtection });
    }

    const requiredPoint = getTierRequiredPoint(tier);
    point += pointChange;
    if (point >= 0) return normalizeTierProgress({ tier, division, point, demotionProtection });

    if (tier === "Bronze" || tier === "Silver" || demotionProtection) {
        return normalizeTierProgress({ tier, division, point: 0, demotionProtection });
    }

    if (division < getTierDivisionCount(tier)) {
        return normalizeTierProgress({
            tier,
            division: clampDivision(division + 1, getTierDivisionCount(tier)),
            point: Math.max(0, requiredPoint - Math.abs(pointChange)),
            demotionProtection,
        });
    }

    if (tier === "Gold") {
        const silverRequiredPoint = getTierRequiredPoint("Silver");
        return normalizeTierProgress({
            tier: "Silver",
            division: clampDivision(1, getTierDivisionCount("Silver")),
            point: Math.max(0, silverRequiredPoint - Math.abs(pointChange)),
            demotionProtection,
        });
    }

    const previousTier = getPreviousNonPeakTier(tier);
    if (!previousTier) return normalizeTierProgress({ tier, division, point: 0, demotionProtection });
    const previousDivision = clampDivision(getTierDivisionCount(previousTier), getTierDivisionCount(previousTier));
    const previousRequiredPoint = getTierRequiredPoint(previousTier);
    return normalizeTierProgress({
        tier: previousTier,
        division: previousDivision,
        point: Math.max(0, previousRequiredPoint - Math.abs(pointChange)),
        demotionProtection,
    });
}

export function applySeasonSoftReset(current: TierProgress): TierProgress {
    const reset = getSeasonSoftResetTarget(current);
    return normalizeTierProgress({
        ...reset,
        point: 0,
        demotionProtection: true,
    });
}

export function calculateTierPointResult(input: TierPointResultInput): TierPointResult {
    const resultPoint = getResultPoint(input.result, input.isPerfectWin);
    const factionBonus = input.result === "win" ? getFactionWinBonus(input.winningFactionCategory) : 0;
    const survivalBonus = input.survived ? 2 : 0;
    const streakBonus = getStreakBonus(input.result, input.currentWinStreak ?? 0, input.currentLossStreak ?? 0);
    const killBonus = getEnemyKillBonus(input.enemyKills ?? 0);
    const basePointChange = resultPoint + factionBonus + survivalBonus + streakBonus + killBonus;
    const weightedPointChange = roundAwayFromZero(basePointChange * getTierPlayerCountWeight(input.playerCount));
    const teamKillPenalty = getTeamKillPenalty(input.playerFactionId, input.teamKills ?? 0);
    return {
        basePointChange,
        weightedPointChange,
        teamKillPenalty,
        totalPointChange: weightedPointChange + teamKillPenalty,
    };
}

export function calculatePeakBaseRate(input: PeakBaseRateInput): number {
    const legendPercentile = clampNumber(input.legendPercentile, 0, 1);
    const lastPeakRate = finiteNumber(input.lastPeakRate, 2000);
    const legendPercentileRate = 1850 + (1 - legendPercentile) * 300;
    const historicalRate = 2000 + (lastPeakRate - 2000) * HISTORY_CARRY_RATE;
    return (legendPercentileRate * BASE_RATE_LEGEND_WEIGHT) + (historicalRate * BASE_RATE_HISTORY_WEIGHT);
}

export function recordPeakPlacementMatch(state: PeakPlacementState, won: boolean): {
    readonly matches: number;
    readonly wins: number;
    readonly done: boolean;
    readonly confirmedRate: number | undefined;
} {
    const matches = Math.min(PEAK_PLACEMENT_MATCHES, state.matches + 1);
    const wins = state.wins + (won ? 1 : 0);
    const done = matches >= PEAK_PLACEMENT_MATCHES;
    return {
        matches,
        wins,
        done,
        confirmedRate: done ? state.baseRate * getPeakPlacementMultiplier(wins) : undefined,
    };
}

export function calculatePeakRateChange(input: PeakRateChangeInput): PeakRateChangeResult {
    if (input.result === "draw") {
        return {
            expected: 0.5,
            baseChange: 0,
            playerCountWeight: getPeakPlayerCountWeight(input.playerCount),
            repeatWeight: input.repeatWeight ?? 1,
            rateBandWeight: 1,
            winStreakMultiplier: 1,
            totalChange: 0,
        };
    }

    const actual = input.result === "win" ? 1 : 0;
    const expected = 1 / (1 + (10 ** ((input.opponentRate - input.playerRate) / 400)));
    const baseChange = PEAK_K * (actual - expected);
    const playerCountWeight = getPeakPlayerCountWeight(input.playerCount);
    const repeatWeight = input.repeatWeight ?? 1;
    const rateBandWeight = getPeakRateBandWeight(input.playerRate, input.result);
    const winStreakMultiplier = getPeakWinStreakMultiplier(input.result, input.winStreak);
    const rateChange = baseChange
        * playerCountWeight
        * repeatWeight
        * rateBandWeight
        * winStreakMultiplier;
    return {
        expected,
        baseChange,
        playerCountWeight,
        repeatWeight,
        rateBandWeight,
        winStreakMultiplier,
        totalChange: rateChange,
    };
}

function isRankTier(value: unknown): value is RankTier {
    return typeof value === "string" && TIER_DEFINITIONS.some((definition) => definition.tier === value);
}

function calculateProgressScore(progress: TierProgress): number {
    const tierIndex = TIER_DEFINITIONS.findIndex((definition) => definition.tier === progress.tier);
    if (progress.tier === "Peak Legend") return tierIndex * 1000000 + getDisplayMatchmakingRate(progress.matchmakingRate);
    const divisionCount = getTierDivisionCount(progress.tier);
    const requiredPoint = getTierRequiredPoint(progress.tier);
    const completedDivisions = divisionCount - (progress.division ?? divisionCount);
    return tierIndex * 1000000 + completedDivisions * requiredPoint + progress.point;
}

function getNextNonPeakTier(tier: NonPeakTier): NonPeakTier | undefined {
    const index = NON_PEAK_TIERS.indexOf(tier);
    return index >= 0 ? NON_PEAK_TIERS[index + 1] : undefined;
}

function getPreviousNonPeakTier(tier: NonPeakTier): NonPeakTier | undefined {
    const index = NON_PEAK_TIERS.indexOf(tier);
    return index > 0 ? NON_PEAK_TIERS[index - 1] : undefined;
}

function getSeasonSoftResetTarget(current: TierProgress): Partial<TierProgress> {
    const division = current.division ?? 1;
    switch (current.tier) {
        case "Bronze":
        case "Silver":
            return { tier: current.tier, division };
        case "Gold":
            if (division === 5) return { tier: "Silver", division: 1 };
            if (division === 4) return { tier: "Gold", division: 5 };
            if (division === 3) return { tier: "Gold", division: 4 };
            return { tier: "Gold", division: 3 };
        case "Platinum":
            if (division === 5) return { tier: "Gold", division: 2 };
            if (division === 4 || division === 3) return { tier: "Gold", division: 1 };
            if (division === 2) return { tier: "Platinum", division: 5 };
            return { tier: "Platinum", division: 4 };
        case "Diamond":
            if (division === 5) return { tier: "Platinum", division: 4 };
            if (division === 4) return { tier: "Platinum", division: 3 };
            if (division === 3 || division === 2) return { tier: "Platinum", division: 2 };
            return { tier: "Platinum", division: 1 };
        case "Master":
            if (division === 5) return { tier: "Platinum", division: 1 };
            if (division === 4 || division === 3) return { tier: "Diamond", division: 5 };
            return { tier: "Diamond", division: 4 };
        case "Legend":
            return { tier: "Diamond", division: 3 };
        case "Peak Legend":
            return { tier: "Diamond", division: current.matchmakingRate >= 2400 ? 1 : 2 };
    }
}

function getResultPoint(result: PlayerMatchResult, isPerfectWin: boolean): number {
    if (result === "win") return isPerfectWin ? 15 : 12;
    if (result === "draw") return 5;
    return -8;
}

function getPeakPlacementMultiplier(wins: number): number {
    if (wins <= 0) return 0.95;
    if (wins === 1) return 1.00;
    if (wins === 2) return 1.03;
    if (wins === 3) return 1.06;
    if (wins === 4) return 1.09;
    return 1.15;
}

function getPeakRateBandWeight(playerRate: number, result: PlayerMatchResult): number {
    if (result === "win") {
        if (playerRate >= 4000) return 0.60;
        if (playerRate >= 3000) return 0.80;
        return 1.00;
    }
    if (result === "loss") {
        if (playerRate <= 1500) return 0.50;
        if (playerRate <= 1700) return 0.75;
        return 1.00;
    }
    return 1.00;
}

function getPeakPlayerCountWeight(playerCount: number): number {
    if (playerCount <= 4) return 0.55;
    if (playerCount === 5) return 0.65;
    if (playerCount === 6) return 0.75;
    if (playerCount === 7) return 0.90;
    if (playerCount === 8) return 1.00;
    if (playerCount <= 10) return 1.05;
    if (playerCount <= 13) return 1.10;
    if (playerCount <= 16) return 1.15;
    return 1.20;
}

function getPeakWinStreakMultiplier(result: PlayerMatchResult, winStreak: number): number {
    if (result !== "win") return 1.00;
    if (winStreak >= 6) return 1.08;
    if (winStreak >= 5) return 1.07;
    if (winStreak >= 3) return 1.05;
    return 1.00;
}

function getFactionWinBonus(category: TierPointResultInput["winningFactionCategory"]): number {
    if (category === "werewolf") return 4;
    if (category === "villager") return 2;
    if (category === "third") return 5;
    return 0;
}

function getStreakBonus(result: PlayerMatchResult, currentWinStreak: number, currentLossStreak: number): number {
    if (result !== "win") return 0;
    if (currentLossStreak >= 3) return 6;
    if (currentWinStreak >= 4) return 5;
    if (currentWinStreak >= 3) return 4;
    if (currentWinStreak >= 2) return 3;
    return 0;
}

function getEnemyKillBonus(enemyKills: number): number {
    if (enemyKills >= 3) return 2;
    if (enemyKills >= 1) return 1;
    return 0;
}

function getTeamKillPenalty(factionId: string, teamKills: number): number {
    const isVillagerFaction = factionId === "village"
        || factionId === "villager"
        || factionId.endsWith(":village")
        || factionId.endsWith(":villager");
    if (isVillagerFaction) return teamKills >= 3 ? -2 : 0;
    return teamKills >= 1 ? -2 : 0;
}

function getTierPlayerCountWeight(playerCount: number): number {
    if (playerCount <= 4) return 0.25;
    if (playerCount === 5) return 0.60;
    if (playerCount === 6) return 0.75;
    if (playerCount === 7) return 0.90;
    if (playerCount <= 10) return 1.00;
    if (playerCount <= 13) return 1.20;
    if (playerCount <= 16) return 1.45;
    if (playerCount <= 19) return 1.75;
    return 2.10;
}

function roundAwayFromZero(value: number): number {
    if (value === 0) return 0;
    return Math.sign(value) * Math.ceil(Math.abs(value));
}

function finiteNumber(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampNumber(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function clampDivision(value: unknown, maxDivision: number): TierDivision {
    const numeric = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : maxDivision;
    return clampNumber(numeric, 1, maxDivision) as TierDivision;
}
