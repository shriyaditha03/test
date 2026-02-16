import { format, startOfDay, endOfDay } from 'date-fns';

/**
 * Gets the current date/time in the user's local timezone.
 */
export const getNowLocal = (): Date => {
    return new Date();
};

/**
 * Converts any date UTC/Local to a Date object for formatting/comparison in local time.
 */
export const toLocal = (date: Date | string | number): Date => {
    const d = new Date(date);
    return isNaN(d.getTime()) ? new Date() : d;
};

/**
 * Formats a date using local timezone.
 */
export const formatDate = (date: Date | string | number, pattern: string = 'dd-MM-yyyy'): string => {
    return format(toLocal(date), pattern);
};

/**
 * Gets today's date string in local time (yyyy-MM-dd) for database/input filtering.
 */
export const getTodayStr = (): string => {
    return format(getNowLocal(), 'yyyy-MM-dd');
};

/**
 * Checks if a given timestamp falls on "Today" in local time.
 */
export const isTodayLocal = (timestamp: string | Date): boolean => {
    const today = getTodayStr();
    const target = format(toLocal(timestamp), 'yyyy-MM-dd');
    return today === target;
};

/**
 * Converts local date strings (yyyy-MM-dd) to UTC ISO strings representing 
 * the start and end of those days in the user's local timezone.
 */
export const getDateRangeUTC = (fromDate: string, toDate: string) => {
    const [fy, fm, fd] = fromDate.split('-').map(Number);
    const [ty, tm, td] = toDate.split('-').map(Number);

    // Create dates in local time
    const start = new Date(fy, fm - 1, fd, 0, 0, 0, 0);
    const end = new Date(ty, tm - 1, td, 23, 59, 59, 999);

    return {
        startDate: start.toISOString(),
        endDate: end.toISOString()
    };
};
