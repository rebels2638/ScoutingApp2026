const APPWRITE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const PLACEHOLDER_PATTERN = /^(?:YOUR_|REPLACE_|CHANGE_ME|<)/i;

type AppwritePublicEnvKey =
    | 'EXPO_PUBLIC_APPWRITE_ENDPOINT'
    | 'EXPO_PUBLIC_APPWRITE_PROJECT_ID'
    | 'EXPO_PUBLIC_APPWRITE_PLATFORM_ID'
    | 'EXPO_PUBLIC_APPWRITE_DATABASE_ID'
    | 'EXPO_PUBLIC_APPWRITE_COLLECTION_ASSIGNMENTS_ID'
    | 'EXPO_PUBLIC_APPWRITE_COLLECTION_SCOUTING_DATA_ID'
    | 'EXPO_PUBLIC_APPWRITE_COLLECTION_PIT_SCOUTING_ID'
    | 'EXPO_PUBLIC_APPWRITE_FUNCTION_VALIDATE_KEY_ID'
    | 'EXPO_PUBLIC_APPWRITE_FUNCTION_SUBMIT_SCOUTING_ID';

export interface BackendConfig {
    endpoint: string;
    projectId: string;
    platformId: string;
    databaseId: string;
    collectionAssignmentsId: string;
    collectionScoutingDataId: string;
    collectionPitScoutingId: string | null;
    functionValidateKeyId: string;
    functionSubmitScoutingId: string;
}

let hasResolvedBackendConfig = false;
let cachedBackendConfig: BackendConfig | null = null;
let cachedBackendConfigError: Error | null = null;

function getRequiredEnvValue(key: AppwritePublicEnvKey): string {
    const value = process.env[key];
    if (typeof value !== 'string') {
        throw new Error(
            `Missing required environment variable ${key}. Copy .env.example to a local .env file and set it.`
        );
    }

    const trimmed = value.trim();
    if (!trimmed || PLACEHOLDER_PATTERN.test(trimmed)) {
        throw new Error(
            `Environment variable ${key} is empty or still using a placeholder value.`
        );
    }

    return trimmed;
}

function getRequiredIdentifier(key: AppwritePublicEnvKey): string {
    const value = getRequiredEnvValue(key);
    if (!APPWRITE_ID_PATTERN.test(value)) {
        throw new Error(
            `Environment variable ${key} must use only letters, numbers, dots, dashes, or underscores.`
        );
    }

    return value;
}

function getOptionalIdentifier(key: AppwritePublicEnvKey): string | null {
    const value = process.env[key];
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    if (!trimmed || PLACEHOLDER_PATTERN.test(trimmed) || !APPWRITE_ID_PATTERN.test(trimmed)) {
        return null;
    }

    return trimmed;
}

function getRequiredEndpoint(key: AppwritePublicEnvKey): string {
    let endpoint: URL;

    try {
        endpoint = new URL(getRequiredEnvValue(key));
    } catch {
        throw new Error(`Environment variable ${key} must be a valid URL.`);
    }

    if (endpoint.protocol !== 'https:') {
        throw new Error(`Environment variable ${key} must use HTTPS.`);
    }

    endpoint.search = '';
    endpoint.hash = '';

    const normalizedPath = endpoint.pathname.replace(/\/+$/, '');
    endpoint.pathname = normalizedPath.length === 0 ? '/v1' : normalizedPath;

    if (!endpoint.pathname.endsWith('/v1')) {
        throw new Error(`Environment variable ${key} must point to the Appwrite /v1 endpoint.`);
    }

    return endpoint.toString().replace(/\/$/, '');
}

function resolveBackendConfig(): BackendConfig {
    return {
        endpoint: getRequiredEndpoint('EXPO_PUBLIC_APPWRITE_ENDPOINT'),
        projectId: getRequiredIdentifier('EXPO_PUBLIC_APPWRITE_PROJECT_ID'),
        platformId: getRequiredIdentifier('EXPO_PUBLIC_APPWRITE_PLATFORM_ID'),
        databaseId: getRequiredIdentifier('EXPO_PUBLIC_APPWRITE_DATABASE_ID'),
        collectionAssignmentsId: getRequiredIdentifier('EXPO_PUBLIC_APPWRITE_COLLECTION_ASSIGNMENTS_ID'),
        collectionScoutingDataId: getRequiredIdentifier('EXPO_PUBLIC_APPWRITE_COLLECTION_SCOUTING_DATA_ID'),
        collectionPitScoutingId: getOptionalIdentifier('EXPO_PUBLIC_APPWRITE_COLLECTION_PIT_SCOUTING_ID'),
        functionValidateKeyId: getRequiredIdentifier('EXPO_PUBLIC_APPWRITE_FUNCTION_VALIDATE_KEY_ID'),
        functionSubmitScoutingId: getRequiredIdentifier('EXPO_PUBLIC_APPWRITE_FUNCTION_SUBMIT_SCOUTING_ID'),
    };
}

function ensureBackendConfigResolved(): void {
    if (hasResolvedBackendConfig) {
        return;
    }

    hasResolvedBackendConfig = true;

    try {
        cachedBackendConfig = resolveBackendConfig();
    } catch (error) {
        cachedBackendConfig = null;
        cachedBackendConfigError =
            error instanceof Error
                ? error
                : new Error('Appwrite backend configuration is invalid.');
    }
}

export function getBackendConfig(): BackendConfig | null {
    ensureBackendConfigResolved();
    return cachedBackendConfig;
}

export function requireBackendConfig(): BackendConfig {
    const config = getBackendConfig();
    if (!config) {
        throw getBackendConfigError() ?? new Error('Appwrite backend configuration is unavailable.');
    }

    return config;
}

export function getBackendConfigError(): Error | null {
    ensureBackendConfigResolved();
    return cachedBackendConfigError;
}

export function isBackendConfigured(): boolean {
    return getBackendConfig() !== null;
}

export const BACKEND_SECURE_STORE_SESSION_KEY = 'agath.backend.session';
export const BACKEND_SECURE_STORE_USER_ID_KEY = 'agath.backend.userId';
export const BACKEND_SECURE_STORE_GUEST_KEY = 'agath.backend.guestKey';
export const BACKEND_SECURE_STORE_DEVICE_ID_KEY = 'agath.backend.deviceId';
export const BACKEND_SECURE_STORE_AUTH_MODE_KEY = 'agath.backend.authMode';

export const BACKEND_AUTH_MODES = ['guest', 'authenticated'] as const;
export type BackendAuthMode = (typeof BACKEND_AUTH_MODES)[number];
