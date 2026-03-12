import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import {
    APP_DESCRIPTION,
    APP_DEVELOPERS,
    APP_ISSUES_URL,
    APP_LICENSE_NAME,
    APP_LICENSE_SUMMARY,
    APP_LICENSE_URL,
    APP_REPOSITORY_URL,
    APP_TEAM_NAME,
    OPEN_SOURCE_PACKAGES,
} from '@/lib/about';
import { springConfigs, timingConfigs } from '@/lib/animations';
import { getActivationKeyValidationError, useBackendAuth } from '@/lib/backend/auth';
import { beginBackendSyncAttempt, requestBackendSyncNow } from '@/lib/backend/sync';
import {
    exportManagedDataBundle,
    getManagedDataStatus,
    importPickedDataBundle,
    type ManagedDataExportResult,
    type ManagedDataImportMode,
    type ManagedDataImportResult,
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
import Constants from 'expo-constants';
import { Check, FlaskConical, FolderOpen, Info, Moon, Smartphone, Sun, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
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

interface AboutSectionProps {
    title: string;
    description?: string;
    action?: React.ReactNode;
    children: React.ReactNode;
}

function AboutSection({ title, description, action, children }: AboutSectionProps) {
    const colors = useThemeColors();

    return (
        <View
            style={{
                backgroundColor: colors.secondary,
                borderColor: colors.border,
                borderWidth: 1,
            }}
            className="rounded-xl p-4"
        >
            <View className="gap-3">
                <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1 gap-1">
                        <Text className="text-base font-semibold">{title}</Text>
                        {description ? (
                            <Text style={{ color: colors.mutedForeground }} className="text-sm leading-5">
                                {description}
                            </Text>
                        ) : null}
                    </View>
                    {action}
                </View>
                {children}
            </View>
        </View>
    );
}

function AboutAppCard() {
    const { theme } = useTheme();
    const { scaled } = useUIScale();
    const [open, setOpen] = useState(false);
    const [showOpenSource, setShowOpenSource] = useState(false);
    const modalScale = useSharedValue(0.96);
    const modalOpacity = useSharedValue(0);
    const appName = Constants.expoConfig?.name ?? 'Agath';
    const appVersion = Constants.expoConfig?.version ?? '1.0.0';

    useEffect(() => {
        if (open) {
            modalScale.value = withSpring(1, springConfigs.gentle);
            modalOpacity.value = withTiming(1, timingConfigs.fast);
            return;
        }

        modalScale.value = 0.96;
        modalOpacity.value = 0;
    }, [modalOpacity, modalScale, open]);

    const modalAnimatedStyle = useAnimatedStyle(() => ({
        opacity: modalOpacity.value,
        transform: [{ scale: modalScale.value }],
    }));

    const openLink = async (label: string, url: string) => {
        try {
            const canOpen = await Linking.canOpenURL(url);
            if (!canOpen) {
                throw new Error('Unable to open URL');
            }

            await Linking.openURL(url);
        } catch (error) {
            Alert.alert('Unable to open link', `Unable to open ${label} right now.`);
        }
    };

    return (
        <>
            <Card>
                <CardHeader className="flex-col items-start gap-1">
                    <CardTitle>
                        <View className="flex-row items-center gap-2">
                            <Info size={18} color={theme.colors.mutedForeground} />
                            <Text style={{ color: theme.colors.foreground }} className="text-base font-semibold">About Agath</Text>
                        </View>
                    </CardTitle>
                    <CardDescription>
                        Versioning Information, Developer Credits, Open-Source Notices, and more.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button variant="secondary" onPress={() => setOpen(true)}>
                        Open Info Window
                    </Button>
                </CardContent>
            </Card>

            <Modal
                visible={open}
                transparent
                animationType="fade"
                onRequestClose={() => setOpen(false)}
            >
                <View className="flex-1 items-center justify-center bg-black/60 px-4 py-6">
                    <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setOpen(false)} />
                    <Animated.View
                        style={[
                            {
                                backgroundColor: theme.colors.card,
                                borderColor: theme.colors.border,
                                borderWidth: 1,
                                width: '100%',
                                maxWidth: 720,
                                maxHeight: '94%',
                            },
                            modalAnimatedStyle,
                        ]}
                        className="overflow-hidden rounded-2xl"
                    >
                        <View
                            style={{ borderBottomColor: theme.colors.border, borderBottomWidth: 1 }}
                            className="flex-row items-center justify-between px-5 py-4"
                        >
                            <View className="flex-1 pr-4">
                                <Text className="text-lg font-semibold">About {appName}</Text>
                                <Text style={{ color: theme.colors.mutedForeground }} className="text-sm">
                                    App details, credits, and open-source notices.
                                </Text>
                            </View>
                            <Pressable
                                onPress={() => setOpen(false)}
                                className="items-center justify-center rounded-md"
                                style={{ height: scaled(36), width: scaled(36) }}
                                hitSlop={8}
                            >
                                <X size={scaled(18)} color={theme.colors.mutedForeground} />
                            </Pressable>
                        </View>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ padding: 20 }}
                        >
                            <View className="gap-4">
                                <View
                                    style={{
                                        backgroundColor: theme.colors.secondary,
                                        borderColor: theme.colors.border,
                                        borderWidth: 1,
                                    }}
                                    className="overflow-hidden rounded-xl"
                                >
                                    <View className="gap-3 p-4">
                                        <View className="gap-1">
                                            <Text className="text-lg font-semibold">{appName} v{appVersion}</Text>
                                            <Text style={{ color: theme.colors.mutedForeground }} className="text-sm leading-5">
                                                {APP_DESCRIPTION}
                                            </Text>
                                            <Text style={{ color: theme.colors.mutedForeground }} className="text-sm">
                                                {APP_TEAM_NAME}
                                            </Text>
                                        </View>
                                    </View>
                                </View>

                                <AboutSection
                                    title="Repository"
                                    description="Source code, issue tracking, and project history live on GitHub."
                                >
                                    <View className="gap-3">
                                        <Text style={{ color: theme.colors.mutedForeground }} className="text-sm leading-5">
                                            {APP_REPOSITORY_URL}
                                        </Text>
                                        <View className="flex-row flex-wrap gap-2">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onPress={() => {
                                                    void openLink('the repository', APP_REPOSITORY_URL);
                                                }}
                                            >
                                                Open Repository
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onPress={() => {
                                                    void openLink('the issue tracker', APP_ISSUES_URL);
                                                }}
                                            >
                                                Open Issues
                                            </Button>
                                        </View>
                                    </View>
                                </AboutSection>

                                <AboutSection
                                    title="Developers"
                                    description="Current app contributors listed in this build."
                                >
                                    <View className="gap-3">
                                        {APP_DEVELOPERS.map((developer) => (
                                            <View
                                                key={developer.name}
                                                style={{
                                                    backgroundColor: theme.colors.card,
                                                    borderColor: theme.colors.border,
                                                    borderWidth: 1,
                                                }}
                                                className="rounded-lg p-3"
                                            >
                                                <View className="flex-row items-center justify-between gap-3">
                                                    <View className="flex-1 gap-1">
                                                        <Text className="text-sm font-semibold">{developer.name}</Text>
                                                        <Text style={{ color: theme.colors.mutedForeground }} className="text-sm">
                                                            {developer.role}
                                                        </Text>
                                                    </View>
                                                    {developer.url ? (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onPress={() => {
                                                                void openLink(`${developer.name}'s profile`, developer.url as string);
                                                            }}
                                                        >
                                                            GitHub
                                                        </Button>
                                                    ) : null}
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                </AboutSection>

                                <AboutSection
                                    title="App License"
                                    description="Agath is open source and may be forked or adapted for other teams under its published terms."
                                >
                                    <View className="gap-3">
                                        <View
                                            style={{
                                                backgroundColor: theme.colors.card,
                                                borderColor: theme.colors.border,
                                                borderWidth: 1,
                                            }}
                                            className="rounded-lg p-3"
                                        >
                                            <Text className="text-sm font-semibold">{APP_LICENSE_NAME}</Text>
                                            <Text style={{ color: theme.colors.mutedForeground }} className="mt-2 text-sm leading-5">
                                                {APP_LICENSE_SUMMARY}
                                            </Text>
                                        </View>
                                        <View className="flex-row flex-wrap gap-2">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onPress={() => {
                                                    void openLink('the GPL license page', APP_LICENSE_URL);
                                                }}
                                            >
                                                Open License Text
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onPress={() => {
                                                    void openLink('the repository', APP_REPOSITORY_URL);
                                                }}
                                            >
                                                Open Source Code
                                            </Button>
                                        </View>
                                    </View>
                                </AboutSection>

                                <AboutSection
                                    title="Open-Source Packages"
                                    description={`This build depends on ${OPEN_SOURCE_PACKAGES.length} open-source packages. Their license types are listed below.`}
                                    action={(
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onPress={() => setShowOpenSource((current) => !current)}
                                        >
                                            {showOpenSource ? 'Hide' : 'Show'}
                                        </Button>
                                    )}
                                >
                                    {showOpenSource ? (
                                        <View className="gap-2">
                                            {OPEN_SOURCE_PACKAGES.map((pkg) => (
                                                <View
                                                    key={pkg.name}
                                                    style={{
                                                        backgroundColor: theme.colors.card,
                                                        borderColor: theme.colors.border,
                                                        borderWidth: 1,
                                                    }}
                                                    className="flex-row items-center justify-between gap-3 rounded-lg px-3 py-2.5"
                                                >
                                                    <Text className="flex-1 text-sm font-medium">{pkg.name}</Text>
                                                    <Text style={{ color: theme.colors.mutedForeground }} className="text-sm">
                                                        {pkg.license}
                                                    </Text>
                                                </View>
                                            ))}
                                        </View>
                                    ) : (
                                        <Text style={{ color: theme.colors.mutedForeground }} className="text-sm leading-5">
                                            Expand this section to see what open source packages were used in this build.
                                        </Text>
                                    )}
                                </AboutSection>
                            </View>
                        </ScrollView>
                    </Animated.View>
                </View>
            </Modal>
        </>
    );
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

function formatImportResultMessage(result: ManagedDataImportResult): string {
    const sourceLabel = result.fileName ? result.fileName : 'the selected file';
    const importedSummary = `${formatFileDataSummary(result.importedScoutingEntryCount, 'scouting entry', 'scouting entries')} and ${formatFileDataSummary(result.importedPitScoutingEntryCount, 'pit entry', 'pit entries')}`;
    const resultingSummary = `${formatFileDataSummary(result.resultingScoutingEntryCount, 'scouting entry', 'scouting entries')} and ${formatFileDataSummary(result.resultingPitScoutingEntryCount, 'pit entry', 'pit entries')}`;

    if (result.mode === 'replace') {
        return `Replaced local data with ${importedSummary} from ${sourceLabel}. Local totals now match ${resultingSummary}.`;
    }

    return `Merged ${importedSummary} from ${sourceLabel}. Local totals are now ${resultingSummary}.`;
}

function formatExportResultMessage(result: ManagedDataExportResult): string {
    const exportedSummary = formatFileDataSummary(result.exportedScoutingEntryCount, 'scouting entry', 'scouting entries');

    if (result.destination === 'android-folder') {
        return `Saved ${result.fileName} with ${exportedSummary} to the folder you selected.`;
    }

    if (result.destination === 'share-sheet') {
        return `Opened the export sheet for ${result.fileName}. Choose Save to Files there if you want ${exportedSummary} in the Files app.`;
    }

    return `Downloaded ${result.fileName} with ${exportedSummary}.`;
}

function DataFilesCard() {
    const { theme } = useTheme();
    const [status, setStatus] = useState<ManagedDataStatus | null>(null);
    const [isLoadingStatus, setIsLoadingStatus] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [resultMessage, setResultMessage] = useState<string | null>(null);

    const refreshStatus = useCallback(async () => {
        try {
            const nextStatus = await getManagedDataStatus();
            setStatus(nextStatus);
        } catch (error) {
            Alert.alert('Data transfer unavailable', getPublicErrorMessage(error, 'Unable to load local data totals for import/export.'));
        } finally {
            setIsLoadingStatus(false);
        }
    }, []);

    useEffect(() => {
        void refreshStatus();
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

    const runExport = useCallback(async () => {
        setIsExporting(true);
        setResultMessage(null);
        try {
            const result = await exportManagedDataBundle();
            if (!result) {
                return;
            }

            setResultMessage(formatExportResultMessage(result));
        } catch (error) {
            Alert.alert('Export failed', getPublicErrorMessage(error, 'Unable to export the current data file.'));
        } finally {
            setIsExporting(false);
            await refreshStatus();
        }
    }, [refreshStatus]);

    const promptImportMode = useCallback((
        runImport: (mode: ManagedDataImportMode) => void
    ) => {
        Alert.alert(
            'Import data',
            'Choose how to load the selected JSON file. Full replacement is recommended. Merge attempts to combine records and can overwrite matching scouting IDs or pit team entries.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Merge (Not Recommended)',
                    onPress: () => {
                        runImport('merge');
                    },
                },
                {
                    text: 'Full Replacement',
                    style: 'destructive',
                    onPress: () => {
                        runImport('replace');
                    },
                },
            ]
        );
    }, []);

    const handleImportPress = useCallback(() => {
        promptImportMode((mode) => {
            void runPickedImport(mode);
        });
    }, [promptImportMode, runPickedImport]);

    const isBusy = isLoadingStatus || isExporting || isImporting;
    const scoutingSummary = status
        ? formatFileDataSummary(status.localScoutingEntryCount, 'scouting entry', 'scouting entries')
        : '0 scouting entries';
    const pitSummary = status
        ? formatFileDataSummary(status.localPitScoutingEntryCount, 'pit entry', 'pit entries')
        : '0 pit entries';
    const exportFlowMessage = Platform.OS === 'android'
        ? 'Export writes a JSON file and opens the Android folder picker so you can choose where it is saved.'
        : Platform.OS === 'ios'
            ? 'Export writes a JSON file and opens the iOS share sheet. Choose Save to Files there if you want the bundle in the Files app.'
            : 'Export downloads a JSON file containing only scouting entries in the browser.';

    return (
        <Card>
            <CardHeader className="flex-col items-start gap-1">
                <CardTitle>
                    <View className="flex-row items-center gap-2">
                        <FolderOpen size={18} color={theme.colors.mutedForeground} />
                        <Text style={{ color: theme.colors.foreground }} className="text-base font-semibold">Data Transfer</Text>
                    </View>
                </CardTitle>
                <CardDescription>
                    {isLoadingStatus
                        ? 'Checking local data totals...'
                        : `${scoutingSummary} ready for export.`}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <View className="gap-3">
                    <Text style={{ color: theme.colors.mutedForeground }} className="text-sm">
                        You may import a JSON file here, or export only your scouting entries as a JSON file.
                    </Text>
                    <Text style={{ color: theme.colors.mutedForeground }} className="text-sm">
                        Full replacement is recommended. Merge can be buggy and is not guaranteed to work correctly, make a backup before using it.
                    </Text>
                    <Button
                        variant="secondary"
                        disabled={isBusy || status?.isSupported === false}
                        onPress={() => {
                            void runExport();
                        }}
                    >
                        {isExporting ? 'Exporting...' : 'Export Scouting Data'}
                    </Button>
                    <Button
                        variant="outline"
                        disabled={isBusy || status?.isSupported === false}
                        onPress={handleImportPress}
                    >
                        {isImporting ? 'Importing...' : 'Import Data'}
                    </Button>
                    <Text style={{ color: theme.colors.mutedForeground }} className="text-sm">
                        {exportFlowMessage}
                    </Text>
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
                automaticallyAdjustKeyboardInsets={false}
                contentContainerStyle={{
                    paddingTop: insets.top + 16,
                    paddingBottom: bottomPadding,
                    paddingHorizontal: 16,
                    gap: 16,
                }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            >
                <AboutAppCard />

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
