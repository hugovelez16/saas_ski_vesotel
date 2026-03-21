export interface SystemModule {
    id: string;
    label: string;
    description: string;
    icon: string; // Lucide icon name or similar
    default: boolean;
}

export const SYSTEM_MODULES: SystemModule[] = [
    {
        id: "billing",
        label: "Facturación y Economía",
        description: "Habilita la pestaña de facturación, gestión de precios y reportes financieros.",
        icon: "Banknote",
        default: false,
    },
    {
        id: "worker_daily_report",
        label: "Parte Diario para Trabajadores",
        description: "Permite a los empleados ver y completar sus partes desde el panel principal.",
        icon: "FileText",
        default: true,
    },
    {
        id: "client_database",
        label: "Base de Datos de Clientes",
        description: "Activa la gestión avanzada de clientes en lugar de entrada de texto libre.",
        icon: "Users",
        default: false,
    },
    {
        id: "advanced_reports",
        label: "Informes Avanzados",
        description: "Activa métricas y visualizaciones avanzadas para la dirección.",
        icon: "BarChart3",
        default: false,
    },
    {
        id: "reports",
        label: "Módulo de Informes",
        description: "Habilita la sección de informes para exportación de partes y PDF.",
        icon: "FileBarChart",
        default: true,
    }
];
