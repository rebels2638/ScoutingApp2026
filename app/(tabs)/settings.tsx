import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { getActivationKeyValidationError, useBackendAuth } from '@/lib/backend/auth';
import { requestBackendSyncNow } from '@/lib/backend/sync';
import { SHOW_TEST_DATA_BUTTON } from '@/lib/devFlags';
import { saveScoutingEntry } from '@/lib/storage';
import { generateTestData } from '@/lib/testData';
import { ThemedScrollView, themes, useTheme, useThemeColors } from '@/lib/theme';
import {
    UI_SCALE_LABELS,
    UI_SCALE_VALUES,
    useUIScale,
    type UIScaleOption,
} from '@/lib/ui-scale';
import { Check, FlaskConical, Moon, Smartphone, Sun } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
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

function BackendConnectionCard() {
    const { activateKey, authState, isActivating, isBackendAvailable, resetKey, userId } = useBackendAuth();
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
        setIsSyncing(true);
        try {
            const result = await requestBackendSyncNow();
            if (!result.ok) {
                Alert.alert('Sync unavailable', 'Unable to sync right now. Please try again shortly.');
                return;
            }

            Alert.alert('Sync started', 'Queued scouting data will sync in the background.');
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
                                ? 'Wait a moment before trying again'
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
                            Backend mode is enabled for syncing uploads and receiving assignments. Turn it off anytime to go back to local scouting.
                        </CardDescription>
                        <Button
                            variant="secondary"
                            disabled={isSyncing || isDisablingBackend}
                            onPress={() => {
                                void handleSyncNow();
                            }}
                        >
                            {isSyncing ? 'Syncing...' : 'Sync now'}
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
        <ThemedScrollView
            contentContainerStyle={{
                paddingTop: insets.top + 16,
                paddingBottom: bottomPadding,
                paddingHorizontal: 16,
                gap: 16,
            }}
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

            {SHOW_TEST_DATA_BUTTON && <DevToolsCard />}
        </ThemedScrollView>
    );
}
