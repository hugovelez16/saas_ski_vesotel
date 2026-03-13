"use client";

import { useQuery } from "@tanstack/react-query";
import { getMyCompanies } from "@/lib/api/companies";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { CompanyDashboard } from "@/components/supervisor/company-dashboard";
import { useEffect, useMemo } from "react";
import { Building2 } from "lucide-react";

export default function SupervisorDashboardPage() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const companyId = searchParams.get("companyId");

    // Fetch My Companies
    const { data: myCompanies = [], isLoading } = useQuery({
        queryFn: getMyCompanies,
        queryKey: ["myCompanies"],
    });

    // Filter Managed Companies
    const managedCompanies = useMemo(() => {
        return myCompanies.filter((c: any) => {
            const role = (c.role || '').toLowerCase();
            return role === 'manager' || role === 'admin' || role === 'owner';
        });
    }, [myCompanies]);

    // Auto-select logic
    useEffect(() => {
        if (!isLoading && managedCompanies.length > 0 && !companyId) {
            router.replace(`${pathname}?companyId=${managedCompanies[0].id}`);
        }
    }, [isLoading, managedCompanies, companyId, pathname, router]);

    if (isLoading) {
        return <div className="p-8">Loading...</div>;
    }

    // Determine current view
    // If companyId is valid, show dashboard.
    // Ensure companyId belongs to managedCompanies
    const selectedCompany = managedCompanies.find(c => c.id === companyId);

    // If no company selected yet (and effect hasn't fired or list empty)
    if (!selectedCompany) {
        if (managedCompanies.length === 0) {
            return <div className="p-8 text-muted-foreground">You do not manage any companies.</div>;
        }
        return <div className="p-8">Redirecting...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Dashboard Content */}
            <CompanyDashboard
                companyId={selectedCompany.id}
                companyName={selectedCompany.name}
            />
        </div>
    );
}
