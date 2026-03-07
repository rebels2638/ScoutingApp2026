import { springConfigs } from '@/lib/animations';
import { useThemeColors } from '@/lib/theme';
import { useUIScale } from '@/lib/ui-scale';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { Pressable } from 'react-native';
import Animated, {
    interpolate,
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';

export interface SwitchProps {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
    className?: string;
}

export const Switch: React.FC<SwitchProps> = ({
    checked,
    onCheckedChange,
    disabled = false,
    className,
}) => {
    const colors = useThemeColors();
    const { scaled } = useUIScale();
    const progress = useSharedValue(checked ? 1 : 0);

    const thumbOffset = scaled(2);
    const thumbTravel = scaled(22);

    const secondaryElevatedColor = colors.secondaryElevated;
    const primaryColor = colors.primary;
    const secondaryElevatedForegroundColor = colors.secondaryElevatedForeground;
    const primaryForegroundColor = colors.primaryForeground;

    React.useEffect(() => {
        progress.value = withSpring(checked ? 1 : 0, {
            ...springConfigs.snappy,
            overshootClamping: true,
        });
    }, [checked]);

    const trackAnimatedStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(
            progress.value,
            [0, 1],
            [secondaryElevatedColor, primaryColor]
        ),
    }));

    const thumbAnimatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: interpolate(progress.value, [0, 1], [thumbOffset, thumbTravel]) },
        ],
        backgroundColor: interpolateColor(
            progress.value,
            [0, 1],
            [secondaryElevatedForegroundColor, primaryForegroundColor]
        ),
    }));

    return (
        <Pressable
            onPress={() => !disabled && onCheckedChange(!checked)}
            disabled={disabled}
            className={cn(disabled && 'opacity-50', className)}
        >
            <Animated.View
                style={[trackAnimatedStyle, { height: scaled(24), width: scaled(44), borderRadius: scaled(12) }]}
                className="justify-center"
            >
                <Animated.View
                    style={[thumbAnimatedStyle, { height: scaled(20), width: scaled(20), borderRadius: scaled(10) }]}
                />
            </Animated.View>
        </Pressable>
    );
};

Switch.displayName = 'Switch';
