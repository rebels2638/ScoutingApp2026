import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { getActivationKeyValidationError, useBackendAuth } from '@/lib/backend/auth';
import { beginBackendSyncAttempt, requestBackendSyncNow } from '@/lib/backend/sync';
import {
    chooseAndroidManagedDataDirectory,
    getManagedDataStatus,
    importManagedDataBundle,
    importPickedDataBundle,
    syncManagedDataBundle,
    type ManagedDataImportMode,
    type ManagedDataImportResult,
    type ManagedDataSource,
    type ManagedDataStatus,
} from '@/lib/dataFiles';
import { SHOW_TEST_DATA_BUTTON } from '@/lib/devFlags';
import { getPublicErrorMessage } from '@/lib/error-utils';
import { saveScoutingEntry } from '@/lib/storage';
import { generateTestData } from '@/lib/testData';
import { ThemedScrollView, themes, useTheme, useThemeColors } from '@/lib/theme';
import {
    UI_SCALE_LABELS,
    UI_SCALE_VALUES,
    useUIScale,
    type UIScaleOption,
} from '@/lib/ui-scale';
import { Check, FlaskConical, FolderOpen, Moon, Smartphone, Sun } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarMetrics } from './_layout';

interface ThemeCardProps {
    themeKey: string;
    themeName: string;
    isSelected: boolean;
    isDark: boolean;
    colors: {
        background: string;
        foreground: string;
        primary: string;
        secondary: string;
        accent: string;
    };
    onSelect: () => void;
}

function ThemeCard({ themeKey, themeName, isSelected, isDark, colors, onSelect }: ThemeCardProps) {
    const currentColors = useThemeColors();
    return (
        <Pressable
            onPress={onSelect}
            className="flex-1 min-w-[140px]"
        >
            <View
                style={{ borderColor: isSelected ? currentColors.primary : currentColors.border }}
                className="rounded-lg border-2 overflow-hidden"
            >

                <View
                    style={{ backgroundColor: colors.background }}
                    className="p-3 h-20"
                >

                    <View className="flex-row items-center gap-2 mb-2">
                        <View
                            style={{ backgroundColor: colors.primary }}
                            className="h-3 w-3 rounded-full"
                        />
                        <View
                            style={{ backgroundColor: colors.foreground, opacity: 0.7 }}
                            className="h-2 flex-1 rounded"
                        />
                    </View>
                    <View
                        style={{ backgroundColor: colors.secondary }}
                        className="h-6 rounded mb-2"
                    />
                    <View className="flex-row gap-1">
                        <View
                            style={{ backgroundColor: colors.accent }}
                            className="h-3 w-8 rounded"
                        />
                        <View
                            style={{ backgroundColor: colors.primary }}
                            className="h-3 w-6 rounded"
                        />
                    </View>
                </View>

                <View
                    style={{ backgroundColor: colors.secondary }}
                    className="px-3 py-2 flex-row items-center justify-between"
                >
                    <View className="flex-row items-center gap-2">
                        {isDark ? (
                            <Moon size={14} color={colors.foreground} />
                        ) : (
                            <Sun size={14} color={colors.foreground} />
                        )}
                        <Text
                            style={{ color: colors.foreground }}
                            className="text-sm font-medium"
                        >
                            {themeName}
                        </Text>
                    </View>
                    {isSelected && (
                        <Check size={16} color={colors.primary} strokeWidth={3} />
                    )}
                </View>
            </View>
        </Pressable>
    );
}

function getQueuedUploadSummary(attemptedCount: number, uploadedCount: number, remainingCount: number): string {
    if (attemptedCount === 0) {
        return 'No queued scouting uploads were waiting.';
    }

    if (remainingCount === 0) {
        return `Uploaded ${uploadedCount} queued ${attemptedCount === 1 ? 'entry' : 'entries'}.`;
    }

    return `Uploaded ${uploadedCount} of ${attemptedCount} queued entries; ${remainingCount} still waiting.`;
}

