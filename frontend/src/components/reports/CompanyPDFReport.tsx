/* eslint-disable jsx-a11y/alt-text */
"use client";

import React, { useMemo } from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { Company } from '@/lib/types';

// Reuse fonts registration
Font.register({
    family: 'Helvetica',
    fonts: [
        { src: 'https://fonts.gstatic.com/s/helveticaneue/v70/1Ptsg8zYS_SKggPNyC0IT4ttDfA.ttf' },
        { src: 'https://fonts.gstatic.com/s/helveticaneue/v70/1Ptsg8zYS_SKggPNyC0IT4ttDfA.ttf', fontWeight: 'bold' }
    ]
});

const styles = StyleSheet.create({
    page: {
        padding: 30,
        backgroundColor: '#ffffff',
        fontFamily: 'Helvetica',
        color: '#334155',
        fontSize: 10,
    },
    // Header
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#0f172a', // Slate-900
        padding: 20,
        margin: -30,
        marginBottom: 30,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
    },
    logoBox: {
        width: 35,
        height: 35,
        backgroundColor: '#1e293b',
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
        border: '1pt solid #334155'
    },
    logoText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    appTitle: {
        fontSize: 16,
        color: 'white',
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    appSubtitle: {
        fontSize: 9,
        color: '#94a3b8',
        textTransform: 'uppercase',
        marginTop: 2,
    },
    headerRight: {
        alignItems: 'flex-end',
    },
    reportTitle: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 12,
        marginBottom: 2,
    },
    generatedDate: {
        color: '#94a3b8',
        fontSize: 9,
        fontFamily: 'Helvetica',
    },

    // Summary Section
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0f172a',
        borderLeftWidth: 4,
        borderLeftColor: '#0f172a',
        paddingLeft: 8,
        marginBottom: 15,
        marginTop: 10,
    },
    summaryGrid: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 20,
    },
    card: {
        flex: 1,
        backgroundColor: '#f8fafc',
        borderRadius: 6,
        padding: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    cardTitle: {
        fontSize: 8,
        color: '#64748b',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 6,
    },
    cardValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#0f172a',
    },

    // Charts
    chartSection: {
        marginBottom: 30,
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 6,
        padding: 15,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    chartImage: {
        width: 400,
        height: 200,
        objectFit: 'contain',
    },

    // Table
    table: {
        borderRadius: 4,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 5,
    },
    tableHeaderRow: {
        flexDirection: 'row',
        backgroundColor: '#0f172a',
        paddingVertical: 8,
        paddingHorizontal: 6,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingVertical: 6,
        paddingHorizontal: 6,
        backgroundColor: '#ffffff',
    },
    tableRowAlt: {
        backgroundColor: '#f8fafc',
    },
    tableHeaderCell: {
        color: 'white',
        fontSize: 8,
        fontWeight: 'bold',
    },
    tableCell: {
        fontSize: 9,
        color: '#334155',
    },

    // Columns
    colName: { width: '40%' },
    colHours: { width: '20%', textAlign: 'right' },
    colDays: { width: '20%', textAlign: 'right' },
    colAmount: { width: '20%', textAlign: 'right' },

    footer: {
        position: 'absolute',
        bottom: 20,
        left: 0,
        right: 0,
        textAlign: 'center',
        color: '#94a3b8',
        fontSize: 8,
    }
});

// --- QuickChart Helper (Bar Chart for Employees) ---
const getEmployeesChartUrl = (labels: string[], data: number[], currency: boolean = false) => {
    // Top 10 to avoid overcrowding
    const displayLabels = labels.slice(0, 10);
    const displayData = data.slice(0, 10);

    const config = {
        type: 'bar',
        data: {
            labels: displayLabels,
            datasets: [{
                label: currency ? 'Coste (€)' : 'Horas',
                data: displayData,
                backgroundColor: '#3b82f6',
                borderRadius: 4,
            }]
        },
        options: {
            plugins: {
                legend: { display: false },
                datalabels: {
                    display: true,
                    anchor: 'end',
                    align: 'top',
                    color: '#64748b',
                    font: { size: 10, weight: 'bold' },
                    formatter: (value: any) => currency ? `€${value}` : `${value}h`
                }
            },
            scales: {
                y: { beginAtZero: true, grid: { display: true, color: '#e2e8f0' } },
                x: { grid: { display: false } }
            }
        }
    };
    const json = JSON.stringify(config);
    return `https://quickchart.io/chart?c=${encodeURIComponent(json)}&w=500&h=300&bkg=transparent`;
};

export interface EmployeeSummary {
    userId: string;
    name: string;
    totalHours: number;
    totalDays: number;
    totalAmount: number;
}

interface CompanyPDFReportProps {
    company: Company;
    employeeStats: EmployeeSummary[];
    title: string;
    startDate: Date;
    endDate: Date;
}

