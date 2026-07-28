export type RankTier =
    | "Bronze"
    | "Silver"
    | "Gold"
    | "Platinum"
    | "Diamond"
    | "Master"
    | "Legend"
    | "Peak Legend";

export type PlayerMatchResult = "win" | "loss" | "draw";

export type PlayerMatchHistoryRecord = {
    readonly id: string;
    readonly recordedAtUnixMs: number;
    readonly recordedAtIso: string;
    readonly seasonId: string;
    readonly seasonName: string;
    readonly result: PlayerMatchResult;
    readonly roleId: string;
    readonly factionId: string;
    readonly winnerFactionIds: readonly string[];
    readonly playerCount: number;
    readonly survived: boolean;
    readonly enemyPlayerIds?: readonly string[] | undefined;
    readonly enemyTeamKey?: string | undefined;
    readonly peakRateLog?: PeakRateLog | undefined;
};

export type PeakRateLog = {
    readonly beforeRate: number;
    readonly opponentRate: number;
    readonly expected: number;
    readonly baseChange: number;
    readonly playerCountWeight: number;
    readonly repeatWeight: number;
    readonly rateBandWeight: number;
    readonly winStreakMultiplier: number;
    readonly totalChange: number;
    readonly afterRate: number;
};

export type PlayerStats = {
    readonly games: number;
    readonly wins: number;
    readonly losses: number;
    readonly draws: number;
    readonly roleCounts: Record<string, number>;
    readonly factionCounts: Record<string, number>;
};

export type SeasonRoleAssignmentRecord = {
    readonly roleId: string;
    readonly name: string;
    readonly color: string;
    readonly addonId: string;
    readonly count: number;
};

export type SeasonCarriedItemRecord = {
    readonly itemId: string;
    readonly name: string;
    readonly color: string;
    readonly addonId: string;
    readonly count: number;
};

export type SeasonRandomItemRecord = {
    readonly itemId: string;
    readonly name: string;
    readonly color: string;
    readonly addonId: string;
    readonly count: number;
};

export type SeasonProfile = {
    readonly seasonId: string;
    readonly seasonName: string;
    readonly games: number;
    readonly wins: number;
    readonly losses: number;
    readonly draws: number;
    readonly kills: number;
    readonly deaths: number;
    readonly lynched: number;
    readonly roleAssignments: Record<string, SeasonRoleAssignmentRecord>;
    readonly carriedItems: Record<string, SeasonCarriedItemRecord>;
    readonly randomItems: Record<string, SeasonRandomItemRecord>;
    readonly rating: number;
    readonly bestRating: number;
    readonly tier: RankTier;
    readonly division: number | undefined;
    readonly tierPoint: number;
    readonly bestTier: RankTier;
    readonly bestDivision: number | undefined;
    readonly bestTierPoint: number;
    readonly matchmakingRate: number;
    readonly bestMatchmakingRate: number;
    readonly tierProgressReachedAtUnixMs: number;
    readonly demotionProtection: boolean;
    readonly winStreak: number;
    readonly lossStreak: number;
    readonly peakBaseRate: number | undefined;
    readonly peakRate: number | undefined;
    readonly peakBestRate: number | undefined;
    readonly peakPlacementMatches: number;
    readonly peakPlacementWins: number;
    readonly peakPlacementDone: boolean;
    readonly peakReachedAtUnixMs: number | undefined;
};

export type PlayerProfile = {
    readonly playerId: string;
    displayId: string;
    name: string;
    playerRank: number;
    rating: number;
    bestRating: number;
    tier: RankTier;
    bestTier: RankTier;
    readonly tags: string[];
    readonly stats: PlayerStats;
    readonly seasons: Record<string, SeasonProfile>;
    readonly history: PlayerMatchHistoryRecord[];
    readonly achievements: string[];
};
