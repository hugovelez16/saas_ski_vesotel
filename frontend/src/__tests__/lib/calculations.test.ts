import { describe, it, expect } from 'vitest';
import { calculateMonthlyStats, IRPF_FACTOR } from '@/lib/calculations';
import type { WorkLog } from '@/lib/types';

// Helper to create a partial WorkLog with defaults
function makeLog(overrides: Partial<WorkLog>): WorkLog {
    return {
        id: 'test-id',
        userId: 'user-1',
        companyId: 'company-1',
        type: 'particular',
        startDate: '2026-01-15',
        endDate: '2026-01-15',
        netAmount: 0,
        grossAmount: 0,
        extraData: {},
        createdAt: '2026-01-15T00:00:00Z',
        updatedAt: '2026-01-15T00:00:00Z',
        ...overrides,
    };
}

describe('IRPF_FACTOR', () => {
    it('should be 0.9352', () => {
        expect(IRPF_FACTOR).toBe(0.9352);
    });
});

describe('calculateMonthlyStats', () => {
    const january = new Date(2026, 0, 1); // January 2026
    const february = new Date(2026, 1, 1); // February 2026

    it('should return zeros for an empty array', () => {
        const result = calculateMonthlyStats([], january);
        expect(result).toEqual({
            totalEarnings: 0,
            totalDaysWorked: 0,
            tutorialDays: 0,
            particularHours: 0,
        });
    });

    it('should aggregate particular log hours and earnings for the correct month', () => {
        const logs: WorkLog[] = [
            makeLog({ date: '2026-01-10', amount: 50, durationHours: 4 }),
            makeLog({ date: '2026-01-20', amount: 75, durationHours: 6 }),
        ];
        const result = calculateMonthlyStats(logs, january);
        expect(result.totalEarnings).toBe(125);
        expect(result.particularHours).toBe(10);
        expect(result.totalDaysWorked).toBe(2);
        expect(result.tutorialDays).toBe(0);
    });

    it('should ignore particular logs from a different month', () => {
        const logs: WorkLog[] = [
            makeLog({ date: '2026-01-10', amount: 50, durationHours: 4 }),
            makeLog({ date: '2026-02-15', amount: 100, durationHours: 8 }),
        ];
        const result = calculateMonthlyStats(logs, january);
        expect(result.totalEarnings).toBe(50);
        expect(result.particularHours).toBe(4);
        expect(result.totalDaysWorked).toBe(1);
    });

    it('should calculate tutorial days within the target month', () => {
        const logs: WorkLog[] = [
            makeLog({
                type: 'tutorial',
                startDate: '2026-01-05',
                endDate: '2026-01-10',
                amount: 600, // 6 days * 100/day
                date: undefined,
            }),
        ];
        const result = calculateMonthlyStats(logs, january);
        expect(result.tutorialDays).toBe(6);
        expect(result.totalDaysWorked).toBe(6);
        expect(result.totalEarnings).toBe(600);
    });

    it('should split tutorial earnings across months correctly', () => {
        // Tutorial spanning Jan 28 to Feb 2 (6 days total)
        // 3 days in Jan, 3 days in Feb
        const logs: WorkLog[] = [
            makeLog({
                type: 'tutorial',
                startDate: '2026-01-28',
                endDate: '2026-02-02',
                amount: 600,
                date: undefined,
            }),
        ];

        const janResult = calculateMonthlyStats(logs, january);
        const febResult = calculateMonthlyStats(logs, february);

        // Jan: 28, 29, 30, 31 = 4 days. Feb: 1, 2 = 2 days. Total 6 days.
        expect(janResult.tutorialDays).toBe(4);
        expect(febResult.tutorialDays).toBe(2);
        expect(janResult.totalEarnings).toBeCloseTo(400);
        expect(febResult.totalEarnings).toBeCloseTo(200);
    });

    it('should combine particular and tutorial stats', () => {
        const logs: WorkLog[] = [
            makeLog({ date: '2026-01-10', amount: 50, durationHours: 4 }),
            makeLog({
                type: 'tutorial',
                startDate: '2026-01-15',
                endDate: '2026-01-17',
                amount: 300,
                date: undefined,
            }),
        ];
        const result = calculateMonthlyStats(logs, january);
        expect(result.totalEarnings).toBe(350);
        expect(result.particularHours).toBe(4);
        expect(result.tutorialDays).toBe(3);
        expect(result.totalDaysWorked).toBe(4); // 1 particular + 3 tutorial
    });

    it('should count unique days (no duplicates)', () => {
        const logs: WorkLog[] = [
            makeLog({ date: '2026-01-10', amount: 30, durationHours: 3 }),
            makeLog({ date: '2026-01-10', amount: 20, durationHours: 2 }),
        ];
        const result = calculateMonthlyStats(logs, january);
        expect(result.totalEarnings).toBe(50);
        expect(result.particularHours).toBe(5);
        expect(result.totalDaysWorked).toBe(1); // Same day
    });
});
