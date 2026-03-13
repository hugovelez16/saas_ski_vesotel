"use client";

import { useQuery } from "@tanstack/react-query";
import { getCompanyRates } from "@/lib/api/companies";
import { UserCompanyRate } from "@/lib/types";
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/data-table";
import { Loader2, Calculator, Check, X } from "lucide-react";

interface TaxOverviewDialogProps {
    companyId: string;
    companyName: string;
}

export function TaxOverviewDialog({ companyId, companyName }: TaxOverviewDialogProps) {
    const { data: rates = [], isLoading } = useQuery({
        queryKey: ["companyRates", companyId],
        queryFn: () => getCompanyRates(companyId),
    });

    const formatPercent = (val?: number) => {
        if (val === undefined || val === null) return "-";
        return `${(val * 100).toFixed(2)}%`;
    };

    // Check if rates is array. API might return null if empty? default [] handles it.

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Calculator className="h-4 w-4" />
                    Tax Overview
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Tax Settings for {companyName}</DialogTitle>
                    <DialogDescription>Overview of tax configuration for all members.</DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                ) : (
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Member</TableHead>
                                    <TableHead>Gross Price?</TableHead>
                                    <TableHead>SS %</TableHead>
                                    <TableHead>IRPF %</TableHead>
                                    <TableHead>Extra %</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rates.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">No rates configured yet.</TableCell>
                                    </TableRow>
                                ) : (
                                    rates.map((rate: UserCompanyRate) => {
                                        const userName = rate.user ? `${rate.user.first_name || ''} ${rate.user.last_name || ''}` : 'Unknown User';
                                        return (
                                            <TableRow key={rate.userId}>
                                                <TableCell className="font-medium">{userName}</TableCell>
                                                <TableCell>
                                                    {rate.isGross ?
                                                        <span className="flex items-center text-green-600 gap-1"><Check className="h-4 w-4" /> Yes</span> :
                                                        <span className="flex items-center text-gray-500 gap-1"><X className="h-4 w-4" /> No</span>
                                                    }
                                                </TableCell>
                                                <TableCell>{rate.deductionSs !== undefined && rate.deductionSs !== null ? formatPercent(rate.deductionSs) : <span className="text-muted-foreground italic">Default</span>}</TableCell>
                                                <TableCell>{formatPercent(rate.deductionIrpf || 0)}</TableCell>
                                                <TableCell>{formatPercent(rate.deductionExtra || 0)}</TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
