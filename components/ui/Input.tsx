import { springConfigs } from '@/lib/animations';
import { useThemeColors } from '@/lib/theme';
import { useUIScale } from '@/lib/ui-scale';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { TextInput, TextInputProps, View } from 'react-native';
import Animated, {
    interpolateColor,
    useAnimatedStyle,
    useDerivedValue,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';
import { Text } from './Text';

export interface InputProps extends TextInputProps {
    className?: string;
    label?: string;
    error?: string;
    supportingText?: string;
}

export const Input = React.forwardRef<TextInput, InputProps>(
    ({ className, label, error, supportingText, onFocus, onBlur, ...props }, ref) => {
        const colors = useThemeColors();
        const { scaled } = useUIScale();
        const focusProgress = useSharedValue(0);

        const borderColor = colors.border;
        const ringColor = colors.ring;
        const destructiveColor = colors.destructive;
        const hasError = !!error;

        const handleFocus = (e: any) => {
            focusProgress.value = withSpring(1, springConfigs.snappy);
            onFocus?.(e);
        };

        const handleBlur = (e: any) => {
            focusProgress.value = withSpring(0, springConfigs.snappy);
            onBlur?.(e);
        };

        const containerAnimatedStyle = useAnimatedStyle(() => ({
            borderColor: hasError
                ? destructiveColor
                : interpolateColor(
                    focusProgress.value,
                    [0, 1],
                    [borderColor, ringColor]
                ),
        }));

        return (
            <View className="gap-1.5">
                {label && (
                    <Text className="text-sm font-medium" style={{ fontSize: scaled(14) }}>{label}</Text>
                )}
                <Animated.View
                    style={[containerAnimatedStyle, { backgroundColor: colors.background, height: scaled(40) }]}
                    className="justify-center rounded-md border"
                >
                    <TextInput
                        ref={ref}
                        className={cn(
                            'px-3 text-base',
                            className
                        )}
                        style={{
                            includeFontPadding: false,
                            textAlignVertical: 'center',
                            lineHeight: scaled(16),
                            fontSize: scaled(16),
                            paddingTop: 0,
                            paddingBottom: 0,
                            color: colors.foreground,
                        }}
                        placeholderTextColor={colors.mutedForeground}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        {...props}
                    />
                </Animated.View>
                {(error || supportingText) && (
                    <Text
                        className="text-xs"
                        style={{ color: error ? colors.destructive : colors.mutedForeground, fontSize: scaled(12) }}
                    >
                        {error || supportingText}
                    </Text>
                )}
            </View>
        );
    }
);

Input.displayName = 'Input';
