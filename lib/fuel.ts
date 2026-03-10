import type { FuelRange, FuelScoredBucket } from './types';

const CANONICAL_FUEL_COUNT_ESTIMATES: Record<string, number> = {
    '0': 0,
    '1-3': 2,
    '4-8': 6,
    '9+': 10,
    '1-4': 2.5,
    '5-8': 6.5,
    '9-12': 10.5,
    '13-16': 14.5,
    '17+': 18,
};

const CANONICAL_FUEL_RANGES: readonly FuelRange[] = ['1-4', '5-8', '9-12', '13-16', '17+'];

export function normalizeFuelCountLabel(value: string): string {
    return value
        .trim()
        .replace(/[\u2010-\u2015\u2212]/g, '-')
        .replace(/\s+/g, '');
}

export function sanitizeFuelCountLabel(value: string | null | undefined): string | null {
    if (value == null) {
        return null;
    }

    const normalized = normalizeFuelCountLabel(value);
    return normalized.length > 0 ? normalized : null;
}

export function isFuelCountLabel(value: string): boolean {
    const normalized = normalizeFuelCountLabel(value);
    if (normalized.length === 0) {
        return false;
    }

    if (/^\d+$/.test(normalized)) {
        return true;
    }

    const rangeMatch = normalized.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
        const minimum = Number.parseInt(rangeMatch[1], 10);
        const maximum = Number.parseInt(rangeMatch[2], 10);
        return Number.isFinite(minimum) && Number.isFinite(maximum) && minimum <= maximum;
    }

    return /^\d+\+$/.test(normalized);
}

export function isLegacyAutoFuelBucket(value: string): value is FuelScoredBucket {
    return value === '0' || value === '1-3' || value === '4-8' || value === '9+';
}

export function estimateFuelCount(value: string | null | undefined): number {
    const normalized = sanitizeFuelCountLabel(value);
    if (!normalized) {
        return 0;
    }

    const canonicalEstimate = CANONICAL_FUEL_COUNT_ESTIMATES[normalized];
    if (canonicalEstimate !== undefined) {
        return canonicalEstimate;
    }

    if (/^\d+$/.test(normalized)) {
        const parsed = Number.parseInt(normalized, 10);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    const rangeMatch = normalized.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
        const minimum = Number.parseInt(rangeMatch[1], 10);
        const maximum = Number.parseInt(rangeMatch[2], 10);
        return Number.isFinite(minimum) && Number.isFinite(maximum) ? (minimum + maximum) / 2 : 0;
    }

    const plusMatch = normalized.match(/^(\d+)\+$/);
    if (plusMatch) {
        const minimum = Number.parseInt(plusMatch[1], 10);
        return Number.isFinite(minimum) ? minimum + 1 : 0;
    }

    return 0;
}

export function toCanonicalFuelRange(value: string | null | undefined): FuelRange | null {
    const normalized = sanitizeFuelCountLabel(value);
    if (!normalized) {
        return null;
    }

    if (CANONICAL_FUEL_RANGES.includes(normalized as FuelRange)) {
        return normalized as FuelRange;
    }

    const estimate = estimateFuelCount(normalized);
    if (!Number.isFinite(estimate) || estimate < 1) {
        return null;
    }

    if (estimate <= 4) {
        return '1-4';
    }

    if (estimate <= 8) {
        return '5-8';
    }

    if (estimate <= 12) {
        return '9-12';
    }

    if (estimate <= 16) {
        return '13-16';
    }

    return '17+';
}