function BackendConnectionCard() {
    const {
        activateKey,
        authState,
        isActivating,
        isBackendAvailable,
        resetKey,
        revalidateSession,
        userId,
    } = useBackendAuth();
    const [isSyncing, setIsSyncing] = useState(false);
    const [isDisablingBackend, setIsDisablingBackend] = useState(false);
    const [rawKey, setRawKey] = useState('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const isAuthenticated = authState === 'authenticated';
    const trimmedKey = rawKey.trim();

    const statusLabel = isAuthenticated
        ? `Currently running in Backend Mode${userId ? ` as: ${userId}` : ''}`
        : 'Currently running in Local Mode';

    const handleSyncNow = async () => {
        const syncAttempt = beginBackendSyncAttempt();
        if (!syncAttempt.ok) {
            Alert.alert('Sync unavailable', 'Wait one minute before syncing again.');
            return;
        }

        setIsSyncing(true);
        try {
            const sessionResult = await revalidateSession();
            if (!sessionResult.ok) {
                Alert.alert(
                    sessionResult.error === 'invalid_session' ? 'Backend session expired' : 'Sync unavailable',
                    sessionResult.error === 'invalid_session'
                        ? 'Your backend session is no longer valid. Backend mode has been turned off.'
                        : 'Unable to sync right now. Please try again shortly.'
                );
                return;
            }

            const result = await requestBackendSyncNow({
                refreshPendingAssignments: true,
                refreshPitData: true,
                skipCooldown: true,
                userId: sessionResult.userId,
            });
            if (!result.ok) {
                Alert.alert(
                    'Sync unavailable',
                    result.error === 'rate_limited'
                        ? 'Wait one minute before syncing again.'
                        : 'Unable to sync right now. Please try again shortly.'
                );
                return;
            }

            const summary = [
                'Backend session is still valid.',
                getQueuedUploadSummary(
                    result.attemptedCount ?? 0,
                    result.uploadedCount ?? 0,
                    result.remainingCount ?? 0
                ),
                result.assignmentsRefreshed ? 'Pending assignments refreshed.' : null,
                result.pitDataRefreshed
                    ? `Pit data refreshed${typeof result.pitProfileCount === 'number' ? ` for ${result.pitProfileCount} ${result.pitProfileCount === 1 ? 'team' : 'teams'}.` : '.'}`
                    : null,
            ]
                .filter((line): line is string => line !== null)
                .join('\n');

            Alert.alert('Sync complete', summary);
        } catch (error) {
            Alert.alert('Sync unavailable', 'Unable to sync right now. Please try again shortly.');
        } finally {
            setIsSyncing(false);
        }
    };

    const handleActivate = async () => {
        const validationError = getActivationKeyValidationError(rawKey);
        if (validationError) {
            setErrorMessage(validationError);
            return;
        }

        setErrorMessage(null);

        const result = await activateKey(trimmedKey);
        if (!result.ok) {
            setErrorMessage(
                result.error === 'backend_unavailable'
                    ? 'Backend sync is unavailable on this build'
                    : result.error === 'invalid_key'
                        ? 'Invalid or inactive key'
                        : result.error === 'invalid_format'
                            ? 'Enter a valid key'
                            : result.error === 'rate_limited'
                                ? 'Wait one minute before trying again'
                                : 'Unable to activate key right now'
            );
            return;
        }

        setRawKey('');
    };

    const handleDisableBackend = async () => {
        setIsDisablingBackend(true);
        try {
            setErrorMessage(null);
            setRawKey('');
            await resetKey();
        } finally {
            setIsDisablingBackend(false);
        }
    };

    return (
        <Card>
            <CardHeader className="flex-col items-start gap-1">
                <CardTitle>Backend Connection</CardTitle>
                <CardDescription>{statusLabel}</CardDescription>
            </CardHeader>
            <CardContent>
                {!isBackendAvailable ? (
                    <CardDescription>
                        Backend sync is unavailable on this build. Agath will keep running in standard local mode.
                    </CardDescription>
                ) : isAuthenticated ? (
                    <>
                        <CardDescription>
                            Backend mode is enabled. Agath rechecks your session, assignments, pit data, and queued uploads automatically every 10 minutes while the app is open. Use the sync button below to force a manual refresh at any time.
                        </CardDescription>
                        <Button
                            variant="secondary"
                            disabled={isSyncing || isDisablingBackend}
                            onPress={() => {
                                void handleSyncNow();
                            }}
                        >
                            {isSyncing ? 'Syncing...' : 'Sync'}
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={isSyncing || isDisablingBackend}
                            onPress={() => {
                                void handleDisableBackend();
                            }}
                        >
                            {isDisablingBackend ? 'Turning off...' : 'Turn off backend mode'}
                        </Button>
                    </>
                ) : (
                    <>
                        <Input
                            label="Backend Key (optional)"
                            value={rawKey}
                            onChangeText={(value) => {
                                setRawKey(value);
                                if (errorMessage) {
                                    setErrorMessage(null);
                                }
                            }}
                            autoCapitalize="none"
                            autoComplete="off"
                            autoCorrect={false}
                            importantForAutofill="no"
                            secureTextEntry
                            editable={!isActivating}
                            error={errorMessage ?? undefined}
                            placeholder="Paste backend key"
                            textContentType="none"
                        />
                        <CardDescription>
                            Local scouting stays active unless you enable backend mode with a valid key.
                        </CardDescription>
                        <Button
                            disabled={isActivating || trimmedKey.length === 0}
                            onPress={() => {
                                void handleActivate();
                            }}
                        >
                            {isActivating ? 'Activating...' : 'Enable backend mode'}
                        </Button>
                    </>
                )}
            </CardContent>
        </Card>
    );
}

function formatFileDataSummary(count: number, singular: string, plural: string): string {
    return `${count} ${count === 1 ? singular : plural}`;
}

function getManagedDataSourceLabel(source: ManagedDataSource | null | undefined): string {
    if (source === 'android-shared-folder') {
        return 'the selected Android Files folder';
    }

    if (source === 'documents') {
        return Platform.OS === 'ios'
            ? 'the Files app document folder'
            : 'the app document folder';
    }

    return 'the managed data file';
}

function formatImportResultMessage(result: ManagedDataImportResult): string {
    const sourceLabel = result.source === 'picked-file'
        ? 'the selected file'
        : getManagedDataSourceLabel(result.source);
    const importedSummary = `${formatFileDataSummary(result.importedScoutingEntryCount, 'scouting entry', 'scouting entries')} and ${formatFileDataSummary(result.importedPitScoutingEntryCount, 'pit entry', 'pit entries')}`;
    const resultingSummary = `${formatFileDataSummary(result.resultingScoutingEntryCount, 'scouting entry', 'scouting entries')} and ${formatFileDataSummary(result.resultingPitScoutingEntryCount, 'pit entry', 'pit entries')}`;

    if (result.mode === 'replace') {
        return `Replaced local data with ${importedSummary} from ${sourceLabel}. Local totals now match ${resultingSummary}.`;
    }

    return `Imported ${importedSummary} from ${sourceLabel}. Local totals are now ${resultingSummary}.`;
}

function DataFilesCard() {
    const { theme } = useTheme();
    const [status, setStatus] = useState<ManagedDataStatus | null>(null);
    const [isLoadingStatus, setIsLoadingStatus] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [isChoosingAndroidFolder, setIsChoosingAndroidFolder] = useState(false);
    const [resultMessage, setResultMessage] = useState<string | null>(null);

    const refreshStatus = useCallback(async () => {
        try {
            const nextStatus = await getManagedDataStatus();
            setStatus(nextStatus);
        } catch (error) {
            Alert.alert('Data files unavailable', getPublicErrorMessage(error, 'Unable to load data file status.'));
        } finally {
            setIsLoadingStatus(false);
        }
    }, []);

    useEffect(() => {
        void refreshStatus();
    }, [refreshStatus]);

    const runManagedImport = useCallback(async (
        mode: ManagedDataImportMode,
        source?: ManagedDataSource | null
    ) => {
        setIsImporting(true);
        setResultMessage(null);
        try {
            const result = await importManagedDataBundle(mode, source);
            setResultMessage(formatImportResultMessage(result));
        } catch (error) {
            Alert.alert('Import failed', getPublicErrorMessage(error, 'Unable to import the managed data file.'));
        } finally {
            setIsImporting(false);
            await refreshStatus();
        }
    }, [refreshStatus]);

    const runPickedImport = useCallback(async (mode: ManagedDataImportMode) => {
        setIsImporting(true);
        setResultMessage(null);
        try {
            const result = await importPickedDataBundle(mode);
            if (!result) {
                return;
            }

            setResultMessage(formatImportResultMessage(result));
        } catch (error) {
            Alert.alert('Import failed', getPublicErrorMessage(error, 'Unable to import the selected data file.'));
        } finally {
            setIsImporting(false);
            await refreshStatus();
        }
    }, [refreshStatus]);

    const promptImportMode = useCallback((
        runImport: (mode: ManagedDataImportMode) => void,
        sourceDescription: string
    ) => {
        Alert.alert(
            'Import data',
            `${sourceDescription} Choose whether to merge records into the current local data or replace everything with the file contents.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Add / Update',
                    onPress: () => {
                        runImport('merge');
                    },
                },
                {
                    text: 'Replace All',
                    style: 'destructive',
                    onPress: () => {
                        runImport('replace');
                    },
                },
            ]
        );
    }, []);

    const promptSyncConflict = (source: ManagedDataSource | null | undefined) => {
        Alert.alert(
            'File changes detected',
            `Agath found a newer data file in ${getManagedDataSourceLabel(source)}. Import it first to keep those edits, or overwrite it with the app's current local data.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Import',
                    onPress: () => {
                        promptImportMode(
                            (mode) => {
                                void runManagedImport(mode, source ?? status?.availableImportSource ?? null);
                            },
                            `Import the file from ${getManagedDataSourceLabel(source)}.`
                        );
                    },
                },
                {
                    text: 'Overwrite',
                    style: 'destructive',
                    onPress: () => {
                        void runSync(true);
                    },
                },
            ]
        );
    };

    const runSync = useCallback(async (force: boolean = false) => {
        setIsSyncing(true);
        setResultMessage(null);
        try {
            const result = await syncManagedDataBundle({ force });

            if (!result.ok) {
                if (result.reason === 'pending_external_changes') {
                    promptSyncConflict(result.source);
                    return;
                }

                Alert.alert('Data files unavailable', 'Managed data files are unavailable on this platform.');
                return;
            }

            const summaries = [
                `Synced ${formatFileDataSummary(result.localScoutingEntryCount ?? 0, 'scouting entry', 'scouting entries')} and ${formatFileDataSummary(result.localPitScoutingEntryCount ?? 0, 'pit entry', 'pit entries')} to agath-data.json.`,
                Platform.OS === 'android' && !status?.androidDirectoryConfigured
                    ? 'Choose an Android folder below to make the file visible in Files outside the app.'
                    : null,
            ]
                .filter((line): line is string => line !== null)
                .join(' ');

            setResultMessage(summaries);
        } catch (error) {
            Alert.alert('Sync failed', getPublicErrorMessage(error, 'Unable to sync the managed data files.'));
        } finally {
            setIsSyncing(false);
            await refreshStatus();
        }
    }, [promptSyncConflict, refreshStatus, status?.androidDirectoryConfigured]);

    const handleImportPress = useCallback(() => {
        const managedImportSource = status?.availableImportSource ?? null;

        if (!managedImportSource) {
            promptImportMode(
                (mode) => {
                    void runPickedImport(mode);
                },
                'Pick an Agath data JSON file from Files.'
            );
            return;
        }

        Alert.alert(
            'Import data',
            'Choose whether to import the file Agath manages for you or pick another data file from Files.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Managed File',
                    onPress: () => {
                        promptImportMode(
                            (mode) => {
                                void runManagedImport(mode, managedImportSource);
                            },
                            `Import the file from ${getManagedDataSourceLabel(managedImportSource)}.`
                        );
                    },
                },
                {
                    text: 'Pick File',
                    onPress: () => {
                        promptImportMode(
                            (mode) => {
                                void runPickedImport(mode);
                            },
                            'Pick an Agath data JSON file from Files.'
                        );
                    },
                },
            ]
        );
    }, [promptImportMode, runManagedImport, runPickedImport, status?.availableImportSource]);

    const handleChooseAndroidFolder = useCallback(async () => {
        if (Platform.OS !== 'android') {
            return;
        }

        setIsChoosingAndroidFolder(true);
        setResultMessage(null);
        try {
            const selection = await chooseAndroidManagedDataDirectory();
            if (selection.canceled) {
                return;
            }

            const syncResult = await syncManagedDataBundle();
            if (!syncResult.ok && syncResult.reason === 'pending_external_changes') {
                promptSyncConflict(syncResult.source);
                return;
            }

            setResultMessage('Android Files folder selected. Agath will keep agath-data.json mirrored there whenever local data changes.');
        } catch (error) {
            Alert.alert('Folder selection failed', getPublicErrorMessage(error, 'Unable to configure the Android Files folder.'));
        } finally {
            setIsChoosingAndroidFolder(false);
            await refreshStatus();
        }
    }, [promptSyncConflict, refreshStatus]);

    const isBusy = isLoadingStatus || isSyncing || isImporting || isChoosingAndroidFolder;
    const scoutingSummary = status
        ? formatFileDataSummary(status.localScoutingEntryCount, 'scouting entry', 'scouting entries')
        : '0 scouting entries';
    const pitSummary = status
        ? formatFileDataSummary(status.localPitScoutingEntryCount, 'pit entry', 'pit entries')
        : '0 pit entries';
    const visibilityMessage = Platform.OS === 'ios'
        ? 'On iPhone and iPad, agath-data.json appears in Files under On My iPhone > Agath.'
        : status?.androidDirectoryConfigured
            ? 'Android is mirroring agath-data.json into the Files folder you selected.'
            : 'Choose an Android folder once so agath-data.json is visible in Files outside the app.';
    const pendingChangeMessage = status?.pendingExternalChangeSource
        ? `A newer file version was detected in ${getManagedDataSourceLabel(status.pendingExternalChangeSource)}. Import it before syncing again, or force an overwrite.`
        : 'Agath keeps agath-data.json current after local data changes and app launches.';

    return (
        <Card>
            <CardHeader className="flex-col items-start gap-1">
                <CardTitle>
                    <View className="flex-row items-center gap-2">
                        <FolderOpen size={18} color={theme.colors.mutedForeground} />
                        <Text style={{ color: theme.colors.foreground }} className="text-base font-semibold">Data Files</Text>
                    </View>
                </CardTitle>
                <CardDescription>
                    {isLoadingStatus
                        ? 'Checking managed data files...'
                        : `Managing ${scoutingSummary} and ${pitSummary} through agath-data.json.`}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <View className="gap-3">
                    <Text style={{ color: theme.colors.mutedForeground }} className="text-sm">
                        {visibilityMessage}
                    </Text>
                    <Text style={{ color: status?.pendingExternalChangeSource ? theme.colors.destructive : theme.colors.mutedForeground }} className="text-sm">
                        {pendingChangeMessage}
                    </Text>
                    <Button
                        variant="secondary"
                        disabled={isBusy}
                        onPress={() => {
                            void runSync();
                        }}
                    >
                        {isSyncing ? 'Syncing files...' : 'Sync Data Files'}
                    </Button>
                    <Button
                        variant="outline"
                        disabled={isBusy}
                        onPress={handleImportPress}
                    >
                        {isImporting ? 'Importing...' : 'Import Data'}
                    </Button>
                    {Platform.OS === 'android' && (
                        <Button
                            variant="outline"
                            disabled={isBusy}
                            onPress={() => {
                                void handleChooseAndroidFolder();
                            }}
                        >
                            {isChoosingAndroidFolder
                                ? 'Opening Files...'
                                : status?.androidDirectoryConfigured
                                    ? 'Change Android Folder'
                                    : 'Choose Android Folder'}
                        </Button>
                    )}
                    {resultMessage && (
                        <Text style={{ color: theme.colors.primary }} className="text-sm font-medium">
                            {resultMessage}
                        </Text>
                    )}
                </View>
            </CardContent>
        </Card>
    );
}

