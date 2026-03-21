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
    const { user, loading, logout } = useAuth();
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
        const dailyReportCompanies = myCompanies.filter((c: any) => {
            const settings = c.settings || {};
            // Support both new 'modules' and legacy 'features'
            return (settings.modules?.worker_daily_report ?? settings.features?.worker_daily_report ?? true) === true;
        });

        const items = [...workerNavItems];

        if (dailyReportCompanies.length > 0) {
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
        const activeCompany = myCompanies.find((c: any) => c.id === targetCompanyId);
        const settings = activeCompany?.settings || {};
        
        // Billing is a premium module, so we check 'modules.billing' (or legacy 'features.billing')
        const isBillingEnabled = (settings.modules?.billing ?? settings.features?.billing) === true;

        const supervisorItems = [
            { href: `/supervisor/dashboard${querySuffix}`, label: "Dashboard", icon: LayoutDashboard },
            { href: `/supervisor/daily-reports${querySuffix}`, label: "Parte Diario", icon: FileText },
            { href: `/supervisor/users${querySuffix}`, label: "Usuarios", icon: Users },
            { href: `/supervisor/shifts${querySuffix}`, label: "Turnos", icon: Calendar },
        ];

        if (isBillingEnabled) {
            supervisorItems.push({ href: `/supervisor/billing${querySuffix}`, label: "Facturación", icon: Banknote });
        }

        navGroups.push({
            label: managedCompanies.length === 1 ? managedCompanies[0].name : "Supervisor",
            items: supervisorItems
        });
    }

    // Admin Group
    if (user?.role === 'admin') {
        navGroups.push({
            label: "Administration",
            items: adminNavItems
        });
    }

    // Account Group (Common) - Restricted "Informes" to accessible companies
    const accountItems = [];
    
    // Check if reports module is accessible in any company
    const hasReportsAccess = user?.role === 'admin' || myCompanies.some((c: any) => {
        const modules = c.settings?.modules || c.settings?.features || {};
        const reportsConfig = modules.reports; // We'll stick to 'reports' as the primary ID

        if (!reportsConfig) return false;
        if (typeof reportsConfig === 'boolean') return reportsConfig;
        if (typeof reportsConfig === 'object') {
            if (reportsConfig.enabled === false) return false;
            if (reportsConfig.access_level === 'managers') {
                const role = String(c.role || '').toLowerCase();
                return ['manager', 'admin', 'owner'].includes(role);
            }
            return true;
        }
        return false;
    });

    if (hasReportsAccess) {
        accountItems.push(...commonNavItems);
    }

    navGroups.push({
        label: "Account",
        items: accountItems
    });

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    if (loading) {
        return <div className="flex h-screen items-center justify-center">Loading...</div>;
    }

    if (!user) return null;

    // "No Company" Warning Screen
    if (user.role !== 'admin' && myCompanies.length === 0 && !loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
                <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg border border-slate-200">
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Building2 className="w-8 h-8 text-amber-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-4">No estás vinculado a ninguna empresa</h1>
                    <p className="text-slate-600 mb-8">
                        Para poder acceder al sistema, tu usuario debe estar vinculado a al menos una empresa.
                        Por favor, ponte en contacto con el administrador para solicitar acceso.
                    </p>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 mb-8">
                        <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Contacto Administrador</p>
                        <a href="mailto:hugo@vesotel.com" className="text-indigo-600 font-bold hover:underline">
                            hugo@vesotel.com
                        </a>
                    </div>
                    <Button 
                        variant="outline" 
                        onClick={() => {
                            logout();
                        }}
                        className="w-full"
                    >
                        Cerrar Sesión
                    </Button>
                </div>
            </div>
        );
    }

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
