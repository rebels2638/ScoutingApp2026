import * as React from 'react';

import { warnWithError } from '../error-utils';
import {
    clearAppwriteSessionHeader,
    getAppwriteAccount,
    getAppwriteFunctions,
    setAppwriteSessionHeader,
} from './client';
import { getBackendConfigError, isBackendConfigured, requireBackendConfig } from './config';
import { getOrCreateInstallUuid } from './device';
import {
    deleteBackendAuthMode,
    deleteBackendGuestKey,
    deleteBackendSession,
    deleteBackendUserId,
    getBackendAuthMode,
    getBackendGuestKey,
    getBackendSession,
    getBackendUserId,
    setBackendAuthMode,
    setBackendSession,
    setBackendUserId,
} from './secure';

export type BackendAuthState = 'authenticated' | 'guest' | 'unconfigured';
type ActivateKeyError =
    | 'backend_unavailable'
    | 'invalid_format'
    | 'invalid_key'
    | 'rate_limited'
    | 'unknown';

export interface ActivateKeyResult {
    ok: boolean;
    error?: ActivateKeyError;
}

interface RevalidateBackendSessionResult {
    ok: boolean;
    error?: 'not_ready' | 'invalid_session' | 'unknown';
    userId?: string;
}

interface BackendAuthContextValue {
    authState: BackendAuthState;
    isBootstrapping: boolean;
    isActivating: boolean;
    isBackendAvailable: boolean;
    backendUnavailableReason: string | null;
    userId: string | null;
    activateKey: (rawKey: string) => Promise<ActivateKeyResult>;
    continueAsGuest: () => Promise<void>;
    signOut: () => Promise<void>;
    resetKey: () => Promise<void>;
    disconnectGuest: () => Promise<void>;
    revalidateSession: () => Promise<RevalidateBackendSessionResult>;
}

interface SessionCredentials {
    userId: string;
    activationSecret: string;
    persistedSession: string;
}

type UnknownRecord = Record<string, unknown>;

const BackendAuthContext = React.createContext<BackendAuthContextValue | undefined>(undefined);
const ACTIVATION_KEY_MAX_LENGTH = 512;
const ACTIVATION_KEY_PATTERN = /^[!-~]+$/;
const ACTIVATION_COOLDOWN_MS = 2000;

export function getActivationKeyValidationError(rawKey: string): string | null {
    const key = rawKey.trim();
    if (!key) {
        return 'Enter a key to continue';
    }

    if (key.length > ACTIVATION_KEY_MAX_LENGTH) {
        return `Key must be ${ACTIVATION_KEY_MAX_LENGTH} characters or fewer`;
    }

    if (!ACTIVATION_KEY_PATTERN.test(key)) {
        return 'Key contains unsupported characters';
    }

    return null;
}

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null;
}

function getString(record: UnknownRecord, keys: string[]): string | null {
    for (const key of keys) {
        const value = record[key];
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (trimmed.length > 0) {
                return trimmed;
            }
        }
    }

    return null;
}

function parseExecutionBody(responseBody: string): unknown {
    if (!responseBody) {
        return null;
    }

    try {
        return JSON.parse(responseBody);
    } catch (error) {
        warnWithError('Failed to parse key validation response body', error, 'Invalid JSON response');
        return null;
    }
}

function extractSessionCredentials(value: unknown): SessionCredentials | null {
    if (!isRecord(value)) {
        return null;
    }

    const queue: UnknownRecord[] = [value];

    while (queue.length > 0) {
        const current = queue.shift();
        if (!current) {
            continue;
        }

        const nestedUser = isRecord(current.user) ? current.user : null;
        const userId =
            getString(current, ['userId', 'user_id']) ??
            (nestedUser ? getString(nestedUser, ['$id', 'id', 'userId']) : null);
        const nestedSession = isRecord(current.session) ? current.session : null;
        const sessionSecret =
            getString(current, ['sessionSecret', 'session_secret']) ??
            (nestedSession ? getString(nestedSession, ['secret']) : null);
        const tokenSecret = getString(current, ['token', 'secret']);
        const activationSecret = tokenSecret ?? sessionSecret;
        const persistedSession = sessionSecret ?? tokenSecret;

        if (userId && activationSecret && persistedSession) {
            return { userId, activationSecret, persistedSession };
        }

        for (const key of ['data', 'payload', 'result', 'response', 'session']) {
            const nestedValue = current[key];
            if (isRecord(nestedValue)) {
                queue.push(nestedValue);
            }
        }
    }

    return null;
}

function getErrorCode(error: unknown): number | null {
    if (!isRecord(error)) {
        return null;
    }

    const code = error.code;
    return typeof code === 'number' ? code : null;
}

async function clearPersistedBackendAuth(): Promise<void> {
    await Promise.all([
        deleteBackendSession(),
        deleteBackendUserId(),
        deleteBackendGuestKey(),
        deleteBackendAuthMode(),
    ]);
}

