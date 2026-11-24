"use client"

import * as React from "react"
import { Check, ChevronDown, Plus, X } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export interface ComboboxProps {
    id?: string
    /**
     * The id of the element that labels this field.
     *
     * The trigger is a `div` with `role="combobox"` rather than a `button`,
     * because the multi-select chips contain their own remove buttons and a
     * button inside a button is invalid HTML. A `div` cannot be labelled
     * with `htmlFor`, so the label is wired up with `aria-labelledby`.
     */
    labelledBy?: string
    /** Every option the admin can pick from. */
    options: readonly string[]
    /** Currently selected options. Single mode uses at most one entry. */
    value: readonly string[]
    onChange: (value: string[]) => void
    /**
     * Called when the admin types an option that does not exist yet and
     * picks the "create" row. The component does not add the option itself
     * — the caller decides whether to persist it.
     */
    onCreate?: (option: string) => void
    multiple?: boolean
    placeholder?: string
    emptyText?: string
    /** Allow typing an option that is not in the list yet. */
    allowCreate?: boolean
    disabled?: boolean
    className?: string
    triggerClassName?: string
    /** Marks the field as invalid and points at the error message. */
    "aria-invalid"?: boolean | "true" | "false"
    /** The id of the element that holds the validation message. */
    "aria-describedby"?: string
}

type ListItem =
    | { kind: "option"; value: string }
    | { kind: "create"; value: string }

/**
 * A searchable dropdown that can also create new options.
 *
 * Hand-rolled on Radix Popover — the project deliberately avoids pulling in
 * a command-palette dependency. Supports single and multi selection,
 * keyboard navigation and an inline "create" row.
 */
