"use client";

import { useQuery } from "@tanstack/react-query";
import { getMyModules } from "@/lib/api/modules";
import { useAuth } from "@/context/AuthContext";
import { AppModule } from "@/lib/types";

/**
 * Hook para acceder a los módulos activos del usuario actual.
 * Uso: const { hasModule } = useModules();
 *      if (hasModule("export_pdf")) { ... }
 */
export function useModules(companyId?: string) {
    const { user } = useAuth();
    const activeCompanyId = companyId || user?.activeCompanyId || undefined;

    const { data: modules = [], isLoading } = useQuery<AppModule[]>({
        queryKey: ["myModules", user?.id, activeCompanyId],
        queryFn: () => getMyModules(activeCompanyId),
        enabled: !!user,
        staleTime: 5 * 60 * 1000, // 5 minutos — los módulos cambian poco
    });

    const hasModule = (codeName: string): boolean => {
        // Platform admin always has access to everything
        if (user?.isPlatformAdmin) return true;
        return modules.some((m) => m.codeName === codeName && m.isActive);
    };

    return { modules, hasModule, isLoading };
}
