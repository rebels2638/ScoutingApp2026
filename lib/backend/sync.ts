import { warnWithError } from '../error-utils';
import { setAppwriteSessionHeader } from './client';
import { isBackendConfigured } from './config';
import { getBackendAuthMode, getBackendSession } from './secure';
import { flushQueuedScoutingSubmissions } from './submissions';

export interface RequestBackendSyncNowResult {
    ok: boolean;
    error?: 'not_ready' | 'unknown';
}

export async function requestBackendSyncNow(): Promise<RequestBackendSyncNowResult> {
    try {
        if (!isBackendConfigured()) {
            return { ok: false, error: 'not_ready' };
        }

        const [authMode, backendSession] = await Promise.all([getBackendAuthMode(), getBackendSession()]);
        if (authMode !== 'authenticated') {
            return { ok: false, error: 'not_ready' };
        }

        if (backendSession) {
            setAppwriteSessionHeader(backendSession);
        }
        await flushQueuedScoutingSubmissions();
        return { ok: true };
    } catch (error) {
        warnWithError('Failed to sync queued scouting submissions', error);
        return { ok: false, error: 'unknown' };
    }
}
