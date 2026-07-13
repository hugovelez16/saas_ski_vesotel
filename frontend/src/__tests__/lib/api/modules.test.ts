import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '@/lib/api';
import { getSubscriptions, updateSubscription } from '@/lib/api/modules';

vi.mock('@/lib/api', () => ({
    default: {
        get: vi.fn(),
        put: vi.fn(),
    },
}));

const mockedApi = vi.mocked(api);

describe('Modules API Client', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('getSubscriptions should GET /modules/subscriptions', async () => {
        (mockedApi.get as any).mockResolvedValue({ data: [] });
        await getSubscriptions();
        expect(mockedApi.get).toHaveBeenCalledWith('/modules/subscriptions', { params: undefined });
    });

    it('updateSubscription should PUT /modules/subscriptions/:id', async () => {
        (mockedApi.put as any).mockResolvedValue({ data: {} });
        await updateSubscription('sub-1', { status: 'cancelled' });
        expect(mockedApi.put).toHaveBeenCalledWith('/modules/subscriptions/sub-1', { status: 'cancelled' });
    });
});
