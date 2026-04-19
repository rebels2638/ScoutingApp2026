import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, InteractionManager, Linking, Modal, Pressable, RefreshControl, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';

import { ScoutingForm } from '@/components/scouting/ScoutingForm';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Text } from '@/components/ui/Text';
import { findAssignmentIdForUser, findMatchingAssignment } from '@/lib/backend/assignments';
import { useBackendAuth } from '@/lib/backend/auth';
import { getBackendConfig } from '@/lib/backend/config';
import { getCachedPitProfiles, type PitTeamProfile } from '@/lib/backend/pitScouting';
import { removeQueuedScoutingSubmissions, submitScoutingEntryWithQueue } from '@/lib/backend/submissions';
import { usePendingAssignments } from '@/lib/backend/usePendingAssignments';
import { CameraView, useCameraPermissions, type BarcodeScanningResult, type CameraMountError } from '@/lib/camera';
import { getPublicErrorMessage } from '@/lib/error-utils';
import {
    buildPitProfileMap,
    getPitProfileForEntry,
    getResolvedPreloadCount,
    getResolvedPrimaryFuelSource,
    getResolvedTypicalFuelCarried,
    getResolvedUsesTrenchRoutes,
} from '@/lib/pitScoutingOverlay';
import {
    parseScoutingEntryQrPayload,
    prepareScoutingEntryQrExport,
    QR_COMMENTS_OMITTED_MESSAGE,
    type ScoutingEntryQrImportResult,
} from '@/lib/qrTransfer';
import { createScoutingFormDataFromEntry, useScoutingFormState } from '@/lib/scoutingForm';
import {
    clearAllScoutingEntries,
    deleteScoutingEntry,
    getScoutingEntries,
    updateScoutingEntry,
    upsertScoutingEntry,
} from '@/lib/storage';
import { ThemedScrollView, ThemedView, useThemeColors } from '@/lib/theme';
import { MatchType, ScoutingEntry, type ScoutingEntrySyncStatus } from '@/lib/types';
import { useUIScale } from '@/lib/ui-scale';
import {
    Camera,
    Database,
    Eye,
    Pencil,
    QrCode,
    RefreshCw,
    Trash2,
    X,
} from 'lucide-react-native';
import { useTabBarMetrics } from './_layout';

type SortOption = 'timestamp' | 'match' | 'team';

interface QrExportModalState {
    entry: ScoutingEntry;
    qrSvg: string;
    commentsIncluded: boolean;
}

interface QrImportSaveResult extends ScoutingEntryQrImportResult {
    saveAction: 'created' | 'updated';
}

const shouldStackForLargeScale = (scaleOption: string) =>
    scaleOption === 'large' || scaleOption === 'extra-large';

function getEntrySyncStatus(entry: ScoutingEntry): ScoutingEntrySyncStatus {
    return entry.syncStatus ?? 'local';
}

function getEntrySyncLabel(syncStatus: ScoutingEntrySyncStatus): string {
    switch (syncStatus) {
        case 'queued':
            return 'Queued';
        case 'synced':
            return 'Synced';
        case 'local':
        default:
            return 'Local';
    }
}

function isEntryUploadable(entry: ScoutingEntry): boolean {
    return getEntrySyncStatus(entry) === 'local';
}

function getNormalizedAssignmentId(value: string | null | undefined): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function formatEntryCount(count: number): string {
    return `${count} ${count === 1 ? 'entry' : 'entries'}`;
}

