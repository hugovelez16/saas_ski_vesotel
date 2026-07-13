"use client";

import { AppModule, ModuleSubscription } from "@/lib/types";
import { SubscriptionBadge } from "./SubscriptionBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, User, Layers } from "lucide-react";

interface Props {
    module: AppModule;
    subscriptions: ModuleSubscription[];
    onAddSubscription: (module: AppModule) => void;
    onCancelSubscription: (sub: ModuleSubscription) => void;
}

const scopeIcons = {
    company: Building2,
    user: User,
    both: Layers,
};

export function ModuleCard({ module, subscriptions, onAddSubscription, onCancelSubscription }: Props) {
    const Icon = scopeIcons[module.targetScope] ?? Layers;
    const activeSubs = subscriptions.filter(s => s.status === "active" || s.status === "trial");

    return (
        <Card className={!module.isActive ? "opacity-50" : ""}>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div className="rounded-md bg-primary/10 p-2">
                        <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="text-base">{module.name}</CardTitle>
                        <code className="text-xs text-muted-foreground">{module.codeName}</code>
                    </div>
                </div>
                <div className="flex gap-2">
                    {!module.isActive && <Badge variant="outline">Inactivo</Badge>}
                    {module.priceMonthly != null && (
                        <Badge variant="secondary">{module.priceMonthly}€/mes</Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {module.description && (
                    <CardDescription>{module.description}</CardDescription>
                )}

                {/* Suscripciones activas */}
                {activeSubs.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Suscripciones activas</p>
                        {activeSubs.map(sub => (
                            <div key={sub.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                                <div className="flex items-center gap-2">
                                    <SubscriptionBadge status={sub.status} />
                                    <span className="text-xs text-muted-foreground">
                                        {sub.scope === "company" ? "Empresa" : "Usuario"} •{" "}
                                        {sub.expiresAt
                                            ? `Expira: ${new Date(sub.expiresAt).toLocaleDateString("es-ES")}`
                                            : "Sin expiración"}
                                    </span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onCancelSubscription(sub)}
                                    className="h-6 text-destructive hover:text-destructive"
                                >
                                    Cancelar
                                </Button>
                            </div>
                        ))}
                    </div>
                )}

                <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={!module.isActive}
                    onClick={() => onAddSubscription(module)}
                >
                    + Añadir Suscripción
                </Button>
            </CardContent>
        </Card>
    );
}
