"use client";

import * as React from "react";
import { Building2, LayoutDashboard } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { CompanyResponse } from "@/lib/types";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
    SelectSeparator,
} from "@/components/ui/select";

interface CompanySwitcherProps {
    companies: CompanyResponse[];
}

export function CompanySwitcher({ companies }: CompanySwitcherProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    // Get current company from URL props
    const currentCompanyId = searchParams.get("companyId");

    // Find selected company object
    const selectedCompany = React.useMemo(() =>
        companies.find((c) => c.id === currentCompanyId),
        [companies, currentCompanyId]
    );

    const onSelectCompany = (value: string) => {
        if (value === "overview") {
            const isManager = pathname.includes('/supervisor') || pathname.includes('/admin');
            router.push(isManager ? '/supervisor/dashboard' : '/dashboard');
            return;
        }

        const company = companies.find((c) => c.id === value);
        if (!company) return;

        // Construct new URL
        const params = new URLSearchParams(searchParams.toString());
        params.set("companyId", company.id);

        if (pathname === '/' || pathname === '/login') {
            router.push(`/dashboard?companyId=${company.id}`);
        } else {
            // Stay on current page, just update the companyId
            router.push(`${pathname}?${params.toString()}`);
        }
    };

    if (companies.length === 0) {
        return null;
    }

    return (
        <Select
            value={selectedCompany?.id || (pathname === '/supervisor/dashboard' && !currentCompanyId ? "overview" : "")}
            onValueChange={onSelectCompany}
        >
            <SelectTrigger className="w-full bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 focus:ring-0 focus:ring-offset-0">
                <div className="flex items-center truncate">
                    <Building2 className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <SelectValue placeholder="Select company..." />
                </div>
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                <SelectGroup>
                    <SelectLabel className="text-slate-500">My Companies</SelectLabel>
                    {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id} className="focus:bg-slate-800 focus:text-white cursor-pointer">
                            {company.name}
                        </SelectItem>
                    ))}
                </SelectGroup>
                <SelectSeparator className="bg-slate-800" />
                <SelectGroup>
                    <SelectItem value="overview" className="focus:bg-slate-800 focus:text-white cursor-pointer">
                        <div className="flex items-center">
                            <LayoutDashboard className="mr-2 h-4 w-4" />
                            <span>Overview</span>
                        </div>
                    </SelectItem>
                </SelectGroup>
            </SelectContent>
        </Select>
    );
}
