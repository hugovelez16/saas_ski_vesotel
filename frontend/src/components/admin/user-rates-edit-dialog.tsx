"use client";

import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { updateUserRatesAdmin } from "@/lib/api/users";
import { UserCompanyRate, Company } from "@/lib/types";

const rateFormSchema = z.object({
    hourlyRate: z.coerce.number().min(0),
    dailyRate: z.coerce.number().min(0),
    nightRate: z.coerce.number().min(0),
    coordinationRate: z.coerce.number().min(0),
    isGross: z.boolean().default(true),
    deductionSs: z.coerce.number().min(0).max(100).optional().nullable(),
    deductionIrpf: z.coerce.number().min(0).max(100).default(0),
    deductionExtra: z.coerce.number().min(0).max(100).default(0),
});

type RateFormValues = z.infer<typeof rateFormSchema>;

interface UserRatesEditDialogProps {
    userId: string;
    company: Company;
    rate?: UserCompanyRate;
    userName: string;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function UserRatesEditDialog({ userId, company, rate, userName, open: externalOpen, onOpenChange }: UserRatesEditDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const open = externalOpen !== undefined ? externalOpen : internalOpen;
    const setOpen = onOpenChange || setInternalOpen;

    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Determine which fields to show based on company config
    const worklogDefs = company.worklogDefinitions || {};
    const hasDaily = Object.values(worklogDefs).some((d: any) => d.is_range === true);
    const hasNight = Object.values(worklogDefs).some((d: any) => (d.options || []).some((o: string) => o.toLowerCase().includes('nocturna') || o.toLowerCase().includes('noche')));
    const hasCoordination = Object.values(worklogDefs).some((d: any) => (d.options || []).some((o: string) => o.toLowerCase().includes('coordinación') || o.toLowerCase().includes('coordinacion')));
    
    // Taxes present in company config
    const taxKeys = Object.keys(company.taxConfig || {});
    const hasSs = taxKeys.some(k => k.toLowerCase().includes('social_security') || k.toLowerCase().includes('ss'));
    const hasIrpf = taxKeys.some(k => k.toLowerCase().includes('irpf'));

    const form = useForm<RateFormValues>({
        resolver: zodResolver(rateFormSchema),
        defaultValues: {
            hourlyRate: rate?.hourlyRate || 0,
            dailyRate: rate?.dailyRate || 0,
            nightRate: rate?.nightRate || 0,
            coordinationRate: rate?.coordinationRate || 0,
            isGross: rate?.isGross !== undefined ? rate?.isGross : true,
            deductionSs: rate?.deductionSs !== undefined && rate?.deductionSs !== null ? rate.deductionSs : null,
            deductionIrpf: rate?.deductionIrpf || 0,
            deductionExtra: rate?.deductionExtra || 0,
        },
    });

    // Reset form when rate or open state changes
    useEffect(() => {
        if (open) {
            form.reset({
                hourlyRate: rate?.hourlyRate || 0,
                dailyRate: rate?.dailyRate || 0,
                nightRate: rate?.nightRate || 0,
                coordinationRate: rate?.coordinationRate || 0,
                isGross: rate?.isGross !== undefined ? rate?.isGross : true,
                deductionSs: rate?.deductionSs !== undefined && rate?.deductionSs !== null ? parseFloat((rate.deductionSs * 100).toFixed(2)) : null,
                deductionIrpf: rate?.deductionIrpf ? parseFloat((rate.deductionIrpf * 100).toFixed(2)) : 0,
                deductionExtra: rate?.deductionExtra ? parseFloat((rate.deductionExtra * 100).toFixed(2)) : 0,
            });
        }
    }, [rate, open, form]);

    const mutation = useMutation({
        mutationFn: (values: any) => updateUserRatesAdmin(userId, values),
        onSuccess: () => {
            toast({ title: "Tarifas actualizadas correctamente" });
            queryClient.invalidateQueries({ queryKey: ["companyRates", company.id] });
            setOpen(false);
        },
        onError: (error: any) => {
            toast({
                title: "Error al actualizar tarifas",
                description: error.response?.data?.detail || "Ha ocurrido un error",
                variant: "destructive",
            });
        },
    });

    function onSubmit(data: RateFormValues) {
        const payload = {
            company_id: company.id,
            hourly_rate: data.hourlyRate,
            daily_rate: data.dailyRate,
            night_rate: data.nightRate,
            coordination_rate: data.coordinationRate,
            is_gross: data.isGross,
            deduction_ss: data.deductionSs === null ? null : data.deductionSs / 100,
            deduction_irpf: data.deductionIrpf / 100,
            deduction_extra: data.deductionExtra / 100,
        };
        mutation.mutate(payload);
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {!onOpenChange && (
                <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Pencil className="h-4 w-4" />
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Editar Tarifas: {userName}</DialogTitle>
                    <DialogDescription>
                        Configura las tarifas de facturación específicas y deducciones de impuestos para {userName} en {company.name}.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid gap-4 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="hourlyRate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tarifa por Hora (€/h)</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.01" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            {hasDaily && (
                                <FormField
                                    control={form.control}
                                    name="dailyRate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Tarifa por Día (€/día)</FormLabel>
                                            <FormControl>
                                                <Input type="number" step="0.01" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                            {hasNight && (
                                <FormField
                                    control={form.control}
                                    name="nightRate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Plus Nocturnidad (€/noche)</FormLabel>
                                            <FormControl>
                                                <Input type="number" step="0.01" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                            {hasCoordination && (
                                <FormField
                                    control={form.control}
                                    name="coordinationRate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Plus Coordinación (€)</FormLabel>
                                            <FormControl>
                                                <Input type="number" step="0.01" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                        </div>

                        <div className="space-y-4 border-t pt-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <h3 className="text-base font-semibold">Impuestos y Deducciones</h3>
                                    <p className="text-sm text-muted-foreground">Configura las retenciones para estas tarifas.</p>
                                </div>
                                <FormField
                                    control={form.control}
                                    name="isGross"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center gap-2 space-y-0">
                                            <FormLabel className="text-base cursor-pointer">Precios sobre Bruto</FormLabel>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {form.watch("isGross") && (
                                <div className="grid gap-4 md:grid-cols-3">
                                    {hasSs && (
                                        <FormField
                                            control={form.control}
                                            name="deductionSs"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Seguridad Social (SS) (%)</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            placeholder={company.taxConfig?.social_security ? `Por defecto: ${company.taxConfig.social_security * 100}%` : "0"}
                                                            {...field}
                                                            value={field.value === null ? "" : field.value}
                                                            onChange={e => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                                                        />
                                                    </FormControl>
                                                    <FormDescription>
                                                        Vacío para usar defecto ({company.taxConfig?.social_security ? company.taxConfig.social_security * 100 : 0}%)
                                                    </FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    )}
                                    {hasIrpf && (
                                        <FormField
                                            control={form.control}
                                            name="deductionIrpf"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>IRPF (%)</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" step="0.01" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    )}
                                    <FormField
                                        control={form.control}
                                        name="deductionExtra"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Deducción Extra (%)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="0.01" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            )}
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={mutation.isPending}>
                                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Guardar Cambios
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