function DevToolsCard() {
    const { theme } = useTheme();
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<string | null>(null);

    const handleSpawnData = () => {
        Alert.alert(
            'Spawn Test Data',
            'This will add 30 realistic scouting entries to your data. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Spawn',
                    style: 'destructive',
                    onPress: async () => {
                        setLoading(true);
                        setResult(null);
                        try {
                            const entries = generateTestData();
                            for (const entry of entries) {
                                await saveScoutingEntry(entry);
                            }
                            setResult(`✓ Spawned ${entries.length} entries`);
                        } catch (error) {
                            setResult('✗ Failed to spawn data');
                        } finally {
                            setLoading(false);
                        }
                    },
                },
            ]
        );
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <View className="flex-row items-center gap-2">
                        <FlaskConical size={18} color={theme.colors.destructive} />
                        <Text style={{ color: theme.colors.foreground }} className="text-base font-semibold">Developer Tools</Text>
                    </View>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <View className="gap-3">
                    <Text style={{ color: theme.colors.mutedForeground }} className="text-xs">
                        Spawns 30 realistic scouting entries across 12 FRC teams. Disable this button by setting SHOW_TEST_DATA_BUTTON to false in lib/devFlags.ts.
                    </Text>
                    <Button
                        variant="destructive"
                        onPress={handleSpawnData}
                        disabled={loading}
                    >
                        {loading ? (
                            <View className="flex-row items-center gap-2">
                                <ActivityIndicator size="small" color={theme.colors.destructiveForeground} />
                                <Text style={{ color: theme.colors.destructiveForeground }} className="font-medium text-sm">Spawning...</Text>
                            </View>
                        ) : (
                            'Spawn Test Data'
                        )}
                    </Button>
                    {result && (
                        <Text
                            style={{ color: result.startsWith('✓') ? theme.colors.primary : theme.colors.destructive }}
                            className="text-sm font-medium text-center"
                        >
                            {result}
                        </Text>
                    )}
                </View>
            </CardContent>
        </Card>
    );
}

