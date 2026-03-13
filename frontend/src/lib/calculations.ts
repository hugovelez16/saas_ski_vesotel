import { differenceInCalendarDays, parseISO, isSameMonth, format } from 'date-fns';
import type { WorkLog, UserSettings } from '@/lib/types';

/**
 * IRPF Factor used for net calculation if needed.
 */
export const IRPF_FACTOR = 0.9352;

/**
 * Calculates monthly statistics from work logs.
 * Aggregates total earnings, total days worked, tutorial days, and particular hours.
 * 
 * @param workLogs - Array of work logs to process.
 * @param month - The specific month to filter and calculate stats for.
 * @returns Object containing aggregated statistics.
 */
export function calculateMonthlyStats(workLogs: WorkLog[], month: Date) {
    let totalEarnings = 0;
    let particularHours = 0;
    let tutorialDays = 0;
    const uniqueDays = new Set<string>();

    workLogs.forEach(entry => {
        if (entry.type === 'particular' && entry.date && isSameMonth(parseISO(entry.date), month)) {
            totalEarnings += (entry.amount || 0);
            particularHours += (entry.durationHours || 0);
            // uniqueDays.add(entry.date); // String/Date issue in types might require casting
            uniqueDays.add(String(entry.date));
        } else if (entry.type === 'tutorial' && entry.startDate && entry.endDate) {
            const start = parseISO(entry.startDate);
            const end = parseISO(entry.endDate);
            const tutorialDuration = differenceInCalendarDays(end, start) + 1;
            const dailyEarning = tutorialDuration > 0 ? (entry.amount || 0) / tutorialDuration : 0;

            for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
                if (isSameMonth(dt, month)) {
                    totalEarnings += dailyEarning;
                    tutorialDays += 1;
                    const dayString = format(dt, 'yyyy-MM-dd');
                    uniqueDays.add(dayString);
                }
            }
        }
    });

    return {
        totalEarnings,
        totalDaysWorked: uniqueDays.size,
        tutorialDays,
        particularHours,
    };
}
