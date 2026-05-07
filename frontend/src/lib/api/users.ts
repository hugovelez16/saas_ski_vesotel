import api from "@/lib/api";
import { User, Token, Session } from "@/lib/types";

export interface CreateUserRequest {
    email: string;
    password?: string;
    first_name: string;
    last_name: string;
    role?: string;
    companyId?: string | null;
    sendEmail?: boolean;
}

export const getUsers = async (): Promise<User[]> => {
    const response = await api.get("/users");
    return response.data;
};

// Sessions Management
export const getUserSessions = async (userId: string): Promise<Session[]> => {
    const response = await api.get(`/users/${userId}/sessions`);
    return response.data;
};

export const revokeUserSession = async (userId: string, sessionId: string) => {
    const response = await api.delete(`/users/${userId}/sessions/${sessionId}`);
    return response.data;
};

export const getUser = async (userId: string): Promise<User> => {
    const response = await api.get(`/users/${userId}`);
    return response.data;
};

export const getUserCompanies = async (userId: string): Promise<any[]> => {
    const response = await api.get(`/users/${userId}/companies`);
    return response.data;
};

export const createUser = async (data: CreateUserRequest): Promise<User> => {
    const response = await api.post("/users", data);
    return response.data;
};

export const updateUserStatus = async (userId: string, is_active: boolean): Promise<any> => {
    const response = await api.put(`/users/${userId}/status?is_active=${is_active}`);
    return response.data;
};

export const updateUser = async (userId: string, data: Partial<User> & { password?: string }): Promise<User> => {
    const response = await api.put(`/users/${userId}`, data);
    return response.data;
};

export const updateMe = async (data: Partial<User>): Promise<User> => {
    const response = await api.put(`/users/me`, data);
    return response.data;
};

export const changePassword = async (data: any): Promise<void> => {
    await api.post('/users/me/change-password', data);
};

export const resetPasswordEmail = async (userId: string) => {
    const response = await api.post(`/users/${userId}/reset-password-email`);
    return response.data;
};

// Master Admin: Impersonation
export const impersonateUser = async (userId: string): Promise<Token> => {
    const response = await api.post<Token>(`/admin/impersonate/${userId}`);
    return response.data;
};


export const getNotifications = async (): Promise<any[]> => {
    const response = await api.get("/users/me/notifications");
    return response.data;
};

export const markNotificationRead = async (notificationId: string): Promise<void> => {
    await api.post(`/users/me/notifications/${notificationId}/read`);
};
