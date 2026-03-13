import { useMemo } from 'react';
import { Company, CompanySettings } from '@/lib/types';

const DEFAULT_SETTINGS: CompanySettings = {
    features: {
        tutorials: true,
        coordination: true,
        night_shifts: true,
        supplements: false,
    },
    billing: {
        price_type: 'gross',
    },
    input_mode: 'manual_single',
};

export function useCompanySettings(company?: Company | null) {
    const settings = useMemo(() => {
        if (!company || !company.settings) return DEFAULT_SETTINGS;

        return {
            features: { ...DEFAULT_SETTINGS.features, ...company.settings.features },
            billing: { ...DEFAULT_SETTINGS.billing, ...company.settings.billing },
            input_mode: company.settings.input_mode || DEFAULT_SETTINGS.input_mode,
        };
    }, [company]);

    return settings;
}
