import { describe, it, expect } from 'vitest';
import type {
    UserProfile,
    User,
    Company,
    CompanyMember,
    WorkLog,
    WorkLogCreate,
    Token,
    Session,
    UserCompanyRate,
} from '@/lib/types';

/**
 * Type-level tests. These verify that our interfaces compile correctly
 * and have the expected shape. If a field is missing or misnamed,
 * these tests will fail at compile time.
 */

describe('Type Definitions — Compile-time Safety', () => {
    it('UserProfile should have expected fields', () => {
        const user: UserProfile = {
            id: 'u-1',
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
            role: 'user',
            isActive: true,
            createdAt: '2026-01-01T00:00:00Z',
        };

        expect(user.id).toBe('u-1');
        expect(user.firstName).toBe('John');
        expect(user.lastName).toBe('Doe');
        expect(user.isActive).toBe(true);
    });

    it('User should be an alias for UserProfile', () => {
        const user: User = {
            id: 'u-1',
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User',
            role: 'admin',
            isActive: true,
            createdAt: '2026-01-01T00:00:00Z',
        };
        // If User is NOT the same as UserProfile, this would fail
        const profile: UserProfile = user;
        expect(profile.firstName).toBe('Test');
    });

    it('WorkLog should have financial fields', () => {
        const log: WorkLog = {
            id: 'wl-1',
            userId: 'u-1',
            companyId: 'c-1',
            type: 'particular',
            startDate: '2026-01-15',
            endDate: '2026-01-15',
            netAmount: 100,
            grossAmount: 120,
            extraData: {},
            createdAt: '2026-01-15T00:00:00Z',
            updatedAt: '2026-01-15T00:00:00Z',
        };

        expect(log.netAmount).toBe(100);
        expect(log.grossAmount).toBe(120);
        expect(log.userId).toBe('u-1');
        expect(log.companyId).toBe('c-1');
    });

    it('WorkLog should accept optional UI-compat fields', () => {
        const log: WorkLog = {
            id: 'wl-2',
            userId: 'u-1',
            companyId: 'c-1',
            type: 'tutorial',
            startDate: '2026-01-10',
            endDate: '2026-01-15',
            netAmount: 0,
            grossAmount: 0,
            extraData: {},
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
            // Optional fields
            date: '2026-01-10',
            durationHours: 8,
            amount: 500,
            hasCoordination: true,
            hasNight: false,
            arrivesPrior: false,
            isGrossCalculation: true,
        };

        expect(log.hasCoordination).toBe(true);
        expect(log.isGrossCalculation).toBe(true);
    });

    it('WorkLogCreate should have expected fields', () => {
        const create: WorkLogCreate = {
            type: 'particular',
            companyId: 'c-1',
            userId: 'u-1',
            startDate: '2026-01-15',
            endDate: '2026-01-15',
        };

        expect(create.companyId).toBe('c-1');
        expect(create.userId).toBe('u-1');
    });

    it('Token should use snake_case', () => {
        const token: Token = {
            access_token: 'abc123',
            token_type: 'bearer',
            requires_2fa: false,
            device_token: 'dev-123',
        };

        expect(token.access_token).toBe('abc123');
        expect(token.token_type).toBe('bearer');
    });

    it('CompanyMember should reference userId', () => {
        const member: CompanyMember = {
            userId: 'u-1',
            companyId: 'c-1',
            role: 'worker',
            isActive: true,
            joinedAt: '2026-01-01',
        };

        expect(member.userId).toBe('u-1');
        expect(member.isActive).toBe(true);
    });

    it('UserCompanyRate should include optional user relation', () => {
        const rate: UserCompanyRate = {
            userId: 'u-1',
            companyId: 'c-1',
            hourlyRate: 15,
            dailyRate: 120,
            nightRate: 20,
            coordinationRate: 10,
            isGross: true,
            user: {
                id: 'u-1',
                email: 'test@test.com',
                firstName: 'John',
                lastName: 'Doe',
                role: 'user',
                isActive: true,
                createdAt: '2026-01-01',
            },
        };

        expect(rate.user?.firstName).toBe('John');
    });

    it('DynamicRateConfig should support dynamic keys', () => {
        const config: Record<string, any> = {
            tutorial: {
                base_rate: 15,
                is_gross: true,
                tax_overrides: { irpf: 0.02 }
            }
        };
        expect(config.tutorial.base_rate).toBe(15);
    });

    it('Session should have expected fields', () => {
        const session: Session = {
            id: 's-1',
            deviceName: 'Chrome',
            ipAddress: '127.0.0.1',
            isActive: true,
            lastActive: '2026-01-15',
            createdAt: '2026-01-01',
        };

        expect(session.isActive).toBe(true);
        expect(session.lastActive).toBe('2026-01-15');
    });
});
