import { useCallback } from 'react';
import {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    WithSpringConfig,
} from 'react-native-reanimated';
import { scaleValues, springConfigs } from './animationConfigs';

interface UseAnimatedScaleOptions {
    pressedScale?: number;

    springConfig?: WithSpringConfig;
}

export function useAnimatedScale(options: UseAnimatedScaleOptions = {}) {
    const {
        pressedScale = scaleValues.pressed,
        springConfig = springConfigs.snappy,
    } = options;

    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const onPressIn = useCallback(() => {
        scale.value = withSpring(pressedScale, springConfig);
    }, [pressedScale, springConfig, scale]);

    const onPressOut = useCallback(() => {
        scale.value = withSpring(1, springConfig);
    }, [springConfig, scale]);

    return {
        animatedStyle,
        onPressIn,
        onPressOut,
        scale,
    };
}
