import { Query, type Models } from 'react-native-appwrite';

import type { AllianceColor, MatchType } from '../types';
import { getAppwriteDatabases } from './client';
import { requireBackendConfig } from './config';
import { getCooldownRemainingMs, ONE_MINUTE_COOLDOWN_MS } from './cooldown';

type AssignmentDocument = Models.DefaultDocument;
type UnknownRecord = Record<string, unknown>;
type PendingAssignmentsListener = (userId: string) => void;

const ASSIGNMENT_REFRESH_COOLDOWN_MS = ONE_MINUTE_COOLDOWN_MS;
const pendingAssignmentsByUserId = new Map<string, PendingScoutingAssignment[]>();
const pendingAssignmentListeners = new Set<PendingAssignmentsListener>();
const lastPendingAssignmentsFetchAtByUserId = new Map<string, number>();

export interface PendingScoutingAssignment {
    id: string;
    matchNumber: number | null;
    teamNumber: number | null;
    matchType: MatchType | null;
    allianceColor: AllianceColor | null;
}

interface CompleteAssignmentForSubmissionParams {
    userId: string;
    matchNumber: number;
    teamNumber: number;
    matchType: MatchType;
    pendingAssignments?: PendingScoutingAssignment[];
}

interface AssignmentMatchCandidate {
    matchNumber: number;
    teamNumber: number;
    matchType: MatchType;
}

export interface FetchPendingAssignmentsOptions {
    bypassCooldown?: boolean;
}

interface PendingAssignmentsRateLimitedError extends Error {
    code: 'rate_limited';
    retryAfterMs: number;
}

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null;
}

function createPendingAssignmentsRateLimitedError(
    retryAfterMs: number
): PendingAssignmentsRateLimitedError {
    const error = new Error('Pending assignments refresh is rate limited') as PendingAssignmentsRateLimitedError;
    error.name = 'PendingAssignmentsRateLimitedError';
    error.code = 'rate_limited';
    error.retryAfterMs = retryAfterMs;
    return error;
}

export function isPendingAssignmentsRateLimitedError(
    error: unknown
): error is PendingAssignmentsRateLimitedError {
    return (
        isRecord(error) &&
        error.code === 'rate_limited' &&
        typeof error.retryAfterMs === 'number'
    );
}

function notifyPendingAssignmentsUpdated(userId: string): void {
    for (const listener of pendingAssignmentListeners) {
        listener(userId);
    }
}

function setCachedPendingAssignments(userId: string, assignments: PendingScoutingAssignment[]): void {
    pendingAssignmentsByUserId.set(userId, assignments);
    notifyPendingAssignmentsUpdated(userId);
}

function removeCachedAssignment(assignmentId: string): void {
    for (const [userId, assignments] of pendingAssignmentsByUserId.entries()) {
        const nextAssignments = assignments.filter((assignment) => assignment.id !== assignmentId);
        if (nextAssignments.length === assignments.length) {
            continue;
        }

        pendingAssignmentsByUserId.set(userId, nextAssignments);
        notifyPendingAssignmentsUpdated(userId);
    }
}

function getFirstValue(record: UnknownRecord, keys: string[]): unknown {
    for (const key of keys) {
        if (key in record) {
            return record[key];
        }
    }

    return undefined;
}

function toPositiveInteger(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value > 0 ? Math.trunc(value) : null;
    }

    if (typeof value === 'string') {
        const parsed = Number.parseInt(value.trim(), 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }

    return null;
}

