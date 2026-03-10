import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import {
    getLocalDataSnapshot,
    mergeLocalDataSnapshot,
    replaceLocalDataSnapshot,
    sanitizePitScoutingEntries,
    sanitizeScoutingEntries,
    setManagedDataSyncHandler,
    type LocalDataSnapshot,
} from './storage';
import type { PitScoutingEntry, ScoutingEntry } from './types';

const MANAGED_DATA_BUNDLE_FILE_NAME = 'agath-data.json';
const MANAGED_DATA_BUNDLE_FILE_BASENAME = 'agath-data';
const MANAGED_DATA_BUNDLE_SCHEMA_VERSION = 1;
const MANAGED_DATA_STATE_KEY = '@agath_managed_data_file_state';

type UnknownRecord = Record<string, unknown>;

export type ManagedDataSource = 'documents' | 'android-shared-folder';
export type ManagedDataImportMode = 'merge' | 'replace';

interface ManagedDataBundle {
    schemaVersion: number;
    exportedAt: string;
    contentHash: string;
    scoutingEntries: ScoutingEntry[];
    pitScoutingEntries: PitScoutingEntry[];
}

interface ManagedDataState {
    lastSyncedHash: string | null;
    androidDirectoryUri: string | null;
    androidFileUri: string | null;
    pendingExternalChangeSource: ManagedDataSource | null;
}

interface ManagedDataCandidate {
    source: ManagedDataSource;
    fileUri: string;
    modifiedAt: number;
    bundle: ManagedDataBundle;
}

export interface ManagedDataStatus {
    isSupported: boolean;
    lastSyncedHash: string | null;
    internalFileUri: string | null;
    internalFileAvailable: boolean;
    androidDirectoryUri: string | null;
    androidDirectoryConfigured: boolean;
    androidFileUri: string | null;
    androidFileAvailable: boolean;
    availableImportSource: ManagedDataSource | null;
    pendingExternalChangeSource: ManagedDataSource | null;
    localScoutingEntryCount: number;
    localPitScoutingEntryCount: number;
}

export interface ManagedDataSyncResult {
    ok: boolean;
    reason?: 'not_supported' | 'pending_external_changes';
    source?: ManagedDataSource | null;
    internalFileUri?: string | null;
    androidFileUri?: string | null;
    localScoutingEntryCount?: number;
    localPitScoutingEntryCount?: number;
}

export interface ManagedDataImportResult {
    source: ManagedDataSource | 'picked-file';
    mode: ManagedDataImportMode;
    importedScoutingEntryCount: number;
    importedPitScoutingEntryCount: number;
    resultingScoutingEntryCount: number;
    resultingPitScoutingEntryCount: number;
}

export interface AndroidDirectorySelectionResult {
    canceled: boolean;
    directoryUri: string | null;
}

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null;
}

function getDefaultManagedDataState(): ManagedDataState {
    return {
        lastSyncedHash: null,
        androidDirectoryUri: null,
        androidFileUri: null,
        pendingExternalChangeSource: null,
    };
}

function isManagedDataSupported(): boolean {
    return Platform.OS === 'ios' || Platform.OS === 'android';
}

function getInternalManagedDataFileUri(): string | null {
    if (!FileSystem.documentDirectory) {
        return null;
    }

    return `${FileSystem.documentDirectory}${MANAGED_DATA_BUNDLE_FILE_NAME}`;
}

function getFileNameMatch(fileUri: string, fileName: string): boolean {
    const normalizedUri = decodeURIComponent(fileUri).toLowerCase();
    const normalizedFileName = fileName.toLowerCase();

    return (
        normalizedUri.endsWith(`/${normalizedFileName}`) ||
        normalizedUri.endsWith(`:${normalizedFileName}`) ||
        normalizedUri.endsWith(normalizedFileName)
    );
}

async function readManagedDataState(): Promise<ManagedDataState> {
    try {
        const storedValue = await AsyncStorage.getItem(MANAGED_DATA_STATE_KEY);
        if (!storedValue) {
            return getDefaultManagedDataState();
        }

        const parsed = JSON.parse(storedValue) as unknown;
        if (!isRecord(parsed)) {
            return getDefaultManagedDataState();
        }

        return {
            lastSyncedHash: typeof parsed.lastSyncedHash === 'string' ? parsed.lastSyncedHash : null,
            androidDirectoryUri: typeof parsed.androidDirectoryUri === 'string' ? parsed.androidDirectoryUri : null,
            androidFileUri: typeof parsed.androidFileUri === 'string' ? parsed.androidFileUri : null,
            pendingExternalChangeSource:
                parsed.pendingExternalChangeSource === 'documents' || parsed.pendingExternalChangeSource === 'android-shared-folder'
                    ? parsed.pendingExternalChangeSource
                    : null,
        };
    } catch {
        return getDefaultManagedDataState();
    }
}

