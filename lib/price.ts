/**
 * Pricing is stored on the project document as a string so legacy documents
 * (which may contain free text such as "Freemium") keep working. New writes
 * are always numeric strings.
 *
 * `parsePrice` returns null for anything that is not a plain, non-negative
 * decimal number so callers can decide whether to show a currency prefix.
 *
 * The format is checked explicitly rather than with `Number()` alone:
 * `Number("0x10")` is 16 and `Number("1e3")` is 1000, so those strings
 * would pass a `Number()` check and then be stored as a completely different
 * price. Only plain decimals are accepted — any number of decimal places,
 * so a stored "29.999" keeps being treated as a price.
 */
const DECIMAL_PRICE = /^\d+(\.\d+)?$/

export function parsePrice(value?: string | null): number | null {
    if (value == null) return null

    const trimmed = value.trim()
    if (!trimmed) return null
    if (!DECIMAL_PRICE.test(trimmed)) return null

    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed) || parsed < 0) return null

    return parsed
}

/** True when the stored pricing value can be rendered as a currency amount. */
export function isNumericPrice(value?: string | null): boolean {
    return parsePrice(value) !== null
}
