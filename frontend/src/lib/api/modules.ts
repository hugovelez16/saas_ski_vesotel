import api from "@/lib/api";
import { AppModule, ModuleSubscription } from "@/lib/types";

export const getModules = async (includeInactive = false): Promise<AppModule[]> => {
    const response = await api.get<AppModule[]>("/modules", {
        params: { include_inactive: includeInactive }
    });
    return response.data;
};

export const getMyModules = async (): Promise<AppModule[]> => {
    const response = await api.get<AppModule[]>("/modules/me");
    return response.data;
};

export const createModule = async (data: {
    codeName: string;
    name: string;
    description?: string;
    isActive?: boolean;
    targetScope?: string;
    priceMonthly?: number | null;
}): Promise<AppModule> => {
    const response = await api.post<AppModule>("/modules", data);
    return response.data;
};

export const updateModule = async (moduleId: string, data: {
    name?: string;
    description?: string;
    isActive?: boolean;
    targetScope?: string;
    priceMonthly?: number | null;
}): Promise<AppModule> => {
    const response = await api.put<AppModule>(`/modules/${moduleId}`, data);
    return response.data;
};

export const getModule = async (moduleId: string): Promise<AppModule> => {
    const response = await api.get<AppModule>(`/modules/${moduleId}`);
    return response.data;
};

export const getSubscriptions = async (params?: {
    companyId?: string;
    userId?: string;
    moduleId?: string;
}): Promise<ModuleSubscription[]> => {
    const queryParams: Record<string, string> = {};
    if (params?.companyId) queryParams.company_id = params.companyId;
    if (params?.userId) queryParams.user_id = params.userId;
    if (params?.moduleId) queryParams.module_id = params.moduleId;
    
    const response = await api.get<ModuleSubscription[]>("/modules/subscriptions", { params: queryParams });
    return response.data;
};


export const createSubscription = async (data: {
    moduleId: string;
    companyId?: string;
    userId?: string;
    scope: string;
    status?: string;
    expiresAt?: string;
    notes?: string;
}): Promise<ModuleSubscription> => {
    const response = await api.post<ModuleSubscription>("/modules/subscriptions", data);
    return response.data;
};

export const updateSubscription = async (subId: string, data: {
    status?: string;
    expiresAt?: string | null;
    notes?: string;
}): Promise<ModuleSubscription> => {
    const response = await api.put<ModuleSubscription>(`/modules/subscriptions/${subId}`, data);
    return response.data;
};

export const deleteSubscription = async (subId: string): Promise<void> => {
    await api.delete(`/modules/subscriptions/${subId}`);
};
