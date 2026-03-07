export interface ThemeColors {
    background: string;
    foreground: string;

    card: string;
    cardForeground: string;

    primary: string;
    primaryForeground: string;

    secondary: string;
    secondaryForeground: string;

    muted: string;
    mutedForeground: string;

    accent: string;
    accentForeground: string;

    destructive: string;
    destructiveForeground: string;

    border: string;
    input: string;
    ring: string;

    secondaryElevated: string;
    secondaryElevatedForeground: string;

    allianceRed: string;
    allianceRedMuted: string;
    allianceRedForeground: string;
    allianceBlue: string;
    allianceBlueMuted: string;
    allianceBlueForeground: string;
}

export interface ThemeSpacing {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
}

export interface ThemeRadii {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    full: number;
}

export interface ThemeAnimations {
    durationFast: number;
    durationNormal: number;
    durationSlow: number;
    scalePressed: number;
    springDamping: number;
    springStiffness: number;
}

export interface Theme {
    name: string;
    isDark: boolean;
    colors: ThemeColors;
    spacing: ThemeSpacing;
    radii: ThemeRadii;
    animations: ThemeAnimations;
}

const defaultSpacing: ThemeSpacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
};

const defaultRadii: ThemeRadii = {
    xs: 2,
    sm: 4,
    md: 6,
    lg: 8,
    xl: 12,
    full: 9999,
};

const defaultAnimations: ThemeAnimations = {
    durationFast: 150,
    durationNormal: 250,
    durationSlow: 400,
    scalePressed: 0.97,
    springDamping: 15,
    springStiffness: 150,
};

export const darkTheme: Theme = {
    name: 'dark',
    isDark: true,
    colors: {
        background: '#09090B',
        foreground: '#FAFAFA',

        card: '#0A0A0C',
        cardForeground: '#FAFAFA',

        primary: '#FAFAFA',
        primaryForeground: '#18181B',

        secondary: '#27272A',
        secondaryForeground: '#FAFAFA',

        muted: '#27272A',
        mutedForeground: '#A1A1AA',

        accent: '#27272A',
        accentForeground: '#FAFAFA',

        destructive: '#EF4444',
        destructiveForeground: '#FAFAFA',

        border: '#27272A',
        input: '#27272A',
        ring: '#D4D4D8',

        secondaryElevated: '#3F3F46',
        secondaryElevatedForeground: '#FAFAFA',

        allianceRed: '#EF4444',
        allianceRedMuted: '#7F1D1D',
        allianceRedForeground: '#FECACA',
        allianceBlue: '#3B82F6',
        allianceBlueMuted: '#1E3A5F',
        allianceBlueForeground: '#BFDBFE',
    },
    spacing: defaultSpacing,
    radii: defaultRadii,
    animations: defaultAnimations,
};

export const lightTheme: Theme = {
    name: 'Light',
    isDark: false,
    colors: {
        background: '#FAFAFA',
        foreground: '#18181B',

        card: '#FFFFFF',
        cardForeground: '#18181B',

        primary: '#18181B',
        primaryForeground: '#FAFAFA',

        secondary: '#F4F4F5',
        secondaryForeground: '#18181B',

        muted: '#E4E4E7',
        mutedForeground: '#52525B',

        accent: '#E4E4E7',
        accentForeground: '#18181B',

        destructive: '#DC2626',
        destructiveForeground: '#FAFAFA',

        border: '#D4D4D8',
        input: '#D4D4D8',
        ring: '#18181B',

        secondaryElevated: '#D4D4D8',
        secondaryElevatedForeground: '#18181B',

        allianceRed: '#DC2626',
        allianceRedMuted: '#FEE2E2',
        allianceRedForeground: '#991B1B',
        allianceBlue: '#2563EB',
        allianceBlueMuted: '#DBEAFE',
        allianceBlueForeground: '#1E40AF',
    },
    spacing: defaultSpacing,
    radii: defaultRadii,
    animations: defaultAnimations,
};

