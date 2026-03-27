/**
 * User Profile Interface.
 */
export interface UserProfile {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    role: string;
    is_active: boolean;
    is_active_worker?: boolean;
    is_manager?: boolean;
    must_change_password?: boolean;
    is_2fa_enabled?: boolean;
    is_impersonated?: boolean;
    is_platform_admin?: boolean;
    active_company_id?: string | null;
    active_role?: string | null;
    default_company_id?: string | null;
    created_at: string;
}

export type User = UserProfile;
export type UserSettings = any; // Placeholder for legacy references

/**
 * Company Interface
 */
export interface Company {
    id: string;
    name: string;
    fiscalId?: string | null;
    taxConfig: {
        social_security: number;
        irpf_base: number;
        [key: string]: number;
    };
    worklogDefinitions?: Record<string, any>;
    settings?: Record<string, any>;
    created_at: string;
    updatedAt: string;

    // UI specific
    role?: string;
    isActiveMember?: boolean;
}

export type CompanyResponse = Company;

export interface CompanySettings {
    modules?: Record<string, boolean>;
    business_logic?: {
        price_type?: 'net' | 'gross';
        cost_markup?: number;
    };
    worker_experience?: {
        input_mode?: 'manual_single' | 'timer' | 'bulk';
        allow_manual_amount?: boolean;
    };
    ui_customization?: {
        labels?: {
            worklog?: string;
            client?: string;
        };
    };
    // Legacy support (to be removed after complete migration)
    /** @deprecated Use modules instead */
    features?: Record<string, boolean>;
    /** @deprecated Use business_logic.price_type instead */
    billing?: {
        price_type?: 'net' | 'gross';
    };
    /** @deprecated Use worker_experience.input_mode instead */
    input_mode?: 'manual_single' | 'timer' | 'bulk';
}

/**
 * Company Member Interface
 */
export interface CompanyMember {
    userId: string;
    companyId: string;
    role: string;
    is_active: boolean;
    status?: string;
    ratesConfig?: Record<string, any>;
    settings?: Record<string, any>;
    joinedAt: string;
    user?: UserProfile;
}

export type CompanyMemberResponse = CompanyMember;

export interface CompanyWithMembers extends Company {
    members: CompanyMember[];
}

/**
 * WorkLog Interface (Refactored for SaaS Dynamic Engine)
 */
export interface WorkLog {
    id: string;
    userId: string;
    companyId: string;
    type: string;
    startDate: string;
    endDate: string;
    startTime?: string | null;
    endTime?: string | null;
    duration?: number;

    // Financials (Unified with Backend)
    netAmount: number;
    grossAmount: number;
    rateApplied: number;

    // Historical Snapshot
    calculationSnapshot?: Record<string, any>;

    extraData: Record<string, any>;
    description?: string | null;
    pickupPoint?: string | null;
    client?: string | null;
    groupId?: string | null;

    created_at: string;
    updatedAt: string;

    // Legacy / UI compat
    date?: string;
    durationHours?: number;
    amount?: number;
    hasCoordination?: boolean;
    hasNight?: boolean;
    arrivesPrior?: boolean;
    isGrossCalculation?: boolean;
}

export interface UserDevice {
    id: string;
    userId: string;
    name: string;
    deviceIdentifier: string;
    lastUsed: string;
    expiresAt: string;
}

/**
 * API Request Schemas
 */
export interface WorkLogCreate {
    type: string;
    companyId: string;
    userId: string;
    startDate: string;
    endDate: string;
    startTime?: string | null;
    endTime?: string | null;
    description?: string | null;
    pickupPoint?: string | null;
    client?: string | null;
    extraData?: Record<string, any>;
    amount?: number; // Manual override
    date?: string | null;
    hasCoordination?: boolean;
    hasNight?: boolean;
    arrivesPrior?: boolean;
    rateApplied?: number;
    grossAmount?: number;
    netAmount?: number;
    isGrossCalculation?: boolean;
    groupId?: string | null;
}

export interface WorkLogBulkCreate extends Omit<WorkLogCreate, 'userId'> {
    userIds: string[];
}

/**
 * Authentication & Sessions
 */
export interface Token {
    access_token: string;
    token_type: string;
    requires_2fa?: boolean;
    device_token?: string;
}

export interface Session {
    id: string;
    deviceName?: string | null;
    ipAddress?: string | null;
    is_active: boolean;
    lastActive: string;
    created_at: string;
}

/**
 * Master Admin Types
 */
export interface UserCompanyRate {
    userId: string;
    companyId: string;
    hourlyRate: number;
    dailyRate: number;
    nightRate: number;
    coordinationRate: number;
    isGross: boolean;
    deductionSs?: number;
    deductionIrpf?: number;
    deductionExtra?: number;
    user?: UserProfile;
}