export function Combobox({
    id,
    labelledBy,
    options,
    value,
    onChange,
    onCreate,
    multiple = false,
    placeholder = "Select an option",
    emptyText = "No options yet",
    allowCreate = true,
    disabled = false,
    className,
    triggerClassName,
    "aria-invalid": ariaInvalid,
    "aria-describedby": ariaDescribedBy,
}: ComboboxProps) {
    const [open, setOpen] = React.useState(false)
    const [query, setQuery] = React.useState("")
    const [activeIndex, setActiveIndex] = React.useState(0)
    const listRef = React.useRef<HTMLDivElement>(null)

    const trimmedQuery = query.trim()

    const filtered = React.useMemo(() => {
        const needle = trimmedQuery.toLowerCase()
        const unique = [...new Set(options)]
        if (!needle) return unique
        return unique.filter((option) => option.toLowerCase().includes(needle))
    }, [options, trimmedQuery])

    const canCreate =
        allowCreate &&
        Boolean(onCreate) &&
        trimmedQuery.length > 0 &&
        !options.some((option) => option.toLowerCase() === trimmedQuery.toLowerCase())

    const items: ListItem[] = React.useMemo(
        () => [
            ...filtered.map((option): ListItem => ({ kind: "option", value: option })),
            ...(canCreate
                ? ([{ kind: "create", value: trimmedQuery }] satisfies ListItem[])
                : []),
        ],
        [filtered, canCreate, trimmedQuery]
    )

    /**
     * The highlighted row.
     *
     * The index is clamped instead of reset in an effect: the list can get
     * shorter when the options change (a new option replaces the "create"
     * row, for example), and an out-of-range index would leave the list with
     * no highlighted row at all — the keyboard focus would be nowhere.
     */
    const safeActiveIndex = Math.min(activeIndex, Math.max(items.length - 1, 0))
    const activeItem = items[safeActiveIndex]

    const listboxId = id ? `${id}-listbox` : undefined
    const inputId = id ? `${id}-input` : undefined
    const activeOptionId =
        listboxId && activeItem ? `${listboxId}-option-${safeActiveIndex}` : undefined

    // Keep the keyboard-highlighted row inside the scroll viewport.
    React.useEffect(() => {
        if (!open) return
        const active = listRef.current?.querySelector<HTMLElement>('[data-active="true"]')
        active?.scrollIntoView({ block: "nearest" })
    }, [safeActiveIndex, open])

    const commit = React.useCallback(
        (item: ListItem) => {
            if (item.kind === "create") {
                onCreate?.(item.value)
                if (multiple) {
                    // A brand-new option is created *and* selected, otherwise
                    // the admin has to hunt for it in the list afterwards.
                    onChange(
                        value.includes(item.value) ? [...value] : [...value, item.value]
                    )
                } else {
                    onChange([item.value])
                    setOpen(false)
                }
                setQuery("")
                return
            }

            if (multiple) {
                const exists = value.includes(item.value)
                onChange(
                    exists
                        ? value.filter((entry) => entry !== item.value)
                        : [...value, item.value]
                )
            } else {
                const same = value[0] === item.value
                onChange(same ? [] : [item.value])
                setOpen(false)
            }
        },
        [multiple, onChange, onCreate, value]
    )

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "ArrowDown") {
            event.preventDefault()
            setActiveIndex((current) => Math.min(current + 1, items.length - 1))
            return
        }

        if (event.key === "ArrowUp") {
            event.preventDefault()
            setActiveIndex((current) => Math.max(current - 1, 0))
            return
        }

        if (event.key === "Home") {
            event.preventDefault()
            setActiveIndex(0)
            return
        }

        if (event.key === "End") {
            event.preventDefault()
            setActiveIndex(Math.max(items.length - 1, 0))
            return
        }

        if (event.key === "Enter") {
            event.preventDefault()
            const item = items[safeActiveIndex]
            if (item) commit(item)
            return
        }

        if (event.key === "Backspace" && multiple && query === "" && value.length > 0) {
            onChange(value.slice(0, -1))
        }
    }

    /**
     * Opens the list when the trigger has the keyboard focus.
     *
     * The trigger is a `div`, so the browser does not turn Enter or Space
     * into a click the way it does for a real button.
     */
    const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (disabled) return

        if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
            event.preventDefault()
            setOpen(true)
        }
    }

    const selectedLabel = multiple
        ? value.length > 0
            ? `${value.length} selected`
            : null
        : (value[0] ?? null)

    return (
        <div className={cn("w-full", className)}>
            <Popover
                open={open}
                onOpenChange={(next) => {
                    setOpen(next)
                    if (next) {
                        // Start from a clean filter with the first row active.
                        setQuery("")
                        setActiveIndex(0)
                    } else {
                        setQuery("")
                        setActiveIndex(0)
                    }
                }}
            >
                <PopoverTrigger asChild>
                    <div
                        id={id}
                        role="combobox"
                        tabIndex={disabled ? -1 : 0}
                        aria-haspopup="listbox"
                        aria-expanded={open}
                        aria-controls={listboxId}
                        aria-labelledby={labelledBy}
                        aria-disabled={disabled || undefined}
                        aria-invalid={ariaInvalid}
                        aria-describedby={ariaDescribedBy}
                        onKeyDown={handleTriggerKeyDown}
                        className={cn(
                            "flex h-12 w-full cursor-pointer items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-sm transition-all hover:bg-black/30 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50",
                            triggerClassName
                        )}
                    >
                        {multiple ? (
                            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 overflow-hidden">
                                {value.length === 0 ? (
                                    <span className="text-muted-foreground/50">{placeholder}</span>
                                ) : (
                                    value.map((entry, entryIndex) => (
                                        <span
                                            key={`${entry}-${entryIndex}`}
                                            className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs text-primary"
                                        >
                                            <span className="truncate">{entry}</span>
                                            <button
                                                type="button"
                                                aria-label={`Remove ${entry}`}
                                                className="rounded-full p-0.5 hover:bg-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                                onClick={(event) => {
                                                    // The click must not reach the
                                                    // trigger, which would open
                                                    // the list.
                                                    event.stopPropagation()
                                                    onChange(
                                                        value.filter((item) => item !== entry)
                                                    )
                                                }}
                                            >
                                                <X className="h-3 w-3" aria-hidden="true" />
                                            </button>
                                        </span>
                                    ))
                                )}
                            </span>
                        ) : (
                            <span
                                className={cn(
                                    "truncate text-left",
                                    !selectedLabel && "text-muted-foreground/50"
                                )}
                            >
                                {selectedLabel ?? placeholder}
                            </span>
                        )}
                        <ChevronDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
                    </div>
                </PopoverTrigger>

                <PopoverContent
                    align="start"
                    className="w-[var(--radix-popover-trigger-width)] min-w-[16rem] border-white/10 bg-[#0A0A0A] p-0"
                >
                    <div className="border-b border-white/10 p-2">
                        <Input
                            id={inputId}
                            autoFocus
                            value={query}
                            onChange={(event) => {
                                setQuery(event.target.value)
                                setActiveIndex(0)
                            }}
                            onKeyDown={handleKeyDown}
                            placeholder="Search or type a new option…"
                            className="h-9 border-white/10 bg-black/40 text-sm"
                            aria-label="Filter options"
                            aria-controls={listboxId}
                            aria-autocomplete="list"
                            aria-activedescendant={activeOptionId}
                        />
                    </div>

                    <div
                        ref={listRef}
                        id={listboxId}
                        role="listbox"
                        aria-multiselectable={multiple || undefined}
                        aria-labelledby={labelledBy}
                        className="max-h-60 overflow-y-auto p-1"
                    >
                        {items.length === 0 && (
                            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                                {emptyText}
                            </p>
                        )}

                        {items.map((item, index) => {
                            const isActive = index === safeActiveIndex
                            const isSelected = value.includes(item.value)

                            return (
                                <div
                                    key={`${item.kind}-${item.value}`}
                                    id={listboxId ? `${listboxId}-option-${index}` : undefined}
                                    role="option"
                                    aria-selected={isSelected}
                                    data-active={isActive}
                                    onMouseEnter={() => setActiveIndex(index)}
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => commit(item)}
                                    className={cn(
                                        "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                                        isActive ? "bg-white/10 text-white" : "text-muted-foreground"
                                    )}
                                >
                                    {item.kind === "create" ? (
                                        <>
                                            <Plus className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                                            <span className="truncate">
                                                Create <span className="font-medium text-white">{item.value}</span>
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <Check
                                                className={cn(
                                                    "h-4 w-4 shrink-0",
                                                    isSelected ? "text-primary" : "opacity-0"
                                                )}
                                                aria-hidden="true"
                                            />
                                            <span className="truncate">{item.value}</span>
                                        </>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}
