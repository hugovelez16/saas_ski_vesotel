"use client";

import React, { useState, useMemo } from 'react';
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
import { APP_ID } from "@/lib/config";
import type { UserProfile, UserSettings, WorkLog, WorkLogCreate } from "@/lib/types";
import { WorkLogForm } from "./work-log-form";

interface AdminCreateWorkLogDialogProps {
    users: UserProfile[];
    allUserSettings: UserSettings[];
    onLogUpdate?: () => void;
    children?: React.ReactNode;
}

export function AdminCreateWorkLogDialog({ users, allUserSettings, onLogUpdate, children }: AdminCreateWorkLogDialogProps) {
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [logType, setLogType] = useState<'particular' | 'tutorial'>('particular');
    const [selectedUserId, setSelectedUserId] = useState<string | undefined>(undefined);
    const [formData, setFormData] = useState<Partial<WorkLogCreate>>({
        hasCoordination: false,
        hasNight: false,
        arrivesPrior: false,
    });
    const { toast } = useToast();

    const resetForm = () => {
        setFormData({ hasCoordination: false, hasNight: false, arrivesPrior: false });
        setSelectedUserId(undefined);
        setLogType('particular');
    };

    const handleSubmit = async () => {
        if (!selectedUserId) {
            toast({ title: "Error", description: "Por favor, selecciona un usuario.", variant: "destructive" });
            return;
        };
        setIsLoading(true);

        const userSetting = allUserSettings.find(s => s.userId === selectedUserId);
        if (!userSetting) {
            toast({ title: "Error", description: "No se encontraron los ajustes para este usuario.", variant: "destructive" });
            setIsLoading(false);
            return;
        }

        if (!formData.description) {
            toast({ title: "Error", description: "La descripción es obligatoria.", variant: "destructive" });
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

        let logData: WorkLogCreate = {
            ...formData as WorkLogCreate,
            userId: selectedUserId,
            type: logType,
        };

        // Calculations are done in the backend now

        try {
            await api.post("/work-logs/", logData);
            toast({ title: "Éxito", description: "Registro de trabajo añadido correctamente." });
            setOpen(false);
            resetForm();
            onLogUpdate?.();

        } catch (error: any) {
            console.error("Error creating work log:", error);
            toast({ title: "Error", description: "No se pudo crear el registro.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }

    const selectedUserName = useMemo(() => {
        if (!selectedUserId) return null;
        const user = users.find(u => u.id === selectedUserId);
        return user ? `${user.first_name} ${user.last_name}` : null;
    }, [selectedUserId, users]);

    return (
        <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) resetForm(); }}>
            <DialogTrigger asChild>
                {children ?? (
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Crear Nuevo Registro
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Crear Nuevo Registro de Jornada (Admin)</DialogTitle>
                    <DialogDescription>
                        Añade un nuevo registro de trabajo para un usuario.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="user" className="text-right">
                            Usuario
                        </Label>
                        <Select onValueChange={setSelectedUserId} value={selectedUserId}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Selecciona un usuario">
                                    {selectedUserName}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {users.map((user: any) => (
                                    <SelectItem key={user.id} value={user.id}>
                                        {user.first_name} {user.last_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <WorkLogForm
                        formData={formData}
                        setFormData={setFormData}
                        logType={logType}
                        setLogType={setLogType}
                        companies={[]}
                    />
                </div>

                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="ghost">Cancelar</Button>
                    </DialogClose>
                    <Button type="submit" disabled={isLoading} onClick={handleSubmit}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Guardar Registro
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
