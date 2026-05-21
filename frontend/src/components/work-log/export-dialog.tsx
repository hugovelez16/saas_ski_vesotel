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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";
import { WorkLog } from "@/lib/types";
import { format } from "date-fns";
import { mkConfig, generateCsv, download } from "export-to-csv";

interface ExportLogsDialogProps {
    workLogs: WorkLog[];
}

const COLUMNS = [
    { id: 'date', label: 'Date' },
    { id: 'type', label: 'Type' },
    { id: 'description', label: 'Description' },
    { id: 'duration', label: 'Duration (Hours)' },
    { id: 'amount', label: 'Amount' },
    { id: 'rate', label: 'Hourly Rate' },
    { id: 'companyName', label: 'Company' }
];

export function ExportLogsDialog({ workLogs }: ExportLogsDialogProps) {
    const [selectedColumns, setSelectedColumns] = useState<string[]>(COLUMNS.map(c => c.id));
    const [isOpen, setIsOpen] = useState(false);

    const toggleColumn = (id: string) => {
        setSelectedColumns(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    const handleExport = () => {
        const csvConfig = mkConfig({ useKeysAsHeaders: true, filename: `work-logs-${format(new Date(), 'yyyy-MM-dd')}` });

        const data = workLogs.map(log => {
            const row: any = {};
            if (selectedColumns.includes('date')) row.Date = log.date || `${log.startDate} - ${log.endDate}`;
            if (selectedColumns.includes('type')) row.Type = log.type;
            if (selectedColumns.includes('description')) row.Description = log.description;
            if (selectedColumns.includes('duration')) row.Duration = log.durationHours;
            if (selectedColumns.includes('amount')) row.Amount = log.amount;
            if (selectedColumns.includes('rate')) row['Hourly Rate'] = log.calculationSnapshot?.rate_applied || 0;
            if (selectedColumns.includes('companyName')) row.Company = log.companyId || 'Unknown';
            return row;
        });

        const csv = generateCsv(csvConfig)(data);
        download(csvConfig)(csv);
        setIsOpen(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Export Work Logs</DialogTitle>
                    <DialogDescription>
                        Select the columns you want to include in the CSV export.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        {COLUMNS.map((col) => (
                            <div key={col.id} className="flex items-center space-x-2">
                                <Checkbox
                                    id={col.id}
                                    checked={selectedColumns.includes(col.id)}
                                    onCheckedChange={() => toggleColumn(col.id)}
                                />
                                <Label htmlFor={col.id}>{col.label}</Label>
                            </div>
                        ))}
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleExport}>Download CSV</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
