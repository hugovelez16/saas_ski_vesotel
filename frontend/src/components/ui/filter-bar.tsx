"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import {
    X,
    Search,
    Calendar as CalendarIcon,
    Filter,
    Check
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface FilterOption {
    label: string;
    value: string;
    icon?: React.ComponentType<{ className?: string }>;
}

export interface FilterConfig {
    id: string;
    label: string;
    type: "select" | "date-range" | "text" | "boolean"; // boolean means toggle
    options?: FilterOption[];
}

interface FilterBarProps {
    config: FilterConfig[];
    onFilterChange: (filters: Record<string, any>) => void;
    className?: string;
}

export function FilterBar({ config, onFilterChange, className }: FilterBarProps) {
    // State to hold current filter values
    const [filters, setFilters] = useState<Record<string, any>>({});
    const [searchQuery, setSearchQuery] = useState("");

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            handleMetaChange("search", searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleMetaChange = (key: string, value: any) => {
        const newFilters = { ...filters, [key]: value };
        // Cleanup undefined/empty
        if (value === undefined || value === "" || value === null || (Array.isArray(value) && value.length === 0)) {
            delete newFilters[key];
        }
        setFilters(newFilters);
        onFilterChange(newFilters);
    };

    const clearFilter = (key: string) => {
        const newFilters = { ...filters };
        delete newFilters[key];
        setFilters(newFilters);
        onFilterChange(newFilters);
    };

    const resetAll = () => {
        setFilters({});
        setSearchQuery("");
        onFilterChange({});
    };

    return (
        <div className={cn("flex flex-col gap-2 p-2 bg-muted/20 rounded-lg border", className)}>
            <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex items-center flex-1 min-w-[200px]">
                    <Search className="absolute left-2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 h-8 bg-background"
                    />
                </div>

                {/* Dynamically Render Filters */}
                {config.map((c) => {
                    if (c.type === "select" && c.options) {
                        return (
                            <FacetFilter
                                key={c.id}
                                title={c.label}
                                options={c.options}
                                selectedValues={filters[c.id] || []}
                                onSelect={(vals) => handleMetaChange(c.id, vals)}
                            />
                        );
                    }
                    if (c.type === "boolean") {
                        return (
                            <Button
                                key={c.id}
                                variant={filters[c.id] ? "secondary" : "outline"}
                                size="sm"
                                onClick={() => handleMetaChange(c.id, !filters[c.id])}
                                className="h-8 border-dashed"
                            >
                                {filters[c.id] && <Check className="mr-2 h-4 w-4" />}
                                {c.label}
                            </Button>
                        );
                    }
                    if (c.type === "date-range") {
                        const range = filters[c.id] as { from?: Date; to?: Date } | undefined;
                        // Cast range to any to avoid strict DateRange mismatch if partial
                        const selectedRange: any = range || undefined;

                        return (
                            <Popover key={c.id}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 border-dashed flex gap-2">
                                        <CalendarIcon className="h-4 w-4" />
                                        {range?.from ? (
                                            range.to ? (
                                                <>
                                                    {format(range.from, "LLL dd, y")} - {format(range.to, "LLL dd, y")}
                                                </>
                                            ) : (
                                                format(range.from, "LLL dd, y")
                                            )
                                        ) : (
                                            <span>{c.label}</span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        initialFocus
                                        mode="range"
                                        defaultMonth={range?.from}
                                        selected={selectedRange}
                                        onSelect={(v) => handleMetaChange(c.id, v)}
                                        numberOfMonths={2}
                                    />
                                </PopoverContent>
                            </Popover>
                        )
                    }
                    return null;
                })}

                {/* Reset Button */}
                {Object.keys(filters).length > 0 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={resetAll}
                        className="h-8 px-2 lg:px-3"
                    >
                        Reset
                        <X className="ml-2 h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
    );
}

// Sub-component for Multi-Select Facets using DropdownMenu
function FacetFilter({
    title,
    options,
    selectedValues,
    onSelect
}: {
    title: string;
    options: FilterOption[];
    selectedValues: string[]; // Set of values
    onSelect: (values: string[]) => void;
}) {
    const selectedSet = new Set(selectedValues);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 border-dashed">
                    <Filter className="mr-2 h-4 w-4" />
                    {title}
                    {selectedSet.size > 0 && (
                        <>
                            <div className="mx-2 h-4 w-[1px] bg-border" />
                            <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                                {selectedSet.size}
                            </Badge>
                        </>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[200px]">
                <DropdownMenuLabel>{title}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {options.map((option) => {
                    const isSelected = selectedSet.has(option.value);
                    return (
                        <DropdownMenuCheckboxItem
                            key={option.value}
                            checked={isSelected}
                            onCheckedChange={() => {
                                const newSet = new Set(selectedValues);
                                if (isSelected) {
                                    newSet.delete(option.value);
                                } else {
                                    newSet.add(option.value);
                                }
                                onSelect(Array.from(newSet));
                            }}
                        >
                            {option.icon && <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />}
                            {option.label}
                        </DropdownMenuCheckboxItem>
                    );
                })}
                {selectedSet.size > 0 && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuCheckboxItem
                            checked={false}
                            onSelect={() => onSelect([])}
                            className="justify-center text-center font-medium"
                        >
                            Clear filters
                        </DropdownMenuCheckboxItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
