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
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Acción Requerida</AlertTitle>
                    <AlertDescription className="flex flex-col gap-2">
                        <span>No has seleccionado una empresa por defecto. Esto es necesario para el registro rápido.</span>
                        <Link href="/profile" className="font-bold underline hover:no-underline w-fit">
                            Ir a ajustes de perfil
                        </Link>
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
}
