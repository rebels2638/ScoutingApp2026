import AsyncStorage from '@react-native-async-storage/async-storage';
import { Query, type Models } from 'react-native-appwrite';

import { warnWithError } from '../error-utils';
import { isFuelCountLabel, sanitizeFuelCountLabel } from '../fuel';
import { getAppwriteDatabases } from './client';
import { getBackendConfig } from './config';

const PIT_DATA_CACHE_KEY = '@agath_pit_data_cache';
const PIT_DATA_LAST_FETCHED_KEY = '@agath_pit_data_last_fetched';
const PIT_DATA_CACHE_VERSION_KEY = '@agath_pit_data_cache_version';
const PIT_DATA_CACHE_VERSION = '3';
const PIT_DATA_REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const PIT_DATA_PAGE_LIMIT = 100;

const truthyTextValues = new Set(['true', '1', 'yes', 'y']);
const falsyTextValues = new Set(['false', '0', 'no', 'n']);
const teamNumberKeys = ['team_num', 'team_number', 'teamNumber', 'team'] as const;
const drivetrainTypeKeys = ['drivetrain_type', 'drivetrainType', 'drivetrain'] as const;
const typicalPreloadCountKeys = ['typical_preload_count', 'typicalPreloadCount', 'preload_count', 'preloadCount'] as const;
const maxFuelCapacityKeys = ['max_fuel_capacity', 'maxFuelCapacity'] as const;
const typicalFuelCarriedKeys = ['typical_fuel_carried', 'typicalFuelCarried'] as const;
const primaryFuelSourceKeys = ['primary_fuel_source', 'primaryFuelSource'] as const;
const canFitTrenchKeys = ['can_fit_trench', 'canFitTrench'] as const;
const climbCapabilityKeys = ['climb_capability', 'climbCapability'] as const;
const estimatedClimbTimeKeys = ['estimated_climb_time', 'estimatedClimbTime'] as const;
const autoRoutinesKeys = ['auto_routines', 'autoRoutines'] as const;
const plansDefenseKeys = ['plans_defense', 'plansDefense'] as const;
const knownIssuesKeys = ['known_issues', 'knownIssues'] as const;
const preloadFullnessRefKeys = ['preload_fullness_ref', 'preloadFullnessRef'] as const;
const maxObservedFuelKeys = ['max_observed_fuel', 'maxObservedFuel'] as const;

type UnknownRecord = Record<string, unknown>;
type PitScoutingDocument = Models.DefaultDocument;
type PitDataRefreshListener = () => void;

interface PitTeamProfileCandidate {
    profile: PitTeamProfile;
    requiredFieldCount: number;
    populatedFieldCount: number;
    updatedAtMs: number;
}

export interface PitTeamProfile {
    teamNumber: number;
    drivetrainType: string | null;
    typicalPreloadCount: number | null;
    maxFuelCapacity: string | null;
    typicalFuelCarried: string | null;
    primaryFuelSource: string | null;
    canFitTrench: boolean | null;
    climbCapability: string | null;
    estimatedClimbTime: number | null;
    autoRoutines: string | null;
    plansDefense: boolean | null;
    knownIssues: string | null;
    preloadFullnessRef: string | null;
    maxObservedFuel: string | null;
}

let pendingPitRefresh: Promise<PitTeamProfile[]> | null = null;
const pitDataRefreshListeners = new Set<PitDataRefreshListener>();

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null;
}

function getFirstValue(record: UnknownRecord, keys: readonly string[]): unknown {
    for (const key of keys) {
        if (key in record) {
            return record[key];
        }
    }

    return undefined;
}

function toStringOrNull(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function toIntOrNull(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.trunc(value);
    }

    const text = toStringOrNull(value);
    if (!text) {
        return null;
    }

    const parsed = Number(text);
    if (!Number.isFinite(parsed)) {
        return null;
    }

    return Math.trunc(parsed);
}

function toBoolOrNull(value: unknown): boolean | null {
    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'number') {
        if (value === 1) {
            return true;
        }
        if (value === 0) {
            return false;
        }
    }

    const text = toStringOrNull(value)?.toLowerCase();
    if (!text) {
        return null;
    }

    if (truthyTextValues.has(text)) {
        return true;
    }
    if (falsyTextValues.has(text)) {
        return false;
    }

    return null;
}

