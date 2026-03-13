import api from '../api';
import { WorkLog, WorkLogCreate } from '@/lib/types';

export const getWorkLogs = async (params?: {
    companyId?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    skip?: number;
}): Promise<WorkLog[]> => {
    const apiParams = {
        company_id: params?.companyId,
        user_id: params?.userId,
        start_date: params?.startDate,
        end_date: params?.endDate,
        limit: params?.limit,
        skip: params?.skip
    };
    const response = await api.get('/work-logs', { params: apiParams });
    return response.data;
};

export const createWorkLog = async (data: WorkLogCreate): Promise<WorkLog> => {
    const response = await api.post('/work-logs', data);
    return response.data;
};

export const updateWorkLog = async (id: string, data: Partial<WorkLogCreate>): Promise<WorkLog> => {
    const response = await api.put(`/work-logs/${id}`, data);
    return response.data;
};

export const deleteWorkLog = async (id: string): Promise<void> => {
    await api.delete(`/work-logs/${id}`);
};
