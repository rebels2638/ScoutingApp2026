import FontAwesome from '@expo/vector-icons/FontAwesome';
import { ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import '../global.css';

import { BackendAuthProvider, useBackendAuth } from '@/lib/backend/auth';
import { ThemeProvider, ThemedStatusBar, useTheme } from '@/lib/theme';
import { UIScaleProvider } from '@/lib/ui-scale';

export {
    ErrorBoundary
} from 'expo-router';

export const unstable_settings = {
    initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

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
