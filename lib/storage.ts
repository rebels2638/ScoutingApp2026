import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { errorWithError } from './error-utils';
import type { PitScoutingEntry, ScoutingEntry, ScoutingEntrySyncStatus } from './types';

const SCOUTING_ENTRIES_KEY = '@agath_scouting_entries';
const PIT_SCOUTING_ENTRIES_KEY = '@agath_pit_scouting_entries';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function isNullableFiniteNumber(value: unknown): value is number | null {
    return value === null || isFiniteNumber(value);
}

function isNullableString(value: unknown): value is string | null {
    return value === null || typeof value === 'string';
}

function isNullableBoolean(value: unknown): value is boolean | null {
    return value === null || typeof value === 'boolean';
}

function isScoutingEntrySyncStatus(value: unknown): value is ScoutingEntrySyncStatus {
    return value === 'local' || value === 'queued' || value === 'synced';
}

function normalizeScoutingEntry(entry: ScoutingEntry): ScoutingEntry {
    const syncStatus = isScoutingEntrySyncStatus(entry.syncStatus) ? entry.syncStatus : 'local';
    const syncedAt = syncStatus === 'synced' && isFiniteNumber(entry.syncedAt) ? entry.syncedAt : null;

    return {
        ...entry,
        syncStatus,
        syncedAt,
    };
}

function isScoutingEntry(value: unknown): value is ScoutingEntry {
    if (
        !isRecord(value) ||
        typeof value.id !== 'string' ||
        !isFiniteNumber(value.timestamp) ||
        (value.syncStatus !== undefined && !isScoutingEntrySyncStatus(value.syncStatus)) ||
        (value.syncedAt !== undefined && !isNullableFiniteNumber(value.syncedAt))
    ) {
        return false;
    }

    const matchMetadata = value.matchMetadata;
    const autonomous = value.autonomous;
    const teleop = value.teleop;
    const activePhase = value.activePhase;
    const inactivePhase = value.inactivePhase;
    const endgame = value.endgame;

    return (
        isRecord(matchMetadata) &&
        isFiniteNumber(matchMetadata.matchNumber) &&
        typeof matchMetadata.matchType === 'string' &&
        isFiniteNumber(matchMetadata.teamNumber) &&
        typeof matchMetadata.allianceColor === 'string' &&
        isRecord(autonomous) &&
        isNullableFiniteNumber(autonomous.preloadCount) &&
        typeof autonomous.leftStartingLine === 'boolean' &&
        typeof autonomous.crossedCenterLine === 'boolean' &&
        typeof autonomous.fuelScoredBucket === 'string' &&
        typeof autonomous.climbResult === 'string' &&
        typeof autonomous.eligibleForAutoClimbPoints === 'boolean' &&
        isRecord(teleop) &&
        isFiniteNumber(teleop.scoringCyclesActive) &&
        isFiniteNumber(teleop.wastedCyclesInactive) &&
        isNullableString(teleop.typicalFuelCarried) &&
        isNullableString(teleop.primaryFuelSource) &&
        isNullableBoolean(teleop.usesTrenchRoutes) &&
        typeof teleop.playsDefense === 'boolean' &&
        isRecord(activePhase) &&
        typeof activePhase.feedsFuelToAllianceZone === 'boolean' &&
        typeof activePhase.playsOffenseOnly === 'boolean' &&
        typeof activePhase.playsSomeDefenseWhileActive === 'boolean' &&
        isRecord(inactivePhase) &&
        typeof inactivePhase.holdsFuelAndWaits === 'boolean' &&
        typeof inactivePhase.feedsFuelToAllianceZone === 'boolean' &&
        typeof inactivePhase.collectsFromNeutralZone === 'boolean' &&
        typeof inactivePhase.playsDefense === 'boolean' &&
        typeof inactivePhase.stillShootsAnyway === 'boolean' &&
        isRecord(endgame) &&
        typeof endgame.attemptedClimb === 'boolean' &&
        typeof endgame.climbLevelAchieved === 'string' &&
        typeof endgame.climbSuccessState === 'string' &&
        isFiniteNumber(endgame.timeToClimb) &&
        typeof endgame.parkedButNoClimb === 'boolean' &&
        typeof endgame.breakdown === 'boolean' &&
        typeof endgame.mobilityIssues === 'string' &&
        Array.isArray(endgame.cards) &&
        endgame.cards.every((card) => typeof card === 'string') &&
        typeof endgame.extraComments === 'string'
    );
}

function isPitScoutingEntry(value: unknown): value is PitScoutingEntry {
    if (!isRecord(value) || typeof value.id !== 'string' || !isFiniteNumber(value.timestamp)) {
        return false;
    }

    const calibration = value.calibration;

    return (
        isFiniteNumber(value.teamNumber) &&
        isRecord(calibration) &&
        typeof calibration.preloadFullnessReference === 'string' &&
        typeof calibration.maxObservedFuel === 'string'
    );
}

function parseStoredEntries<T>(
    data: string | null,
    guard: (value: unknown) => value is T,
    label: string
): T[] {
    if (!data) {
        return [];
    }

    try {
        const parsed = JSON.parse(data) as unknown;
        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed.filter(guard);
    } catch (error) {
        errorWithError(`Error getting ${label}`, error);
        return [];
    }
}

