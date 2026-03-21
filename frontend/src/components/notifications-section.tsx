"use client";

import { UserProfile } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import Link from "next/link";

interface NotificationsSectionProps {
    user: UserProfile;
}

export function NotificationsSection({ user }: NotificationsSectionProps) {
    // Virtual Notifications only
    const needsDefaultCompany = !user.default_company_id && user.role !== 'admin';

    if (!needsDefaultCompany) {
        return null;
    }

    return (
        <div className="space-y-2 mb-6">
            {needsDefaultCompany && (
                <Alert variant="destructive" className="bg-red-50/50 border-red-200/50 shadow-sm transition-all hover:shadow-md">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <AlertTitle className="text-red-800 font-bold">Acción Requerida</AlertTitle>
                    <AlertDescription className="flex flex-col gap-3">
                        <span className="text-red-700/90 leading-relaxed">No has seleccionado una empresa por defecto. Esto es necesario para que el sistema pueda asignar tus registros automáticamente.</span>
                        <Link href="/profile" className="inline-flex items-center gap-1 font-bold text-red-700 underline decoration-red-300 underline-offset-4 hover:decoration-red-700 transition-all w-fit">
                            Configurar ahora en mi perfil
                        </Link>
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
}
