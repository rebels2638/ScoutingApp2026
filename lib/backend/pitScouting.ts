import AsyncStorage from '@react-native-async-storage/async-storage';
import { Query, type Models } from 'react-native-appwrite';

import { warnWithError } from '../error-utils';
import type {
    ClimbLevel,
    DrivetrainType,
    FuelRange,
    PreloadFullnessReference,
    PrimaryFuelSource,
} from '../types';
import { getAppwriteDatabases } from './client';
import { getBackendConfig } from './config';

const PIT_DATA_CACHE_KEY = '@agath_pit_data_cache';
const PIT_DATA_LAST_FETCHED_KEY = '@agath_pit_data_last_fetched';
const PIT_DATA_REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const PIT_DATA_PAGE_LIMIT = 100;

const drivetrainTypes: readonly DrivetrainType[] = ['Swerve', 'West Coast', 'Mecanum', 'Tank', 'Other'];
const fuelRanges: readonly FuelRange[] = ['1-4', '5-8', '9-12', '13-16', '17+'];
const primaryFuelSources: readonly PrimaryFuelSource[] = ['Neutral Zone', 'Depot', 'Outpost feed', 'Mixed'];
const climbLevels: readonly ClimbLevel[] = ['None', 'Level 1', 'Level 2', 'Level 3'];
const preloadFullnessReferences: readonly PreloadFullnessReference[] = [
    'About half',
    'About three-quarters',
    'Completely full',
];

type UnknownRecord = Record<string, unknown>;
type PitScoutingDocument = Models.DefaultDocument;

export interface PitTeamProfile {
    teamNumber: number;
    drivetrainType: DrivetrainType | null;
    typicalPreloadCount: number | null;
    maxFuelCapacity: FuelRange | null;
    typicalFuelCarried: FuelRange | null;
    primaryFuelSource: PrimaryFuelSource | null;
    canFitTrench: boolean | null;
    climbCapability: ClimbLevel | null;
    estimatedClimbTime: number | null;
    autoRoutines: string | null;
    plansDefense: boolean | null;
    knownIssues: string | null;
    preloadFullnessRef: PreloadFullnessReference | null;
    maxObservedFuel: FuelRange | null;
}

let pendingPitRefresh: Promise<PitTeamProfile[]> | null = null;

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null;
}

function toStringOrNull(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function toIntOrNull(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return null;
    }

    return Math.trunc(value);
}

function toBoolOrNull(value: unknown): boolean | null {
    return typeof value === 'boolean' ? value : null;
}

function toOptionOrNull<T extends string>(value: unknown, options: readonly T[]): T | null {
    const text = toStringOrNull(value);
    if (!text) {
        return null;
    }

    return options.find((option) => option === text) ?? null;
}

function mapDocumentToProfile(doc: PitScoutingDocument): PitTeamProfile | null {
    const record = doc as UnknownRecord;
    const teamNumber = toIntOrNull(record.team_num);

    if (teamNumber == null || teamNumber < 1) {
        return null;
    }

    return {
        teamNumber,
        drivetrainType: toOptionOrNull(record.drivetrain_type, drivetrainTypes),
        typicalPreloadCount: toIntOrNull(record.typical_preload_count),
        maxFuelCapacity: toOptionOrNull(record.max_fuel_capacity, fuelRanges),
        typicalFuelCarried: toOptionOrNull(record.typical_fuel_carried, fuelRanges),
        primaryFuelSource: toOptionOrNull(record.primary_fuel_source, primaryFuelSources),
        canFitTrench: toBoolOrNull(record.can_fit_trench),
        climbCapability: toOptionOrNull(record.climb_capability, climbLevels),
        estimatedClimbTime: toIntOrNull(record.estimated_climb_time),
        autoRoutines: toStringOrNull(record.auto_routines),
        plansDefense: toBoolOrNull(record.plans_defense),
        knownIssues: toStringOrNull(record.known_issues),
        preloadFullnessRef: toOptionOrNull(record.preload_fullness_ref, preloadFullnessReferences),
        maxObservedFuel: toOptionOrNull(record.max_observed_fuel, fuelRanges),
    };
}