export const solarizedDarkTheme: Theme = {
    name: 'Solarized Dark',
    isDark: true,
    colors: {
        background: '#002B36',
        foreground: '#839496',

        card: '#073642',
        cardForeground: '#93A1A1',

        primary: '#268BD2',
        primaryForeground: '#FDF6E3',

        secondary: '#073642',
        secondaryForeground: '#839496',

        muted: '#073642',
        mutedForeground: '#657B83',

        accent: '#2AA198',
        accentForeground: '#FDF6E3',

        destructive: '#DC322F',
        destructiveForeground: '#FDF6E3',

        border: '#073642',
        input: '#073642',
        ring: '#268BD2',

        secondaryElevated: '#0A4A5C',
        secondaryElevatedForeground: '#93A1A1',

        allianceRed: '#DC322F',
        allianceRedMuted: '#5F1A19',
        allianceRedForeground: '#F8B4B4',
        allianceBlue: '#268BD2',
        allianceBlueMuted: '#0D3E5C',
        allianceBlueForeground: '#7DD3FC',
    },
    spacing: defaultSpacing,
    radii: defaultRadii,
    animations: defaultAnimations,
};

export const solarizedLightTheme: Theme = {
    name: 'Solarized Light',
    isDark: false,
    colors: {
        background: '#FDF6E3',
        foreground: '#073642',

        card: '#EEE8D5',
        cardForeground: '#073642',

        primary: '#268BD2',
        primaryForeground: '#FDF6E3',

        secondary: '#EEE8D5',
        secondaryForeground: '#073642',

        muted: '#E0DAC9',
        mutedForeground: '#586E75',

        accent: '#2AA198',
        accentForeground: '#FDF6E3',

        destructive: '#DC322F',
        destructiveForeground: '#FDF6E3',

        border: '#D3CBBB',
        input: '#D3CBBB',
        ring: '#268BD2',

        secondaryElevated: '#C9C0AB',
        secondaryElevatedForeground: '#073642',

        allianceRed: '#DC322F',
        allianceRedMuted: '#F9E4E4',
        allianceRedForeground: '#991B1B',
        allianceBlue: '#268BD2',
        allianceBlueMuted: '#D4E8F5',
        allianceBlueForeground: '#075985',
    },
    spacing: defaultSpacing,
    radii: defaultRadii,
    animations: defaultAnimations,
};

export const nordTheme: Theme = {
    name: 'Nord',
    isDark: true,
    colors: {
        background: '#2E3440',
        foreground: '#ECEFF4',

        card: '#3B4252',
        cardForeground: '#ECEFF4',

        primary: '#88C0D0',
        primaryForeground: '#2E3440',

        secondary: '#434C5E',
        secondaryForeground: '#ECEFF4',

        muted: '#434C5E',
        mutedForeground: '#D8DEE9',

        accent: '#81A1C1',
        accentForeground: '#2E3440',

        destructive: '#BF616A',
        destructiveForeground: '#ECEFF4',

        border: '#4C566A',
        input: '#4C566A',
        ring: '#88C0D0',

        secondaryElevated: '#5E6779',
        secondaryElevatedForeground: '#ECEFF4',

        allianceRed: '#BF616A',
        allianceRedMuted: '#59343A',
        allianceRedForeground: '#E5C4C7',
        allianceBlue: '#5E81AC',
        allianceBlueMuted: '#2E4157',
        allianceBlueForeground: '#A3C4E5',
    },
    spacing: defaultSpacing,
    radii: defaultRadii,
    animations: defaultAnimations,
};

export const draculaTheme: Theme = {
    name: 'Dracula',
    isDark: true,
    colors: {
        background: '#282A36',
        foreground: '#F8F8F2',

        card: '#44475A',
        cardForeground: '#F8F8F2',

        primary: '#BD93F9',
        primaryForeground: '#282A36',

        secondary: '#44475A',
        secondaryForeground: '#F8F8F2',

        muted: '#44475A',
        mutedForeground: '#6272A4',

        accent: '#FF79C6',
        accentForeground: '#282A36',

        destructive: '#FF5555',
        destructiveForeground: '#F8F8F2',

        border: '#6272A4',
        input: '#44475A',
        ring: '#BD93F9',

        secondaryElevated: '#5A5D6E',
        secondaryElevatedForeground: '#F8F8F2',

        allianceRed: '#FF5555',
        allianceRedMuted: '#6B2828',
        allianceRedForeground: '#FFB3B3',
        allianceBlue: '#8BE9FD',
        allianceBlueMuted: '#2A4D54',
        allianceBlueForeground: '#B5F0FB',
    },
    spacing: defaultSpacing,
    radii: defaultRadii,
    animations: defaultAnimations,
};

