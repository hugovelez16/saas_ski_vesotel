import { useMemo } from 'react';
import { Company, CompanySettings } from '@/lib/types';

const DEFAULT_SETTINGS: CompanySettings = {
    modules: {
        billing: false,
        worker_daily_report: true,
        client_database: false,
        advanced_reports: false,
        reports: true,
    },
    business_logic: {
        price_type: 'gross',
        cost_markup: 0,
    },
    worker_experience: {
        input_mode: 'manual_single',
        allow_manual_amount: false,
    },
};

export function useCompanySettings(company?: Company | null) {
    const settings = useMemo(() => {
        if (!company || !company.settings) return DEFAULT_SETTINGS;

        const s = company.settings as CompanySettings;

        // Migration logic: Fallback to old keys if new ones are missing
        const modules = { 
            ...DEFAULT_SETTINGS.modules, 
            ...(s.modules || s.features || {}) 
        };

        const business_logic = { 
            ...DEFAULT_SETTINGS.business_logic, 
            ...(s.business_logic || { price_type: s.billing?.price_type }) 
        };

        const worker_experience = { 
            ...DEFAULT_SETTINGS.worker_experience, 
            ...(s.worker_experience || { input_mode: s.input_mode }) 
        };

        return {
            ...DEFAULT_SETTINGS,
            ...s,
            modules,
            business_logic,
            worker_experience,
        };
    }, [company]);

    return settings;
}
