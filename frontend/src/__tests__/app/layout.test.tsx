import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AppLayout from '@/app/(app)/layout';
import { useAuth } from '@/context/AuthContext';
import { useModules } from '@/hooks/useModules';
import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

// Mock Next.js Navigation
vi.mock('next/navigation', () => {
    const pushMock = vi.fn();
    return {
        usePathname: vi.fn(() => '/dashboard'),
        useRouter: vi.fn(() => ({
            push: pushMock,
        })),
        useSearchParams: vi.fn(() => ({
            get: vi.fn((key) => null),
        })),
    };
});

// Mock Auth Context
vi.mock('@/context/AuthContext', () => ({
    useAuth: vi.fn(),
}));

// Mock Modules Hook
vi.mock('@/hooks/useModules', () => ({
    useModules: vi.fn(),
}));

// Mock React Query
vi.mock('@tanstack/react-query', () => ({
    useQuery: vi.fn(),
}));

// Mock ScopeSelectionDialog and Button to isolate Sidebar testing
vi.mock('@/components/auth/scope-selection-dialog', () => ({
    ScopeSelectionDialog: () => <div data-testid="scope-dialog" />,
}));

vi.mock('@/components/ui/button', () => ({
    Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

// Mock Framer Motion to avoid any animation related issues in jsdom
vi.mock('framer-motion', () => ({
    motion: {
        span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
        aside: ({ children, ...props }: any) => <aside {...props}>{children}</aside>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('AppLayout Sidebar Integration for Platform Admin', () => {
    const mockCompanies = [
        { id: 'querkus-id', name: 'Querkus' },
        { id: 'surf-id', name: 'Surf in Comporta' }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        
        // Mock getMyCompanies query response
        (useQuery as any).mockReturnValue({
            data: mockCompanies,
            isLoading: false,
        });
    });

    it('Scenario 1: Platform Admin with NO company context should see Administration items', () => {
        // Mock user as Platform Admin with no active role or company
        (useAuth as any).mockReturnValue({
            user: {
                id: 'admin-id',
                email: 'hugo@vesotel.com',
                role: 'admin',
                isPlatformAdmin: true,
                activeRole: null,
                activeCompanyId: null,
            },
            loading: false,
            logout: vi.fn(),
        });

        // Mock empty modules since no company context
        (useModules as any).mockReturnValue({
            modules: [],
            isLoading: false,
            hasModule: () => true,
        });

        render(
            <AppLayout>
                <div>Content</div>
            </AppLayout>
        );

        // Should see Platform Administration section and its links
        expect(screen.getByText('Administración Plataforma')).toBeInTheDocument();
        expect(screen.getByText('Gestión de Empresas')).toBeInTheDocument();
        expect(screen.getByText('Usuarios')).toBeInTheDocument();
        expect(screen.getByText('Módulos')).toBeInTheDocument();
    });

    it('Scenario 2: Platform Admin in Querkus context (only billing active) should NOT see Parte Diario or Informes', () => {
        // Mock Search Params returning Querkus ID
        (useSearchParams as any).mockReturnValue({
            get: vi.fn((key) => key === 'companyId' ? 'querkus-id' : null),
        });

        // Mock user switched context to manager in Querkus
        (useAuth as any).mockReturnValue({
            user: {
                id: 'admin-id',
                email: 'hugo@vesotel.com',
                role: 'admin',
                isPlatformAdmin: true,
                activeRole: 'manager',
                activeCompanyId: 'querkus-id',
            },
            loading: false,
            logout: vi.fn(),
        });

        // Mock Querkus modules: billing only
        (useModules as any).mockReturnValue({
            modules: [
                { id: 'm-billing', codeName: 'billing', name: 'Facturación', isActive: true }
            ],
            isLoading: false,
            hasModule: (code: string) => code === 'billing',
        });

        render(
            <AppLayout>
                <div>Content</div>
            </AppLayout>
        );

        // Group label should be active company name
        expect(screen.getByText('Querkus')).toBeInTheDocument();

        // Manager default items
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Calendario')).toBeInTheDocument();
        expect(screen.getByText('Usuarios')).toBeInTheDocument();
        expect(screen.getByText('Turnos')).toBeInTheDocument();

        // Billing is active for Querkus
        expect(screen.getByText('Facturación')).toBeInTheDocument();

        // Parte Diario and Informes should NOT be in the document
        expect(screen.queryByText('Parte Diario')).not.toBeInTheDocument();
        expect(screen.queryByText('Informes')).not.toBeInTheDocument();
    });

    it('Scenario 3: Platform Admin in Surf in Comporta context (all modules active) should see everything', () => {
        // Mock Search Params returning Surf in Comporta ID
        (useSearchParams as any).mockReturnValue({
            get: vi.fn((key) => key === 'companyId' ? 'surf-id' : null),
        });

        // Mock user switched context to manager in Surf in Comporta
        (useAuth as any).mockReturnValue({
            user: {
                id: 'admin-id',
                email: 'hugo@vesotel.com',
                role: 'admin',
                isPlatformAdmin: true,
                activeRole: 'manager',
                activeCompanyId: 'surf-id',
            },
            loading: false,
            logout: vi.fn(),
        });

        // Mock Surf in Comporta modules: all active
        (useModules as any).mockReturnValue({
            modules: [
                { id: 'm-billing', codeName: 'billing', name: 'Facturación', isActive: true },
                { id: 'm-reports', codeName: 'reports', name: 'Informes', isActive: true },
                { id: 'm-daily', codeName: 'worker_daily_report', name: 'Parte Diario', isActive: true }
            ],
            isLoading: false,
            hasModule: () => true,
        });

        render(
            <AppLayout>
                <div>Content</div>
            </AppLayout>
        );

        // Group label should be active company name
        expect(screen.getByText('Surf in Comporta')).toBeInTheDocument();

        // Manager items
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Calendario')).toBeInTheDocument();
        expect(screen.getByText('Usuarios')).toBeInTheDocument();
        expect(screen.getByText('Turnos')).toBeInTheDocument();

        // Active modules in the sidebar
        expect(screen.getByText('Parte Diario')).toBeInTheDocument();
        expect(screen.getByText('Facturación')).toBeInTheDocument();
        expect(screen.getByText('Informes')).toBeInTheDocument();
    });
});
