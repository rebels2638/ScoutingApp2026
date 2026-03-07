import { springConfigs } from '@/lib/animations';
import { useThemeColors } from '@/lib/theme';
import { useUIScale } from '@/lib/ui-scale';
import { cn } from '@/lib/utils';
import { Minus, Plus } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { Text } from './Text';

export interface StepperProps {
    value: number;
    onValueChange: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    label?: string;
    disabled?: boolean;
    className?: string;
}

export const Stepper: React.FC<StepperProps> = ({
    value,
    onValueChange,
    min = 0,
    max = 100,
    step = 1,
    label,
    disabled = false,
    className,
}) => {
    const colors = useThemeColors();
    const { scaled } = useUIScale();
    const canDecrement = value > min;
    const canIncrement = value < max;

    const decrementScale = useSharedValue(1);
    const incrementScale = useSharedValue(1);
    const valueScale = useSharedValue(1);

    const decrementAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: decrementScale.value }],
    }));

    const incrementAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: incrementScale.value }],
    }));

    const valueAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: valueScale.value }],
    }));

    const animateValue = () => {
        valueScale.value = withSequence(
            withSpring(1.1, { ...springConfigs.stiff, overshootClamping: true }),
            withSpring(1, springConfigs.stiff)
        );
    };

    const decrement = () => {
        if (canDecrement && !disabled) {
            onValueChange(Math.max(min, value - step));
            animateValue();
        }
    };

    const increment = () => {
        if (canIncrement && !disabled) {
            onValueChange(Math.min(max, value + step));
            animateValue();
        }
    };

    const handleDecrementPressIn = () => {
        if (canDecrement && !disabled) {
            decrementScale.value = withSpring(0.9, springConfigs.snappy);
        }
    };

    const handleDecrementPressOut = () => {
        decrementScale.value = withSpring(1, springConfigs.snappy);
    };

    const handleIncrementPressIn = () => {
        if (canIncrement && !disabled) {
            incrementScale.value = withSpring(0.9, springConfigs.snappy);
        }
    };

    const handleIncrementPressOut = () => {
        incrementScale.value = withSpring(1, springConfigs.snappy);
    };

    return (
        <View className={cn('gap-1.5', className)}>
            {label && (
                <Text className="font-medium" style={{ fontSize: scaled(14) }}>{label}</Text>
            )}
            <View className="flex-row items-center gap-3">
                <Pressable
                    onPress={decrement}
                    onPressIn={handleDecrementPressIn}
                    onPressOut={handleDecrementPressOut}
                    disabled={!canDecrement || disabled}
                >
                    <Animated.View
                        style={[
                            decrementAnimatedStyle,
                            {
                                backgroundColor: colors.secondaryElevated,
                                height: scaled(40),
                                width: scaled(40),
                                borderColor: colors.border,
                            },
                        ]}
                        className={cn(
                            'items-center justify-center rounded-md border',
                            (!canDecrement || disabled) && 'opacity-50'
                        )}
                    >
                        <Minus size={scaled(18)} color={colors.secondaryElevatedForeground} />
                    </Animated.View>
                </Pressable>

                <Animated.View
                    style={[
                        valueAnimatedStyle,
                        {
                            backgroundColor: colors.background,
                            borderColor: colors.border,
                            height: scaled(40),
                            minWidth: scaled(64),
                            paddingHorizontal: scaled(16),
                        },
                    ]}
                    className="items-center justify-center rounded-md border"
                >
                    <Text className="font-medium" style={{ fontSize: scaled(18) }}>{value}</Text>
                </Animated.View>

                <Pressable
                    onPress={increment}
                    onPressIn={handleIncrementPressIn}
                    onPressOut={handleIncrementPressOut}
                    disabled={!canIncrement || disabled}
                >
                    <Animated.View
                        style={[
                            incrementAnimatedStyle,
                            {
                                backgroundColor: colors.secondaryElevated,
                                height: scaled(40),
                                width: scaled(40),
                                borderColor: colors.border,
                            },
                        ]}
                        className={cn(
                            'items-center justify-center rounded-md border',
                            (!canIncrement || disabled) && 'opacity-50'
                        )}
                    >
                        <Plus size={scaled(18)} color={colors.secondaryElevatedForeground} />
                    </Animated.View>
                </Pressable>
            </View>
        </View>
    );
};

Stepper.displayName = 'Stepper';
