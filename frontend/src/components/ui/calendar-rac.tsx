"use client";

import {
  Button,
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  DateInput,
  DateSegment,
  Heading,
  RangeCalendar,
} from "react-aria-components";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { twMerge } from "tailwind-merge";

const _Calendar = ({
  className,
  ...props
}: any) => {
  return (
    <Calendar
      className={twMerge(
        "w-fit rounded-md border bg-background p-3 text-popover-foreground shadow-md",
        className
      )}
      {...props}
    >
      <header className="flex w-full items-center justify-between gap-2">
        <Button
          className="inline-flex h-7 w-7 items-center justify-center whitespace-nowrap rounded-md border border-input bg-transparent text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          slot="previous"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Heading className="text-sm font-medium" />
        <Button
          className="inline-flex h-7 w-7 items-center justify-center whitespace-nowrap rounded-md border border-input bg-transparent text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          slot="next"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </header>
      <CalendarGrid className="mt-4 w-full border-collapse space-y-1">
        <CalendarGridHeader>
          {(date) => (
            <CalendarHeaderCell className="rounded-md text-[0.8rem] font-normal text-muted-foreground">
              {date}
            </CalendarHeaderCell>
          )}
        </CalendarGridHeader>
        <CalendarGridBody>
          {(date) => (
            <CalendarCell
              className="relative flex h-8 w-8 items-center justify-center rounded-md p-0 text-center text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring data-[disabled]:pointer-events-none data-[hovered]:bg-accent data-[hovered]:text-accent-foreground data-[outside-month]:text-muted-foreground data-[outside-month]:opacity-50 data-[selected]:bg-primary data-[selected]:text-primary-foreground data-[selected]:hover:bg-primary data-[selected]:hover:text-primary-foreground data-[unavailable]:text-destructive-foreground data-[unavailable]:opacity-50"
              date={date}
            />
          )}
        </CalendarGridBody>
      </CalendarGrid>
    </Calendar>
  );
};

const _RangeCalendar = ({
  className,
  ...props
}: any) => {
  return (
    <RangeCalendar
      className={twMerge(
        "w-fit rounded-md border bg-background p-3 text-popover-foreground shadow-md",
        className
      )}
      {...props}
    >
      <header className="flex w-full items-center justify-between gap-2">
        <Button
          className="inline-flex h-7 w-7 items-center justify-center whitespace-nowrap rounded-md border border-input bg-transparent text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          slot="previous"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Heading className="text-sm font-medium" />
        <Button
          className="inline-flex h-7 w-7 items-center justify-center whitespace-nowrap rounded-md border border-input bg-transparent text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          slot="next"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </header>
      <CalendarGrid className="mt-4 w-full border-collapse space-y-1">
        <CalendarGridHeader>
          {(date) => (
            <CalendarHeaderCell className="rounded-md text-[0.8rem] font-normal text-muted-foreground">
              {date}
            </CalendarHeaderCell>
          )}
        </CalendarGridHeader>
        <CalendarGridBody>
          {(date) => (
            <CalendarCell
              className="relative flex h-8 w-8 items-center justify-center rounded-md p-0 text-center text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring data-[disabled]:pointer-events-none data-[hovered]:bg-accent data-[hovered]:text-accent-foreground data-[outside-month]:text-muted-foreground data-[outside-month]:opacity-50 data-[selected]:bg-primary data-[selected]:text-primary-foreground data-[selected]:hover:bg-primary data-[selected]:hover:text-primary-foreground data-[unavailable]:text-destructive-foreground data-[unavailable]:opacity-50 data-[selection-start]:rounded-r-none data-[selection-end]:rounded-l-none data-[selection-middle]:rounded-none data-[selection-middle]:bg-accent data-[selection-middle]:text-accent-foreground"
              date={date}
            />
          )}
        </CalendarGridBody>
      </CalendarGrid>
    </RangeCalendar>
  );
};

export { _Calendar as Calendar, _RangeCalendar as RangeCalendar };
