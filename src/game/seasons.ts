export type SeasonInfo = {
    readonly seasonId: string;
    readonly seasonName: string;
    readonly startsAtUnixMs: number;
    readonly endsAtUnixMs: number | undefined;
    readonly isPreseason: boolean;
};

const FIRST_SEASON_START = Date.UTC(2027, 0, 1);
const SEASON_MONTHS = 2;

export function getCurrentSeason(now = new Date()): SeasonInfo {
    const time = now.getTime();

    if (time < FIRST_SEASON_START) {
        const monthOffset = Math.max(0, now.getUTCMonth() - 6);
        const preseasonIndex = Math.floor(monthOffset / SEASON_MONTHS) + 1;
        const startMonth = 6 + (preseasonIndex - 1) * SEASON_MONTHS;
        return {
            seasonId: `2026-preseason-${preseasonIndex}`,
            seasonName: `2026 Preseason ${preseasonIndex}`,
            startsAtUnixMs: Date.UTC(2026, startMonth, 1),
            endsAtUnixMs: Math.min(Date.UTC(2026, startMonth + SEASON_MONTHS, 1), FIRST_SEASON_START),
            isPreseason: true,
        };
    }

    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const seasonIndex = Math.floor(month / SEASON_MONTHS) + 1;
    const startMonth = (seasonIndex - 1) * SEASON_MONTHS;
    const startsAtUnixMs = Date.UTC(year, startMonth, 1);
    const endsAtUnixMs = Date.UTC(year, startMonth + SEASON_MONTHS, 1);

    return {
        seasonId: `${year}-s${seasonIndex}`,
        seasonName: `${year} Season ${seasonIndex}`,
        startsAtUnixMs,
        endsAtUnixMs,
        isPreseason: false,
    };
}
