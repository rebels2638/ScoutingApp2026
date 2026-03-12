import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, type Theme as NavigationTheme } from '@react-navigation/native';
import * as React from 'react';
import { darkTheme, themes, type Theme } from './themes';

const THEME_STORAGE_KEY = '@agath/theme';

function createNavigationTheme(theme: Theme): NavigationTheme {
    const base = theme.isDark ? DarkTheme : DefaultTheme;
    return {
        ...base,
        dark: theme.isDark,
        colors: {
            ...base.colors,
            primary: theme.colors.primary,
            background: theme.colors.background,
            card: theme.colors.card,
            text: theme.colors.foreground,
            border: theme.colors.border,
            notification: theme.colors.destructive,
        },
    };
}

interface ThemeContextValue {
    theme: Theme;
    themeName: string;
    setTheme: (name: string) => void;
    toggleTheme: () => void;
    isDark: boolean;

    navigationTheme: NavigationTheme;
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
    children: React.ReactNode;
    defaultTheme?: string;
}

export function ThemeProvider({ children, defaultTheme = 'dark' }: ThemeProviderProps) {
    const [themeName, setThemeName] = React.useState(defaultTheme);

    React.useEffect(() => {
        const loadTheme = async () => {
            try {
                const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
                if (stored && themes[stored]) {
                    setThemeName(stored);
                }
            } catch (error) {
                console.warn('Failed to load theme:', error);
            }
        };
        loadTheme();
    }, []);

    const setTheme = React.useCallback(async (name: string) => {
        if (themes[name]) {
            setThemeName(name);
            try {
                await AsyncStorage.setItem(THEME_STORAGE_KEY, name);
            } catch (error) {
                console.warn('Failed to persist theme:', error);
            }
        }
    }, []);

    const toggleTheme = React.useCallback(() => {
        const newTheme = themeName === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    }, [themeName, setTheme]);

    const theme = themes[themeName] ?? darkTheme;
    const navigationTheme = React.useMemo(() => createNavigationTheme(theme), [theme]);

    const value = React.useMemo<ThemeContextValue>(
        () => ({
            theme,
            themeName,
            setTheme,
            toggleTheme,
            isDark: theme.isDark,
            navigationTheme,
        }),
        [theme, themeName, setTheme, toggleTheme, navigationTheme]
    );

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme(): ThemeContextValue {
    const context = React.useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}

export function useThemeColors() {
    const { theme } = useTheme();
    return theme.colors;
}

export function useThemeAnimations() {
    const { theme } = useTheme();
    return theme.animations;
}
