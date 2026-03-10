import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import {
    getLocalDataSnapshot,
    mergeLocalDataSnapshot,
    replaceLocalDataSnapshot,
    sanitizePitScoutingEntries,
    sanitizeScoutingEntries,
    type LocalDataSnapshot,
} from './storage';
import type { FuelRange, PitScoutingEntry, PreloadFullnessReference, ScoutingEntry } from './types';

const DATA_BUNDLE_SCHEMA_VERSION = 1;
const DATA_BUNDLE_FILE_PREFIX = 'agath-data';
const DATA_BUNDLE_EXPORT_DIRECTORY = 'exports';

const PRELOAD_FULLNESS_REFERENCE_VALUES: readonly PreloadFullnessReference[] = [
    'About half',
    'About three-quarters',
    'Completely full',
];
const FUEL_RANGE_VALUES: readonly FuelRange[] = ['1-4', '5-8', '9-12', '13-16', '17+'];

type UnknownRecord = Record<string, unknown>;
type ManagedDataExportDestination = 'android-folder' | 'share-sheet' | 'download';

export type ManagedDataImportMode = 'merge' | 'replace';

interface ManagedDataBundle {
    schemaVersion: number;
    exportedAt: string;
    contentHash: string;
    scoutingEntries: ScoutingEntry[];
    pitScoutingEntries?: PitScoutingEntry[];
}

export interface ManagedDataStatus {
    isSupported: boolean;
    localScoutingEntryCount: number;
    localPitScoutingEntryCount: number;
}

export interface ManagedDataExportResult {
    destination: ManagedDataExportDestination;
    fileName: string;
    exportedScoutingEntryCount: number;
}

export interface ManagedDataImportResult {
    source: 'picked-file';
    mode: ManagedDataImportMode;
    fileName: string | null;
    importedScoutingEntryCount: number;
    importedPitScoutingEntryCount: number;
    resultingScoutingEntryCount: number;
    resultingPitScoutingEntryCount: number;
}

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null;
}

function isManagedDataSupported(): boolean {
    return Platform.OS === 'android' || Platform.OS === 'ios' || Platform.OS === 'web';
}

function padNumber(value: number): string {
    return `${value}`.padStart(2, '0');
}

function buildDataBundleFileName(date = new Date()): string {
    return `${DATA_BUNDLE_FILE_PREFIX}-${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}-${padNumber(date.getHours())}${padNumber(date.getMinutes())}${padNumber(date.getSeconds())}-${`${date.getMilliseconds()}`.padStart(3, '0')}.json`;
}

function getDataBundleFileStem(fileName: string): string {
    return fileName.endsWith('.json') ? fileName.slice(0, -'.json'.length) : fileName;
}

function toFiniteNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value !== 'string') {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function toStringOrNull(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function toPreloadFullnessReference(value: unknown): PreloadFullnessReference | null {
    const normalized = toStringOrNull(value);
    if (!normalized) {
        return null;
    }

    return PRELOAD_FULLNESS_REFERENCE_VALUES.includes(normalized as PreloadFullnessReference)
        ? normalized as PreloadFullnessReference
        : null;
}

function toFuelRange(value: unknown): FuelRange | null {
    const normalized = toStringOrNull(value);
    if (!normalized) {
        return null;
    }

    return FUEL_RANGE_VALUES.includes(normalized as FuelRange)
        ? normalized as FuelRange
        : null;
}

function derivePreloadFullnessReference(
    explicitValue: unknown,
    typicalPreloadCountValue: unknown
): PreloadFullnessReference | null {
    const explicitReference = toPreloadFullnessReference(explicitValue);
    if (explicitReference) {
        return explicitReference;
    }

    const typicalPreloadCount = toFiniteNumber(typicalPreloadCountValue);
    if (typicalPreloadCount === null) {
        return null;
    }

    if (typicalPreloadCount >= 4) {
        return 'Completely full';
    }

    if (typicalPreloadCount >= 3) {
        return 'About three-quarters';
    }

    return 'About half';
}

function deriveFuelRange(...candidateValues: unknown[]): FuelRange | null {
    for (const candidateValue of candidateValues) {
        const fuelRange = toFuelRange(candidateValue);
        if (fuelRange) {
            return fuelRange;
        }
    }

    return null;
}

function buildPitScoutingEntriesFromPitProfiles(
    value: unknown,
    exportedAt: string
): PitScoutingEntry[] {
    if (!Array.isArray(value)) {
        return [];
    }

    const fallbackTimestamp = Date.parse(exportedAt);
    const timestamp = Number.isFinite(fallbackTimestamp) ? fallbackTimestamp : Date.now();

    return value.flatMap((item) => {
        if (!isRecord(item)) {
            return [];
        }

        const teamNumber = toFiniteNumber(item.teamNumber);
        const preloadFullnessReference = derivePreloadFullnessReference(
            item.preloadFullnessRef,
            item.typicalPreloadCount
        );
        const maxObservedFuel = deriveFuelRange(
            item.maxObservedFuel,
            item.typicalFuelCarried,
            item.maxFuelCapacity
        );

        if (!teamNumber || !preloadFullnessReference || !maxObservedFuel) {
            return [];
        }

        return [{
            id: `admin-pit-${teamNumber}`,
            timestamp,
            teamNumber,
            calibration: {
                preloadFullnessReference,
                maxObservedFuel,
            },
        }];
    });
}

async function computeSnapshotHash(
    snapshot: Pick<LocalDataSnapshot, 'scoutingEntries'> & Partial<Pick<LocalDataSnapshot, 'pitScoutingEntries'>>
): Promise<string> {
    const hashPayload: {
        scoutingEntries: ScoutingEntry[];
        pitScoutingEntries?: PitScoutingEntry[];
    } = {
        scoutingEntries: snapshot.scoutingEntries,
    };

    if (snapshot.pitScoutingEntries !== undefined) {
        hashPayload.pitScoutingEntries = snapshot.pitScoutingEntries;
    }

    return await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        JSON.stringify(hashPayload)
    );
}

function createManagedDataBundle(
    snapshot: Pick<LocalDataSnapshot, 'scoutingEntries'>,
    contentHash: string
): ManagedDataBundle {
    return {
        schemaVersion: DATA_BUNDLE_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        contentHash,
        scoutingEntries: snapshot.scoutingEntries,
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

    const exportedAt = typeof value.exportedAt === 'string' ? value.exportedAt : new Date().toISOString();
    const scoutingEntries = sanitizeScoutingEntries(rawScoutingEntries);
    if (rawScoutingEntries.length > 0 && scoutingEntries.length === 0) {
        return null;
    }

    let pitScoutingEntries: PitScoutingEntry[] = [];

    if ('pitScoutingEntries' in value || 'pitEntries' in value) {
        const rawPitEntries = 'pitScoutingEntries' in value ? value.pitScoutingEntries : value.pitEntries;
        if (!Array.isArray(rawPitEntries)) {
            return null;
        }

        pitScoutingEntries = sanitizePitScoutingEntries(rawPitEntries);
        if (rawPitEntries.length > 0 && pitScoutingEntries.length === 0) {
            return null;
        }
    } else if ('pitProfiles' in value) {
        pitScoutingEntries = buildPitScoutingEntriesFromPitProfiles(value.pitProfiles, exportedAt);
    }

    return {
        scoutingEntries,
        pitScoutingEntries,
    };
}

async function parseManagedDataBundle(rawContents: string): Promise<ManagedDataBundle | null> {
    try {
        const parsed = JSON.parse(rawContents) as unknown;
        const snapshot = extractSnapshotFromUnknown(parsed);
        if (!snapshot) {
            return null;
        }

        const exportedAt = isRecord(parsed) && typeof parsed.exportedAt === 'string'
            ? parsed.exportedAt
            : new Date().toISOString();
        const contentHash = await computeSnapshotHash(snapshot);

        return {
            schemaVersion:
                isRecord(parsed) && typeof parsed.schemaVersion === 'number'
                    ? parsed.schemaVersion
                    : DATA_BUNDLE_SCHEMA_VERSION,
            exportedAt,
            contentHash,
            scoutingEntries: snapshot.scoutingEntries,
            pitScoutingEntries: snapshot.pitScoutingEntries,
        };
    } catch {
        return null;
    }
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

async function writeExportBundleToCache(fileName: string, serializedBundle: string): Promise<string> {
    if (!FileSystem.cacheDirectory) {
        throw new Error('No writable cache directory is available for export.');
    }

    const exportDirectoryUri = `${FileSystem.cacheDirectory}${DATA_BUNDLE_EXPORT_DIRECTORY}/`;
    await FileSystem.makeDirectoryAsync(exportDirectoryUri, {
        intermediates: true,
    });

    const fileUri = `${exportDirectoryUri}${fileName}`;
    await FileSystem.writeAsStringAsync(fileUri, serializedBundle, {
        encoding: FileSystem.EncodingType.UTF8,
    });

    return fileUri;
}

function downloadBundleOnWeb(fileName: string, serializedBundle: string): void {
    if (typeof document === 'undefined') {
        throw new Error('Browser downloads are unavailable in this environment.');
    }

    const blob = new Blob([serializedBundle], { type: 'application/json' });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
}

async function buildSerializedDataBundle(): Promise<{
    fileName: string;
    localSnapshot: LocalDataSnapshot;
    serializedBundle: string;
}> {
    const localSnapshot = await getLocalDataSnapshot();
    const exportSnapshot = {
        scoutingEntries: localSnapshot.scoutingEntries,
    };
    const contentHash = await computeSnapshotHash(exportSnapshot);
    const bundle = createManagedDataBundle(exportSnapshot, contentHash);

    return {
        fileName: buildDataBundleFileName(),
        localSnapshot,
        serializedBundle: JSON.stringify(bundle, null, 4),
    };
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

export async function getManagedDataStatus(): Promise<ManagedDataStatus> {
    const localSnapshot = await getLocalDataSnapshot();

    return {
        isSupported: isManagedDataSupported(),
        localScoutingEntryCount: localSnapshot.scoutingEntries.length,
        localPitScoutingEntryCount: localSnapshot.pitScoutingEntries.length,
    };
}

export async function exportManagedDataBundle(): Promise<ManagedDataExportResult | null> {
    if (!isManagedDataSupported()) {
        throw new Error('File import and export are unavailable on this platform.');
    }

    const { fileName, localSnapshot, serializedBundle } = await buildSerializedDataBundle();

    if (Platform.OS === 'web') {
        downloadBundleOnWeb(fileName, serializedBundle);

        return {
            destination: 'download',
            fileName,
            exportedScoutingEntryCount: localSnapshot.scoutingEntries.length,
        };
    }

    const cachedFileUri = await writeExportBundleToCache(fileName, serializedBundle);

    if (Platform.OS === 'android') {
        const directoryPermissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!directoryPermissions.granted) {
            return null;
        }

        const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
            directoryPermissions.directoryUri,
            getDataBundleFileStem(fileName),
            'application/json'
        );

        await FileSystem.StorageAccessFramework.writeAsStringAsync(fileUri, serializedBundle, {
            encoding: FileSystem.EncodingType.UTF8,
        });

        return {
            destination: 'android-folder',
            fileName,
            exportedScoutingEntryCount: localSnapshot.scoutingEntries.length,
        };
    }

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
        throw new Error('The system export sheet is unavailable on this device.');
    }

    await Sharing.shareAsync(cachedFileUri, {
        dialogTitle: 'Export Agath data',
        mimeType: 'application/json',
        UTI: 'public.json',
    });

    return {
        destination: 'share-sheet',
        fileName,
        exportedScoutingEntryCount: localSnapshot.scoutingEntries.length,
    };
}

export async function importPickedDataBundle(
    mode: ManagedDataImportMode
): Promise<ManagedDataImportResult | null> {
    if (!isManagedDataSupported()) {
        throw new Error('File import and export are unavailable on this platform.');
    }

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
        pitScoutingEntries: bundle.pitScoutingEntries ?? [],
    };
    const resultingSnapshot = await importSnapshot(snapshot, mode);

    return {
        source: 'picked-file',
        mode,
        fileName: pickedAsset.name ?? null,
        importedScoutingEntryCount: snapshot.scoutingEntries.length,
        importedPitScoutingEntryCount: snapshot.pitScoutingEntries.length,
        resultingScoutingEntryCount: resultingSnapshot.scoutingEntries.length,
        resultingPitScoutingEntryCount: resultingSnapshot.pitScoutingEntries.length,
    };
}