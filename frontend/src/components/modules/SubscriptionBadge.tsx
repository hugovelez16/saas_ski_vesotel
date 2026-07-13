import { Badge } from "@/components/ui/badge";

interface Props {
    status: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    active: { label: "Activo", variant: "default" },
    trial: { label: "Trial", variant: "secondary" },
    cancelled: { label: "Cancelado", variant: "destructive" },
    expired: { label: "Expirado", variant: "outline" },
};

export function SubscriptionBadge({ status }: Props) {
    const config = statusConfig[status] ?? { label: status, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
}
