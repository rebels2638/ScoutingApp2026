import AsyncStorage from '@react-native-async-storage/async-storage';
import * as React from 'react';

const UI_SCALE_STORAGE_KEY = '@agath/ui_scale';

export type UIScaleOption = 'small' | 'default' | 'large' | 'extra-large';

export const UI_SCALE_VALUES: Record<UIScaleOption, number> = {
    'small': 0.85,
    'default': 1.0,
    'large': 1.2,
    'extra-large': 1.4,
};

export const UI_SCALE_LABELS: Record<UIScaleOption, string> = {
    'small': 'Small',
    'default': 'Default',
    'large': 'Large',
    'extra-large': 'XL',
};

interface UIScaleContextValue {
    scaleOption: UIScaleOption;
    scale: number;
    setScaleOption: (option: UIScaleOption) => void;
    scaled: (value: number) => number;
}

const UIScaleContext = React.createContext<UIScaleContextValue | undefined>(undefined);

interface UIScaleProviderProps {
    children: React.ReactNode;
}

export function UIScaleProvider({ children }: UIScaleProviderProps) {
    const [scaleOption, setScaleOptionState] = React.useState<UIScaleOption>('default');

    React.useEffect(() => {
        const load = async () => {
            try {
                const stored = await AsyncStorage.getItem(UI_SCALE_STORAGE_KEY);
                if (stored && stored in UI_SCALE_VALUES) {
                    setScaleOptionState(stored as UIScaleOption);
                }
            } catch (error) {
                console.warn('Failed to load UI scale:', error);
            }
        };
        load();
    }, []);

    const setScaleOption = React.useCallback(async (option: UIScaleOption) => {
        setScaleOptionState(option);
        try {
            await AsyncStorage.setItem(UI_SCALE_STORAGE_KEY, option);
        } catch (error) {
            console.warn('Failed to persist UI scale:', error);
        }
    }, []);

    const scale = UI_SCALE_VALUES[scaleOption];

    const scaled = React.useCallback(
        (value: number) => Math.round(value * scale),
        [scale]
    );

    const value = React.useMemo<UIScaleContextValue>(
        () => ({ scaleOption, scale, setScaleOption, scaled }),
        [scaleOption, scale, setScaleOption, scaled]
    );

    return (
        <UIScaleContext.Provider value={value}>
            {children}
        </UIScaleContext.Provider>
    );
}

export function useUIScale(): UIScaleContextValue {
    const context = React.useContext(UIScaleContext);
    if (!context) {
        throw new Error('useUIScale must be used within a UIScaleProvider');
    }
    return context;
}
