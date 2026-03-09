import { warnWithError } from '../error-utils';
import { setAppwriteSessionHeader } from './client';
import { fetchPendingAssignments } from './assignments';
import { getBackendConfig, isBackendConfigured } from './config';
import { forceRefreshPitData } from './pitScouting';
import { getBackendAuthMode, getBackendSession, getBackendUserId } from './secure';
import { flushQueuedScoutingSubmissions } from './submissions';

interface RequestBackendSyncNowOptions {
    refreshPendingAssignments?: boolean;
    refreshPitData?: boolean;
    userId?: string | null;
}

export interface RequestBackendSyncNowResult {
    ok: boolean;
    error?: 'not_ready' | 'unknown';
    attemptedCount?: number;
    uploadedCount?: number;
    remainingCount?: number;
    assignmentsRefreshed?: boolean;
    pitDataRefreshed?: boolean;
    pitProfileCount?: number;
}

export async function requestBackendSyncNow(
    options: RequestBackendSyncNowOptions = {}
): Promise<RequestBackendSyncNowResult> {
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
            await fetchPendingAssignments(resolvedUserId);
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
    }
}