async function writeManagedDataState(state: ManagedDataState): Promise<void> {
    await AsyncStorage.setItem(MANAGED_DATA_STATE_KEY, JSON.stringify(state));
}

async function computeSnapshotHash(snapshot: LocalDataSnapshot): Promise<string> {
    return await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        JSON.stringify({
            scoutingEntries: snapshot.scoutingEntries,
            pitScoutingEntries: snapshot.pitScoutingEntries,
        })
    );
}

function createManagedDataBundle(snapshot: LocalDataSnapshot, contentHash: string): ManagedDataBundle {
    return {
        schemaVersion: MANAGED_DATA_BUNDLE_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        contentHash,
        scoutingEntries: snapshot.scoutingEntries,
        pitScoutingEntries: snapshot.pitScoutingEntries,
    };
}

function extractSnapshotFromUnknown(value: unknown): LocalDataSnapshot | null {
    if (Array.isArray(value)) {
        const scoutingEntries = sanitizeScoutingEntries(value);
        if (value.length > 0 && scoutingEntries.length === 0) {
            return null;
        }

        return {
            scoutingEntries,
            pitScoutingEntries: [],
        };
    }

    if (!isRecord(value)) {
        return null;
    }

    const rawScoutingEntries = 'scoutingEntries' in value ? value.scoutingEntries : 'entries' in value ? value.entries : null;
    if (!Array.isArray(rawScoutingEntries)) {
        return null;
    }

    const rawPitEntries =
        'pitScoutingEntries' in value
            ? value.pitScoutingEntries
            : 'pitEntries' in value
                ? value.pitEntries
                : [];

    if (!Array.isArray(rawPitEntries)) {
        return null;
    }

    const scoutingEntries = sanitizeScoutingEntries(rawScoutingEntries);
    const pitScoutingEntries = sanitizePitScoutingEntries(rawPitEntries);

    if (rawScoutingEntries.length > 0 && scoutingEntries.length === 0) {
        return null;
    }

    if (rawPitEntries.length > 0 && pitScoutingEntries.length === 0) {
        return null;
    }

    return {
        scoutingEntries,
        pitScoutingEntries,
    };
}

async function parseManagedDataBundle(rawContents: string): Promise<ManagedDataBundle | null> {
    const parsed = JSON.parse(rawContents) as unknown;
    const snapshot = extractSnapshotFromUnknown(parsed);
    if (!snapshot) {
        return null;
    }

    const contentHash = await computeSnapshotHash(snapshot);
    const exportedAt =
        isRecord(parsed) && typeof parsed.exportedAt === 'string'
            ? parsed.exportedAt
            : new Date().toISOString();

    return {
        schemaVersion:
            isRecord(parsed) && typeof parsed.schemaVersion === 'number'
                ? parsed.schemaVersion
                : MANAGED_DATA_BUNDLE_SCHEMA_VERSION,
        exportedAt,
        contentHash,
        scoutingEntries: snapshot.scoutingEntries,
        pitScoutingEntries: snapshot.pitScoutingEntries,
    };
}

async function readBundleCandidate(
    source: ManagedDataSource,
    fileUri: string | null
): Promise<ManagedDataCandidate | null> {
    if (!fileUri) {
        return null;
    }

    try {
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (!fileInfo.exists || fileInfo.isDirectory) {
            return null;
        }

        const rawContents = await FileSystem.readAsStringAsync(fileUri, {
            encoding: FileSystem.EncodingType.UTF8,
        });
        const bundle = await parseManagedDataBundle(rawContents);
        if (!bundle) {
            return null;
        }

        return {
            source,
            fileUri,
            modifiedAt:
                typeof fileInfo.modificationTime === 'number'
                    ? fileInfo.modificationTime * 1000
                    : Date.parse(bundle.exportedAt) || 0,
            bundle,
        };
    } catch {
        return null;
    }
}

async function resolveAndroidManagedDataFileUri(
    state: ManagedDataState,
    createIfMissing: boolean
): Promise<string | null> {
    if (Platform.OS !== 'android' || !state.androidDirectoryUri) {
        return null;
    }

    if (state.androidFileUri) {
        const storedFileInfo = await FileSystem.getInfoAsync(state.androidFileUri);
        if (storedFileInfo.exists && !storedFileInfo.isDirectory) {
            return state.androidFileUri;
        }
    }

    const directoryEntries = await FileSystem.StorageAccessFramework.readDirectoryAsync(state.androidDirectoryUri);
    const existingFileUri = directoryEntries.find((fileUri) => getFileNameMatch(fileUri, MANAGED_DATA_BUNDLE_FILE_NAME)) ?? null;

    if (existingFileUri) {
        await writeManagedDataState({
            ...state,
            androidFileUri: existingFileUri,
        });
        return existingFileUri;
    }

    if (!createIfMissing) {
        return null;
    }

    const createdFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
        state.androidDirectoryUri,
        MANAGED_DATA_BUNDLE_FILE_BASENAME,
        'application/json'
    );

    await writeManagedDataState({
        ...state,
        androidFileUri: createdFileUri,
    });

    return createdFileUri;
}

