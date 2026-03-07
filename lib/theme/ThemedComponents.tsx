import { cn } from '@/lib/utils';
import * as React from 'react';
import {
    ScrollView,
    ScrollViewProps,
    StatusBar,
    View,
    ViewProps,
    ViewStyle,
} from 'react-native';
import { useThemeColors } from './ThemeProvider';

export interface ThemedViewProps extends ViewProps {
    className?: string;

    variant?: 'background' | 'card';
}

export const ThemedView = React.forwardRef<View, ThemedViewProps>(
    ({ className, variant = 'background', style, ...props }, ref) => {
        const colors = useThemeColors();

        const themedStyle: ViewStyle = {
            backgroundColor: variant === 'card' ? colors.card : colors.background,
        };

        return (
            <View
                ref={ref}
                className={cn('flex-1', className)}
                style={[themedStyle, style]}
                {...props}
            />
        );
    }
);

ThemedView.displayName = 'ThemedView';

export interface ThemedScrollViewProps extends ScrollViewProps {
    className?: string;

    variant?: 'background' | 'card';
    contentClassName?: string;
}

export const ThemedScrollView = React.forwardRef<ScrollView, ThemedScrollViewProps>(
    (
        {
            className,
            variant = 'background',
            style,
            contentContainerStyle,
            contentClassName,
            ...props
        },
        ref
    ) => {
        const colors = useThemeColors();

        const themedStyle: ViewStyle = {
            backgroundColor: variant === 'card' ? colors.card : colors.background,
        };

        return (
            <ScrollView
                ref={ref}
                className={cn('flex-1', className)}
                style={[themedStyle, style]}
                contentContainerStyle={contentContainerStyle}
                {...props}
            />
        );
    }
);

ThemedScrollView.displayName = 'ThemedScrollView';

export interface ThemedStatusBarProps {
    barStyle?: 'light-content' | 'dark-content' | 'auto';
}

export const ThemedStatusBar: React.FC<ThemedStatusBarProps> = ({
    barStyle = 'auto',
}) => {
    const colors = useThemeColors();

    const isDarkBackground = React.useMemo(() => {
        const hex = colors.background.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance < 0.5;
    }, [colors.background]);

    const computedBarStyle =
        barStyle === 'auto'
            ? isDarkBackground
                ? 'light-content'
                : 'dark-content'
            : barStyle;

    return (
        <StatusBar
            barStyle={computedBarStyle}
            backgroundColor={colors.background}
            translucent={false}
        />
    );
};
