export type RankTier = "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond" | "Master";

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
};

export type PlayerStats = {
    readonly games: number;
    readonly wins: number;
    readonly losses: number;
    readonly draws: number;
    readonly roleCounts: Record<string, number>;
    readonly factionCounts: Record<string, number>;
};

export type SeasonProfile = {
    readonly seasonId: string;
    readonly seasonName: string;
    readonly games: number;
    readonly wins: number;
    readonly losses: number;
    readonly draws: number;
    readonly rating: number;
    readonly bestRating: number;
    readonly tier: RankTier;
    readonly bestTier: RankTier;
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
