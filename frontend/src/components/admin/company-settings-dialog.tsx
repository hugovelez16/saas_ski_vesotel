"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateCompany } from "@/lib/api/companies";

interface CompanySettingsDialogProps {
    company: any;
}

export function CompanySettingsDialog({ company }: CompanySettingsDialogProps) {
    const [open, setOpen] = useState(false);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const currentSettings = company.settings || {};

    // Default values if undefined: true (allowed)
    const [allowTutorial, setAllowTutorial] = useState(currentSettings.allow_tutorial !== false);
    const [allowCoordination, setAllowCoordination] = useState(currentSettings.allow_coordination !== false);

    // Rate: stored as 0.0648, displayed as 6.48
    const initialSs = (company as any).social_security_deduction ? Number((company as any).social_security_deduction) * 100 : "";
    const [ssDeduction, setSsDeduction] = useState<string>(initialSs.toString());

    // Allowed rates. If undefined, assume all. If array, only those present.
    // We'll manage the array explicitly.
    const allRates = ["hourly", "daily", "night", "coordination"];
    const [allowedRates, setAllowedRates] = useState<string[]>(
        currentSettings.allowed_rates || allRates
    );

    const mutation = useMutation({
        mutationFn: (data: any) => updateCompany(company.id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["companiesDetailed"] });
            toast({ title: "Settings updated" });
            setOpen(false);
        },
        onError: () => {
            toast({ title: "Failed to update settings", variant: "destructive" });
        }
    });

    const handleRateToggle = (rate: string) => {
        setAllowedRates(prev => {
            if (prev.includes(rate)) {
                return prev.filter(r => r !== rate);
            } else {
                return [...prev, rate];
            }
        });
    };

    const handleSave = () => {
        const newSettings = {
            ...currentSettings,
            allow_tutorial: allowTutorial,
            allow_coordination: allowCoordination,
            allowed_rates: allowedRates
        };

        // Convert Percentage (6.48) back to decimal (0.0648)
        const ssValue = ssDeduction ? parseFloat(ssDeduction) / 100 : 0.0;

        mutation.mutate({
            settings: newSettings,
            social_security_deduction: ssValue
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Company Settings: {company.name}</DialogTitle>
                    <DialogDescription>
                        Configure available features for this company.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="flex items-center justify-between space-x-2">
                        <Label htmlFor="allow_tutorial" className="flex flex-col space-y-1">
                            <span>Enable Tutorial</span>
                            <span className="font-normal text-xs text-muted-foreground">Allow 'Tutorial' (Daily) log type.</span>
                        </Label>
                        <Switch id="allow_tutorial" checked={allowTutorial} onCheckedChange={setAllowTutorial} />
                    </div>

                    <div className="flex items-center justify-between space-x-2">
                        <Label htmlFor="allow_coordination" className="flex flex-col space-y-1">
                            <span>Enable Coordination</span>
                            <span className="font-normal text-xs text-muted-foreground">Allow 'Coordination' extra.</span>
                        </Label>
                        <Switch id="allow_coordination" checked={allowCoordination} onCheckedChange={setAllowCoordination} />
                    </div>

                    <div className="space-y-2 pt-2 border-t">
                        <Label htmlFor="ss_deduction">Default Social Security Deduction (0-100%)</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                id="ss_deduction"
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                value={ssDeduction}
                                onChange={(e) => setSsDeduction(e.target.value)}
                                placeholder="Example: 6.48"
                            />
                            <span className="text-sm font-medium">%</span>
                        </div>
                        <p className="text-xs text-muted-foreground">This value (e.g., 6.48%) will be used as the default SS deduction for members.</p>
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                        <Label>Allowed Rate Inputs (Profile)</Label>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center space-x-2">
                                <Checkbox id="rate_hourly" checked={allowedRates.includes('hourly')} onCheckedChange={() => handleRateToggle('hourly')} />
                                <Label htmlFor="rate_hourly">Hourly Rate</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="rate_daily" checked={allowedRates.includes('daily')} onCheckedChange={() => handleRateToggle('daily')} />
                                <Label htmlFor="rate_daily">Daily Rate</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="rate_night" checked={allowedRates.includes('night')} onCheckedChange={() => handleRateToggle('night')} />
                                <Label htmlFor="rate_night">Night Rate</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="rate_coord" checked={allowedRates.includes('coordination')} onCheckedChange={() => handleRateToggle('coordination')} />
                                <Label htmlFor="rate_coord">Coordination Rate</Label>
                            </div>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button type="submit" onClick={handleSave} disabled={mutation.isPending}>
                        Save changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
