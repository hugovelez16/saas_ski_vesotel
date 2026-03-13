"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMyCompanies } from "@/lib/api/companies";
import { CompanyResponse } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { LayoutDashboard, FileText, Calendar, Settings, Users, Building2, Bell, Banknote } from "lucide-react";
import { Sidebar, SidebarProvider } from "@/components/ui/sidebar";
import { CompanySwitcher } from "@/components/company-switcher";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";

function AppLayoutContent({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentCompanyId = searchParams.get("companyId");

    const adminNavItems = [
        { href: "/admin/companies", label: "Gestión de Empresas", icon: Building2 },
        { href: "/admin/daily-reports", label: "Parte Diario", icon: FileText },
        { href: "/admin/users", label: "Usuarios", icon: Users },
    ];

    const workerNavItems = [
        { href: "/dashboard", label: "My Dashboard", icon: LayoutDashboard },
        { href: "/list", label: "Work Logs", icon: FileText },
        { href: "/calendar", label: "Calendar", icon: Calendar },
    ];

    const commonNavItems = [
        { href: "/reports", label: "Informes", icon: FileText },
    ];

    // Company Selection Guard
    const [isCompanyDialogOpen, setIsCompanyDialogOpen] = useState(false);

    // Fetch My Companies (Used for both Supervisor and Worker special access)
    const { data: myCompanies = [] } = useQuery({
        queryFn: getMyCompanies,
        queryKey: ['myCompanies'],
        enabled: !!user
    });

    // Build Nav Groups
    const navGroups: { label?: string; items: any[] }[] = [];

    // Worker Group
    if (user?.is_active_worker || user?.role === 'admin') {
        // Check if any company has worker_daily_report enabled
        const dailyReportCompanies = myCompanies.filter((c: any) =>
            c.settings?.features?.worker_daily_report === true
        );

        const items = [...workerNavItems];

        if (dailyReportCompanies.length > 0) {
            // Add link. If multiple, maybe just link to the page and let page handle selection?
            // User requested: "se le tiene que mostrar en el sidebar el boton de daily report"
            // We can link to /supervisor/daily-reports (which we'll use for workers too).
            // Default to first one or generic.
            const targetId = dailyReportCompanies[0].id;
            items.push({
                href: `/supervisor/daily-reports?companyId=${targetId}`,
                label: "Parte Diario",
                icon: FileText
            });
        }

        navGroups.push({
            label: "Worker Profile",
            items: items
        });
    }

    // Supervisor Group
    // Filter companies where user is manager or admin
    const managedCompanies = myCompanies.filter((c: any) => {
        const role = (c.role || '').toLowerCase();
        return role === 'manager' || role === 'admin' || role === 'owner';
    });

    // Determine target company ID for links (persist current or default to first)
    const targetCompanyId = currentCompanyId || (managedCompanies.length > 0 ? managedCompanies[0].id : null);
    const querySuffix = targetCompanyId ? `?companyId=${targetCompanyId}` : "";

    if (user?.is_supervisor || user?.role === 'admin') {
        navGroups.push({
            label: managedCompanies.length === 1 ? managedCompanies[0].name : "Supervisor",
            items: [
                { href: `/supervisor/dashboard${querySuffix}`, label: "Dashboard", icon: LayoutDashboard },
                { href: `/supervisor/daily-reports${querySuffix}`, label: "Parte Diario", icon: FileText },
                { href: `/supervisor/users${querySuffix}`, label: "Usuarios", icon: Users },
                { href: `/supervisor/shifts${querySuffix}`, label: "Turnos", icon: Calendar },
                { href: `/supervisor/billing${querySuffix}`, label: "Facturación", icon: Banknote },
            ]
        });
    }

    // Admin Group
    if (user?.role === 'admin') {
        navGroups.push({
            label: "Administration",
            items: adminNavItems
        });
    }

    // Account Group (Common)
    navGroups.push({
        label: "Account",
        items: commonNavItems
    });

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    useEffect(() => {
        if (loading || !user || !user.is_supervisor) {
            setIsCompanyDialogOpen(false);
            return;
        }

        // Only enforce on supervisor pages or pages that likely need company context (like reports)
        // Or broadly enforce for supervisors to ensure context. 
        // Let's enforce for all current routes provided they are logged in as supervisor.
        // But avoiding Admin routes if the user is also admin?
        // Admin routes (/admin) generally don't use the sidebar company switcher in the same way (they manage companies).
        const pathname = window.location.pathname;
        if (pathname.startsWith('/admin')) {
            setIsCompanyDialogOpen(false);
            return;
        }

        if (managedCompanies.length > 0 && !currentCompanyId) {
            if (managedCompanies.length === 1) {
                // Auto-select
                const target = managedCompanies[0].id;
                const params = new URLSearchParams(searchParams.toString());
                params.set("companyId", target);
                router.replace(`${pathname}?${params.toString()}`);
            } else if (managedCompanies.length > 1) {
                setIsCompanyDialogOpen(true);
            }
        } else {
            setIsCompanyDialogOpen(false);
        }
    }, [user, loading, managedCompanies, currentCompanyId, router, searchParams]);

    if (loading) {
        return <div className="flex h-screen items-center justify-center">Loading...</div>;
    }

    if (!user) return null;

    // Condition for CompanySwitcher: Only if managing more than 1 company
    const showCompanySwitcher = myCompanies.length > 1;

    // ... (previous logic)




    const handleSelectCompany = (companyId: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("companyId", companyId);
        const pathname = window.location.pathname;
        router.push(`${pathname}?${params.toString()}`);
        setIsCompanyDialogOpen(false);
    };

    return (
        <SidebarProvider>
            <div className="flex min-h-screen flex-col md:flex-row bg-slate-50">
                <Sidebar
                    navGroups={navGroups}
                    companySwitcher={showCompanySwitcher ? <CompanySwitcher companies={myCompanies} /> : null}
                />
                <main className="flex-1 overflow-x-hidden">
                    <div className="p-4 md:p-8">
                        {children}
                    </div>
                </main>

                <Dialog open={isCompanyDialogOpen} onOpenChange={(open) => !open && setIsCompanyDialogOpen(true)}>
                    <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
                        <DialogHeader>
                            <DialogTitle>Seleccionar Empresa</DialogTitle>
                            <DialogDescription>
                                Por favor, selecciona una empresa para continuar.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            {managedCompanies.map((company) => (
                                <Button
                                    key={company.id}
                                    variant="outline"
                                    className="w-full justify-start h-auto py-3 text-left"
                                    onClick={() => handleSelectCompany(company.id)}
                                >
                                    <Building2 className="mr-2 h-5 w-5 opacity-70" />
                                    <div className="flex flex-col items-start">
                                        <span className="font-semibold">{company.name}</span>
                                        <span className="text-xs text-muted-foreground capitalize">{company.role}</span>
                                    </div>
                                </Button>
                            ))}
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </SidebarProvider>
    );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
            <AppLayoutContent>{children}</AppLayoutContent>
        </Suspense>
    );
}
