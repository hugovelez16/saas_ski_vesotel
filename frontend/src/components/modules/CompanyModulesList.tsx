"use client";

import { useQuery } from "@tanstack/react-query";
import { getSubscriptions } from "@/lib/api/modules";
import { SubscriptionBadge } from "./SubscriptionBadge";
import { Package } from "lucide-react";

interface Props {
    companyId: string;
}

export function CompanyModulesList({ companyId }: Props) {
    const { data: subscriptions = [] } = useQuery({
        queryKey: ["subscriptions", companyId],
        queryFn: () => getSubscriptions({ companyId }),
    });

    const active = subscriptions.filter(s => s.status === "active" || s.status === "trial");

    if (active.length === 0) {
        return (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <Package className="h-8 w-8 opacity-30" />
                <p className="text-sm">Esta empresa no tiene módulos activos.</p>
                <p className="text-xs">Ve a <a href="/admin/modules" className="underline">Gestionar Módulos</a> para añadir suscripciones.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {active.map(sub => (
                <div key={sub.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                    <div>
                        <p className="text-sm font-semibold">{sub.module?.name ?? sub.moduleId}</p>
                        {sub.expiresAt && (
                            <p className="text-xs text-muted-foreground">
                                Expira: {new Date(sub.expiresAt).toLocaleDateString("es-ES")}
                            </p>
                        )}
                        {!sub.expiresAt && (
                            <p className="text-xs text-muted-foreground">Sin expiración</p>
                        )}
                    </div>
                    <SubscriptionBadge status={sub.status} />
                </div>
            ))}
        </div>
    );
}
