"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMyCompanies } from "@/lib/api/companies";
import { CompanyResponse } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { LayoutDashboard, FileText, Calendar, Settings, Users, Building2, Bell, Banknote, CalendarDays, Package } from "lucide-react";
import { Sidebar, SidebarProvider } from "@/components/ui/sidebar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";

function AppLayoutContent({ children }: { children: React.ReactNode }) {
    const { user, loading, logout } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const currentCompanyId = searchParams.get("companyId");

    const adminNavItems = [
        { href: "/admin/companies", label: "Gestión de Empresas", icon: Building2 },
        { href: "/admin/daily-reports", label: "Parte Diario", icon: FileText },
        { href: "/admin/users", label: "Usuarios", icon: Users },
        { href: "/admin/modules", label: "Módulos", icon: Package },
    ];

    const workerNavItems = [
        { href: "/dashboard", label: "My Dashboard", icon: LayoutDashboard },
        { href: "/list", label: "Work Logs", icon: FileText },
        { href: "/calendar", label: "Calendar", icon: Calendar },
    ];

    // (commonNavItems removed as we move Informes to specific sections)

    // Company Selection Guard (Legacy removed as we now use context switching)

    // Fetch My Companies (Used for both Manager and Worker special access)
    const { data: myCompanies = [] } = useQuery({
        queryFn: getMyCompanies,
        queryKey: ['myCompanies'],
        enabled: !!user
    });

    // ... (managedCompanies removed as legacy switcher is gone)

    // Determine target company ID for links (persist current -> session context -> default to first)
    const targetCompanyId = currentCompanyId || user?.activeCompanyId || (myCompanies.length > 0 ? myCompanies[0].id : null);
    const querySuffix = targetCompanyId ? `?companyId=${targetCompanyId}` : "";

    // Build Nav Groups
    const navGroups: { label?: string; items: any[] }[] = [];

    const isPlatformAdmin = user?.role === 'admin' || user?.isPlatformAdmin;
    const activeRole = user?.activeRole;

    // Platform Admin Logic: Exclusive visibility
    if (isPlatformAdmin) {
        // Platform Admin Group - Show only if we have not switched to manager or worker context
        if (!activeRole) {
            navGroups.push({
                label: "Administración Plataforma",
                items: adminNavItems
            });
        }

        // Show Manager/Worker groups ONLY if they have explicitly switched context to one
        if (activeRole === 'manager') {
            const activeCompany = myCompanies.find((c: any) => c.id === targetCompanyId);
            const settings = activeCompany?.settings || {};
            const isBillingEnabled = (settings.modules?.billing ?? settings.features?.billing) === true;
            const isDailyReportEnabled = (settings.modules?.worker_daily_report ?? settings.features?.worker_daily_report ?? true) === true;
            
            // Modules check for Reports
            const reportsConfig = settings.modules?.reports ?? settings.features?.reports;
            const hasReports = reportsConfig === undefined ? true : (typeof reportsConfig === 'boolean' ? reportsConfig : (reportsConfig.enabled !== false));

            const managerItems = [
                { href: `/manager/dashboard${querySuffix}`, label: "Dashboard", icon: LayoutDashboard },
                { href: `/manager/calendar${querySuffix}`, label: "Calendario", icon: Calendar },
            ];
            if (isDailyReportEnabled) {
                managerItems.push({ href: `/manager/daily-reports${querySuffix}`, label: "Parte Diario", icon: FileText });
            }
            managerItems.push(
                { href: `/manager/users${querySuffix}`, label: "Usuarios", icon: Users },
                { href: `/manager/shifts${querySuffix}`, label: "Turnos", icon: CalendarDays }
            );
            if (isBillingEnabled) {
                managerItems.push({ href: `/manager/billing${querySuffix}`, label: "Facturación", icon: Banknote });
            }
            if (hasReports) {
                managerItems.push({ href: `/reports${querySuffix}`, label: "Informes", icon: FileText });
            }

            navGroups.push({
                label: activeCompany?.name || "Manager Context",
                items: managerItems
            });
        } else if (activeRole === 'worker') {
            // Check if reports are enabled for ANY of the user's companies (since reports page handles company selection)
            const hasAnyReports = user?.role === 'admin' || myCompanies.some((c: any) => {
                const config = c.settings?.modules?.reports ?? c.settings?.features?.reports;
                return config === undefined ? true : (typeof config === 'boolean' ? config : (config.enabled !== false));
            });

            const items = [...workerNavItems];
            if (hasAnyReports) {
                items.push({ href: "/reports", label: "Informes Personales", icon: FileText });
            }

            navGroups.push({
                label: "Worker Context",
                items: items
            });
        }
    } else {
        // Regular User Logic (Current behavior)
        if (activeRole === 'worker') {
            const dailyReportCompanies = myCompanies.filter((c: any) => {
                const settings = c.settings || {};
                return (settings.modules?.worker_daily_report ?? settings.features?.worker_daily_report ?? true) === true;
            });

            // Reports check
            const hasAnyReports = myCompanies.some((c: any) => {
                const config = c.settings?.modules?.reports ?? c.settings?.features?.reports;
                return config === undefined ? true : (typeof config === 'boolean' ? config : (config.enabled !== false));
            });

            const items = [...workerNavItems];
            if (dailyReportCompanies.length > 0) {
                const targetId = dailyReportCompanies[0].id;
                items.push({
                    href: `/manager/daily-reports?companyId=${targetId}`,
                    label: "Parte Diario",
                    icon: FileText
                });
            }
            if (hasAnyReports) {
                items.push({ href: "/reports", label: "Informes Personales", icon: FileText });
            }

            navGroups.push({
                label: "Perfil de Trabajador",
                items: items
            });
        }

        if (activeRole === 'manager') {
            const activeCompany = myCompanies.find((c: any) => c.id === targetCompanyId);
            const settings = activeCompany?.settings || {};
            const isBillingEnabled = (settings.modules?.billing ?? settings.features?.billing) === true;
            const isDailyReportEnabled = (settings.modules?.worker_daily_report ?? settings.features?.worker_daily_report ?? true) === true;
            
            // Reports check
            const reportsConfig = settings.modules?.reports ?? settings.features?.reports;
            const hasReports = reportsConfig === undefined ? true : (typeof reportsConfig === 'boolean' ? reportsConfig : (reportsConfig.enabled !== false));

            const managerItems = [
                { href: `/manager/dashboard${querySuffix}`, label: "Dashboard", icon: LayoutDashboard },
                { href: `/manager/calendar${querySuffix}`, label: "Calendario", icon: Calendar },
            ];
            if (isDailyReportEnabled) {
                managerItems.push({ href: `/manager/daily-reports${querySuffix}`, label: "Parte Diario", icon: FileText });
            }
            managerItems.push(
                { href: `/manager/users${querySuffix}`, label: "Usuarios", icon: Users },
                { href: `/manager/shifts${querySuffix}`, label: "Turnos", icon: CalendarDays }
            );
            if (isBillingEnabled) {
                managerItems.push({ href: `/manager/billing${querySuffix}`, label: "Facturación", icon: Banknote });
            }
            if (hasReports) {
                managerItems.push({ href: `/reports${querySuffix}`, label: "Informes", icon: FileText });
            }

            navGroups.push({
                label: activeCompany?.name || "Manager",
                items: managerItems
            });
        }
    }

    // (Account Group removed: Informes moved to Manager/Worker sections)

    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.push('/login');
            } else if (user.mustChangePassword && pathname !== '/force-change-password') {
                router.push('/force-change-password');
            }
        }
    }, [user, loading, router, pathname]);

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

    // ... (showCompanySwitcher removed)

    // ... (previous logic)




    const handleSelectCompany = (companyId: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("companyId", companyId);
        const pathname = window.location.pathname;
        router.push(`${pathname}?${params.toString()}`);
    };

    if (user?.mustChangePassword && pathname === '/force-change-password') {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
                <main className="w-full max-w-md">
                    {children}
                </main>
            </div>
        );
    }

    return (
        <SidebarProvider>
            <div className="flex min-h-screen flex-col md:flex-row bg-slate-50">
                <Sidebar
                    navGroups={navGroups}
                />
                <main className="flex-1 overflow-x-hidden">
                    <div className="p-4 md:p-8">
                        {children}
                    </div>
                </main>

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
