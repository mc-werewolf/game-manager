import { getCurrentSeason } from "../game/seasons";
import type { GameState } from "../types/gameState";
import type { PlayerMatchHistoryRecord, PlayerMatchResult, PlayerProfile, PlayerStats, RankTier, SeasonProfile } from "../types/playerProfile";

const MAX_HISTORY_RECORDS = 50;
const MAX_PROFILE_TAGS = 3;
const DEFAULT_PLAYER_RANK = 1;
const DEFAULT_RATING = 1000;
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

    getAll(): PlayerProfile[] {
        return [...profiles.values()];
    },

    replaceAll(records: readonly PlayerProfile[]): void {
        profiles.clear();
        for (const record of records) {
            profiles.set(record.playerId, normalizeProfile(record, getUsedDisplayIds()));
        }
    },

    recordGameEnd(state: GameState, winnerFactionIds: readonly string[]): void {
        const season = getCurrentSeason();
        const playerCount = Object.keys(state.players).length;
        const isDraw = winnerFactionIds.length === 0;
        const now = Date.now();

        for (const playerState of Object.values(state.players)) {
            const profile = this.getOrCreate(playerState.playerId, playerState.name);
            const result: PlayerMatchResult = isDraw
                ? "draw"
                : winnerFactionIds.includes(playerState.factionId) ? "win" : "loss";
            const ratingDelta = getRatingDelta(result);

            profile.rating = Math.max(0, profile.rating + ratingDelta);
            profile.bestRating = Math.max(profile.bestRating, profile.rating);
            profile.tier = getRankTier(profile.rating);
            profile.bestTier = getRankTier(profile.bestRating);
            mutateStats(profile.stats, playerState.roleId, playerState.factionId, result);

            const seasonProfile = getOrCreateSeasonProfile(profile, season.seasonId, season.seasonName);
            mutateSeasonProfile(seasonProfile, result, ratingDelta);

            profile.history.unshift({
                id: `${now}-${playerState.playerId}`,
                recordedAtUnixMs: now,
                recordedAtIso: new Date(now).toISOString(),
                seasonId: season.seasonId,
                seasonName: season.seasonName,
                result,
                roleId: playerState.roleId,
                factionId: playerState.factionId,
                winnerFactionIds: [...winnerFactionIds],
                playerCount,
                survived: playerState.isAlive,
            });
            profile.history.splice(MAX_HISTORY_RECORDS);
        }
    },
};

function createProfile(playerId: string, name: string): PlayerProfile {
    return {
        playerId,
        displayId: createUniqueDisplayId(),
        name,
        playerRank: DEFAULT_PLAYER_RANK,
        rating: DEFAULT_RATING,
        bestRating: DEFAULT_RATING,
        tier: getRankTier(DEFAULT_RATING),
        bestTier: getRankTier(DEFAULT_RATING),
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

    return {
        ...profile,
        displayId,
        playerRank: profile.playerRank ?? DEFAULT_PLAYER_RANK,
        rating: profile.rating ?? DEFAULT_RATING,
        bestRating: profile.bestRating ?? profile.rating ?? DEFAULT_RATING,
        tier: profile.tier ?? getRankTier(profile.rating ?? DEFAULT_RATING),
        bestTier: profile.bestTier ?? getRankTier(profile.bestRating ?? profile.rating ?? DEFAULT_RATING),
        tags: Array.isArray(profile.tags) ? profile.tags.slice(0, MAX_PROFILE_TAGS) : [],
        stats: profile.stats ?? createStats(),
        seasons: profile.seasons ?? {},
        history: Array.isArray(profile.history) ? profile.history.slice(0, MAX_HISTORY_RECORDS) : [],
        achievements: Array.isArray(profile.achievements) ? profile.achievements : [],
    };
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

    const created: SeasonProfile = {
        seasonId,
        seasonName,
        games: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        rating: DEFAULT_RATING,
        bestRating: DEFAULT_RATING,
        tier: getRankTier(DEFAULT_RATING),
        bestTier: getRankTier(DEFAULT_RATING),
    };
    profile.seasons[seasonId] = created;
    return created;
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

function mutateSeasonProfile(season: SeasonProfile, result: PlayerMatchResult, ratingDelta: number): void {
    const writable = season as {
        games: number;
        wins: number;
        losses: number;
        draws: number;
        rating: number;
        bestRating: number;
        tier: RankTier;
        bestTier: RankTier;
    };
    writable.games++;
    if (result === "win") writable.wins++;
    if (result === "loss") writable.losses++;
    if (result === "draw") writable.draws++;
    writable.rating = Math.max(0, writable.rating + ratingDelta);
    writable.bestRating = Math.max(writable.bestRating, writable.rating);
    writable.tier = getRankTier(writable.rating);
    writable.bestTier = getRankTier(writable.bestRating);
}

function getRatingDelta(result: PlayerMatchResult): number {
    if (result === "win") return 20;
    if (result === "loss") return -10;
    return 0;
}

export function getRankTier(rating: number): RankTier {
    if (rating >= 1800) return "Master";
    if (rating >= 1600) return "Diamond";
    if (rating >= 1400) return "Platinum";
    if (rating >= 1200) return "Gold";
    if (rating >= 1000) return "Silver";
    return "Bronze";
}
