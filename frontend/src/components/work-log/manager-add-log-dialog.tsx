"use client";

import React, { useState, useMemo, useEffect } from 'react';
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { WorkLog, WorkLogCreate, WorkLogBulkCreate } from "@/lib/types";
import { WorkLogForm } from "./work-log-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface ManagerAddWorkLogDialogProps {
    companyId: string;
    companyName: string;
    users: any[];
    onSuccess?: () => void;
    children?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    initialData?: Partial<WorkLog>;
}

export function ManagerAddWorkLogDialog({
    companyId,
    companyName,
    users,
    onSuccess,
    children,
    open: externalOpen,
    onOpenChange: setExternalOpen,
    initialData
}: ManagerAddWorkLogDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false);

    // Use external state if provided, otherwise internal
    const isControlled = externalOpen !== undefined;
    const open = isControlled ? externalOpen : internalOpen;
    const setOpen = isControlled ? setExternalOpen! : setInternalOpen;

    const [isLoading, setIsLoading] = useState(false);
    const [logType, setLogType] = useState<'particular' | 'tutorial'>('particular');
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

    // Form data - pre-fill companyId
    const [formData, setFormData] = useState<Partial<WorkLogCreate>>({
        companyId: companyId,
        hasCoordination: false,
        hasNight: false,
        arrivesPrior: false,
    });
    const { user } = useAuth(); // Need auth context for some user lookups or safety

    const { toast } = useToast();

    // Reset or Initialize when opening
    useEffect(() => {
        if (open) {
            setFormData(prev => ({
                ...prev,
                companyId: companyId,
                hasCoordination: false,
                hasNight: false,
                arrivesPrior: false,
                // Merge initial data if present (filter out nulls if necessary)
                ...(initialData ? {
                    ...initialData,
                    startTime: initialData.startTime || undefined,
                    endTime: initialData.endTime || undefined,
                    date: initialData.date || undefined,
                } : {})
            }));

            if (initialData?.userId) {
                setSelectedUserIds([initialData.userId]);
            } else {
                setSelectedUserIds([]);
            }

            if (initialData?.type) {
                setLogType(initialData.type as 'particular' | 'tutorial');
            }
        } else {
            // Only reset if closing (and we want to clear)
            // But usually we reset ON open to fresh state or defaults.
            // Let's reset on CLOSE to be clean.
            if (!isControlled) { // If controlled, parent might handle reset, but safe to do here.
                setFormData({ companyId: companyId, hasCoordination: false, hasNight: false, arrivesPrior: false });
                setSelectedUserIds([]);
                setLogType('particular');
            }
        }
    }, [open, companyId, initialData, isControlled]);

    // Mock company object for WorkLogForm
    const companies = useMemo(() => [{ id: companyId, name: companyName, settings: {} }], [companyId, companyName]);

    const handleSubmit = async () => {
        if (selectedUserIds.length === 0) {
            toast({ title: "Error", description: "Por favor, selecciona al menos un usuario.", variant: "destructive" });
            return;
        }

        setIsLoading(true);

        if (!formData.client) {
            toast({ title: "Error", description: "El cliente es obligatorio.", variant: "destructive" });
            setIsLoading(false);
            return;
        }
        if (logType === 'particular' && (!formData.date || !formData.startTime || !formData.endTime)) {
            toast({ title: "Error", description: "Fecha, hora de inicio y fin son obligatorias para el tipo 'Particular'.", variant: "destructive" });
            setIsLoading(false);
            return;
        }
        if (logType === 'tutorial' && (!formData.startDate || !formData.endDate)) {
            toast({ title: "Error", description: "Fecha de inicio y fin son obligatorias para el tipo 'Tutorial'.", variant: "destructive" });
            setIsLoading(false);
            return;
        }

        const sharedData = {
            ...formData,
            companyId: companyId,
            type: logType,
        };

        try {
            if (initialData?.id) {
                await api.put(`/work-logs/${initialData.id}`, { ...sharedData, userId: selectedUserIds[0] });
                toast({ title: "Éxito", description: "Registro actualizado correctamente." });
            } else if (selectedUserIds.length === 1) {
                await api.post("/work-logs/", { ...sharedData, userId: selectedUserIds[0] });
                toast({ title: "Éxito", description: "Registro añadido correctamente." });
            } else {
                const bulkData: WorkLogBulkCreate = {
                    ...sharedData,
                    userIds: selectedUserIds,
                } as any;
                await api.post("/work-logs/bulk", bulkData);
                toast({ title: "Éxito", description: `${selectedUserIds.length} registros añadidos correctamente.` });
            }

            setOpen(false);
            onSuccess?.();

        } catch (error: any) {
            console.error("Error saving work log:", error);
            const msg = error.response?.data?.detail || "No se pudo guardar el registro.";
            toast({ title: "Error", description: msg, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }

    const selectedUsersNames = useMemo(() => {
        return selectedUserIds.map(id => {
            const u = users.find(u => u.id === id);
            return u ? `${u.firstName} ${u.lastName}` : null;
        }).filter(Boolean);
    }, [selectedUserIds, users]);

    const toggleUser = (userId: string) => {
        setSelectedUserIds(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children ?? (
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Añadir Registro
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Añadir Registro - {companyName}</DialogTitle>
                    <DialogDescription>
                        Crea un nuevo registro para un miembro del equipo.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label>Usuarios seleccionados ({selectedUserIds.length})</Label>
                        <div className="flex flex-wrap gap-2 border p-2 rounded-md min-h-[40px] bg-slate-50">
                            {selectedUsersNames.length > 0 ? (
                                selectedUsersNames.map((name, idx) => (
                                    <Badge key={idx} variant="secondary" className="flex items-center gap-1 py-1">
                                        {name}
                                        <X 
                                            className="h-3 w-3 cursor-pointer hover:text-destructive" 
                                            onClick={() => toggleUser(selectedUserIds[idx])}
                                        />
                                    </Badge>
                                ))
                            ) : (
                                <span className="text-muted-foreground text-sm italic">Ningún usuario seleccionado</span>
                            )}
                        </div>

                        <Label className="mt-2">Seleccionar miembros</Label>
                        <div className="h-[120px] w-full border rounded-md p-2 overflow-y-auto">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {users.map((u: any) => (
                                    <div key={u.id} className="flex items-center space-x-2 p-1 hover:bg-slate-100 rounded transition-colors">
                                        <Checkbox 
                                            id={`user-${u.id}`} 
                                            checked={selectedUserIds.includes(u.id)}
                                            onCheckedChange={() => toggleUser(u.id)}
                                        />
                                        <Label 
                                            htmlFor={`user-${u.id}`}
                                            className="text-xs cursor-pointer flex-1"
                                        >
                                            {u.firstName} {u.lastName}
                                        </Label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Shared Form */}
                    <WorkLogForm
                        formData={formData}
                        setFormData={setFormData}
                        logType={logType}
                        setLogType={setLogType as any}
                        companies={companies}
                    />
                </div>

                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="ghost">Cancelar</Button>
                    </DialogClose>
                    <Button type="submit" disabled={isLoading} onClick={handleSubmit}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Guardar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
