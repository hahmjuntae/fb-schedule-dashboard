const WEEKLY_REGULAR_HOURS = 40;
const MM_PER_40_HOURS = 0.24;

export const toMM = (hours: number) => (hours / WEEKLY_REGULAR_HOURS) * MM_PER_40_HOURS;
export const formatMM = (hours: number) => toMM(hours).toFixed(2);