export async function saveScoutingEntry(entry: ScoutingEntry): Promise<void> {
    try {
        const existingData = await getScoutingEntries();
        const updatedData = [...existingData, normalizeScoutingEntry(entry)];
        await AsyncStorage.setItem(SCOUTING_ENTRIES_KEY, JSON.stringify(updatedData));
    } catch (error) {
        errorWithError('Error saving scouting entry', error);
        throw error;
    }
}

export async function getScoutingEntries(): Promise<ScoutingEntry[]> {
    try {
        const data = await AsyncStorage.getItem(SCOUTING_ENTRIES_KEY);
        return parseStoredEntries(data, isScoutingEntry, 'scouting entries').map(normalizeScoutingEntry);
    } catch (error) {
        errorWithError('Error getting scouting entries', error);
        return [];
    }
}

export async function getScoutingEntryById(id: string): Promise<ScoutingEntry | null> {
    try {
        const entries = await getScoutingEntries();
        return entries.find((entry) => entry.id === id) ?? null;
    } catch (error) {
        errorWithError('Error getting scouting entry by id', error);
        return null;
    }
}

export async function deleteScoutingEntry(id: string): Promise<void> {
    try {
        const existingData = await getScoutingEntries();
        const updatedData = existingData.filter((entry) => entry.id !== id);
        await AsyncStorage.setItem(SCOUTING_ENTRIES_KEY, JSON.stringify(updatedData));
    } catch (error) {
        errorWithError('Error deleting scouting entry', error);
        throw error;
    }
}

export async function updateScoutingEntry(updatedEntry: ScoutingEntry): Promise<void> {
    try {
        const existingData = await getScoutingEntries();
        const normalizedEntry = normalizeScoutingEntry(updatedEntry);
        const updatedData = existingData.map((entry) =>
            entry.id === normalizedEntry.id ? normalizedEntry : entry
        );
        await AsyncStorage.setItem(SCOUTING_ENTRIES_KEY, JSON.stringify(updatedData));
    } catch (error) {
        errorWithError('Error updating scouting entry', error);
        throw error;
    }
}

export async function upsertScoutingEntry(entry: ScoutingEntry): Promise<'created' | 'updated'> {
    try {
        const existingData = await getScoutingEntries();
        const normalizedEntry = normalizeScoutingEntry(entry);
        const hasExistingEntry = existingData.some((existingEntry) => existingEntry.id === normalizedEntry.id);
        const updatedData = hasExistingEntry
            ? existingData.map((existingEntry) =>
                existingEntry.id === normalizedEntry.id ? normalizedEntry : existingEntry
            )
            : [...existingData, normalizedEntry];

        await AsyncStorage.setItem(SCOUTING_ENTRIES_KEY, JSON.stringify(updatedData));
        return hasExistingEntry ? 'updated' : 'created';
    } catch (error) {
        errorWithError('Error upserting scouting entry', error);
        throw error;
    }
}

export async function setScoutingEntrySyncStatus(
    id: string,
    syncStatus: ScoutingEntrySyncStatus,
    syncedAt?: number | null
): Promise<void> {
    try {
        const existingData = await getScoutingEntries();
        const nextSyncedAt = syncStatus === 'synced' ? syncedAt ?? Date.now() : null;
        const updatedData = existingData.map((entry) =>
            entry.id === id
                ? normalizeScoutingEntry({
                    ...entry,
                    syncStatus,
                    syncedAt: nextSyncedAt,
                })
                : entry
        );
        await AsyncStorage.setItem(SCOUTING_ENTRIES_KEY, JSON.stringify(updatedData));
    } catch (error) {
        errorWithError('Error updating scouting entry sync status', error);
        throw error;
    }
}

export async function clearAllScoutingEntries(): Promise<void> {
    try {
        await AsyncStorage.removeItem(SCOUTING_ENTRIES_KEY);
    } catch (error) {
        errorWithError('Error clearing scouting entries', error);
        throw error;
    }
}

export async function savePitScoutingEntry(entry: PitScoutingEntry): Promise<void> {
    try {
        const existingData = await getPitScoutingEntries();

        const existingIndex = existingData.findIndex((e) => e.teamNumber === entry.teamNumber);
        if (existingIndex >= 0) {
            existingData[existingIndex] = entry;
        } else {
            existingData.push(entry);
        }
        await AsyncStorage.setItem(PIT_SCOUTING_ENTRIES_KEY, JSON.stringify(existingData));
    } catch (error) {
        errorWithError('Error saving pit scouting entry', error);
        throw error;
    }
}

export async function getPitScoutingEntries(): Promise<PitScoutingEntry[]> {
    try {
        const data = await AsyncStorage.getItem(PIT_SCOUTING_ENTRIES_KEY);
        return parseStoredEntries(data, isPitScoutingEntry, 'pit scouting entries');
    } catch (error) {
        errorWithError('Error getting pit scouting entries', error);
        return [];
    }
}

export async function getPitScoutingEntryByTeam(teamNumber: number): Promise<PitScoutingEntry | null> {
    try {
        const entries = await getPitScoutingEntries();
        return entries.find((e) => e.teamNumber === teamNumber) || null;
    } catch (error) {
        errorWithError('Error getting pit scouting entry by team', error);
        return null;
    }
}

export function generateId(): string {
    return Crypto.randomUUID();
}