async function getManagedCandidates(state: ManagedDataState): Promise<ManagedDataCandidate[]> {
    const internalCandidate = await readBundleCandidate('documents', getInternalManagedDataFileUri());
    const androidFileUri = await resolveAndroidManagedDataFileUri(state, false);
    const androidCandidate = await readBundleCandidate('android-shared-folder', androidFileUri);

    return [internalCandidate, androidCandidate].filter((candidate): candidate is ManagedDataCandidate => candidate !== null);
}

function pickLatestCandidate(candidates: ManagedDataCandidate[]): ManagedDataCandidate | null {
    if (candidates.length === 0) {
        return null;
    }

    return [...candidates].sort((left, right) => right.modifiedAt - left.modifiedAt)[0] ?? null;
}

async function readPickedFileContents(uri: string): Promise<string> {
    if (Platform.OS === 'web') {
        const response = await fetch(uri);
        return await response.text();
    }

    return await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.UTF8,
    });
}

async function importSnapshot(
    snapshot: LocalDataSnapshot,
    mode: ManagedDataImportMode
): Promise<LocalDataSnapshot> {
    if (mode === 'replace') {
        await replaceLocalDataSnapshot(snapshot);
        return snapshot;
    }

    return await mergeLocalDataSnapshot(snapshot);
}

async function loadManagedImportCandidate(
    preferredSource?: ManagedDataSource | null
): Promise<ManagedDataCandidate> {
    const state = await readManagedDataState();
    const candidates = await getManagedCandidates(state);

    if (preferredSource) {
        const preferredCandidate = candidates.find((candidate) => candidate.source === preferredSource);
        if (preferredCandidate) {
            return preferredCandidate;
        }
        throw new Error('No managed data file was found in that location.');
    }

    const latestCandidate = pickLatestCandidate(candidates);
    if (!latestCandidate) {
        throw new Error('No managed data file is available yet.');
    }

    return latestCandidate;
}

async function requestAndroidManagedDirectory(): Promise<AndroidDirectorySelectionResult> {
    const state = await readManagedDataState();
    const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(
        state.androidDirectoryUri
    );

    if (!permissions.granted) {
        return {
            canceled: true,
            directoryUri: null,
        };
    }

    const nextState: ManagedDataState = {
        ...state,
        androidDirectoryUri: permissions.directoryUri,
        androidFileUri: null,
    };
    await writeManagedDataState(nextState);

    return {
        canceled: false,
        directoryUri: permissions.directoryUri,
    };
}

export async function getManagedDataStatus(): Promise<ManagedDataStatus> {
    const state = await readManagedDataState();
    const localSnapshot = await getLocalDataSnapshot();
    const localHash = await computeSnapshotHash(localSnapshot);
    const internalFileUri = getInternalManagedDataFileUri();
    const internalFileInfo = internalFileUri ? await FileSystem.getInfoAsync(internalFileUri) : null;
    const androidFileUri = await resolveAndroidManagedDataFileUri(state, false);
    const androidFileInfo = androidFileUri ? await FileSystem.getInfoAsync(androidFileUri) : null;
    const candidates = await getManagedCandidates(state);
    const pendingExternalCandidate = candidates.find(
        (candidate) => candidate.bundle.contentHash !== localHash && candidate.bundle.contentHash !== state.lastSyncedHash
    ) ?? null;
    const latestCandidate = pickLatestCandidate(candidates);

    if (pendingExternalCandidate?.source !== state.pendingExternalChangeSource) {
        await writeManagedDataState({
            ...state,
            androidFileUri: androidFileUri ?? state.androidFileUri,
            pendingExternalChangeSource: pendingExternalCandidate?.source ?? null,
        });
    }

    return {
        isSupported: isManagedDataSupported(),
        lastSyncedHash: state.lastSyncedHash,
        internalFileUri,
        internalFileAvailable: !!internalFileInfo?.exists && !internalFileInfo.isDirectory,
        androidDirectoryUri: state.androidDirectoryUri,
        androidDirectoryConfigured: !!state.androidDirectoryUri,
        androidFileUri,
        androidFileAvailable: !!androidFileInfo?.exists && !androidFileInfo.isDirectory,
        availableImportSource: latestCandidate?.source ?? null,
        pendingExternalChangeSource: pendingExternalCandidate?.source ?? null,
        localScoutingEntryCount: localSnapshot.scoutingEntries.length,
        localPitScoutingEntryCount: localSnapshot.pitScoutingEntries.length,
    };
}