function toTrimmedString(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function toMatchType(value: unknown): MatchType | null {
    const trimmedValue = toTrimmedString(value)?.toLowerCase();
    if (!trimmedValue) {
        return null;
    }

    if (trimmedValue === 'practice') {
        return 'Practice';
    }

    if (trimmedValue === 'qualification' || trimmedValue === 'qualifications' || trimmedValue === 'qual') {
        return 'Qualification';
    }

    if (trimmedValue === 'playoff' || trimmedValue === 'playoffs') {
        return 'Playoff';
    }

    return null;
}

function toAllianceColor(value: unknown): AllianceColor | null {
    const trimmedValue = toTrimmedString(value)?.toLowerCase();
    if (trimmedValue === 'red') {
        return 'Red';
    }

    if (trimmedValue === 'blue') {
        return 'Blue';
    }

    return null;
}

function mapPendingAssignment(document: AssignmentDocument): PendingScoutingAssignment {
    const record = document as UnknownRecord;

    return {
        id: document.$id,
        matchNumber: toPositiveInteger(getFirstValue(record, ['match_number', 'matchNumber', 'match'])),
        teamNumber: toPositiveInteger(getFirstValue(record, ['team_number', 'teamNumber', 'team'])),
        matchType: toMatchType(getFirstValue(record, ['match_type', 'matchType'])),
        allianceColor: toAllianceColor(getFirstValue(record, ['alliance_color', 'allianceColor', 'alliance'])),
    };
}

export function matchesAssignment(
    assignment: PendingScoutingAssignment,
    candidate: AssignmentMatchCandidate
): boolean {
    if (assignment.matchNumber !== candidate.matchNumber || assignment.teamNumber !== candidate.teamNumber) {
        return false;
    }

    if (!assignment.matchType) {
        return true;
    }

    return assignment.matchType === candidate.matchType;
}

export function findMatchingAssignment(
    assignments: PendingScoutingAssignment[],
    candidate: AssignmentMatchCandidate
): PendingScoutingAssignment | null {
    return assignments.find((assignment) => matchesAssignment(assignment, candidate)) ?? null;
}

export async function fetchPendingAssignments(
    userId: string,
    options: FetchPendingAssignmentsOptions = {}
): Promise<PendingScoutingAssignment[]> {
    const normalizedUserId = userId.trim();
    const now = Date.now();
    const lastFetchAt =
        lastPendingAssignmentsFetchAtByUserId.get(normalizedUserId) ?? -ASSIGNMENT_REFRESH_COOLDOWN_MS;
    const retryAfterMs = options.bypassCooldown
        ? 0
        : getCooldownRemainingMs(lastFetchAt, ASSIGNMENT_REFRESH_COOLDOWN_MS, now);

    if (retryAfterMs > 0) {
        if (pendingAssignmentsByUserId.has(normalizedUserId)) {
            return getCachedPendingAssignments(normalizedUserId);
        }

        throw createPendingAssignmentsRateLimitedError(retryAfterMs);
    }

    lastPendingAssignmentsFetchAtByUserId.set(normalizedUserId, now);
    const config = requireBackendConfig();
    const response = await getAppwriteDatabases().listDocuments<AssignmentDocument>({
        databaseId: config.databaseId,
        collectionId: config.collectionAssignmentsId,
        queries: [
            Query.equal('key_id', normalizedUserId),
            Query.equal('completed', false),
            Query.orderAsc('$createdAt'),
            Query.limit(100),
        ],
    });

    const assignments = response.documents.map(mapPendingAssignment);
    setCachedPendingAssignments(normalizedUserId, assignments);
    return assignments;
}

export function getCachedPendingAssignments(userId: string): PendingScoutingAssignment[] {
    return pendingAssignmentsByUserId.get(userId)?.slice() ?? [];
}

export function subscribeToPendingAssignments(listener: PendingAssignmentsListener): () => void {
    pendingAssignmentListeners.add(listener);
    return () => {
        pendingAssignmentListeners.delete(listener);
    };
}

export async function markAssignmentCompleted(assignmentId: string): Promise<void> {
    const config = requireBackendConfig();
    await getAppwriteDatabases().updateDocument({
        databaseId: config.databaseId,
        collectionId: config.collectionAssignmentsId,
        documentId: assignmentId,
        data: {
            completed: true,
        },
    });
    removeCachedAssignment(assignmentId);
}

export async function completeAssignmentForSubmission({
    userId,
    matchNumber,
    teamNumber,
    matchType,
    pendingAssignments,
}: CompleteAssignmentForSubmissionParams): Promise<boolean> {
    const assignments = pendingAssignments ?? (await fetchPendingAssignments(userId, { bypassCooldown: true }));
    let match = findMatchingAssignment(assignments, {
        matchNumber,
        teamNumber,
        matchType,
    });

    if (!match && pendingAssignments) {
        const refreshedAssignments = await fetchPendingAssignments(userId, { bypassCooldown: true });
        match = findMatchingAssignment(refreshedAssignments, {
            matchNumber,
            teamNumber,
            matchType,
        });
    }

    if (!match) {
        return false;
    }

    await markAssignmentCompleted(match.id);
    return true;
}