export const githubDarkTheme: Theme = {
    name: 'GitHub Dark',
    isDark: true,
    colors: {
        background: '#0D1117',
        foreground: '#E6EDF3',

        card: '#161B22',
        cardForeground: '#E6EDF3',

        primary: '#238636',
        primaryForeground: '#FFFFFF',

        secondary: '#21262D',
        secondaryForeground: '#E6EDF3',

        muted: '#21262D',
        mutedForeground: '#8B949E',

        accent: '#1F6FEB',
        accentForeground: '#FFFFFF',

        destructive: '#F85149',
        destructiveForeground: '#FFFFFF',

        border: '#30363D',
        input: '#21262D',
        ring: '#238636',

        secondaryElevated: '#30363D',
        secondaryElevatedForeground: '#E6EDF3',

        allianceRed: '#F85149',
        allianceRedMuted: '#5C211D',
        allianceRedForeground: '#FFA198',
        allianceBlue: '#1F6FEB',
        allianceBlueMuted: '#0D2D5C',
        allianceBlueForeground: '#79B8FF',
    },
    spacing: defaultSpacing,
    radii: defaultRadii,
    animations: defaultAnimations,
};

export const monokaiTheme: Theme = {
    name: 'Monokai',
    isDark: true,
    colors: {
        background: '#272822',
        foreground: '#F8F8F2',

        card: '#3E3D32',
        cardForeground: '#F8F8F2',

        primary: '#A6E22E',
        primaryForeground: '#272822',

        secondary: '#3E3D32',
        secondaryForeground: '#F8F8F2',

        muted: '#3E3D32',
        mutedForeground: '#75715E',

        accent: '#E6DB74',
        accentForeground: '#272822',

        destructive: '#F92672',
        destructiveForeground: '#F8F8F2',

        border: '#49483E',
        input: '#3E3D32',
        ring: '#A6E22E',

        secondaryElevated: '#525249',
        secondaryElevatedForeground: '#F8F8F2',

        allianceRed: '#F92672',
        allianceRedMuted: '#6B1A3A',
        allianceRedForeground: '#FFB3D0',
        allianceBlue: '#66D9EF',
        allianceBlueMuted: '#1F4550',
        allianceBlueForeground: '#A8E8F5',
    },
    spacing: defaultSpacing,
    radii: defaultRadii,
    animations: defaultAnimations,
};

export const oneDarkTheme: Theme = {
    name: 'One Dark',
    isDark: true,
    colors: {
        background: '#282C34',
        foreground: '#ABB2BF',

        card: '#21252B',
        cardForeground: '#ABB2BF',

        primary: '#61AFEF',
        primaryForeground: '#282C34',

        secondary: '#3E4451',
        secondaryForeground: '#ABB2BF',

        muted: '#3E4451',
        mutedForeground: '#5C6370',

        accent: '#C678DD',
        accentForeground: '#282C34',

        destructive: '#E06C75',
        destructiveForeground: '#282C34',

        border: '#3E4451',
        input: '#3E4451',
        ring: '#61AFEF',

        secondaryElevated: '#545862',
        secondaryElevatedForeground: '#ABB2BF',

        allianceRed: '#E06C75',
        allianceRedMuted: '#5C2E32',
        allianceRedForeground: '#F0B3B8',
        allianceBlue: '#61AFEF',
        allianceBlueMuted: '#1F3A54',
        allianceBlueForeground: '#A8D4F7',
    },
    spacing: defaultSpacing,
    radii: defaultRadii,
    animations: defaultAnimations,
};

export const themes: Record<string, Theme> = {
    dark: { ...darkTheme, name: 'Dark' },
    light: lightTheme,
    'solarized-dark': solarizedDarkTheme,
    'solarized-light': solarizedLightTheme,
    nord: nordTheme,
    dracula: draculaTheme,
    'github-dark': githubDarkTheme,
    monokai: monokaiTheme,
    'one-dark': oneDarkTheme,
};

export function composeTheme(base: Theme, overrides: Partial<Theme>): Theme {
    return {
        ...base,
        ...overrides,
        colors: { ...base.colors, ...overrides.colors },
        spacing: { ...base.spacing, ...overrides.spacing },
        radii: { ...base.radii, ...overrides.radii },
        animations: { ...base.animations, ...overrides.animations },
    };
}