function countRequiredPitFields(profile: PitTeamProfile): number {
    return [
        profile.typicalPreloadCount,
        profile.typicalFuelCarried !== null && isFuelCountLabel(profile.typicalFuelCarried)
            ? profile.typicalFuelCarried
            : null,
        profile.primaryFuelSource,
        profile.canFitTrench,
    ].filter((value) => value !== null).length;
}

function countPopulatedPitFields(profile: PitTeamProfile): number {
    return [
        profile.drivetrainType,
        profile.typicalPreloadCount,
        profile.maxFuelCapacity,
        profile.typicalFuelCarried,
        profile.primaryFuelSource,
        profile.canFitTrench,
        profile.climbCapability,
        profile.estimatedClimbTime,
        profile.autoRoutines,
        profile.plansDefense,
        profile.knownIssues,
        profile.preloadFullnessRef,
        profile.maxObservedFuel,
    ].filter((value) => value !== null).length;
}

function toTimestampMs(value: string | undefined): number {
    if (!value) {
        return 0;
    }

    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function shouldPreferPitProfile(
    nextProfile: PitTeamProfile,
    currentProfile: PitTeamProfile
): boolean {
    const nextRequiredFieldCount = countRequiredPitFields(nextProfile);
    const currentRequiredFieldCount = countRequiredPitFields(currentProfile);
    if (nextRequiredFieldCount !== currentRequiredFieldCount) {
        return nextRequiredFieldCount > currentRequiredFieldCount;
    }

    const nextPopulatedFieldCount = countPopulatedPitFields(nextProfile);
    const currentPopulatedFieldCount = countPopulatedPitFields(currentProfile);
    return nextPopulatedFieldCount >= currentPopulatedFieldCount;
}

function shouldPreferPitProfileCandidate(
    nextCandidate: PitTeamProfileCandidate,
    currentCandidate: PitTeamProfileCandidate
): boolean {
    if (nextCandidate.requiredFieldCount !== currentCandidate.requiredFieldCount) {
        return nextCandidate.requiredFieldCount > currentCandidate.requiredFieldCount;
    }
    if (nextCandidate.populatedFieldCount !== currentCandidate.populatedFieldCount) {
        return nextCandidate.populatedFieldCount > currentCandidate.populatedFieldCount;
    }

    return nextCandidate.updatedAtMs >= currentCandidate.updatedAtMs;
}

function mapDocumentToProfile(doc: PitScoutingDocument): PitTeamProfileCandidate | null {
    const record = doc as UnknownRecord;
    const teamNumber = toIntOrNull(getFirstValue(record, teamNumberKeys));

    if (teamNumber == null || teamNumber < 1) {
        return null;
    }

    const profile: PitTeamProfile = {
        teamNumber,
        drivetrainType: toStringOrNull(getFirstValue(record, drivetrainTypeKeys)),
        typicalPreloadCount: toIntOrNull(getFirstValue(record, typicalPreloadCountKeys)),
        maxFuelCapacity: toStringOrNull(getFirstValue(record, maxFuelCapacityKeys)),
        typicalFuelCarried: sanitizeFuelCountLabel(toStringOrNull(getFirstValue(record, typicalFuelCarriedKeys))),
        primaryFuelSource: toStringOrNull(getFirstValue(record, primaryFuelSourceKeys)),
        canFitTrench: toBoolOrNull(getFirstValue(record, canFitTrenchKeys)),
        climbCapability: toStringOrNull(getFirstValue(record, climbCapabilityKeys)),
        estimatedClimbTime: toIntOrNull(getFirstValue(record, estimatedClimbTimeKeys)),
        autoRoutines: toStringOrNull(getFirstValue(record, autoRoutinesKeys)),
        plansDefense: toBoolOrNull(getFirstValue(record, plansDefenseKeys)),
        knownIssues: toStringOrNull(getFirstValue(record, knownIssuesKeys)),
        preloadFullnessRef: toStringOrNull(getFirstValue(record, preloadFullnessRefKeys)),
        maxObservedFuel: sanitizeFuelCountLabel(toStringOrNull(getFirstValue(record, maxObservedFuelKeys))),
    };

    return {
        profile,
        requiredFieldCount: countRequiredPitFields(profile),
        populatedFieldCount: countPopulatedPitFields(profile),
        updatedAtMs: toTimestampMs(doc.$updatedAt || doc.$createdAt),
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

function isPitTeamProfile(value: unknown): value is PitTeamProfile {
    if (!isRecord(value)) {
        return false;
    }

    return (
        typeof value.teamNumber === 'number' &&
        Number.isFinite(value.teamNumber) &&
        value.teamNumber > 0 &&
        isNullableString(value.drivetrainType) &&
        isNullableNumber(value.typicalPreloadCount) &&
        isNullableString(value.maxFuelCapacity) &&
        isNullableString(value.typicalFuelCarried) &&
        isNullableString(value.primaryFuelSource) &&
        isNullableBoolean(value.canFitTrench) &&
        isNullableString(value.climbCapability) &&
        isNullableNumber(value.estimatedClimbTime) &&
        isNullableString(value.autoRoutines) &&
        isNullableBoolean(value.plansDefense) &&
        isNullableString(value.knownIssues) &&
        isNullableString(value.preloadFullnessRef) &&
        isNullableString(value.maxObservedFuel)
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
    await Promise.all([
        AsyncStorage.setItem(PIT_DATA_CACHE_KEY, JSON.stringify(profiles)),
        AsyncStorage.setItem(PIT_DATA_LAST_FETCHED_KEY, Date.now().toString()),
        AsyncStorage.setItem(PIT_DATA_CACHE_VERSION_KEY, PIT_DATA_CACHE_VERSION),
    ]);
}

function notifyPitDataRefreshed(): void {
    for (const listener of pitDataRefreshListeners) {
        listener();
    }
}

export function subscribeToPitDataRefresh(listener: PitDataRefreshListener): () => void {
    pitDataRefreshListeners.add(listener);
    return () => {
        pitDataRefreshListeners.delete(listener);
    };
}

async function refreshPitProfiles(): Promise<PitTeamProfile[]> {
    if (pendingPitRefresh) {
        return pendingPitRefresh;
    }

    pendingPitRefresh = (async () => {
        const profiles = await fetchAllPitProfiles();
        await cachePitProfiles(profiles);
        notifyPitDataRefreshed();
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

    const profilesByTeamNumber = new Map<number, PitTeamProfileCandidate>();
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

        for (const candidate of response.documents
            .map(mapDocumentToProfile)
            .filter((profile): profile is PitTeamProfileCandidate => profile !== null)) {
            const existingCandidate = profilesByTeamNumber.get(candidate.profile.teamNumber);
            if (!existingCandidate || shouldPreferPitProfileCandidate(candidate, existingCandidate)) {
                profilesByTeamNumber.set(candidate.profile.teamNumber, candidate);
            }
        }

        if (response.documents.length < PIT_DATA_PAGE_LIMIT) {
            break;
        }

        const lastDocument = response.documents[response.documents.length - 1];
        if (!lastDocument) {
            break;
        }

        cursorAfter = lastDocument.$id;
    }

    return Array.from(profilesByTeamNumber.values(), (candidate) => candidate.profile);
}

export async function getCachedPitProfiles(): Promise<PitTeamProfile[]> {
    try {
        const [cacheVersion, data] = await Promise.all([
            AsyncStorage.getItem(PIT_DATA_CACHE_VERSION_KEY),
            AsyncStorage.getItem(PIT_DATA_CACHE_KEY),
        ]);
        if (cacheVersion !== PIT_DATA_CACHE_VERSION || !data) {
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
    let preferredProfile: PitTeamProfile | null = null;

    for (const profile of profiles) {
        if (profile.teamNumber !== teamNumber) {
            continue;
        }

        if (!preferredProfile || shouldPreferPitProfile(profile, preferredProfile)) {
            preferredProfile = profile;
        }
    }

    return preferredProfile;
}

export async function shouldRefreshPitData(): Promise<boolean> {
    const [cacheVersion, lastFetchedValue, cachedProfilesValue] = await Promise.all([
        AsyncStorage.getItem(PIT_DATA_CACHE_VERSION_KEY),
        AsyncStorage.getItem(PIT_DATA_LAST_FETCHED_KEY),
        AsyncStorage.getItem(PIT_DATA_CACHE_KEY),
    ]);

    if (cacheVersion !== PIT_DATA_CACHE_VERSION || !lastFetchedValue || !hasCachedPitProfiles(cachedProfilesValue)) {
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