function isNullableNumber(value: unknown): boolean {
    return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function isNullableBoolean(value: unknown): boolean {
    return value === null || typeof value === 'boolean';
}

function isNullableString(value: unknown): boolean {
    return value === null || typeof value === 'string';
}

function isNullableOption<T extends string>(value: unknown, options: readonly T[]): boolean {
    return value === null || options.some((option) => option === value);
}

function isPitTeamProfile(value: unknown): value is PitTeamProfile {
    if (!isRecord(value)) {
        return false;
    }

    return (
        typeof value.teamNumber === 'number' &&
        Number.isFinite(value.teamNumber) &&
        value.teamNumber > 0 &&
        isNullableOption(value.drivetrainType, drivetrainTypes) &&
        isNullableNumber(value.typicalPreloadCount) &&
        isNullableOption(value.maxFuelCapacity, fuelRanges) &&
        isNullableOption(value.typicalFuelCarried, fuelRanges) &&
        isNullableOption(value.primaryFuelSource, primaryFuelSources) &&
        isNullableBoolean(value.canFitTrench) &&
        isNullableOption(value.climbCapability, climbLevels) &&
        isNullableNumber(value.estimatedClimbTime) &&
        isNullableString(value.autoRoutines) &&
        isNullableBoolean(value.plansDefense) &&
        isNullableString(value.knownIssues) &&
        isNullableOption(value.preloadFullnessRef, preloadFullnessReferences) &&
        isNullableOption(value.maxObservedFuel, fuelRanges)
    );
}

function hasCachedPitProfiles(data: string | null): boolean {
    if (data == null) {
        return false;
    }

    try {
        return Array.isArray(JSON.parse(data));
    } catch {
        return false;
    }
}

async function cachePitProfiles(profiles: PitTeamProfile[]): Promise<void> {
    await AsyncStorage.setItem(PIT_DATA_CACHE_KEY, JSON.stringify(profiles));
    await AsyncStorage.setItem(PIT_DATA_LAST_FETCHED_KEY, Date.now().toString());
}

async function refreshPitProfiles(): Promise<PitTeamProfile[]> {
    if (pendingPitRefresh) {
        return pendingPitRefresh;
    }

    pendingPitRefresh = (async () => {
        const profiles = await fetchAllPitProfiles();
        await cachePitProfiles(profiles);
        return profiles;
    })();

    try {
        return await pendingPitRefresh;
    } finally {
        pendingPitRefresh = null;
    }
}

export async function fetchAllPitProfiles(): Promise<PitTeamProfile[]> {
    const config = getBackendConfig();
    const collectionId = config?.collectionPitScoutingId;

    if (!config || !collectionId) {
        return [];
    }

    const profiles: PitTeamProfile[] = [];
    let cursorAfter: string | null = null;

    while (true) {
        const queries = [Query.limit(PIT_DATA_PAGE_LIMIT)];
        if (cursorAfter) {
            queries.push(Query.cursorAfter(cursorAfter));
        }

        const response = await getAppwriteDatabases().listDocuments<PitScoutingDocument>({
            databaseId: config.databaseId,
            collectionId,
            queries,
        });

        profiles.push(
            ...response.documents
                .map(mapDocumentToProfile)
                .filter((profile): profile is PitTeamProfile => profile !== null)
        );

        if (response.documents.length < PIT_DATA_PAGE_LIMIT) {
            break;
        }

        const lastDocument = response.documents[response.documents.length - 1];
        if (!lastDocument) {
            break;
        }

        cursorAfter = lastDocument.$id;
    }

    return profiles;
}

export async function getCachedPitProfiles(): Promise<PitTeamProfile[]> {
    try {
        const data = await AsyncStorage.getItem(PIT_DATA_CACHE_KEY);
        if (!data) {
            return [];
        }

        const parsed = JSON.parse(data) as unknown;
        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed.filter(isPitTeamProfile);
    } catch {
        return [];
    }
}

export async function getCachedPitProfileForTeam(teamNumber: number): Promise<PitTeamProfile | null> {
    if (!Number.isFinite(teamNumber) || teamNumber < 1) {
        return null;
    }

    const profiles = await getCachedPitProfiles();
    return profiles.find((profile) => profile.teamNumber === teamNumber) ?? null;
}

export async function shouldRefreshPitData(): Promise<boolean> {
    const [lastFetchedValue, cachedProfilesValue] = await Promise.all([
        AsyncStorage.getItem(PIT_DATA_LAST_FETCHED_KEY),
        AsyncStorage.getItem(PIT_DATA_CACHE_KEY),
    ]);

    if (!lastFetchedValue || !hasCachedPitProfiles(cachedProfilesValue)) {
        return true;
    }

    const lastFetched = Number.parseInt(lastFetchedValue, 10);
    if (!Number.isFinite(lastFetched)) {
        return true;
    }

    return Date.now() - lastFetched >= PIT_DATA_REFRESH_INTERVAL_MS;
}

export async function refreshPitDataIfStale(): Promise<boolean> {
    try {
        const config = getBackendConfig();
        if (!config?.collectionPitScoutingId) {
            return false;
        }

        if (!(await shouldRefreshPitData())) {
            return false;
        }

        await refreshPitProfiles();
        return true;
    } catch (error) {
        warnWithError('Failed to refresh pit scouting data', error);
        return false;
    }
}

export async function forceRefreshPitData(): Promise<PitTeamProfile[]> {
    const config = getBackendConfig();
    if (!config?.collectionPitScoutingId) {
        return [];
    }

    return refreshPitProfiles();
}
