export type SeasonInfo = {
    readonly seasonId: string;
    readonly seasonName: string;
    readonly startsAtUnixMs: number;
    readonly endsAtUnixMs: number | undefined;
    readonly isPreseason: boolean;
};

const FIRST_SEASON_START = Date.UTC(2027, 0, 1);
const FIRST_PRESEASON_START = Date.UTC(2026, 6, 1);
const SEASON_MONTHS = 2;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const SEASON_CLOSE_COOLDOWN_MS = 60 * 60 * 1000;
const SEASON_OPEN_RESET_DELAY_MS = 6 * 60 * 60 * 1000;
const SEASON_TIER_RESULT_DEADLINE_MS = 3 * 60 * 60 * 1000;

export function getCurrentSeason(now = new Date()): SeasonInfo {
    const time = now.getTime() + JST_OFFSET_MS;

    if (time < FIRST_SEASON_START) {
        const preseasonTime = Math.max(time, FIRST_PRESEASON_START);
        const preseasonDate = new Date(preseasonTime);
        const monthOffset = Math.max(0, preseasonDate.getUTCMonth() - 6);
        const preseasonIndex = Math.floor(monthOffset / SEASON_MONTHS) + 1;
        const startMonth = 6 + (preseasonIndex - 1) * SEASON_MONTHS;
        return {
            seasonId: `2026-preseason-${preseasonIndex}`,
            seasonName: `2026 Preseason ${preseasonIndex}`,
            startsAtUnixMs: jstDateUtcMs(2026, startMonth, 1),
            endsAtUnixMs: Math.min(jstDateUtcMs(2026, startMonth + SEASON_MONTHS, 1), jstDateUtcMs(2027, 0, 1)),
            isPreseason: true,
        };
    }

    const jstNow = new Date(time);
    const monthsSinceStart = (jstNow.getUTCFullYear() - 2027) * 12 + jstNow.getUTCMonth();
    const seasonNumber = Math.floor(monthsSinceStart / SEASON_MONTHS) + 1;
    const startMonthOffset = (seasonNumber - 1) * SEASON_MONTHS;
    const startYear = 2027 + Math.floor(startMonthOffset / 12);
    const startMonth = startMonthOffset % 12;
    const startsAtUnixMs = jstDateUtcMs(startYear, startMonth, 1);
    const endsAtUnixMs = jstDateUtcMs(startYear, startMonth + SEASON_MONTHS, 1);

    return {
        seasonId: `season-${seasonNumber}`,
        seasonName: `Season ${seasonNumber}`,
        startsAtUnixMs,
        endsAtUnixMs,
        isPreseason: false,
    };
}

export function getSeasonsThroughCurrent(now = new Date()): SeasonInfo[] {
    const currentSeason = getCurrentSeason(now);
    const seasons: SeasonInfo[] = [];
    let cursor = jstDateUtcMs(2026, 6, 1);

    while (cursor <= currentSeason.startsAtUnixMs) {
        const season = getCurrentSeason(new Date(cursor));
        if (seasons[seasons.length - 1]?.seasonId !== season.seasonId) {
            seasons.push(season);
        }
        if (season.endsAtUnixMs === undefined) break;
        cursor = season.endsAtUnixMs;
        if (seasons.length > 500) break;
    }

    return seasons;
}

export function getTierSeasonForMatch(startedAtUnixMs: number, endedAtUnixMs: number): SeasonInfo | undefined {
    const season = getCurrentSeason(new Date(startedAtUnixMs));
    if (isTierCooldownAt(startedAtUnixMs, season)) return undefined;
    if (season.endsAtUnixMs !== undefined && endedAtUnixMs >= season.endsAtUnixMs + SEASON_TIER_RESULT_DEADLINE_MS) {
        return undefined;
    }
    return season;
}

export function isSeasonResetOpen(nowUnixMs = Date.now()): boolean {
    const season = getCurrentSeason(new Date(nowUnixMs));
    return nowUnixMs >= season.startsAtUnixMs + SEASON_OPEN_RESET_DELAY_MS;
}

export function isTierCooldownAt(unixMs: number, season = getCurrentSeason(new Date(unixMs))): boolean {
    if (unixMs < season.startsAtUnixMs + SEASON_OPEN_RESET_DELAY_MS) return true;
    if (season.endsAtUnixMs === undefined) return false;
    return unixMs >= season.endsAtUnixMs - SEASON_CLOSE_COOLDOWN_MS;
}

function jstDateUtcMs(year: number, month: number, day: number): number {
    return Date.UTC(year, month, day) - JST_OFFSET_MS;
}
