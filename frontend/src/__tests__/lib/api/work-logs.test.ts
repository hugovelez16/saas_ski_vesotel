import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WorkLog, WorkLogCreate } from '@/lib/types';

// Mock the api module
vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
    },
}));

import api from '@/lib/api';
import { getWorkLogs, createWorkLog, updateWorkLog, deleteWorkLog } from '@/lib/api/work-logs';

const mockedApi = vi.mocked(api);

describe('Work Logs API Client', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getWorkLogs', () => {
        it('should call /work-logs with no params when none provided', async () => {
            (mockedApi.get as any).mockResolvedValue({ data: [] });

            const result = await getWorkLogs();

            expect(mockedApi.get).toHaveBeenCalledWith('/work-logs', {
                params: {
                    company_id: undefined,
                    user_id: undefined,
                    start_date: undefined,
                    end_date: undefined,
                    limit: undefined,
                    skip: undefined,
                },
            });
            expect(result).toEqual([]);
        });

        it('should map camelCase params to snake_case for the backend', async () => {
            (mockedApi.get as any).mockResolvedValue({ data: [] });

            await getWorkLogs({
                companyId: 'comp-1',
                userId: 'user-1',
                startDate: '2026-01-01',
                endDate: '2026-01-31',
                limit: 100,
                skip: 0,
            });

            expect(mockedApi.get).toHaveBeenCalledWith('/work-logs', {
                params: {
                    company_id: 'comp-1',
                    user_id: 'user-1',
                    start_date: '2026-01-01',
                    end_date: '2026-01-31',
                    limit: 100,
                    skip: 0,
                },
            });
        });

        it('should return the data from the response', async () => {
            const mockLogs: Partial<WorkLog>[] = [
                { id: 'wl-1', type: 'particular', userId: 'u-1' },
                { id: 'wl-2', type: 'tutorial', userId: 'u-2' },
            ];
            (mockedApi.get as any).mockResolvedValue({ data: mockLogs });

            const result = await getWorkLogs({ companyId: 'c-1' });

            expect(result).toEqual(mockLogs);
            expect(result).toHaveLength(2);
        });
    });

    describe('createWorkLog', () => {
        it('should POST to /work-logs with the data', async () => {
            const newLog: WorkLogCreate = {
                type: 'particular',
                companyId: 'c-1',
                userId: 'u-1',
                startDate: '2026-01-15',
                endDate: '2026-01-15',
            };
            const mockResponse = { id: 'wl-new', ...newLog };
            (mockedApi.post as any).mockResolvedValue({ data: mockResponse });

            const result = await createWorkLog(newLog);

            expect(mockedApi.post).toHaveBeenCalledWith('/work-logs', newLog);
            expect(result).toEqual(mockResponse);
        });
    });

    describe('updateWorkLog', () => {
        it('should PUT to /work-logs/:id with partial data', async () => {
            const update: Partial<WorkLogCreate> = { description: 'Updated' };
            const mockResponse = { id: 'wl-1', description: 'Updated' };
            (mockedApi.put as any).mockResolvedValue({ data: mockResponse });

            const result = await updateWorkLog('wl-1', update);

            expect(mockedApi.put).toHaveBeenCalledWith('/work-logs/wl-1?apply_to_group=false', update);
            expect(result).toEqual(mockResponse);
        });
    });

    describe('deleteWorkLog', () => {
        it('should DELETE /work-logs/:id', async () => {
            (mockedApi.delete as any).mockResolvedValue({});

            await deleteWorkLog('wl-1');

            expect(mockedApi.delete).toHaveBeenCalledWith('/work-logs/wl-1');
        });
    });
});
