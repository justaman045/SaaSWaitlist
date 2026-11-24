"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Small, dependency-free chart primitives for the admin dashboard.
 *
 * These are deliberately simple CSS/SVG shapes rather than a charting
 * library — the admin bundle stays small and there is no new package to
 * audit.
 */

export function StatCard({
    label,
    value,
    hint,
    icon,
    className,
}: {
    label: string
    value: React.ReactNode
    hint?: React.ReactNode
    icon?: React.ReactNode
    className?: string
}) {
    return (
        <div
            className={cn(
                "rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-md shadow-xl",
                className
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {label}
                </p>
                {icon && <span className="text-primary/70">{icon}</span>}
            </div>
            <p className="mt-3 text-3xl font-bold tracking-tight text-white">{value}</p>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
    )
}

export interface BarDatum {
    label: string
    count: number
}

/**
 * Vertical bar chart used for "signups per day".
 *
 * Bars are sized as a percentage of the tallest bar so the chart scales to
 * any container width without measuring the DOM.
 */
export function BarChart({
    data,
    emptyText = "No signups in this period",
    className,
}: {
    data: BarDatum[]
    emptyText?: string
    className?: string
}) {
    const max = Math.max(1, ...data.map((datum) => datum.count))
    const total = data.reduce((sum, datum) => sum + datum.count, 0)
    const labelEvery = Math.max(1, Math.ceil(data.length / 7))

    if (data.length === 0 || total === 0) {
        return (
            <div
                className={cn(
                    "flex h-40 items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-muted-foreground",
                    className
                )}
            >
                {emptyText}
            </div>
        )
    }

    const peak = data.reduce((best, datum) =>
        datum.count > best.count ? datum : best
    )

    return (
        <div className={cn("space-y-3", className)}>
            {/*
                The chart is a picture, so it is exposed as one image with a
                text summary. The individual bars stay in the DOM for the
                mouse, but a screen reader gets the sentence instead of 30
                unlabelled rectangles.
            */}
            <div
                role="img"
                aria-label={`Daily signups over the last ${data.length} days. ${total} signup${
                    total === 1 ? "" : "s"
                } in total. The busiest day was ${peak.label} with ${peak.count}.`}
                className="flex h-40 items-end gap-1"
            >
                {data.map((datum) => (
                    <div
                        key={datum.label}
                        className="group relative flex h-full flex-1 items-end"
                        title={`${datum.label}: ${datum.count} signup${datum.count === 1 ? "" : "s"}`}
                    >
                        {datum.count === 0 ? (
                            // A day without signups is drawn as a flat, muted
                            // line. A short coloured bar would read as "a
                            // small number of signups".
                            <div className="h-px w-full bg-white/15" />
                        ) : (
                            <div
                                className="w-full rounded-t-md bg-primary/60 transition-colors group-hover:bg-primary"
                                style={{ height: `${(datum.count / max) * 100}%` }}
                            />
                        )}
                        {datum.count > 0 && (
                            <span className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full rounded-md border border-white/10 bg-black/90 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                                {datum.count}
                            </span>
                        )}
                    </div>
                ))}
            </div>

            <div className="flex gap-1" aria-hidden="true">
                {data.map((datum, index) => (
                    <span
                        key={`${datum.label}-axis`}
                        className="flex-1 truncate text-center text-[10px] text-muted-foreground/70"
                    >
                        {index % labelEvery === 0 ? datum.label : ""}
                    </span>
                ))}
            </div>
        </div>
    )
}

export interface HorizontalBarDatum {
    label: string
    value: number
    hint?: string
}

/** Horizontal bars used for "top projects by signups". */
export function HorizontalBars({
    data,
    emptyText = "Nothing to show yet",
    valueSuffix = "",
    className,
}: {
    data: HorizontalBarDatum[]
    emptyText?: string
    valueSuffix?: string
    className?: string
}) {
    const max = Math.max(1, ...data.map((datum) => datum.value))

    if (data.length === 0) {
        return (
            <div
                className={cn(
                    "flex h-24 items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-muted-foreground",
                    className
                )}
            >
                {emptyText}
            </div>
        )
    }

    // Labels are not guaranteed to be unique (two projects can share a
    // title), so a repeated label gets a counter instead of the array index
    // — the key then stays the same when the order changes.
    const seen = new Map<string, number>()
    const rows = data.map((datum) => {
        const occurrence = seen.get(datum.label) ?? 0
        seen.set(datum.label, occurrence + 1)
        return {
            ...datum,
            key: occurrence === 0 ? datum.label : `${datum.label}#${occurrence}`,
        }
    })

    return (
        <ul className={cn("space-y-3", className)}>
            {rows.map((datum) => (
                <li key={datum.key} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate text-white">{datum.label}</span>
                        <span className="shrink-0 font-medium text-primary">
                            {datum.value}
                            {valueSuffix}
                        </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/5">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary"
                            style={{
                                width: `${datum.value === 0 ? 0 : Math.max(2, (datum.value / max) * 100)}%`,
                            }}
                        />
                    </div>
                    {datum.hint && (
                        <p className="text-xs text-muted-foreground">{datum.hint}</p>
                    )}
                </li>
            ))}
        </ul>
    )
}