export const CompanyPDFReport = ({ company, employeeStats, title, startDate, endDate }: CompanyPDFReportProps) => {

    const totals = useMemo(() => {
        return employeeStats.reduce((acc, curr) => ({
            amount: acc.amount + curr.totalAmount,
            hours: acc.hours + curr.totalHours,
            days: acc.days + curr.totalDays, // Sum of days might duplicate actual calendar days if summarizing effort, but ok for "man-days"
        }), { amount: 0, hours: 0, days: 0 });
    }, [employeeStats]);

    // Sort by amount desc
    const sortedEmployees = [...employeeStats].sort((a, b) => b.totalAmount - a.totalAmount);

    const chartUrl = getEmployeesChartUrl(
        sortedEmployees.map(e => e.name.split(' ')[0]), // First name only for chart
        sortedEmployees.map(e => e.totalAmount),
        true
    );

    return (
        <Document>
            <Page size="A4" style={styles.page}>

                {/* Header */}
                <View style={styles.headerContainer}>
                    <View style={styles.headerLeft}>
                        <View style={styles.logoBox}>
                            <Text style={styles.logoText}>C</Text>
                        </View>
                        <View>
                            <Text style={styles.appTitle}>{company.name}</Text>
                            <Text style={styles.appSubtitle}>Informe Corporativo</Text>
                        </View>
                    </View>
                    <View style={styles.headerRight}>
                        <Text style={styles.reportTitle}>{title}</Text>
                        <Text style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'Helvetica', marginBottom: 2 }}>
                            {startDate && endDate ? `${format(new Date(startDate), "dd/MM/yyyy")} - ${format(new Date(endDate), "dd/MM/yyyy")}` : ''}
                        </Text>
                        <Text style={styles.generatedDate}>Generado: {format(new Date(), 'dd/MM/yyyy HH:mm')}</Text>
                    </View>
                </View>

                {/* Summary Section */}
                <Text style={styles.sectionTitle}>Resumen General</Text>
                <View style={styles.summaryGrid}>
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Coste Total (Bruto/Neto)</Text>
                        <Text style={styles.cardValue}>{formatCurrency(totals.amount)}</Text>
                    </View>
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Total Horas</Text>
                        <Text style={styles.cardValue}>{totals.hours.toFixed(0)}h</Text>
                    </View>
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Total Jornadas</Text>
                        <Text style={styles.cardValue}>{totals.days}</Text>
                    </View>
                </View>

                {/* Chart */}
                <View style={styles.chartSection}>
                    <Text style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 10, color: '#64748b', textTransform: 'uppercase' }}>Top Empleados por Coste</Text>
                    <Image src={chartUrl} style={styles.chartImage} />
                </View>

                {/* Employees Table */}
                <Text style={styles.sectionTitle}>Detalle por Empleado</Text>
                <View style={styles.table}>
                    <View style={styles.tableHeaderRow}>
                        <View style={styles.colName}><Text style={styles.tableHeaderCell}>Empleado</Text></View>
                        <View style={styles.colHours}><Text style={styles.tableHeaderCell}>Horas</Text></View>
                        <View style={styles.colDays}><Text style={styles.tableHeaderCell}>Días</Text></View>
                        <View style={styles.colAmount}><Text style={styles.tableHeaderCell}>Coste Total</Text></View>
                    </View>

                    {sortedEmployees.map((emp, i) => (
                        <View key={emp.userId} style={[styles.tableRow, i % 2 !== 0 ? styles.tableRowAlt : {}]}>
                            <View style={styles.colName}><Text style={[styles.tableCell, { fontWeight: 'bold' }]}>{emp.name}</Text></View>
                            <View style={styles.colHours}><Text style={styles.tableCell}>{emp.totalHours.toFixed(1)}</Text></View>
                            <View style={styles.colDays}><Text style={styles.tableCell}>{emp.totalDays}</Text></View>
                            <View style={styles.colAmount}><Text style={[styles.tableCell, { fontWeight: 'bold' }]}>{formatCurrency(emp.totalAmount)}</Text></View>
                        </View>
                    ))}

                    {/* Total Row */}
                    <View style={[styles.tableRow, { borderTopWidth: 2, borderTopColor: '#0f172a', backgroundColor: '#f1f5f9' }]}>
                        <View style={styles.colName}><Text style={[styles.tableCell, { fontWeight: 'bold', textTransform: 'uppercase' }]}>TOTAL</Text></View>
                        <View style={styles.colHours}><Text style={[styles.tableCell, { fontWeight: 'bold' }]}>{totals.hours.toFixed(1)}</Text></View>
                        <View style={styles.colDays}><Text style={[styles.tableCell, { fontWeight: 'bold' }]}>{totals.days}</Text></View>
                        <View style={styles.colAmount}><Text style={[styles.tableCell, { fontWeight: 'bold' }]}>{formatCurrency(totals.amount)}</Text></View>
                    </View>
                </View>

                <Text style={styles.footer} fixed>InvestorApp - Informe Corporativo</Text>
            </Page>
        </Document>
    );
};
