import AsyncStorage from '@react-native-async-storage/async-storage';

import { warnWithError } from '../error-utils';
import type { ScoutingEntry } from '../types';
import { getAppwriteFunctions } from './client';
import { requireBackendConfig } from './config';
import { getInstallUuid } from './device';

const SCOUTING_SUBMISSION_QUEUE_KEY = '@agath_backend_submission_queue';

type UnknownRecord = Record<string, unknown>;

interface ScoutingSubmissionPayload {
    key_id: string;
    match_num: number;
    team_num: number;
    local_entry_id: string;
    submitted_at: string;
    data: string;
    assignment_id?: string;
    device_id?: string;
}

interface QueuedScoutingSubmission {
    local_entry_id: string;
    payload: ScoutingSubmissionPayload;
    queued_at: string;
}

interface SubmitScoutingEntryWithQueueParams {
    keyId: string;
    entry: ScoutingEntry;
    assignmentId?: string | null;
}

export interface SubmitScoutingEntryWithQueueResult {
    status: 'uploaded' | 'queued' | 'failed';
}

export interface FlushQueuedScoutingSubmissionsResult {
    attempted: number;
    uploaded: number;
    remaining: number;
}

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null;
}

function isQueuedScoutingSubmission(value: unknown): value is QueuedScoutingSubmission {
    if (!isRecord(value)) {
        return false;
    }

    if (typeof value.local_entry_id !== 'string' || value.local_entry_id.trim().length === 0) {
        return false;
    }

    if (typeof value.queued_at !== 'string') {
        return false;
    }

    const payload = value.payload;
    if (!isRecord(payload)) {
        return false;
    }

    return (
        typeof payload.key_id === 'string' &&
        typeof payload.match_num === 'number' &&
        typeof payload.team_num === 'number' &&
        typeof payload.local_entry_id === 'string' &&
        typeof payload.submitted_at === 'string' &&
        typeof payload.data === 'string'
    );
}

async function readSubmissionQueue(): Promise<QueuedScoutingSubmission[]> {
    const storedValue = await AsyncStorage.getItem(SCOUTING_SUBMISSION_QUEUE_KEY);
    if (!storedValue) {
        return [];
    }

    try {
        const parsedValue = JSON.parse(storedValue) as unknown;
        if (!Array.isArray(parsedValue)) {
            return [];
        }

        return parsedValue.filter(isQueuedScoutingSubmission);
    } catch (error) {
        warnWithError('Failed to parse scouting submission queue', error, 'Invalid queued submission data');
        return [];
    }
}

async function writeSubmissionQueue(queue: QueuedScoutingSubmission[]): Promise<void> {
    if (queue.length === 0) {
        await AsyncStorage.removeItem(SCOUTING_SUBMISSION_QUEUE_KEY);
        return;
    }

    await AsyncStorage.setItem(SCOUTING_SUBMISSION_QUEUE_KEY, JSON.stringify(queue));
}

async function removeSubmissionFromQueue(localEntryId: string): Promise<void> {
    const queue = await readSubmissionQueue();
    const nextQueue = queue.filter((queuedSubmission) => queuedSubmission.local_entry_id !== localEntryId);

    if (nextQueue.length !== queue.length) {
        await writeSubmissionQueue(nextQueue);
    }
}

async function enqueueSubmission(payload: ScoutingSubmissionPayload): Promise<void> {
    const queue = await readSubmissionQueue();
    const dedupedQueue = queue.filter(
        (queuedSubmission) => queuedSubmission.local_entry_id !== payload.local_entry_id
    );

    dedupedQueue.push({
        local_entry_id: payload.local_entry_id,
        payload,
        queued_at: new Date().toISOString(),
    });

    await writeSubmissionQueue(dedupedQueue);
}

async function executeSubmission(payload: ScoutingSubmissionPayload): Promise<void> {
    const { functionSubmitScoutingId } = requireBackendConfig();
    const execution = await getAppwriteFunctions().createExecution({
        functionId: functionSubmitScoutingId,
        body: JSON.stringify(payload),
        async: false,
    });

    if (execution.responseStatusCode >= 400) {
        throw new Error(`Scouting submission failed (${execution.responseStatusCode})`);
    }
}

async function buildScoutingSubmissionPayload({
    keyId,
    entry,
    assignmentId,
}: SubmitScoutingEntryWithQueueParams): Promise<ScoutingSubmissionPayload> {
    const payload: ScoutingSubmissionPayload = {
        key_id: keyId,
        match_num: entry.matchMetadata.matchNumber,
        team_num: entry.matchMetadata.teamNumber,
        local_entry_id: entry.id,
        submitted_at: new Date().toISOString(),
        data: JSON.stringify(entry),
    };

    const trimmedAssignmentId = assignmentId?.trim();
    if (trimmedAssignmentId) {
        payload.assignment_id = trimmedAssignmentId;
    }

    const deviceId = await getInstallUuid();
    if (deviceId) {
        payload.device_id = deviceId;
    }

    return payload;
}

export async function submitScoutingEntryWithQueue(
    params: SubmitScoutingEntryWithQueueParams
): Promise<SubmitScoutingEntryWithQueueResult> {
    const payload = await buildScoutingSubmissionPayload(params);

    try {
        await executeSubmission(payload);
        await removeSubmissionFromQueue(payload.local_entry_id);
        return { status: 'uploaded' };
    } catch (submissionError) {
        warnWithError('Failed to submit scouting entry to backend, queuing for retry', submissionError);
        try {
            await enqueueSubmission(payload);
            return { status: 'queued' };
        } catch (queueError) {
            warnWithError('Failed to queue scouting entry for retry', queueError);
            return { status: 'failed' };
        }
    }
}

export async function flushQueuedScoutingSubmissions(): Promise<FlushQueuedScoutingSubmissionsResult> {
    const queue = await readSubmissionQueue();
    if (queue.length === 0) {
        return { attempted: 0, uploaded: 0, remaining: 0 };
    }

    const remainingQueue: QueuedScoutingSubmission[] = [];
    let uploadedCount = 0;

    for (const queuedSubmission of queue) {
        try {
            await executeSubmission(queuedSubmission.payload);
            uploadedCount += 1;
        } catch (submissionError) {
            warnWithError('Failed to flush queued scouting submission', submissionError);
            remainingQueue.push(queuedSubmission);
        }
    }

    await writeSubmissionQueue(remainingQueue);

    return {
        attempted: queue.length,
        uploaded: uploadedCount,
        remaining: remainingQueue.length,
    };
}
