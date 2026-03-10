import { warnWithError } from '../error-utils';
import { fetchPendingAssignments } from './assignments';
import { setAppwriteSessionHeader } from './client';
import { getBackendConfig, isBackendConfigured } from './config';
import { getCooldownRemainingMs, ONE_MINUTE_COOLDOWN_MS } from './cooldown';
import { forceRefreshPitData } from './pitScouting';
import { getBackendAuthMode, getBackendSession, getBackendUserId } from './secure';
import { flushQueuedScoutingSubmissions } from './submissions';

const BACKEND_SYNC_COOLDOWN_MS = ONE_MINUTE_COOLDOWN_MS;
export const BACKEND_AUTO_SYNC_INTERVAL_MS = 10 * 60 * 1000;
let lastBackendSyncAt = -BACKEND_SYNC_COOLDOWN_MS;
let pendingBackendSync: Promise<RequestBackendSyncNowResult> | null = null;

interface RequestBackendSyncNowOptions {
    refreshPendingAssignments?: boolean;
    refreshPitData?: boolean;
    skipCooldown?: boolean;
    userId?: string | null;
}

interface BeginBackendSyncAttemptResult {
    ok: boolean;
    retryAfterMs?: number;
}

export interface RequestBackendSyncNowResult {
    ok: boolean;
    error?: 'not_ready' | 'rate_limited' | 'unknown';
    attemptedCount?: number;
    uploadedCount?: number;
    remainingCount?: number;
    assignmentsRefreshed?: boolean;
    pitDataRefreshed?: boolean;
    pitProfileCount?: number;
    retryAfterMs?: number;
}

export function getBackendSyncRetryAfterMs(now = Date.now()): number {
    return getCooldownRemainingMs(lastBackendSyncAt, BACKEND_SYNC_COOLDOWN_MS, now);
}

export function beginBackendSyncAttempt(now = Date.now()): BeginBackendSyncAttemptResult {
    const retryAfterMs = getBackendSyncRetryAfterMs(now);
    if (retryAfterMs > 0) {
        return { ok: false, retryAfterMs };
    }

    lastBackendSyncAt = now;
    return { ok: true };
}

export async function requestBackendSyncNow(
    options: RequestBackendSyncNowOptions = {}
): Promise<RequestBackendSyncNowResult> {
    if (pendingBackendSync) {
        return pendingBackendSync;
    }

    pendingBackendSync = (async () => {
        try {
            if (!isBackendConfigured()) {
                return { ok: false, error: 'not_ready' };
            }

            const [authMode, backendSession, storedUserId] = await Promise.all([
                getBackendAuthMode(),
                getBackendSession(),
                options.refreshPendingAssignments ? getBackendUserId() : Promise.resolve(null),
            ]);

            if (authMode !== 'authenticated') {
                return { ok: false, error: 'not_ready' };
            }

            if (backendSession) {
                setAppwriteSessionHeader(backendSession);
            }

            const syncAttempt = options.skipCooldown ? { ok: true } : beginBackendSyncAttempt();
            if (!syncAttempt.ok) {
                return { ok: false, error: 'rate_limited', retryAfterMs: syncAttempt.retryAfterMs };
            }

            const queuedUploadResult = await flushQueuedScoutingSubmissions();
            const config = getBackendConfig();
            const resolvedUserId = options.userId?.trim() || storedUserId?.trim() || null;
            let assignmentsRefreshed = false;
            let pitDataRefreshed = false;
            let pitProfileCount: number | undefined;

            if (options.refreshPitData && config?.collectionPitScoutingId) {
                pitProfileCount = (await forceRefreshPitData()).length;
                pitDataRefreshed = true;
            }

            if (options.refreshPendingAssignments && resolvedUserId) {
                await fetchPendingAssignments(resolvedUserId, { bypassCooldown: true });
                assignmentsRefreshed = true;
            }

            return {
                ok: true,
                attemptedCount: queuedUploadResult.attempted,
                uploadedCount: queuedUploadResult.uploaded,
                remainingCount: queuedUploadResult.remaining,
                assignmentsRefreshed,
                pitDataRefreshed,
                pitProfileCount,
            };
        } catch (error) {
            warnWithError('Failed to sync backend scouting data', error);
            return { ok: false, error: 'unknown' };
        } finally {
            pendingBackendSync = null;
        }
    })();

    return pendingBackendSync;
}
