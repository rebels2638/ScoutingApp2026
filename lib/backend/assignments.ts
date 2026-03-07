import { Query, type Models } from 'react-native-appwrite';

import { getAppwriteDatabases } from './client';
import { requireBackendConfig } from './config';

type AssignmentDocument = Models.DefaultDocument;
type UnknownRecord = Record<string, unknown>;

export interface PendingScoutingAssignment {
    id: string;
    matchNumber: number | null;
    teamNumber: number | null;
    matchType: string | null;
    allianceColor: string | null;
}

interface CompleteAssignmentForSubmissionParams {
    userId: string;
    matchNumber: number;
    teamNumber: number;
    pendingAssignments?: PendingScoutingAssignment[];
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

function mapPendingAssignment(document: AssignmentDocument): PendingScoutingAssignment {
    const record = document as UnknownRecord;

    return {
        id: document.$id,
        matchNumber: toPositiveInteger(getFirstValue(record, ['match_number', 'matchNumber', 'match'])),
        teamNumber: toPositiveInteger(getFirstValue(record, ['team_number', 'teamNumber', 'team'])),
        matchType: toTrimmedString(getFirstValue(record, ['match_type', 'matchType'])),
        allianceColor: toTrimmedString(getFirstValue(record, ['alliance_color', 'allianceColor', 'alliance'])),
    };
}

function findMatchingAssignment(
    assignments: PendingScoutingAssignment[],
    matchNumber: number,
    teamNumber: number
): PendingScoutingAssignment | null {
    return assignments.find(
        (assignment) => assignment.matchNumber === matchNumber && assignment.teamNumber === teamNumber
    ) ?? null;
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

    return response.documents.map(mapPendingAssignment);
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
}

export async function completeAssignmentForSubmission({
    userId,
    matchNumber,
    teamNumber,
    pendingAssignments,
}: CompleteAssignmentForSubmissionParams): Promise<boolean> {
    const assignments = pendingAssignments ?? (await fetchPendingAssignments(userId));
    let match = findMatchingAssignment(assignments, matchNumber, teamNumber);

    if (!match && pendingAssignments) {
        const refreshedAssignments = await fetchPendingAssignments(userId);
        match = findMatchingAssignment(refreshedAssignments, matchNumber, teamNumber);
    }

    if (!match) {
        return false;
    }

    await markAssignmentCompleted(match.id);
    return true;
}
