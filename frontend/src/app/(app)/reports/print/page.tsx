"use client";

import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { parse, format } from "date-fns";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { getMyCompanies } from "@/lib/api/companies";
import { WorkLog } from "@/lib/types";
import { PrintableReport } from "@/components/reports/PrintableReport";
import { Loader2 } from "lucide-react";

export default function PrintReportPage() {
    const searchParams = useSearchParams();
    const { user, loading: authLoading } = useAuth();

    const startStr = searchParams.get('start');
    const endStr = searchParams.get('end');
    const title = searchParams.get('title') || "Work Report";

    const { data: companies = [], isLoading: companiesLoading } = useQuery({
        queryFn: getMyCompanies,
        queryKey: ['myCompanies'],
        enabled: !!user
    });

    const { data: workLogs = [], isLoading: logsLoading } = useQuery({
        queryKey: ['reportLogs', startStr, endStr],
        queryFn: async () => {
            if (!startStr || !endStr) return [];
            const response = await api.get<WorkLog[]>('/work-logs/', {
                params: {
                    start_date: startStr,
                    end_date: endStr,
                    limit: 1000
                }
            });
            return response.data;
        },
        enabled: !!user && !!startStr && !!endStr
    });

    if (authLoading || companiesLoading || logsLoading) {
        return (
            <div className="h-screen w-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    if (!user) return null;

    const startDate = startStr ? parse(startStr, 'yyyy-MM-dd', new Date()) : new Date();
    const endDate = endStr ? parse(endStr, 'yyyy-MM-dd', new Date()) : new Date();

    return (
        <div className="min-h-screen bg-slate-100 print:bg-white p-4 print:p-0">
            {/* Print Controls (Hidden when printing) */}
            <div className="max-w-[210mm] mx-auto mb-4 flex justify-between items-center print:hidden">
                <button
                    onClick={() => window.history.back()}
                    className="text-sm text-slate-500 hover:text-slate-900"
                >
                    ← Back
                </button>
                <button
                    onClick={() => window.print()}
                    className="bg-slate-900 text-white px-4 py-2 rounded-md shadow hover:bg-slate-800 text-sm font-medium"
                >
                    Print / Save as PDF
                </button>
            </div>

            <PrintableReport
                workLogs={workLogs}
                companies={companies}
                title={title}
                dateRange={{ from: startDate, to: endDate }}
            />
        </div>
    );
}
