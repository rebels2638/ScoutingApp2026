import { Query, type Models } from 'react-native-appwrite';

import type { AllianceColor, MatchType } from '../types';
import { getAppwriteDatabases } from './client';
import { requireBackendConfig } from './config';

type AssignmentDocument = Models.DefaultDocument;
type UnknownRecord = Record<string, unknown>;
type PendingAssignmentsListener = (userId: string) => void;

const pendingAssignmentsByUserId = new Map<string, PendingScoutingAssignment[]>();
const pendingAssignmentListeners = new Set<PendingAssignmentsListener>();

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

export async function fetchPendingAssignments(userId: string): Promise<PendingScoutingAssignment[]> {
    const config = requireBackendConfig();
    const response = await getAppwriteDatabases().listDocuments<AssignmentDocument>({
        databaseId: config.databaseId,
        collectionId: config.collectionAssignmentsId,
        queries: [
            Query.equal('key_id', userId),
            Query.equal('completed', false),
            Query.orderAsc('$createdAt'),
            Query.limit(100),
        ],
    });

    const assignments = response.documents.map(mapPendingAssignment);
    setCachedPendingAssignments(userId, assignments);
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
    const assignments = pendingAssignments ?? (await fetchPendingAssignments(userId));
    let match = findMatchingAssignment(assignments, {
        matchNumber,
        teamNumber,
        matchType,
    });

    if (!match && pendingAssignments) {
        const refreshedAssignments = await fetchPendingAssignments(userId);
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
