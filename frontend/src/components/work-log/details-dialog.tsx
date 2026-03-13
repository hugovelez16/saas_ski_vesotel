"use client";

import React from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { es } from "date-fns/locale";
import { WorkLog, UserSettings } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";

interface WorkLogDetailsDialogProps {
    log: WorkLog | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userSettings?: UserSettings | null;
    onEdit?: (log: WorkLog) => void;
    onDelete?: (log: WorkLog) => void;
}

export function WorkLogDetailsDialog({ log, open, onOpenChange, userSettings, onEdit, onDelete }: WorkLogDetailsDialogProps) {
    const { user } = useAuth();
    const [applyToGroup, setApplyToGroup] = React.useState(false);

    if (!log) return null;

    const isTutorial = log.type === 'tutorial';

    // Breakdown Calculation Logic
    let breakdown = [];
    let calculatedGross = 0;

    if (isTutorial && log.startDate && log.endDate) {
        const start = parseISO(log.startDate);
        const end = parseISO(log.endDate);
        const days = differenceInCalendarDays(end, start) + 1;
        const rate = log.rateApplied || userSettings?.dailyRate || 0;
        const baseTotal = days * rate;

        breakdown.push({ label: `${days}d x ${rate.toFixed(2)}€ (Tutorial)`, value: baseTotal });
        calculatedGross += baseTotal;

        if (log.hasNight) {
            let nightBase = days > 0 ? days - 1 : 0;
            const nights = log.arrivesPrior ? nightBase + 1 : nightBase;
            const nightRate = userSettings?.nightRate ?? 30;
            const nightTotal = nights * nightRate;

            breakdown.push({ label: `${nights} nights (noches) x ${formatCurrency(nightRate)} / night (noche)`, value: nightTotal });
            calculatedGross += nightTotal;
        }

        if (log.hasCoordination) {
            const coordinationRate = userSettings?.coordinationRate ?? 10;
            const coordinationTotal = days * coordinationRate;
            breakdown.push({ label: `${days} days (días) x ${formatCurrency(coordinationRate)} (Coordination/Coordinación)`, value: coordinationTotal });
            calculatedGross += coordinationTotal;
        }

    } else if (!isTutorial && log.date) {
        const duration = log.durationHours || 0;
        const rate = log.rateApplied || userSettings?.hourlyRate || 0;
        const baseTotal = duration * rate;

        breakdown.push({ label: `${duration.toFixed(2)}h x ${rate.toFixed(2)}€`, value: baseTotal });
        calculatedGross += baseTotal;

        if (log.hasNight) {
            const nightRate = userSettings?.nightRate ?? 30;
            breakdown.push({ label: `Night Supplement (Plus nocturnidad)`, value: nightRate });
            calculatedGross += nightRate;
        }

        if (log.hasCoordination) {
            const coordinationRate = userSettings?.coordinationRate ?? 10;
            breakdown.push({ label: `Coordination Supplement (Plus coordinación)`, value: coordinationRate });
            calculatedGross += coordinationRate;
        }
    }

    // Use stored totals as source of truth
    const finalGross = log.grossAmount || calculatedGross;
    const finalNet = log.amount || finalGross;

    // Add adjustment if there's a difference between calculated and stored gross
    const adjustment = finalGross - calculatedGross;
    if (Math.abs(adjustment) > 0.01) {
        breakdown.push({
            label: `Adjustment (Ajuste manual / histórico)`,
            value: adjustment
        });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Work Log Details</DialogTitle>
                    <DialogDescription>
                        Full breakdown of the price calculation.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4 text-sm">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <h4 className="font-semibold text-muted-foreground">Type</h4>
                            <p className="capitalize">{log.type}</p>
                        </div>
                        <div>
                            <h4 className="font-semibold text-muted-foreground">Client</h4>
                            <p>{log.client || '-'}</p>
                        </div>
                        <div>
                            <h4 className="font-semibold text-muted-foreground">Date</h4>
                            {isTutorial ? (
                                <p>{log.startDate ? format(parseISO(log.startDate), 'dd/MM/yyyy') : '-'} - {log.endDate ? format(parseISO(log.endDate), 'dd/MM/yy') : '-'}</p>
                            ) : (
                                <p>{log.date ? format(parseISO(log.date), 'dd/MM/yyyy') : '-'}</p>
                            )}
                        </div>
                        <div>
                            <h4 className="font-semibold text-muted-foreground">Time</h4>
                            {isTutorial ? (
                                <p>{log.startDate && log.endDate ? differenceInCalendarDays(parseISO(log.endDate), parseISO(log.startDate)) + 1 : 0} days</p>
                            ) : (
                                <p>{log.startTime} - {log.endTime} ({log.durationHours?.toFixed(2)}h)</p>
                            )}
                        </div>
                    </div>

                    <div className="border-t pt-4 bg-slate-50 p-4 rounded-md">
                        <h4 className="font-semibold mb-2">Price Breakdown</h4>
                        <div className="space-y-2">
                            {breakdown.map((item, index) => (
                                <div key={index} className="flex justify-between">
                                    <span className={item.label.includes('Adjustment') ? 'italic text-muted-foreground' : ''}>{item.label}</span>
                                    <span>{formatCurrency(item.value)}</span>
                                </div>
                            ))}

                            <div className="border-t border-slate-300 my-2"></div>

                            <div className="flex justify-between font-bold">
                                <span>Total Gross (Bruto)</span>
                                <span>{formatCurrency(finalGross)}</span>
                            </div>

                            {/* Show deductions if calculated or stored */}
                            {log.isGrossCalculation && (
                                <>
                                    {/* Estimated Deductions if we don't have stored percentages (just for info) */}
                                    <div className="flex justify-between text-red-500 text-xs mt-1">
                                        <span>Retenciones y deducciones</span>
                                        <span>-{formatCurrency(finalGross - finalNet)}</span>
                                    </div>
                                </>
                            )}

                            <div className="flex justify-between text-green-600 font-bold border-t border-slate-200 mt-2 pt-2 text-base">
                                <span>Total Net (Neto)</span>
                                <span>{formatCurrency(finalNet)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="text-xs text-muted-foreground mt-2">
                        Log ID: {log.id} {log.groupId && `| Group ID: ${log.groupId}`}
                    </div>

                    {log.groupId && (
                        <div className="flex items-center space-x-2 mt-4 p-2 bg-blue-50 rounded-md border border-blue-100">
                            <Checkbox 
                                id="applyToGroup" 
                                checked={applyToGroup} 
                                onCheckedChange={(checked) => setApplyToGroup(!!checked)}
                            />
                            <Label htmlFor="applyToGroup" className="text-sm font-medium text-blue-900 cursor-pointer">
                                Aplicar cambios de edición a todo el grupo
                            </Label>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                    <div className="flex gap-2 w-full sm:w-auto mr-auto">
                        {onEdit && (
                            <Button variant="secondary" onClick={() => {
                                // We might need to pass applyToGroup to the edit handler
                                // If onEdit opens another dialog, that dialog needs to know.
                                (onEdit as any)(log, applyToGroup);
                            }}>
                                Edit
                            </Button>
                        )}
                        {onDelete && (
                            <Button variant="destructive" onClick={() => onDelete(log)}>
                                Delete
                            </Button>
                        )}
                    </div>
                    <DialogClose asChild>
                        <Button variant="outline">Close</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
