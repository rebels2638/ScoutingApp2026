import FontAwesome from '@expo/vector-icons/FontAwesome';
import { ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useRef } from 'react';
import { AppState, LogBox, Platform, useWindowDimensions } from 'react-native';
import 'react-native-reanimated';
import '../global.css';

import { BackendAuthProvider, useBackendAuth } from '@/lib/backend/auth';
import { BACKEND_AUTO_SYNC_INTERVAL_MS, requestBackendSyncNow } from '@/lib/backend/sync';
import { syncManagedDataBundle } from '@/lib/dataFiles';
import { ThemeProvider, ThemedStatusBar, useTheme } from '@/lib/theme';
import { UIScaleProvider } from '@/lib/ui-scale';

export {
    ErrorBoundary
} from 'expo-router';

export const unstable_settings = {
    initialRouteName: '(tabs)',
};

const IGNORED_DEV_WARNINGS = [
    'SafeAreaView has been deprecated and will be removed in a future release. Please use',
];

if (__DEV__) {
    LogBox.ignoreLogs(IGNORED_DEV_WARNINGS);
}

SplashScreen.preventAutoHideAsync();

const TABLET_MIN_DIMENSION = 600;

export default function RootLayout() {
    const [loaded, error] = useFonts({
        SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
        ...FontAwesome.font,
    });

    useEffect(() => {
        if (error) throw error;
    }, [error]);

    useEffect(() => {
        if (loaded) {
            SplashScreen.hideAsync();
        }
    }, [loaded]);

    if (!loaded) {
        return null;
    }

    return (
        <ThemeProvider defaultTheme="dark">
            <BackendAuthProvider>
                <UIScaleProvider>
                    <RootLayoutNav />
                </UIScaleProvider>
            </BackendAuthProvider>
        </ThemeProvider>
    );
}

function RootLayoutNav() {
    const { navigationTheme } = useTheme();
    const { isBootstrapping } = useBackendAuth();

    if (isBootstrapping) {
        return null;
    }

    return (
        <NavigationThemeProvider value={navigationTheme}>
            <BackendAutoSyncManager />
            <LocalDataFileSyncManager />
            <ResponsiveOrientationManager />
            <ThemedStatusBar />
            <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="compare" options={{ headerShown: false, presentation: 'card' }} />
                <Stack.Screen name="connect" options={{ headerShown: false }} />
                <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
            </Stack>
        </NavigationThemeProvider>
    );
}

function BackendAutoSyncManager() {
    const { authState, isBackendAvailable, isBootstrapping, revalidateSession, userId } = useBackendAuth();
    const appStateRef = useRef(AppState.currentState);
    const isSyncingRef = useRef(false);
    const lastAutoSyncAtRef = useRef(0);
    const isAutoSyncEnabled =
        !isBootstrapping &&
        isBackendAvailable &&
        authState === 'authenticated' &&
        !!userId;

    const runAutoSync = useCallback(async () => {
        if (!isAutoSyncEnabled || appStateRef.current !== 'active' || isSyncingRef.current) {
            return;
        }

        isSyncingRef.current = true;
        lastAutoSyncAtRef.current = Date.now();

        try {
            const sessionResult = await revalidateSession();
            if (!sessionResult.ok) {
                return;
            }

            await requestBackendSyncNow({
                refreshPendingAssignments: true,
                refreshPitData: true,
                skipCooldown: true,
                userId: sessionResult.userId ?? userId,
            });
        } finally {
            isSyncingRef.current = false;
        }
    }, [isAutoSyncEnabled, revalidateSession, userId]);

    useEffect(() => {
        if (!isAutoSyncEnabled) {
            lastAutoSyncAtRef.current = 0;
            isSyncingRef.current = false;
            return;
        }

        void runAutoSync();

        const intervalId = setInterval(() => {
            if (appStateRef.current !== 'active') {
                return;
            }

            void runAutoSync();
        }, BACKEND_AUTO_SYNC_INTERVAL_MS);

        const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
            const previousAppState = appStateRef.current;
            appStateRef.current = nextAppState;

            if (nextAppState !== 'active' || previousAppState === 'active') {
                return;
            }

            if (Date.now() - lastAutoSyncAtRef.current < BACKEND_AUTO_SYNC_INTERVAL_MS) {
                return;
            }

            void runAutoSync();
        });

        return () => {
            clearInterval(intervalId);
            appStateSubscription.remove();
        };
    }, [isAutoSyncEnabled, runAutoSync]);

    return null;
}

function LocalDataFileSyncManager() {
    const appStateRef = useRef(AppState.currentState);
    const isSyncingRef = useRef(false);

    const runDataFileSync = useCallback(async () => {
        if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
            return;
        }

        if (isSyncingRef.current) {
            return;
        }

        isSyncingRef.current = true;
        try {
            await syncManagedDataBundle();
        } finally {
            isSyncingRef.current = false;
        }
    }, []);

    useEffect(() => {
        void runDataFileSync();

        const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
            const previousAppState = appStateRef.current;
            appStateRef.current = nextAppState;

            if (nextAppState === 'active' && previousAppState !== 'active') {
                void runDataFileSync();
            }
        });

        return () => {
            appStateSubscription.remove();
        };
    }, [runDataFileSync]);

    return null;
}

function ResponsiveOrientationManager() {
    const { width, height } = useWindowDimensions();
    const isTablet = Math.min(width, height) >= TABLET_MIN_DIMENSION;

    useEffect(() => {
        if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
            return;
        }

        const updateOrientationLock = async () => {
            if (isTablet) {
                await ScreenOrientation.unlockAsync();
                return;
            }

            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        };

        updateOrientationLock().catch((error) => {
            console.error('Failed to update orientation lock', error);
        });
    }, [isTablet]);

    return null;
}
