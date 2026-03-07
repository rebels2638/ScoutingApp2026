import { springConfigs } from '@/lib/animations';
import { useThemeColors } from '@/lib/theme';
import { useUIScale } from '@/lib/ui-scale';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { LayoutChangeEvent, Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Text } from './Text';

export interface SegmentedControlOption<T = string> {
    label: string;
    value: T;
}

export interface SegmentedControlProps<T = string> {
    value: T;
    onValueChange: (value: T) => void;
    options: SegmentedControlOption<T>[];
    label?: string;
    disabled?: boolean;
    className?: string;
}

export function SegmentedControl<T extends string>({
    value,
    onValueChange,
    options,
    label,
    disabled = false,
    className,
}: SegmentedControlProps<T>) {
    const colors = useThemeColors();
    const { scaled } = useUIScale();
    const [containerWidth, setContainerWidth] = React.useState(0);
    const selectedIndex = options.findIndex((opt) => opt.value === value);
    const segmentWidth = containerWidth / options.length;

    const indicatorPosition = useSharedValue(0);

    React.useEffect(() => {
        if (containerWidth > 0) {
            indicatorPosition.value = withSpring(selectedIndex * segmentWidth, springConfigs.gentle);
        }
    }, [selectedIndex, segmentWidth, containerWidth]);

    const handleLayout = (event: LayoutChangeEvent) => {
        const width = event.nativeEvent.layout.width;
        setContainerWidth(width);

        indicatorPosition.value = selectedIndex * (width / options.length);
    };

    const getIndicatorColor = () => {
        if (value === 'Red') return colors.allianceRedMuted;
        if (value === 'Blue') return colors.allianceBlueMuted;
        return colors.secondaryElevated;
    };

    const getSelectedTextColor = () => {
        if (value === 'Red') return colors.allianceRedForeground;
        if (value === 'Blue') return colors.allianceBlueForeground;
        return colors.secondaryElevatedForeground;
    };

    const indicatorAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: indicatorPosition.value }],
    }));

    return (
        <View className={cn('gap-1.5', className)}>
            {label && (
                <Text className="font-medium" style={{ fontSize: scaled(14) }}>{label}</Text>
            )}
            <View
                style={{
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    height: scaled(40),
                }}
                className="flex-row overflow-hidden rounded-lg border"
                onLayout={handleLayout}
            >

                {containerWidth > 0 && (
                    <Animated.View
                        style={[
                            {
                                position: 'absolute',
                                width: segmentWidth,
                                height: '100%',
                                backgroundColor: getIndicatorColor(),
                                borderRadius: 6,
                            },
                            indicatorAnimatedStyle,
                        ]}
                    />
                )}

                {options.map((option) => {
                    const isSelected = option.value === value;

                    return (
                        <Pressable
                            key={String(option.value)}
                            onPress={() => !disabled && onValueChange(option.value)}
                            className={cn(
                                'flex-1 items-center justify-center',
                                disabled && 'opacity-50'
                            )}
                            disabled={disabled}
                        >
                            <Text
                                className="font-medium"
                                style={{ color: isSelected ? getSelectedTextColor() : colors.mutedForeground, fontSize: scaled(14) }}
                            >
                                {option.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

SegmentedControl.displayName = 'SegmentedControl';
