"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateCompany } from "@/lib/api/companies";
import { Loader2 } from "lucide-react";
import { WorklogDefinitionBuilder } from "@/components/admin/worklog-definition-builder";
import { TaxConfigBuilder } from "@/components/admin/tax-config-builder";

interface CompanyConfigurationTabProps {
    company: any;
}

export function CompanyConfigurationTab({ company }: CompanyConfigurationTabProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: (data: any) => updateCompany(company.id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["companiesDetailed"] });
            toast({ title: "Configuration saved successfully" });
        },
        onError: () => {
            toast({ title: "Failed to save configuration", variant: "destructive" });
        }
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Configuración Avanzada (JSON)</CardTitle>
                <CardDescription>Personaliza los tipos de partes y los impuestos a nivel de empresa.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">

                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-medium">Definición de Partes de Trabajo</h3>
                            <p className="text-sm text-muted-foreground">Configura visualmente qué turnos existen y qué campos se piden al trabajador.</p>
                        </div>
                    </div>
                    <hr className="my-4" />
                    <WorklogDefinitionBuilder
                        initialValue={company.worklogDefinitions || {
                            "particular": {
                                "label": "Particular",
                                "fields": ["description"],
                                "options": ["coordination"]
                            }
                        }}
                        onSave={(val) => mutation.mutate({ worklogDefinitions: val })}
                    />
                </div>

                <div className="space-y-4">
                    <h3 className="text-lg font-medium">Impuestos Generales (Tasas)</h3>
                    <p className="text-sm text-muted-foreground">Deducciones globales que se aplicarán si el trabajador no tiene una sobreescritura específica en su perfil.</p>
                    <hr className="my-4" />
                    <TaxConfigBuilder
                        initialValue={company.taxConfig || {}}
                        onSave={(val) => mutation.mutate({ taxConfig: val })}
                    />
                </div>

            </CardContent>
            {mutation.isPending && (
                <CardFooter className="flex justify-end gap-2 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-b-lg">
                    <span className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</span>
                </CardFooter>
            )}
        </Card>
    );
}
