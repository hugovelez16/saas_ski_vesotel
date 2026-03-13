"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Save, BadgePercent } from "lucide-react";

interface TaxConfigBuilderProps {
    initialValue: Record<string, any>;
    onSave: (value: Record<string, any>) => void;
}

export function TaxConfigBuilder({ initialValue, onSave }: TaxConfigBuilderProps) {
    const [taxes, setTaxes] = useState<{ key: string, value: number | string }[]>([]);

    // Sync with initialValue but handle resets gracefully
    // Convert 0.0648 to 6.48 for display
    useEffect(() => {
        const entries = Object.entries(initialValue || {}).map(([key, val]) => ({
            key,
            value: typeof val === 'number' ? parseFloat((val * 100).toFixed(4)) : val
        }));
        setTaxes(entries);
    }, [JSON.stringify(initialValue)]);

    const handleSave = () => {
        const finalObj: Record<string, number> = {};
        taxes.forEach(t => {
            if (t.key.trim()) {
                // Convert 6.48 back to 0.0648 for storage
                // Round to avoid floating point precision issues (0.06480000000000001)
                const numVal = typeof t.value === 'string' ? parseFloat(t.value) : t.value;
                const result = (numVal || 0) / 100;
                finalObj[t.key] = Math.round(result * 1000000) / 1000000;
            }
        });
        onSave(finalObj);
    };

    const updateTax = (index: number, field: 'key' | 'value', val: any) => {
        setTaxes(prev => prev.map((t, i) => i === index ? { ...t, [field]: val } : t));
    };

    const addTax = () => {
        setTaxes(prev => [...prev, { key: "", value: 0 }]);
    };

    const removeTax = (index: number) => {
        setTaxes(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-4">
            <div className="grid gap-4">
                {taxes.map((tax, index) => (
                    <div key={index} className="flex items-end gap-2 p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow">
                        <div className="flex-1 space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Nombre del Impuesto / Tasa</Label>
                            <Input
                                value={tax.key}
                                onChange={(e) => updateTax(index, 'key', e.target.value)}
                                placeholder="Ej: irpf_base, social_security"
                                className="h-9 font-mono text-sm"
                            />
                        </div>
                        <div className="w-32 space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Valor (%)</Label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={tax.value}
                                    onChange={(e) => updateTax(index, 'value', e.target.value)}
                                    className="h-9 pr-7"
                                />
                                <span className="absolute right-2.5 top-2.5 text-xs text-muted-foreground">%</span>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => removeTax(index)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ))}

                {taxes.length === 0 && (
                    <div className="text-center py-6 border border-dashed rounded-lg text-muted-foreground text-sm">
                        No hay impuestos configurados todavía.
                    </div>
                )}
            </div>

            <div className="flex gap-3">
                <Button variant="outline" onClick={addTax} className="flex-1 border-dashed">
                    <Plus className="h-4 w-4 mr-2" />
                    Añadir Tasa
                </Button>
                <Button onClick={handleSave} className="min-w-[120px]">
                    <Save className="h-4 w-4 mr-2" />
                    Guardar
                </Button>
            </div>
        </div>
    );
}