export default function SettingsScreen() {
    const insets = useSafeAreaInsets();
    const { theme, themeName, setTheme } = useTheme();
    const { scaleOption, setScaleOption, scaled } = useUIScale();

    const lightThemes = Object.entries(themes).filter(([_, t]) => !t.isDark);
    const darkThemes = Object.entries(themes).filter(([_, t]) => t.isDark);

    const scaleOptions = Object.keys(UI_SCALE_VALUES) as UIScaleOption[];

    const { height: tabBarHeight, marginBottom: tabBarMarginBottom } = useTabBarMetrics();
    const bottomPadding = tabBarHeight + Math.max(insets.bottom, tabBarMarginBottom) + 16;

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ThemedScrollView
                contentContainerStyle={{
                    paddingTop: insets.top + 16,
                    paddingBottom: bottomPadding,
                    paddingHorizontal: 16,
                    gap: 16,
                }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            >
                <Card>
                    <CardHeader>
                        <CardTitle>
                            <View className="flex-row items-center gap-2">
                                <Smartphone size={18} color={theme.colors.mutedForeground} />
                                <Text style={{ color: theme.colors.foreground }} className="text-base font-semibold">UI Scale</Text>
                            </View>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <View className="flex-row gap-2">
                            {scaleOptions.map((option) => {
                                const isSelected = scaleOption === option;
                                return (
                                    <Pressable
                                        key={option}
                                        onPress={() => setScaleOption(option)}
                                        className="flex-1"
                                    >
                                        <View
                                            style={{
                                                backgroundColor: isSelected ? theme.colors.primary : theme.colors.secondary,
                                                borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                                            }}
                                            className="items-center justify-center rounded-lg border py-3"
                                        >
                                            <Text
                                                style={{
                                                    color: isSelected ? theme.colors.primaryForeground : theme.colors.foreground,
                                                    fontSize: 13,
                                                }}
                                                className="font-medium"
                                            >
                                                {UI_SCALE_LABELS[option]}
                                            </Text>
                                            <Text
                                                style={{
                                                    color: isSelected ? theme.colors.primaryForeground : theme.colors.mutedForeground,
                                                    fontSize: 11,
                                                    opacity: 0.8,
                                                }}
                                            >
                                                {Math.round(UI_SCALE_VALUES[option] * 100)}%
                                            </Text>
                                        </View>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>
                            <View className="flex-row items-center gap-2">
                                <Moon size={18} color={theme.colors.mutedForeground} />
                                <Text style={{ color: theme.colors.foreground }} className="text-base font-semibold">Dark Themes</Text>
                            </View>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <View className="flex-row flex-wrap gap-3">
                            {darkThemes.map(([key, t]) => (
                                <ThemeCard
                                    key={key}
                                    themeKey={key}
                                    themeName={t.name}
                                    isSelected={themeName === key}
                                    isDark={t.isDark}
                                    colors={{
                                        background: t.colors.background,
                                        foreground: t.colors.foreground,
                                        primary: t.colors.primary,
                                        secondary: t.colors.secondary,
                                        accent: t.colors.accent,
                                    }}
                                    onSelect={() => setTheme(key)}
                                />
                            ))}
                        </View>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>
                            <View className="flex-row items-center gap-2">
                                <Sun size={18} color={theme.colors.mutedForeground} />
                                <Text style={{ color: theme.colors.foreground }} className="text-base font-semibold">Light Themes</Text>
                            </View>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <View className="flex-row flex-wrap gap-3">
                            {lightThemes.map(([key, t]) => (
                                <ThemeCard
                                    key={key}
                                    themeKey={key}
                                    themeName={t.name}
                                    isSelected={themeName === key}
                                    isDark={t.isDark}
                                    colors={{
                                        background: t.colors.background,
                                        foreground: t.colors.foreground,
                                        primary: t.colors.primary,
                                        secondary: t.colors.secondary,
                                        accent: t.colors.accent,
                                    }}
                                    onSelect={() => setTheme(key)}
                                />
                            ))}
                        </View>
                    </CardContent>
                </Card>

                <BackendConnectionCard />

                <DataFilesCard />

                {SHOW_TEST_DATA_BUTTON && <DevToolsCard />}
            </ThemedScrollView>
        </KeyboardAvoidingView>
    );
}