export async function syncManagedDataBundle(
    options: { force?: boolean } = {}
): Promise<ManagedDataSyncResult> {
    if (!isManagedDataSupported()) {
        return {
            ok: false,
            reason: 'not_supported',
        };
    }

    const state = await readManagedDataState();
    const localSnapshot = await getLocalDataSnapshot();
    const localHash = await computeSnapshotHash(localSnapshot);
    const candidates = await getManagedCandidates(state);
    const pendingExternalCandidate = candidates.find(
        (candidate) => candidate.bundle.contentHash !== localHash && candidate.bundle.contentHash !== state.lastSyncedHash
    ) ?? null;

    if (pendingExternalCandidate && !options.force) {
        await writeManagedDataState({
            ...state,
            pendingExternalChangeSource: pendingExternalCandidate.source,
        });

        return {
            ok: false,
            reason: 'pending_external_changes',
            source: pendingExternalCandidate.source,
            internalFileUri: getInternalManagedDataFileUri(),
            androidFileUri: state.androidFileUri,
            localScoutingEntryCount: localSnapshot.scoutingEntries.length,
            localPitScoutingEntryCount: localSnapshot.pitScoutingEntries.length,
        };
    }

    const bundle = createManagedDataBundle(localSnapshot, localHash);
    const serializedBundle = JSON.stringify(bundle, null, 4);
    const internalFileUri = getInternalManagedDataFileUri();

    if (internalFileUri) {
        await FileSystem.writeAsStringAsync(internalFileUri, serializedBundle, {
            encoding: FileSystem.EncodingType.UTF8,
        });
    }

    const androidFileUri = await resolveAndroidManagedDataFileUri(state, true);
    if (androidFileUri) {
        await FileSystem.StorageAccessFramework.writeAsStringAsync(androidFileUri, serializedBundle, {
            encoding: FileSystem.EncodingType.UTF8,
        });
    }

    await writeManagedDataState({
        ...state,
        lastSyncedHash: localHash,
        androidFileUri,
        pendingExternalChangeSource: null,
    });

    return {
        ok: true,
        internalFileUri,
        androidFileUri,
        localScoutingEntryCount: localSnapshot.scoutingEntries.length,
        localPitScoutingEntryCount: localSnapshot.pitScoutingEntries.length,
    };
}

setManagedDataSyncHandler(syncManagedDataBundle);

export async function chooseAndroidManagedDataDirectory(): Promise<AndroidDirectorySelectionResult> {
    if (Platform.OS !== 'android') {
        return {
            canceled: true,
            directoryUri: null,
        };
    }

    return await requestAndroidManagedDirectory();
}

export async function importManagedDataBundle(
    mode: ManagedDataImportMode,
    source?: ManagedDataSource | null
): Promise<ManagedDataImportResult> {
    const candidate = await loadManagedImportCandidate(source);
    const snapshot = {
        scoutingEntries: candidate.bundle.scoutingEntries,
        pitScoutingEntries: candidate.bundle.pitScoutingEntries,
    };
    const resultingSnapshot = await importSnapshot(snapshot, mode);

    await syncManagedDataBundle({ force: true });

    return {
        source: candidate.source,
        mode,
        importedScoutingEntryCount: snapshot.scoutingEntries.length,
        importedPitScoutingEntryCount: snapshot.pitScoutingEntries.length,
        resultingScoutingEntryCount: resultingSnapshot.scoutingEntries.length,
        resultingPitScoutingEntryCount: resultingSnapshot.pitScoutingEntries.length,
    };
}

export async function importPickedDataBundle(
    mode: ManagedDataImportMode
): Promise<ManagedDataImportResult | null> {
    const pickerResult = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/json', 'text/plain'],
        copyToCacheDirectory: true,
        multiple: false,
    });

    if (pickerResult.canceled || !pickerResult.assets?.[0]) {
        return null;
    }

    const pickedAsset = pickerResult.assets[0];
    const rawContents = await readPickedFileContents(pickedAsset.uri);
    const bundle = await parseManagedDataBundle(rawContents);
    if (!bundle) {
        throw new Error('The selected file is not a valid Agath data bundle.');
    }

    const snapshot = {
        scoutingEntries: bundle.scoutingEntries,
        pitScoutingEntries: bundle.pitScoutingEntries,
    };
    const resultingSnapshot = await importSnapshot(snapshot, mode);

    await syncManagedDataBundle({ force: true });

    return {
        source: 'picked-file',
        mode,
        importedScoutingEntryCount: snapshot.scoutingEntries.length,
        importedPitScoutingEntryCount: snapshot.pitScoutingEntries.length,
        resultingScoutingEntryCount: resultingSnapshot.scoutingEntries.length,
        resultingPitScoutingEntryCount: resultingSnapshot.pitScoutingEntries.length,
    };
}