async function resolveAuthenticatedBackendUserId(
    storedSession: string | null,
    storedUserId: string | null
): Promise<string> {
    const appwriteAccount = getAppwriteAccount();

    const resolveUserId = async () => {
        const account = await appwriteAccount.get();
        const resolvedUserId = storedUserId ?? account.$id;

        await Promise.all([
            storedUserId && storedUserId === resolvedUserId
                ? Promise.resolve()
                : setBackendUserId(resolvedUserId),
            setBackendAuthMode('authenticated'),
            deleteBackendGuestKey(),
        ]);

        return resolvedUserId;
    };

    if (!storedSession) {
        return resolveUserId();
    }

    setAppwriteSessionHeader(storedSession);

    try {
        return await resolveUserId();
    } catch (error) {
        if (getErrorCode(error) !== 401) {
            throw error;
        }

        clearAppwriteSessionHeader();
        warnWithError('Stored backend session is invalid, trying cookie session fallback', error);
        await deleteBackendSession();

        try {
            return await resolveUserId();
        } catch (fallbackError) {
            warnWithError('Cookie session fallback failed', fallbackError);
            throw fallbackError;
        }
    }
}

interface BackendAuthProviderProps {
    children: React.ReactNode;
}

export function BackendAuthProvider({ children }: BackendAuthProviderProps) {
    const [authState, setAuthState] = React.useState<BackendAuthState>('unconfigured');
    const [isBootstrapping, setIsBootstrapping] = React.useState(true);
    const [isActivating, setIsActivating] = React.useState(false);
    const [userId, setUserId] = React.useState<string | null>(null);
    const lastActivationAttemptAtRef = React.useRef(-ACTIVATION_COOLDOWN_MS);
    const isBackendAvailable = React.useMemo(() => isBackendConfigured(), []);
    const backendUnavailableReason = React.useMemo(
        () => getBackendConfigError()?.message ?? null,
        []
    );

    React.useEffect(() => {
        let cancelled = false;

        const bootstrap = async () => {
            setIsBootstrapping(true);

            try {
                const [storedSession, storedUserId, guestKey, authMode] = await Promise.all([
                    getBackendSession(),
                    getBackendUserId(),
                    getBackendGuestKey(),
                    getBackendAuthMode(),
                ]);

                const hasLegacyGuestState =
                    !storedSession && (authMode === 'guest' || (authMode == null && !!guestKey));

                if (!isBackendAvailable) {
                    clearAppwriteSessionHeader();
                    if (hasLegacyGuestState) {
                        await Promise.all([
                            deleteBackendGuestKey(),
                            deleteBackendAuthMode(),
                        ]);
                    }
                    if (!cancelled) {
                        setUserId(null);
                        setAuthState('unconfigured');
                    }
                    return;
                }

                if (hasLegacyGuestState) {
                    clearAppwriteSessionHeader();
                    await Promise.all([
                        deleteBackendGuestKey(),
                        deleteBackendAuthMode(),
                    ]);
                    if (!cancelled) {
                        setUserId(null);
                        setAuthState('unconfigured');
                    }
                    return;
                }

                if (storedSession || authMode === 'authenticated') {
                    try {
                        const resolvedUserId = await resolveAuthenticatedBackendUserId(
                            storedSession,
                            storedUserId
                        );

                        if (!cancelled) {
                            setUserId(resolvedUserId);
                            setAuthState('authenticated');
                        }

                        return;
                    } catch (error) {
                        if (getErrorCode(error) === 401) {
                            warnWithError('Stored authenticated mode is invalid', error);
                            await clearPersistedBackendAuth();
                            if (!cancelled) {
                                setUserId(null);
                                setAuthState('unconfigured');
                            }
                            return;
                        }

                        throw error;
                    }
                }

                clearAppwriteSessionHeader();
                if (!cancelled) {
                    setUserId(null);
                    setAuthState('unconfigured');
                }
            } catch (error) {
                warnWithError('Failed to bootstrap backend auth', error);
                clearAppwriteSessionHeader();
                if (!cancelled) {
                    setUserId(null);
                    setAuthState('unconfigured');
                }
            } finally {
                if (!cancelled) {
                    setIsBootstrapping(false);
                }
            }
        };

        void bootstrap();

        return () => {
            cancelled = true;
        };
    }, [isBackendAvailable]);

    const activateKey = React.useCallback(async (rawKey: string): Promise<ActivateKeyResult> => {
        if (!isBackendAvailable) {
            return { ok: false, error: 'backend_unavailable' };
        }

        const validationError = getActivationKeyValidationError(rawKey);
        if (validationError) {
            return { ok: false, error: 'invalid_format' };
        }

        const now = Date.now();
        if (now - lastActivationAttemptAtRef.current < ACTIVATION_COOLDOWN_MS) {
            return { ok: false, error: 'rate_limited' };
        }

        lastActivationAttemptAtRef.current = now;
        const keyToSubmit = rawKey.trim();
        setIsActivating(true);

        try {
            const { functionValidateKeyId } = requireBackendConfig();
            const appwriteFunctions = getAppwriteFunctions();
            const appwriteAccount = getAppwriteAccount();
            const deviceId = await getOrCreateInstallUuid();
            const payload: Record<string, string> = { raw_key: keyToSubmit };

            if (deviceId) {
                payload.device_id = deviceId;
            }

            const executionPromise = appwriteFunctions.createExecution({
                functionId: functionValidateKeyId,
                body: JSON.stringify(payload),
                async: false,
            });

            const execution = await executionPromise;

            if (execution.responseStatusCode === 401) {
                return { ok: false, error: 'invalid_key' };
            }

            if (execution.responseStatusCode >= 400) {
                throw new Error(`Key validation failed (${execution.responseStatusCode})`);
            }

            const credentials = extractSessionCredentials(parseExecutionBody(execution.responseBody));
            if (!credentials) {
                throw new Error('Key validation response is missing credentials');
            }

            await appwriteAccount.createSession({
                userId: credentials.userId,
                secret: credentials.activationSecret,
            });

            setAppwriteSessionHeader(credentials.persistedSession);

            await Promise.all([
                setBackendSession(credentials.persistedSession),
                setBackendUserId(credentials.userId),
                setBackendAuthMode('authenticated'),
                deleteBackendGuestKey(),
            ]);

            setUserId(credentials.userId);
            setAuthState('authenticated');
            return { ok: true };
        } catch (error) {
            if (getErrorCode(error) === 401) {
                return { ok: false, error: 'invalid_key' };
            }

            warnWithError('Failed to activate backend key', error);
            clearAppwriteSessionHeader();
            await clearPersistedBackendAuth();
            setUserId(null);
            setAuthState('unconfigured');
            return { ok: false, error: 'unknown' };
        } finally {
            setIsActivating(false);
        }
    }, [isBackendAvailable]);

    const revalidateSession = React.useCallback(async (): Promise<RevalidateBackendSessionResult> => {
        if (!isBackendAvailable) {
            return { ok: false, error: 'not_ready' };
        }

        try {
            const [storedSession, storedUserId, authMode] = await Promise.all([
                getBackendSession(),
                getBackendUserId(),
                getBackendAuthMode(),
            ]);

            if (authMode !== 'authenticated') {
                return { ok: false, error: 'not_ready' };
            }

            const resolvedUserId = await resolveAuthenticatedBackendUserId(storedSession, storedUserId);
            setUserId(resolvedUserId);
            setAuthState('authenticated');
            return { ok: true, userId: resolvedUserId };
        } catch (error) {
            if (getErrorCode(error) === 401) {
                warnWithError('Stored authenticated mode is invalid', error);
                clearAppwriteSessionHeader();
                await clearPersistedBackendAuth();
                setUserId(null);
                setAuthState('unconfigured');
                return { ok: false, error: 'invalid_session' };
            }

            warnWithError('Failed to validate backend session', error);
            return { ok: false, error: 'unknown' };
        }
    }, [isBackendAvailable]);

    const signOut = React.useCallback(async () => {
        if (isBackendAvailable) {
            try {
                await getAppwriteAccount().deleteSession({ sessionId: 'current' });
            } catch (error) {
                warnWithError('Failed to delete current backend session', error);
            }
        }

        clearAppwriteSessionHeader();
        await clearPersistedBackendAuth();
        setUserId(null);
        setAuthState('unconfigured');
    }, [isBackendAvailable]);

    const continueAsGuest = React.useCallback(async () => {
        if (authState === 'authenticated') {
            await signOut();
            return;
        }

        clearAppwriteSessionHeader();

        await clearPersistedBackendAuth();

        setUserId(null);
        setAuthState('unconfigured');
    }, [authState, signOut]);

    const resetKey = React.useCallback(async () => {
        await signOut();
    }, [signOut]);

    const disconnectGuest = React.useCallback(async () => {
        await continueAsGuest();
    }, [continueAsGuest]);

    const value = React.useMemo<BackendAuthContextValue>(
        () => ({
            authState,
            backendUnavailableReason,
            isBootstrapping,
            isActivating,
            isBackendAvailable,
            userId,
            activateKey,
            continueAsGuest,
            signOut,
            resetKey,
            disconnectGuest,
            revalidateSession,
        }),
        [
            activateKey,
            authState,
            backendUnavailableReason,
            continueAsGuest,
            disconnectGuest,
            isActivating,
            isBackendAvailable,
            isBootstrapping,
            revalidateSession,
            resetKey,
            signOut,
            userId,
        ]
    );

    return (
        <BackendAuthContext.Provider value={value}>
            {children}
        </BackendAuthContext.Provider>
    );
}

export function useBackendAuth(): BackendAuthContextValue {
    const context = React.useContext(BackendAuthContext);
    if (!context) {
        throw new Error('useBackendAuth must be used within a BackendAuthProvider');
    }

    return context;
}
