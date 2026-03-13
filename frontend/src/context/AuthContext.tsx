"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import api, { setAuthToken } from "@/lib/api";
import { UserProfile, Token } from "@/lib/types";
import { useRouter } from 'next/navigation';

interface AuthContextType {
    user: UserProfile | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<{ requires2FA: boolean }>;
    verify2FA: (code: string, trustDevice?: boolean) => Promise<void>;
    resend2FA: () => Promise<void>;
    logout: () => void;
    checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    login: async () => { return { requires2FA: false } },
    verify2FA: async () => { },
    resend2FA: async () => { },
    logout: () => { },
    checkAuth: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const fetchUser = async () => {
        try {
            const response = await api.get<UserProfile>('/users/me');
            setUser(response.data);
            return response.data;
        } catch (error: any) {
            // Suppress 401 errors from console to avoid Next.js error overlay
            if (error.response?.status !== 401) {
                console.error("Failed to fetch user:", error);
            } else {
                logout();
            }
            return null;
        } finally {
            setLoading(false);
        }
    };

    const checkAuth = async () => {
        let token = typeof window !== 'undefined' ? (sessionStorage.getItem('token') || localStorage.getItem('token')) : null;

        // Check URL for token (Impersonation / Magic Link)
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const urlToken = params.get('token');
            if (urlToken) {
                token = urlToken;
                sessionStorage.setItem('token', token); // Use session storage for impersonation/temp link
                // Clear URL
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }

        if (token) {
            setAuthToken(token);
            await fetchUser();
        } else {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkAuth();
    }, []);

    const login = async (email: string, password: string) => {
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);

        // Add Device Token if exists
        const deviceToken = localStorage.getItem('device_token');
        if (deviceToken) {
            formData.append('device_token', deviceToken);
        }

        const response = await api.post('/token', formData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        // Backend returns snake_case: access_token, requires_2fa, device_token
        const tokenData = response.data;

        if (tokenData.requires_2fa) {
            setAuthToken(tokenData.access_token); // Temp token
            return { requires2FA: true };
        }

        setAuthToken(tokenData.access_token);
        // If device token returned (e.g. rotated), update it
        if (tokenData.device_token) {
            localStorage.setItem('device_token', tokenData.device_token);
        }


        const userData = await fetchUser();

        if (userData?.role === 'admin') {
            router.push('/admin/companies');
        } else if (userData?.is_supervisor) {
            router.push('/supervisor/daily-reports');
        } else {
            router.push('/dashboard');
        }
        return { requires2FA: false };
    };

    const verify2FA = async (code: string, trustDevice: boolean = false) => {
        const response = await api.post('/verify-2fa', { code, trustDevice });
        // Backend returns snake_case
        const tokenData = response.data;
        setAuthToken(tokenData.access_token);

        if (tokenData.device_token) {
            localStorage.setItem('device_token', tokenData.device_token);
        }

        const userData = await fetchUser();

        if (userData?.role === 'admin') {
            router.push('/admin/companies');
        } else if (userData?.is_supervisor) {
            router.push('/supervisor/daily-reports');
        } else {
            router.push('/dashboard');
        }
    };

    const resend2FA = async () => {
        await api.post('/resend-2fa');
    };

    const logout = () => {
        setAuthToken(null);
        setUser(null);
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
        router.push('/login');
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, verify2FA, resend2FA, logout, checkAuth }}>
            {children}
        </AuthContext.Provider>
    );
};
