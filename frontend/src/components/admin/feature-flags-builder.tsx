"use client";

import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SYSTEM_MODULES } from "@/lib/config/modules";
import * as Icons from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FeatureFlagsBuilderProps {
    initialValue: any;
    onSave: (val: any) => void;
}

export function FeatureFlagsBuilder({ initialValue, onSave }: FeatureFlagsBuilderProps) {
    const [modules, setModules] = useState<Record<string, any>>(initialValue?.modules || initialValue?.features || {});

    useEffect(() => {
        setModules(initialValue?.modules || initialValue?.features || {});
    }, [JSON.stringify(initialValue?.modules || initialValue?.features || {})]);

    const handleToggle = (id: string) => {
        setModules((prev: any) => {
            const current = prev[id];
            // If it was a boolean true, turn off.
            // If it was an object, turn off.
            // If it was off (undefined/false), turn on (as true or object depends on module)
            if (current) {
                return { ...prev, [id]: false };
            }
            return { ...prev, [id]: true };
        });
    };

    const handleAccessLevelChange = (id: string, level: string) => {
        setModules((prev: any) => ({
            ...prev,
            [id]: {
                enabled: true,
                access_level: level
            }
        }));
    };

    const handleSave = () => {
        onSave({
            ...initialValue,
            modules,
        });
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SYSTEM_MODULES.map((module) => {
                    const Icon = (Icons as any)[module.icon] || Icons.Settings2;
                    return (
                        <div
                            key={module.id}
                            className="flex items-start space-x-4 p-4 rounded-lg border border-slate-200 bg-white"
                        >
                            <div className="mt-1 p-2 bg-slate-50 rounded-md">
                                <Icon className="h-5 w-5 text-slate-600" />
                            </div>
                            <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor={module.id} className="text-sm font-bold cursor-pointer">
                                        {module.label}
                                    </Label>
                                    <Switch
                                        id={module.id}
                                        checked={typeof modules[module.id] === 'object' ? modules[module.id].enabled : (modules[module.id] ?? module.default)}
                                        onCheckedChange={() => handleToggle(module.id)}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    {module.description}
                                </p>

                                {/* Access Level Selector (Only for reports for now) */}
                                {module.id === 'reports' && (typeof modules[module.id] === 'object' ? modules[module.id].enabled : modules[module.id]) && (
                                    <div className="pt-2 flex items-center gap-2">
                                        <label className="text-[10px] font-bold uppercase text-slate-400">Acceso:</label>
                                        <Select 
                                            value={typeof modules[module.id] === 'object' ? modules[module.id].access_level : 'all'} 
                                            onValueChange={(val) => handleAccessLevelChange(module.id, val)}
                                        >
                                            <SelectTrigger className="h-7 text-xs w-[140px]">
                                                <SelectValue placeholder="Nivel de acceso" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Todos los miembros</SelectItem>
                                                <SelectItem value="managers">Solo Managers</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="flex justify-end">
                <Button onClick={handleSave} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                    Guardar Módulos Activos
                </Button>
            </div>
        </div>
    );
}
