type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null;
}

function getString(record: UnknownRecord, keys: string[]): string | null {
    for (const key of keys) {
        const value = record[key];
        if (typeof value !== 'string') {
            continue;
        }

        const trimmed = value.trim();
        if (trimmed.length > 0) {
            return trimmed;
        }
    }

    return null;
}

function getNumber(record: UnknownRecord, keys: string[]): number | null {
    for (const key of keys) {
        const value = record[key];
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
    }

    return null;
}

function sanitizeErrorMessage(message: string): string {
    return message
        .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
        .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[redacted]')
        .replace(
            /(["']?(?:token|secret|session|authorization)["']?\s*[:=]\s*["']?)[^"',\s}]+/gi,
            '$1[redacted]'
        )
        .replace(/[A-Za-z0-9+/_=-]{48,}/g, '[redacted]')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 240);
}

export function getPublicErrorMessage(error: unknown, fallback = 'Unknown error'): string {
    let message: string | null = null;
    let code: number | null = null;

    if (typeof error === 'string') {
        message = error;
    } else if (error instanceof Error) {
        message = error.message;
    }

    if (isRecord(error)) {
        code = getNumber(error, ['code', 'statusCode', 'responseStatusCode']);
        if (!message) {
            message = getString(error, ['message', 'type', 'name']);
        }
    }

    const sanitized = sanitizeErrorMessage(message ?? fallback);
    if (!sanitized) {
        return fallback;
    }

    return code == null ? sanitized : `${sanitized} (code ${code})`;
}

export function warnWithError(context: string, error: unknown, fallback = 'Unknown error'): void {
    console.warn(`${context}: ${getPublicErrorMessage(error, fallback)}`);
}

export function errorWithError(context: string, error: unknown, fallback = 'Unknown error'): void {
    console.error(`${context}: ${getPublicErrorMessage(error, fallback)}`);
}