export default function DataTab() {
    const colors = useThemeColors();
    const { authState, isBackendAvailable, userId } = useBackendAuth();
    const isBackendEnabled = authState === 'authenticated' && !!userId;
    const isPitScoutingEnabled = isBackendEnabled && !!getBackendConfig()?.collectionPitScoutingId;
    const { assignments: pendingAssignments, refreshAssignments } = usePendingAssignments({
        enabled: isBackendEnabled,
        userId,
    });
    const [entries, setEntries] = useState<ScoutingEntry[]>([]);
    const [pitProfiles, setPitProfiles] = useState<PitTeamProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<ScoutingEntry | null>(null);
    const [filterMatchType, setFilterMatchType] = useState<MatchType | 'All'>('All');
    const [sortBy, setSortBy] = useState<SortOption>('timestamp');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
    const [isUploadingSelected, setIsUploadingSelected] = useState(false);
    const [editingEntry, setEditingEntry] = useState<ScoutingEntry | null>(null);
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [isQrScannerVisible, setIsQrScannerVisible] = useState(false);
    const [qrExportState, setQrExportState] = useState<QrExportModalState | null>(null);
    const [exportingQrEntryId, setExportingQrEntryId] = useState<string | null>(null);
    const pendingQrExportTaskRef = React.useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(null);
    const isBackendEnabledRef = React.useRef(isBackendEnabled);
    const {
        formData: editFormData,
        setFormData: setEditFormData,
        isPitDataPending: isEditPitDataPending,
        resetForm: resetEditForm,
        prepareFormData: prepareEditFormData,
    } = useScoutingFormState({
        isPitScoutingEnabled,
    });
    const pitProfilesByTeam = useMemo(() => buildPitProfileMap(pitProfiles), [pitProfiles]);

    const loadEntries = useCallback(async () => {
        try {
            const [data, cachedPitProfiles] = await Promise.all([
                getScoutingEntries(),
                getCachedPitProfiles(),
            ]);
            setEntries(data);
            setPitProfiles(cachedPitProfiles);
            setSelectedEntryIds((current) =>
                current.filter((id) =>
                    data.some((entry) => entry.id === id && isEntryUploadable(entry))
                )
            );
        } catch (error) {
            console.error('Error loading entries:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            void loadEntries();
        }, [loadEntries])
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        void loadEntries();
    }, [loadEntries]);

    const clearSelection = useCallback(() => {
        setSelectedEntryIds([]);
    }, []);

    React.useEffect(() => {
        if (!isBackendEnabled) {
            clearSelection();
        }
    }, [clearSelection, isBackendEnabled]);

    React.useEffect(() => {
        isBackendEnabledRef.current = isBackendEnabled;
    }, [isBackendEnabled]);

    const clearPendingQrExportTask = useCallback(() => {
        pendingQrExportTaskRef.current?.cancel();
        pendingQrExportTaskRef.current = null;
    }, []);

    const closeQrExportModal = useCallback(() => {
        clearPendingQrExportTask();
        setQrExportState(null);
        setExportingQrEntryId(null);
    }, [clearPendingQrExportTask]);

    React.useEffect(() => {
        if (!isBackendEnabled) {
            return;
        }

        setIsQrScannerVisible(false);
        closeQrExportModal();
    }, [closeQrExportModal, isBackendEnabled]);

    React.useEffect(() => {
        return () => {
            clearPendingQrExportTask();
        };
    }, [clearPendingQrExportTask]);

    React.useEffect(() => {
        if (!editingEntry) {
            return;
        }

        resetEditForm(createScoutingFormDataFromEntry(editingEntry));
    }, [editingEntry, resetEditForm]);

    const startEditingEntry = useCallback((entry: ScoutingEntry) => {
        clearSelection();
        setSelectedEntry(null);
        setEditingEntry(entry);
    }, [clearSelection]);

    const cancelEditingEntry = useCallback(() => {
        if (!editingEntry || isSavingEdit) {
            return;
        }

        Alert.alert(
            'Discard changes?',
            'Your edits to this scouting entry will be discarded.',
            [
                { text: 'Keep editing', style: 'cancel' },
                {
                    text: 'Discard',
                    style: 'destructive',
                    onPress: () => {
                        setEditingEntry(null);
                    },
                },
            ]
        );
    }, [editingEntry, isSavingEdit]);

    const saveEditedEntry = useCallback(async () => {
        if (!editingEntry) {
            return;
        }

        if (editFormData.matchMetadata.matchNumber < 1) {
            Alert.alert('Validation Error', 'Please enter a valid match number.');
            return;
        }

        if (editFormData.matchMetadata.teamNumber < 1) {
            Alert.alert('Validation Error', 'Please enter a valid team number.');
            return;
        }

        setIsSavingEdit(true);
        try {
            const preparedData = prepareEditFormData();
            const previousStatus = getEntrySyncStatus(editingEntry);
            const currentRevision =
                typeof editingEntry.correctionRevision === 'number' &&
                Number.isFinite(editingEntry.correctionRevision) &&
                editingEntry.correctionRevision >= 0
                    ? Math.trunc(editingEntry.correctionRevision)
                    : 0;
            const nextRevision =
                previousStatus === 'queued' || previousStatus === 'synced'
                    ? currentRevision + 1
                    : currentRevision;
            const updatedEntry: ScoutingEntry = {
                ...editingEntry,
                ...preparedData,
                timestamp: Date.now(),
                syncStatus: 'local',
                syncedAt: null,
                assignmentId: getNormalizedAssignmentId(editingEntry.assignmentId),
                correctionRevision: nextRevision,
            };

            await removeQueuedScoutingSubmissions([editingEntry.id]);
            await updateScoutingEntry(updatedEntry);
            setEditingEntry(null);
            await loadEntries();

            Alert.alert(
                'Entry updated',
                previousStatus === 'queued' || previousStatus === 'synced'
                    ? 'The corrected scouting entry is now Local and ready to upload again from this tab.'
                    : 'The scouting entry was updated.'
            );
        } catch (error) {
            console.error('Error updating scouting entry:', error);
            Alert.alert('Update failed', 'Failed to save your edits. Please try again.');
        } finally {
            setIsSavingEdit(false);
        }
    }, [editFormData.matchMetadata.matchNumber, editFormData.matchMetadata.teamNumber, editingEntry, loadEntries, prepareEditFormData]);

    const toggleEntrySelection = useCallback((entry: ScoutingEntry) => {
        if (!isBackendEnabled || !isEntryUploadable(entry)) {
            return;
        }

        setSelectedEntryIds((current) =>
            current.includes(entry.id)
                ? current.filter((id) => id !== entry.id)
                : [...current, entry.id]
        );
    }, [isBackendEnabled]);

    const handleEntryPress = useCallback((entry: ScoutingEntry) => {
        if (isBackendEnabled && selectedEntryIds.length > 0 && isEntryUploadable(entry)) {
            toggleEntrySelection(entry);
            return;
        }

        setSelectedEntry(entry);
    }, [isBackendEnabled, selectedEntryIds.length, toggleEntrySelection]);

    const handleEntryLongPress = useCallback((entry: ScoutingEntry) => {
        if (!isBackendEnabled) {
            return;
        }

        toggleEntrySelection(entry);
    }, [isBackendEnabled, toggleEntrySelection]);

    const handleDelete = (entry: ScoutingEntry) => {
        Alert.alert(
            'Delete Entry',
            `Are you sure you want to delete Team ${entry.matchMetadata.teamNumber} in Match ${entry.matchMetadata.matchNumber}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await removeQueuedScoutingSubmissions([entry.id]);
                            await deleteScoutingEntry(entry.id);
                            if (selectedEntry?.id === entry.id) {
                                setSelectedEntry(null);
                            }
                            await loadEntries();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete entry.');
                        }
                    },
                },
            ]
        );
    };

    const handleClearAll = () => {
        if (entries.length === 0) {
            Alert.alert('No Data', 'There are no entries to clear.');
            return;
        }

        Alert.alert(
            'Clear All Data',
            `Delete all ${entries.length} scouting entries? This cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear All',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await removeQueuedScoutingSubmissions(entries.map((entry) => entry.id));
                            await clearAllScoutingEntries();
                            clearSelection();
                            setSelectedEntry(null);
                            await loadEntries();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to clear entries.');
                        }
                    },
                },
            ]
        );
    };

    const selectedEntryIdSet = useMemo(() => new Set(selectedEntryIds), [selectedEntryIds]);

    const selectedEntries = useMemo(
        () => entries.filter((entry) => selectedEntryIdSet.has(entry.id)),
        [entries, selectedEntryIdSet]
    );

    const uploadableSelectedEntries = useMemo(
        () => selectedEntries.filter(isEntryUploadable),
        [selectedEntries]
    );

    const normalizedQuery = searchQuery.trim().toLowerCase();

    const filteredEntries = useMemo(() => {
        return entries
            .filter((entry) => {
                if (filterMatchType === 'All') return true;
                return entry.matchMetadata.matchType === filterMatchType;
            })
            .filter((entry) => {
                if (!normalizedQuery) return true;
                return (
                    String(entry.matchMetadata.teamNumber).includes(normalizedQuery) ||
                    String(entry.matchMetadata.matchNumber).includes(normalizedQuery)
                );
            })
            .sort((a, b) => {
                switch (sortBy) {
                    case 'match':
                        return a.matchMetadata.matchNumber - b.matchMetadata.matchNumber;
                    case 'team':
                        return a.matchMetadata.teamNumber - b.matchMetadata.teamNumber;
                    case 'timestamp':
                    default:
                        return b.timestamp - a.timestamp;
                }
            });
    }, [entries, filterMatchType, normalizedQuery, sortBy]);

    const selectedEntryPitProfile = useMemo(
        () => (selectedEntry ? getPitProfileForEntry(selectedEntry, pitProfilesByTeam) : null),
        [pitProfilesByTeam, selectedEntry]
    );

    const hasActiveFilters = filterMatchType !== 'All' || sortBy !== 'timestamp' || normalizedQuery.length > 0;

    const resetFilters = () => {
        setFilterMatchType('All');
        setSortBy('timestamp');
        setSearchQuery('');
    };

    const matchTypeFilterOptions = [
        { label: 'All Match Types', value: 'All' as const },
        { label: 'Practice', value: 'Practice' as MatchType },
        { label: 'Qualification', value: 'Qualification' as MatchType },
        { label: 'Playoff', value: 'Playoff' as MatchType },
    ];

    const sortOptions = [
        { label: 'Newest First', value: 'timestamp' as const },
        { label: 'Match Number', value: 'match' as const },
        { label: 'Team Number', value: 'team' as const },
    ];

    const resolveAssignmentIdForUpload = useCallback(async (
        entry: ScoutingEntry,
        keyId: string,
        availableAssignments: typeof pendingAssignments,
        resolvedAssignmentBySlot: Map<string, string | null>
    ): Promise<string | null> => {
        const existingAssignmentId = getNormalizedAssignmentId(entry.assignmentId);
        if (existingAssignmentId) {
            return existingAssignmentId;
        }

        const matchingAssignment = findMatchingAssignment(availableAssignments, entry.matchMetadata);
        if (matchingAssignment) {
            const matchingAssignmentIndex = availableAssignments.findIndex(
                (assignment) => assignment.id === matchingAssignment.id
            );
            if (matchingAssignmentIndex >= 0) {
                availableAssignments.splice(matchingAssignmentIndex, 1);
            }

            return matchingAssignment.id;
        }

        const slotKey = `${entry.matchMetadata.matchNumber}-${entry.matchMetadata.teamNumber}-${entry.matchMetadata.matchType}`;
        if (resolvedAssignmentBySlot.has(slotKey)) {
            return resolvedAssignmentBySlot.get(slotKey) ?? null;
        }

        const resolvedAssignmentId = await findAssignmentIdForUser(keyId, entry.matchMetadata);
        resolvedAssignmentBySlot.set(slotKey, resolvedAssignmentId);
        return resolvedAssignmentId;
    }, []);

    const uploadSelectedEntries = async () => {
        if (!userId) {
            Alert.alert('Backend mode required', 'Enable backend mode in Settings before uploading entries.');
            return;
        }

        setIsUploadingSelected(true);
        try {
            const availableAssignments = [...pendingAssignments];
            const resolvedAssignmentBySlot = new Map<string, string | null>();
            let uploadedCount = 0;
            let queuedCount = 0;
            let skippedCount = 0;
            let failedCount = 0;

            for (const entry of uploadableSelectedEntries) {
                const assignmentId = await resolveAssignmentIdForUpload(
                    entry,
                    userId,
                    availableAssignments,
                    resolvedAssignmentBySlot
                );

                if (assignmentId && !getNormalizedAssignmentId(entry.assignmentId)) {
                    await updateScoutingEntry({
                        ...entry,
                        assignmentId,
                    });
                }

                const result = await submitScoutingEntryWithQueue({
                    keyId: userId,
                    entry,
                    assignmentId: assignmentId ?? undefined,
                });

                if (result.status === 'uploaded') {
                    uploadedCount += 1;
                } else if (result.status === 'queued') {
                    queuedCount += 1;
                } else if (result.status === 'skipped') {
                    skippedCount += 1;
                } else {
                    failedCount += 1;
                }
            }

            await loadEntries();
            clearSelection();
            if (uploadedCount > 0) {
                await refreshAssignments({ bypassCooldown: true });
            }

            const messageParts: string[] = [];
            if (uploadedCount > 0) {
                messageParts.push(`Uploaded ${formatEntryCount(uploadedCount)}`);
            }
            if (queuedCount > 0) {
                messageParts.push(`Queued ${formatEntryCount(queuedCount)} for retry`);
            }
            if (skippedCount > 0) {
                messageParts.push(`Skipped ${formatEntryCount(skippedCount)} already queued or synced`);
            }
            if (failedCount > 0) {
                messageParts.push(`Failed to upload ${formatEntryCount(failedCount)}`);
            }

            let alertMessage =
                messageParts.length > 0
                    ? `${messageParts.join('. ')}.`
                    : 'No new uploads were started.';

            if (queuedCount > 0) {
                alertMessage = `${alertMessage} Queued entries will sync automatically later.`;
            }

            Alert.alert(
                failedCount > 0 ? 'Upload finished' : 'Upload updated',
                alertMessage
            );
        } catch (error) {
            console.error('Error uploading selected entries:', error);
            Alert.alert('Upload failed', 'Failed to upload selected entries. Please try again.');
        } finally {
            setIsUploadingSelected(false);
        }
    };

    const handleUploadSelected = () => {
        if (!isBackendAvailable) {
            Alert.alert('Backend unavailable', 'Backend sync is unavailable on this build.');
            return;
        }
        if (!isBackendEnabled) {
            Alert.alert('Backend mode required', 'Enable backend mode in Settings before uploading entries.');
            return;
        }
        if (uploadableSelectedEntries.length === 0) {
            Alert.alert('No entries selected', 'Hold a local scouting record to select it for upload.');
            return;
        }

        Alert.alert(
            'Upload selected entries',
            `Upload ${formatEntryCount(uploadableSelectedEntries.length)}? Edited records are allowed and will resync as corrected data.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Upload',
                    onPress: () => {
                        void uploadSelectedEntries();
                    },
                },
            ]
        );
    };

    const handleImportQrData = useCallback(async (rawData: string): Promise<QrImportSaveResult> => {
        if (isBackendEnabled) {
            throw new Error('QR import is unavailable while backend mode is enabled.');
        }

        const importResult = parseScoutingEntryQrPayload(rawData);
        const saveAction = await upsertScoutingEntry(importResult.entry);
        setSelectedEntry(null);
        await loadEntries();
        return {
            ...importResult,
            saveAction,
        };
    }, [isBackendEnabled, loadEntries]);

    const handleExportQr = useCallback(async (entry: ScoutingEntry) => {
        if (isBackendEnabled) {
            return;
        }

        setExportingQrEntryId(entry.id);
        try {
            const qrExportResult = await prepareScoutingEntryQrExport(entry);
            clearPendingQrExportTask();
            setSelectedEntry((current) => current?.id === entry.id ? null : current);
            pendingQrExportTaskRef.current = InteractionManager.runAfterInteractions(() => {
                pendingQrExportTaskRef.current = null;
                if (isBackendEnabledRef.current) {
                    return;
                }

                setQrExportState({
                    entry,
                    ...qrExportResult,
                });
            });
        } catch (error) {
            Alert.alert(
                'Export unavailable',
                getPublicErrorMessage(error, 'Failed to prepare this scouting entry for QR export.')
            );
        } finally {
            setExportingQrEntryId(null);
        }
    }, [clearPendingQrExportTask, isBackendEnabled]);

    const insets = useSafeAreaInsets();
    const { height: tabBarHeight, marginBottom: tabBarMarginBottom } = useTabBarMetrics();

    if (loading) {
        return (
            <ThemedView className="flex-1 items-center justify-center px-8">
                <View className="items-center gap-3">
                    <Database size={28} color={colors.mutedForeground} />
                    <Text className="text-lg font-semibold">Loading scouting data...</Text>
                    <Text className="text-center text-sm" style={{ color: colors.mutedForeground }}>
                        Loading saved match entries and sync status.
                    </Text>
                </View>
            </ThemedView>
        );
    }

    const bottomPadding = tabBarHeight + Math.max(insets.bottom, tabBarMarginBottom) + 16;

    if (editingEntry) {
        return (
            <ScoutingForm
                formData={editFormData}
                onFormDataChange={setEditFormData}
                isPitScoutingEnabled={isPitScoutingEnabled}
                isPitDataPending={isEditPitDataPending}
                isSubmitting={isSavingEdit}
                onSubmit={() => {
                    void saveEditedEntry();
                }}
                onReset={cancelEditingEntry}
                submitLabel="Save Changes"
                submittingLabel="Saving..."
                resetLabel="Back to Data"
                bottomPadding={bottomPadding}
                headerContent={
                    <Card variant="outline">
                        <CardHeader className="flex-col items-start gap-1 pb-2">
                            <CardTitle className="text-base">Edit Scouting Entry</CardTitle>
                            <Text className="text-sm" style={{ color: colors.mutedForeground }}>
                                Team {editingEntry.matchMetadata.teamNumber} • {editingEntry.matchMetadata.matchType} Match {editingEntry.matchMetadata.matchNumber}
                            </Text>
                        </CardHeader>
                    </Card>
                }
            />
        );
    }

    return (
        <ThemedView className="flex-1" style={{ paddingTop: insets.top }}>
            <ThemedScrollView
                contentContainerStyle={{
                    paddingHorizontal: 14,
                    paddingTop: 12,
                    paddingBottom: bottomPadding,
                }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                <View className="gap-3">
                    <DataOverviewCard
                        entryCount={entries.length}
                        isBackendEnabled={isBackendEnabled}
                        onRefresh={onRefresh}
                        onClearAll={handleClearAll}
                    />

                    {isBackendEnabled ? (
                        <ManualUploadCard
                            selectedCount={uploadableSelectedEntries.length}
                            canUploadSelected={uploadableSelectedEntries.length > 0}
                            isUploadingSelected={isUploadingSelected}
                            onUploadSelected={handleUploadSelected}
                            onClearSelection={clearSelection}
                        />
                    ) : (
                        <LocalQrTransferCard onOpenScanner={() => setIsQrScannerVisible(true)} />
                    )}

                    <DataFilterCard
                        searchQuery={searchQuery}
                        onSearchQueryChange={setSearchQuery}
                        filterMatchType={filterMatchType}
                        setFilterMatchType={setFilterMatchType}
                        sortBy={sortBy}
                        setSortBy={setSortBy}
                        matchTypeFilterOptions={matchTypeFilterOptions}
                        sortOptions={sortOptions}
                        hasActiveFilters={hasActiveFilters}
                        onResetFilters={resetFilters}
                    />

                    {filteredEntries.length === 0 ? (
                        <EmptyState hasEntries={entries.length > 0} onResetFilters={resetFilters} />
                    ) : (
                        <View className="gap-3">
                            {filteredEntries.map((entry) => (
                                <EntryCard
                                    key={entry.id}
                                    entry={entry}
                                    isSelected={isBackendEnabled && selectedEntryIdSet.has(entry.id)}
                                    isSelectionMode={isBackendEnabled && selectedEntryIds.length > 0}
                                    selectionEnabled={isBackendEnabled}
                                    onPress={() => handleEntryPress(entry)}
                                    onLongPress={() => handleEntryLongPress(entry)}
                                    onView={() => setSelectedEntry(entry)}
                                    onEdit={() => startEditingEntry(entry)}
                                    onDelete={() => handleDelete(entry)}
                                />
                            ))}
                        </View>
                    )}
                </View>
            </ThemedScrollView>

            <EntryDetailModal
                entry={selectedEntry}
                pitProfile={selectedEntryPitProfile}
                canExportQr={!isBackendEnabled}
                isExportingQr={selectedEntry?.id === exportingQrEntryId}
                onExportQr={handleExportQr}
                onEdit={startEditingEntry}
                onClose={() => setSelectedEntry(null)}
            />
            <QrImportScannerModal
                visible={isQrScannerVisible}
                onClose={() => setIsQrScannerVisible(false)}
                onImportData={handleImportQrData}
            />
            <QrExportModal
                exportState={qrExportState}
                onClose={closeQrExportModal}
            />
        </ThemedView>
    );
}

interface DataOverviewCardProps {
    entryCount: number;
    isBackendEnabled: boolean;
    onRefresh: () => void;
    onClearAll: () => void;
}

function DataOverviewCard({
    entryCount,
    isBackendEnabled,
    onRefresh,
    onClearAll,
}: DataOverviewCardProps) {
    const colors = useThemeColors();
    const { scaleOption, scaled } = useUIScale();
    const stackLayout = shouldStackForLargeScale(scaleOption);
    const actionButtonClassName = stackLayout ? 'w-full' : '';

    return (
        <Card className="px-4 py-3" style={{ backgroundColor: colors.secondary }}>
            <View className={stackLayout ? 'gap-2' : 'flex-row items-start justify-between gap-2'}>
                <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                        <Database size={scaled(18)} color={colors.foreground} />
                        <Text className="text-lg font-semibold">Data</Text>
                    </View>
                    <Text className="mt-1 text-sm" style={{ color: colors.mutedForeground }}>
                        {isBackendEnabled
                            ? 'Review, filter, manage, and manually upload your scouting data.'
                            : 'Review, filter, and manage your scouting data.'}
                    </Text>
                </View>

                <View className={stackLayout ? 'gap-2' : 'flex-row items-center gap-2'}>
                    <Button variant="outline" size="sm" onPress={onRefresh} className={actionButtonClassName}>
                        <View className="flex-row items-center justify-center gap-1.5">
                            <RefreshCw size={scaled(14)} color={colors.foreground} />
                            <Text className="text-sm font-medium" style={{ color: colors.foreground }}>
                                Refresh
                            </Text>
                        </View>
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        onPress={onClearAll}
                        className={actionButtonClassName}
                        disabled={entryCount === 0}
                    >
                        <View className="flex-row items-center justify-center gap-1.5">
                            <Trash2 size={scaled(14)} color={colors.destructiveForeground} />
                            <Text className="text-sm font-medium" style={{ color: colors.destructiveForeground }}>
                                Clear All
                            </Text>
                        </View>
                    </Button>
                </View>
            </View>
        </Card>
    );
}

interface ManualUploadCardProps {
    selectedCount: number;
    canUploadSelected: boolean;
    isUploadingSelected: boolean;
    onUploadSelected: () => void;
    onClearSelection: () => void;
}

function ManualUploadCard({
    selectedCount,
    canUploadSelected,
    isUploadingSelected,
    onUploadSelected,
    onClearSelection,
}: ManualUploadCardProps) {
    const colors = useThemeColors();
    const { scaleOption } = useUIScale();
    const stackLayout = shouldStackForLargeScale(scaleOption);
    const actionButtonClassName = stackLayout ? 'w-full' : '';

    return (
        <Card className="p-3">
            <CardHeader className="flex-col items-start gap-1 pb-2">
                <CardTitle className="text-base">Manual Upload</CardTitle>
                <Text className="text-sm" style={{ color: colors.mutedForeground }}>
                    Hold a Local entry to select it for upload. If you edit a synced record, Agath marks it Local again so you can upload a corrected version.
                </Text>
            </CardHeader>

            <CardContent className="gap-3">
                <Text className="text-sm font-medium">
                    {selectedCount > 0
                        ? `${formatEntryCount(selectedCount)} selected for upload`
                        : 'No entries selected yet'}
                </Text>

                <View className={stackLayout ? 'gap-2' : 'flex-row gap-2'}>
                    <Button
                        onPress={onUploadSelected}
                        disabled={!canUploadSelected || isUploadingSelected}
                        className={actionButtonClassName}
                    >
                        {isUploadingSelected
                            ? 'Uploading...'
                            : selectedCount > 0
                                ? `Upload Selected (${selectedCount})`
                                : 'Upload Selected'}
                    </Button>
                    {selectedCount > 0 ? (
                        <Button
                            variant="outline"
                            onPress={onClearSelection}
                            disabled={isUploadingSelected}
                            className={actionButtonClassName}
                        >
                            Clear Selection
                        </Button>
                    ) : null}
                </View>
            </CardContent>
        </Card>
    );
}

function LocalQrTransferCard({ onOpenScanner }: { onOpenScanner: () => void }) {
    const colors = useThemeColors();
    const { scaleOption, scaled } = useUIScale();
    const stackLayout = shouldStackForLargeScale(scaleOption);
    const actionButtonClassName = stackLayout ? 'w-full' : '';

    return (
        <Card className="p-3">
            <CardHeader className="flex-col items-start gap-1 pb-2">
                <CardTitle className="text-base">QR Transfer</CardTitle>
                <Text className="text-sm" style={{ color: colors.mutedForeground }}>
                    Scan a QR to import a scouting entry. Open any entry to export it as a QR code.
                </Text>
            </CardHeader>

            <CardContent className="gap-3">
                <Text className="text-xs" style={{ color: colors.mutedForeground }}>
                    If an entry is too large for one QR code, Agath removes the comments field and warns you.
                </Text>

                <View className={stackLayout ? 'gap-2' : 'flex-row gap-2'}>
                    <Button variant="outline" size="sm" onPress={onOpenScanner} className={actionButtonClassName}>
                        <View className="flex-row items-center justify-center gap-1.5">
                            <Camera size={scaled(14)} color={colors.foreground} />
                            <Text className="text-sm font-medium" style={{ color: colors.foreground }}>
                                Scan QR Import
                            </Text>
                        </View>
                    </Button>
                </View>
            </CardContent>
        </Card>
    );
}

interface DataFilterCardProps {
    searchQuery: string;
    onSearchQueryChange: (value: string) => void;
    filterMatchType: MatchType | 'All';
    setFilterMatchType: (value: MatchType | 'All') => void;
    sortBy: SortOption;
    setSortBy: (value: SortOption) => void;
    matchTypeFilterOptions: { label: string; value: MatchType | 'All' }[];
    sortOptions: { label: string; value: SortOption }[];
    hasActiveFilters: boolean;
    onResetFilters: () => void;
}

function DataFilterCard({
    searchQuery,
    onSearchQueryChange,
    filterMatchType,
    setFilterMatchType,
    sortBy,
    setSortBy,
    matchTypeFilterOptions,
    sortOptions,
    hasActiveFilters,
    onResetFilters,
}: DataFilterCardProps) {
    const colors = useThemeColors();
    const { scaleOption } = useUIScale();
    const stackLayout = shouldStackForLargeScale(scaleOption);

    return (
        <Card className="p-3">
            <CardHeader className={stackLayout ? 'flex-col items-start gap-2 pb-2' : 'pb-2'}>
                <View className="flex-1">
                    <CardTitle className="text-base">Filters & Sorting</CardTitle>
                    <Text className="mt-1 text-sm" style={{ color: colors.mutedForeground }}>
                        Search by team or match number, then sort the results.
                    </Text>
                </View>
                {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onPress={onResetFilters}>
                        Reset
                    </Button>
                )}
            </CardHeader>

            <CardContent className="gap-2">
                <Input
                    value={searchQuery}
                    onChangeText={onSearchQueryChange}
                    label="Search"
                    placeholder="Type team or match number"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="number-pad"
                />

                <View className={stackLayout ? 'gap-2' : 'flex-row gap-2'}>
                    <View className="flex-1">
                        <Select
                            value={filterMatchType}
                            onValueChange={setFilterMatchType}
                            options={matchTypeFilterOptions}
                            label="Match Type"
                            placeholder="Select a match type"
                        />
                    </View>
                    <View className="flex-1">
                        <Select
                            value={sortBy}
                            onValueChange={setSortBy}
                            options={sortOptions}
                            label="Sort By"
                            placeholder="Select sorting"
                        />
                    </View>
                </View>
            </CardContent>
        </Card>
    );
}

interface EntryCardProps {
    entry: ScoutingEntry;
    isSelected: boolean;
    isSelectionMode: boolean;
    selectionEnabled: boolean;
    onPress: () => void;
    onLongPress: () => void;
    onView: () => void;
    onEdit: () => void;
    onDelete: () => void;
}

function EntryCard({
    entry,
    isSelected,
    isSelectionMode,
    selectionEnabled,
    onPress,
    onLongPress,
    onView,
    onEdit,
    onDelete,
}: EntryCardProps) {
    const colors = useThemeColors();
    const { scaleOption, scaled } = useUIScale();
    const stackLayout = shouldStackForLargeScale(scaleOption);

    const { matchMetadata, autonomous, teleop, endgame } = entry;
    const syncStatus = getEntrySyncStatus(entry);
    const canSelect = selectionEnabled && isEntryUploadable(entry);

    const timestampLabel = new Date(entry.timestamp).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    return (
        <Pressable onPress={onPress} onLongPress={canSelect ? onLongPress : undefined}>
            <Card
                className="p-0"
                style={{
                    borderColor: isSelected ? colors.primary : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                    backgroundColor: isSelected ? colors.secondaryElevated : colors.card,
                }}
            >
                <View className="px-3 py-3">
                    <View className={stackLayout ? 'gap-2' : 'flex-row items-start justify-between gap-2'}>
                        <View className="flex-1 flex-row items-start gap-2">
                            <View className="flex-1">
                                <View className="flex-row flex-wrap items-center gap-2">
                                    <View
                                        style={{
                                            backgroundColor:
                                                matchMetadata.allianceColor === 'Red'
                                                    ? colors.allianceRedMuted
                                                    : colors.allianceBlueMuted,
                                        }}
                                        className="rounded-md px-2 py-1"
                                    >
                                        <Text
                                            className="text-xs font-semibold"
                                            style={{
                                                color:
                                                    matchMetadata.allianceColor === 'Red'
                                                        ? colors.allianceRedForeground
                                                        : colors.allianceBlueForeground,
                                            }}
                                        >
                                            {matchMetadata.allianceColor} Alliance
                                        </Text>
                                    </View>
                                    <SyncStatusPill status={syncStatus} />
                                    {isSelected ? (
                                        <View
                                            style={{ backgroundColor: colors.primary }}
                                            className="rounded-full px-2.5 py-1"
                                        >
                                            <Text
                                                className="text-xs font-semibold"
                                                style={{ color: colors.primaryForeground }}
                                            >
                                                Selected
                                            </Text>
                                        </View>
                                    ) : null}
                                </View>

                                <Text className="mt-2 text-base font-semibold">Team {matchMetadata.teamNumber}</Text>
                                <Text className="text-sm" style={{ color: colors.mutedForeground }}>
                                    {matchMetadata.matchType} Match {matchMetadata.matchNumber}
                                </Text>
                                <Text className="mt-0.5 text-xs" style={{ color: colors.mutedForeground }}>
                                    {timestampLabel}
                                </Text>
                                <Text className="mt-1 text-xs" style={{ color: colors.mutedForeground }}>
                                    {syncStatus === 'queued'
                                        ? 'Waiting for backend sync'
                                        : syncStatus === 'synced'
                                            ? 'Already synced'
                                            : canSelect
                                                ? isSelectionMode
                                                    ? 'Tap to toggle selection'
                                                    : 'Hold to select for upload'
                                                : 'Saved locally'}
                                </Text>
                            </View>
                        </View>

                        <View className={stackLayout ? 'flex-row self-start gap-2' : 'flex-row gap-2'}>
                            <Button variant="outline" size="icon" onPress={onView} accessibilityLabel="View entry details">
                                <Eye size={scaled(14)} color={colors.foreground} />
                            </Button>
                            <Button variant="outline" size="icon" onPress={onEdit} accessibilityLabel="Edit entry">
                                <Pencil size={scaled(14)} color={colors.foreground} />
                            </Button>
                            <Button variant="destructive" size="icon" onPress={onDelete} accessibilityLabel="Delete entry">
                                <Trash2 size={scaled(14)} color={colors.destructiveForeground} />
                            </Button>
                        </View>
                    </View>
                </View>
            </Card>
        </Pressable>
    );
}

function EmptyState({ hasEntries, onResetFilters }: { hasEntries: boolean; onResetFilters: () => void }) {
    const colors = useThemeColors();

    return (
        <Card className="p-3">
            <CardContent className="items-center py-7">
                <Database size={26} color={colors.mutedForeground} />
                <Text className="mt-3 text-lg font-semibold">
                    {hasEntries ? 'No matching entries' : 'No entries yet'}
                </Text>
                <Text className="mt-1 text-center text-sm" style={{ color: colors.mutedForeground }}>
                    {hasEntries
                        ? 'Try a different search or reset the filters to view more scouting data.'
                        : 'Submit scouting entries from the Scout tab to populate this screen.'}
                </Text>
                {hasEntries && (
                    <Button variant="outline" size="sm" className="mt-4" onPress={onResetFilters}>
                        Show All Entries
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}

interface EntryDetailModalProps {
    entry: ScoutingEntry | null;
    pitProfile: PitTeamProfile | null;
    canExportQr: boolean;
    isExportingQr: boolean;
    onExportQr: (entry: ScoutingEntry) => void;
    onEdit: (entry: ScoutingEntry) => void;
    onClose: () => void;
}

function EntryDetailModal({
    entry,
    pitProfile,
    canExportQr,
    isExportingQr,
    onExportQr,
    onEdit,
    onClose,
}: EntryDetailModalProps) {
    const colors = useThemeColors();
    const { scaleOption, scaled } = useUIScale();
    const stackLayout = shouldStackForLargeScale(scaleOption);

    if (!entry) return null;

    const { matchMetadata, autonomous, teleop, activePhase, inactivePhase, endgame } = entry;
    const preloadCount = getResolvedPreloadCount(entry, pitProfile);
    const typicalFuelCarried = getResolvedTypicalFuelCarried(entry, pitProfile);
    const primaryFuelSource = getResolvedPrimaryFuelSource(entry, pitProfile);
    const usesTrenchRoutes = getResolvedUsesTrenchRoutes(entry, pitProfile);
    const isUsingPitTrenchFallback = teleop.usesTrenchRoutes == null && pitProfile?.canFitTrench != null;

    return (
        <Modal
            visible={!!entry}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={onClose}
        >
            <ThemedView className="flex-1">
                <View
                    style={{ backgroundColor: colors.card, borderBottomColor: colors.border }}
                    className={stackLayout ? 'gap-3 border-b px-4 py-4' : 'flex-row items-start justify-between border-b px-4 py-4'}
                >
                    <View className="flex-1">
                        <Text className="text-xl font-bold">Team {matchMetadata.teamNumber}</Text>
                        <Text className="mt-1 text-sm" style={{ color: colors.mutedForeground }}>
                            {matchMetadata.matchType} Match {matchMetadata.matchNumber}
                        </Text>
                    </View>

                    <View className={stackLayout ? 'flex-row self-start gap-2' : 'flex-row gap-2'}>
                        {canExportQr ? (
                            <Button variant="outline" size="sm" onPress={() => onExportQr(entry)} disabled={isExportingQr}>
                                <View className="flex-row items-center gap-1.5">
                                    <QrCode size={scaled(14)} color={colors.foreground} />
                                    <Text className="text-sm font-medium" style={{ color: colors.foreground }}>
                                        {isExportingQr ? 'Preparing...' : 'Export QR'}
                                    </Text>
                                </View>
                            </Button>
                        ) : null}

                        <Button variant="outline" size="sm" onPress={() => onEdit(entry)}>
                            <View className="flex-row items-center gap-1.5">
                                <Pencil size={scaled(14)} color={colors.foreground} />
                                <Text className="text-sm font-medium" style={{ color: colors.foreground }}>
                                    Edit
                                </Text>
                            </View>
                        </Button>

                        <Button variant="outline" size="icon" onPress={onClose} className={stackLayout ? 'self-start' : ''}>
                            <X size={scaled(18)} color={colors.foreground} />
                        </Button>
                    </View>
                </View>

                <ThemedScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
                    <View className="gap-4">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">Snapshot</CardTitle>
                            </CardHeader>
                            <CardContent className="gap-0">
                                <DetailRow label="Alliance" value={matchMetadata.allianceColor} />
                                <DetailRow label="Auto Fuel" value={autonomous.fuelScoredBucket} />
                                <DetailRow label="Climb" value={endgame.climbLevelAchieved} />
                                <DetailRow label="Sync Status" value={getEntrySyncLabel(getEntrySyncStatus(entry))} />
                                <DetailRow label="Recorded" value={new Date(entry.timestamp).toLocaleString()} />
                            </CardContent>
                        </Card>

                        <DetailSection title="Autonomous">
                            <DetailRow label="Preload Count" value={preloadCount == null ? '—' : String(preloadCount)} />
                            <DetailRow label="Left Starting Line" value={autonomous.leftStartingLine ? 'Yes' : 'No'} />
                            <DetailRow label="Crossed Center Line" value={autonomous.crossedCenterLine ? 'Yes' : 'No'} />
                            <DetailRow label="Fuel Scored" value={autonomous.fuelScoredBucket} />
                            <DetailRow label="Climb Result" value={autonomous.climbResult} />
                            <DetailRow
                                label="Eligible for Auto Climb"
                                value={autonomous.eligibleForAutoClimbPoints ? 'Yes' : 'No'}
                            />
                        </DetailSection>

                        <DetailSection title="Teleop">
                            <DetailRow label="Scoring Cycles (Active)" value={String(teleop.scoringCyclesActive)} />
                            <DetailRow label="Wasted Cycles (Inactive)" value={String(teleop.wastedCyclesInactive)} />
                            <DetailRow label="Typical Fuel Carried" value={typicalFuelCarried ?? '—'} />
                            <DetailRow label="Primary Fuel Source" value={primaryFuelSource ?? '—'} />
                            <DetailRow
                                label="Uses Trench Routes"
                                value={
                                    usesTrenchRoutes == null
                                        ? '—'
                                        : `${usesTrenchRoutes ? 'Yes' : 'No'}${isUsingPitTrenchFallback ? ' (pit)' : ''}`
                                }
                            />
                            {isUsingPitTrenchFallback ? (
                                <DetailRow
                                    label="Trench Compatibility"
                                    value={pitProfile.canFitTrench ? 'Can fit trench' : 'Cannot fit trench'}
                                />
                            ) : null}
                            <DetailRow label="Plays Defense" value={teleop.playsDefense ? 'Yes' : 'No'} />
                        </DetailSection>

                        <DetailSection title="Active Phase Strategy">
                            <DetailRow
                                label="Feeds Fuel to Alliance Zone"
                                value={activePhase.feedsFuelToAllianceZone ? 'Yes' : 'No'}
                            />
                            <DetailRow label="Plays Offense Only" value={activePhase.playsOffenseOnly ? 'Yes' : 'No'} />
                            <DetailRow
                                label="Some Defense While Active"
                                value={activePhase.playsSomeDefenseWhileActive ? 'Yes' : 'No'}
                            />
                        </DetailSection>

                        <DetailSection title="Inactive Phase Strategy">
                            <DetailRow label="Holds Fuel and Waits" value={inactivePhase.holdsFuelAndWaits ? 'Yes' : 'No'} />
                            <DetailRow
                                label="Feeds Fuel to Alliance Zone"
                                value={inactivePhase.feedsFuelToAllianceZone ? 'Yes' : 'No'}
                            />
                            <DetailRow
                                label="Collects Neutral Fuel (Keeps It)"
                                value={inactivePhase.collectsFromNeutralZone ? 'Yes' : 'No'}
                            />
                            <DetailRow label="Plays Defense" value={inactivePhase.playsDefense ? 'Yes' : 'No'} />
                            <DetailRow
                                label="Still Shoots Anyway"
                                value={inactivePhase.stillShootsAnyway ? 'Yes' : 'No'}
                            />
                        </DetailSection>

                        <DetailSection title="Endgame + Reliability">
                            <DetailRow label="Attempted Climb" value={endgame.attemptedClimb ? 'Yes' : 'No'} />
                            <DetailRow label="Climb Level" value={endgame.climbLevelAchieved} />
                            <DetailRow label="Climb Success State" value={endgame.climbSuccessState} />
                            <DetailRow label="Time to Climb" value={`${endgame.timeToClimb}s`} />
                            <DetailRow label="Parked but No Climb" value={endgame.parkedButNoClimb ? 'Yes' : 'No'} />
                            <DetailRow label="Breakdown" value={endgame.breakdown ? 'Yes' : 'No'} />
                            <DetailRow label="Mobility Issues" value={endgame.mobilityIssues} />
                            <DetailRow label="Cards" value={endgame.cards.length > 0 ? endgame.cards.join(', ') : 'None'} />
                            {endgame.extraComments && <ExtraCommentsBox comments={endgame.extraComments} />}
                        </DetailSection>
                    </View>
                </ThemedScrollView>
            </ThemedView>
        </Modal>
    );
}

interface QrImportScannerModalProps {
    visible: boolean;
    onClose: () => void;
    onImportData: (rawData: string) => Promise<QrImportSaveResult>;
}

function QrImportScannerModal({
    visible,
    onClose,
    onImportData,
}: QrImportScannerModalProps) {
    const colors = useThemeColors();
    const { scaleOption, scaled } = useUIScale();
    const stackLayout = shouldStackForLargeScale(scaleOption);
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const [permission, requestPermission] = useCameraPermissions();
    const [isProcessingScan, setIsProcessingScan] = useState(false);
    const scannerFrameSize = Math.min(width - scaled(64), scaled(280));
    const scannerOverlayBottomPadding = Math.max(insets.bottom, 16) + 8;

    React.useEffect(() => {
        if (!visible) {
            setIsProcessingScan(false);
        }
    }, [visible]);

    const handleBarcodeScanned = useCallback(async ({ data }: BarcodeScanningResult) => {
        if (isProcessingScan) {
            return;
        }

        setIsProcessingScan(true);
        try {
            const result = await onImportData(data);
            const messageParts = [
                result.saveAction === 'updated'
                    ? `Updated Team ${result.entry.matchMetadata.teamNumber} in Match ${result.entry.matchMetadata.matchNumber}.`
                    : `Imported Team ${result.entry.matchMetadata.teamNumber} in Match ${result.entry.matchMetadata.matchNumber}.`,
                'The scouting record is saved locally.',
            ];

            if (!result.commentsIncluded) {
                messageParts.push(QR_COMMENTS_OMITTED_MESSAGE);
            }

            Alert.alert('Import complete', messageParts.join(' '), [
                {
                    text: 'Done',
                    onPress: onClose,
                },
            ]);
        } catch (error) {
            Alert.alert(
                'Import failed',
                getPublicErrorMessage(error, 'This QR code does not contain valid scouting data.'),
                [
                    {
                        text: 'Scan Again',
                        onPress: () => setIsProcessingScan(false),
                    },
                    {
                        text: 'Close',
                        style: 'cancel',
                        onPress: onClose,
                    },
                ]
            );
        }
    }, [isProcessingScan, onClose, onImportData]);

    const handleOpenSettings = useCallback(() => {
        void Linking.openSettings();
    }, []);

    const handleCameraMountError = useCallback((error: CameraMountError) => {
        Alert.alert('Camera unavailable', error.message, [
            {
                text: 'Close',
                onPress: onClose,
            },
        ]);
    }, [onClose]);

    const scannerHeaderContent = (
        <View className={stackLayout ? 'gap-3' : 'flex-row items-start gap-3'}>
            <View className="flex-1">
                <Text className="text-xl font-bold">Scan scouting QR</Text>
                <Text className="mt-1 text-sm" style={{ color: colors.mutedForeground }}>
                    Use another device&apos;s QR export to import a scouting entry.
                </Text>
            </View>

            <Button variant="outline" size="icon" onPress={onClose} className="self-start">
                <X size={scaled(18)} color={colors.foreground} />
            </Button>
        </View>
    );

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={onClose}
        >
            <ThemedView className="flex-1">
                {!permission ? (
                    <ThemedView className="flex-1">
                        <View
                            style={{ backgroundColor: colors.card, paddingTop: insets.top + 16 }}
                            className="px-4 pb-4"
                        >
                            {scannerHeaderContent}
                        </View>

                        <ThemedView className="flex-1 items-center justify-center px-6">
                            <Card className="w-full max-w-md p-4">
                                <CardContent className="items-center gap-3">
                                    <Text className="text-center text-base font-semibold">Checking camera access...</Text>
                                    <Text className="text-center text-sm" style={{ color: colors.mutedForeground }}>
                                        Agath needs camera access before it can scan scouting QR codes.
                                    </Text>
                                </CardContent>
                            </Card>
                        </ThemedView>
                    </ThemedView>
                ) : !permission.granted ? (
                    <ThemedView className="flex-1">
                        <View
                            style={{ backgroundColor: colors.card, paddingTop: insets.top + 16 }}
                            className="px-4 pb-4"
                        >
                            {scannerHeaderContent}
                        </View>

                        <ThemedView className="flex-1 items-center justify-center px-6">
                            <Card className="w-full max-w-md p-4">
                                <CardHeader className="flex-col items-start gap-1 pb-2">
                                    <CardTitle className="text-base">Camera access required</CardTitle>
                                    <Text className="text-sm" style={{ color: colors.mutedForeground }}>
                                        Allow camera access to scan a scouting QR code from another device.
                                    </Text>
                                </CardHeader>
                                <CardContent className="gap-2">
                                    {permission.canAskAgain ? (
                                        <Button onPress={() => void requestPermission()}>
                                            Allow Camera
                                        </Button>
                                    ) : (
                                        <Button onPress={handleOpenSettings}>
                                            Open Settings
                                        </Button>
                                    )}
                                    <Button variant="outline" onPress={onClose}>
                                        Cancel
                                    </Button>
                                </CardContent>
                            </Card>
                        </ThemedView>
                    </ThemedView>
                ) : (
                    <View className="flex-1 bg-black">
                        <CameraView
                            style={{ flex: 1 }}
                            facing="back"
                            autofocus="on"
                            onMountError={handleCameraMountError}
                            onBarcodeScanned={isProcessingScan ? undefined : handleBarcodeScanned}
                            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                        />

                        <View pointerEvents="box-none" className="absolute inset-x-0 top-0 px-4" style={{ paddingTop: insets.top + 16 }}>
                            <Card>
                                {scannerHeaderContent}
                            </Card>
                        </View>

                        <View pointerEvents="none" className="absolute inset-0 items-center justify-center px-8">
                            <View
                                style={{
                                    width: scannerFrameSize,
                                    height: scannerFrameSize,
                                    borderColor: colors.foreground,
                                    borderWidth: 2,
                                    borderRadius: scaled(24),
                                }}
                            />
                        </View>

                        <View className="absolute inset-x-0 bottom-0 p-4" style={{ paddingBottom: scannerOverlayBottomPadding }}>
                            <Card className="p-3">
                                <CardContent className="gap-1">
                                    <Text className="text-sm font-medium">
                                        {isProcessingScan ? 'Importing scouting entry...' : 'Center the QR code in the camera view.'}
                                    </Text>
                                    <Text className="text-sm" style={{ color: colors.mutedForeground }}>
                                        Imported records will stay local even when swtiched to backend mode.
                                    </Text>
                                </CardContent>
                            </Card>
                        </View>
                    </View>
                )}
            </ThemedView>
        </Modal>
    );
}

function QrExportModal({
    exportState,
    onClose,
}: {
    exportState: QrExportModalState | null;
    onClose: () => void;
}) {
    const colors = useThemeColors();
    const { scaled } = useUIScale();
    const { width } = useWindowDimensions();

    if (!exportState) {
        return null;
    }

    const qrSize = Math.min(width - 72, scaled(320));

    return (
        <Modal
            visible={!!exportState}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={onClose}
        >
            <ThemedView className="flex-1">
                <View
                    style={{ backgroundColor: colors.card, borderBottomColor: colors.border }}
                    className="flex-row items-start justify-between border-b px-4 py-4"
                >
                    <View className="flex-1">
                        <Text className="text-xl font-bold">Export scouting QR</Text>
                        <Text className="mt-1 text-sm" style={{ color: colors.mutedForeground }}>
                            Team {exportState.entry.matchMetadata.teamNumber} · {exportState.entry.matchMetadata.matchType} Match {exportState.entry.matchMetadata.matchNumber}
                        </Text>
                    </View>

                    <Button variant="outline" size="icon" onPress={onClose}>
                        <X size={scaled(18)} color={colors.foreground} />
                    </Button>
                </View>

                <ThemedScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
                    <View className="gap-4">
                        <Card className="p-4">
                            <CardContent className="items-center gap-4">
                                <Text className="text-center text-sm" style={{ color: colors.mutedForeground }}>
                                    Scan this QR from the Data tab camera button on another device to import the record locally.
                                </Text>

                                {!exportState.commentsIncluded ? (
                                    <View style={{ backgroundColor: colors.secondaryElevated }} className="w-full rounded-md p-3">
                                        <Text className="text-sm font-medium">Comments omitted</Text>
                                        <Text className="mt-1 text-sm" style={{ color: colors.mutedForeground }}>
                                            {QR_COMMENTS_OMITTED_MESSAGE}
                                        </Text>
                                    </View>
                                ) : null}

                                <View
                                    className="rounded-2xl p-4"
                                    style={{
                                        backgroundColor: '#FFFFFF',
                                        minHeight: qrSize + scaled(32),
                                        minWidth: qrSize + scaled(32),
                                    }}
                                >
                                    <SvgXml xml={exportState.qrSvg} width={qrSize} height={qrSize} />
                                </View>
                            </CardContent>
                        </Card>
                    </View>
                </ThemedScrollView>
            </ThemedView>
        </Modal>
    );
}

function SyncStatusPill({ status, label }: { status: ScoutingEntrySyncStatus; label?: string }) {
    const colors = useThemeColors();

    if (status === 'queued') {
        return (
            <View
                style={{ backgroundColor: colors.secondaryElevated }}
                className="rounded-full px-2.5 py-1"
            >
                <Text
                    className="text-xs font-semibold"
                    style={{ color: colors.secondaryElevatedForeground }}
                >
                    {label ?? getEntrySyncLabel(status)}
                </Text>
            </View>
        );
    }

    if (status === 'synced') {
        return (
            <View style={{ backgroundColor: colors.primary }} className="rounded-full px-2.5 py-1">
                <Text className="text-xs font-semibold" style={{ color: colors.primaryForeground }}>
                    {label ?? getEntrySyncLabel(status)}
                </Text>
            </View>
        );
    }

    return (
        <View style={{ backgroundColor: colors.secondary }} className="rounded-full px-2.5 py-1">
            <Text className="text-xs font-semibold" style={{ color: colors.secondaryForeground }}>
                {label ?? getEntrySyncLabel(status)}
            </Text>
        </View>
    );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
    const colors = useThemeColors();
    return (
        <Card className="p-0">
            <View style={{ borderBottomColor: colors.border }} className="border-b px-4 py-3">
                <Text className="text-base font-semibold">{title}</Text>
            </View>
            <CardContent className="gap-0 px-4 py-1">{children}</CardContent>
        </Card>
    );
}

function DetailRow({ label, value }: { label: string; value: string }) {
    const colors = useThemeColors();
    const { scaleOption } = useUIScale();
    const stackRow = shouldStackForLargeScale(scaleOption);

    return (
        <View
            style={{ borderBottomColor: colors.border }}
            className={
                stackRow
                    ? 'gap-1 border-b py-2.5 last:border-b-0'
                    : 'flex-row items-center justify-between border-b py-2.5 last:border-b-0'
            }
        >
            <Text className="text-sm" style={{ color: colors.mutedForeground, flexShrink: 1 }}>
                {label}
            </Text>
            <Text
                className={stackRow ? 'text-sm font-medium' : 'text-sm font-medium text-right'}
                style={{ color: colors.foreground, flexShrink: 1 }}
            >
                {value}
            </Text>
        </View>
    );
}

function ExtraCommentsBox({ comments }: { comments: string }) {
    const colors = useThemeColors();
    return (
        <View style={{ backgroundColor: colors.secondaryElevated }} className="mt-2 rounded-md p-3">
            <Text className="text-sm font-medium" style={{ color: colors.mutedForeground }}>
                Comments
            </Text>
            <Text className="mt-1" style={{ color: colors.secondaryElevatedForeground }}>
                {comments}
            </Text>
        </View>
    );
}
