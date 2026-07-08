
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BillingRow } from "./billing-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/data-table";
import { useRouter } from "next/navigation";
import { User, Calculator } from "lucide-react";

interface BillingBreakdownDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    row: BillingRow | null;
}

export function BillingBreakdownDialog({ open, onOpenChange, row }: BillingBreakdownDialogProps) {
    const router = useRouter();

    if (!row) return null;

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("es-ES", {
            style: "currency",
            currency: "EUR",
        }).format(amount);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Calculator className="h-5 w-5" />
                        Desglose de Facturación
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="flex flex-col gap-1">
                        <span className="font-semibold text-lg">{row.userName}</span>
                        <span className="text-sm text-muted-foreground">{row.userEmail}</span>
                    </div>

                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Concepto</TableHead>
                                    <TableHead className="text-right">Cantidad</TableHead>
                                    <TableHead className="text-right">Importe</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow>
                                    <TableCell className="font-medium">Horas Particulares</TableCell>
                                    <TableCell className="text-right">{row.particularHours.toFixed(2)} h</TableCell>
                                    <TableCell className="text-right">{formatCurrency(row.particularGrossAmount || row.particularAmount)}</TableCell>
                                </TableRow>
                                {row.tutorialDays > 0 && (
                                    <TableRow>
                                        <TableCell className="font-medium">Días Tutoriales</TableCell>
                                        <TableCell className="text-right">{row.tutorialDays} días</TableCell>
                                        <TableCell className="text-right">{formatCurrency(row.tutorialGrossAmount || row.tutorialAmount)}</TableCell>
                                    </TableRow>
                                )}
                                {row.coordinatedDays > 0 && (
                                    <TableRow>
                                        <TableCell className="font-medium">Coordinación</TableCell>
                                        <TableCell className="text-right">{row.coordinatedDays} días</TableCell>
                                        <TableCell className="text-right">{formatCurrency(row.coordinatedGrossAmount || row.coordinatedAmount)}</TableCell>
                                    </TableRow>
                                )}
                                {row.nightShifts > 0 && (
                                    <TableRow>
                                        <TableCell className="font-medium">Nocturnidad</TableCell>
                                        <TableCell className="text-right">{row.nightShifts} turnos</TableCell>
                                        <TableCell className="text-right">{formatCurrency(row.nightGrossAmount || row.nightAmount)}</TableCell>
                                    </TableRow>
                                )}
                                <TableRow className="bg-muted/50 font-bold">
                                    <TableCell colSpan={2}>Total</TableCell>
                                    <TableCell className="text-right text-emerald-600">{formatCurrency(row.totalGrossAmount || row.totalAmount)}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                </div>

                <DialogFooter className="sm:justify-between gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cerrar
                    </Button>
                    <Button onClick={() => router.push(`/manager/users/${row.userId}`)}>
                        <User className="mr-2 h-4 w-4" />
                        Ver Detalles de Usuario
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
