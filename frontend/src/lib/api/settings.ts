import api from '../api';
import { UserCompanyRate, CompanyWithMembers } from '@/lib/types';
import { getCompaniesDetailed } from './companies';

export const getUserRates = async (companyId?: string): Promise<UserCompanyRate[]> => {
    try {
        const companies = await getCompaniesDetailed();
        const { data: user } = await api.get('/users/me'); // Need current user ID to match member

        let ratesList: UserCompanyRate[] = [];

        for (const company of companies) {
            if (companyId && company.id !== companyId) continue;

            const myMembership = company.members?.find(m => m.user_id === user.id);
            if (myMembership && myMembership.ratesConfig) {
                ratesList.push({
                    company_id: company.id,
                    user_id: user.id,
                    ...myMembership.ratesConfig
                } as unknown as UserCompanyRate); // Cast based on what UI expects
            }
        }

        return ratesList;
    } catch (e) {
        console.warn("Failed to fetch granular rates from detailed endpoint", e);
        return [];
    }
};

// Deprecated alias
export const getUserSettings = async () => {
    const rates = await getUserRates();
    return rates.length > 0 ? rates[0] : null;
}

export const updateUserRates = async (companyId: string, userId: string, data: any) => {
    // Note: To update rates, we now update the member's ratesConfig via the companies endpoint
    const response = await api.put(`/companies/${companyId}/members/${userId}`, { ratesConfig: data });
    return response.data;
};

// Deprecated alias
export const updateUserSettings = updateUserRates;

export const getCompanies = async () => {
    const response = await api.get('/companies');
    return response.data;
};
