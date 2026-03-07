import { useEffect } from 'react';
import {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    WithTimingConfig,
} from 'react-native-reanimated';
import { opacityValues, timingConfigs } from './animationConfigs';

interface UseAnimatedFadeOptions {
    initialOpacity?: number;

    visibleOpacity?: number;

    fadeInConfig?: WithTimingConfig;

    fadeOutConfig?: WithTimingConfig;

    animateOnMount?: boolean;
}

export function useAnimatedFade(options: UseAnimatedFadeOptions = {}) {
    const {
        initialOpacity = opacityValues.hidden,
        visibleOpacity = opacityValues.visible,
        fadeInConfig = timingConfigs.easeOut,
        fadeOutConfig = timingConfigs.easeIn,
        animateOnMount = false,
    } = options;

    const opacity = useSharedValue(initialOpacity);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    const fadeIn = () => {
        opacity.value = withTiming(visibleOpacity, fadeInConfig);
    };

    const fadeOut = () => {
        opacity.value = withTiming(0, fadeOutConfig);
    };

    const toggle = () => {
        if (opacity.value > 0.5) {
            fadeOut();
        } else {
            fadeIn();
        }
    };

    useEffect(() => {
        if (animateOnMount) {
            fadeIn();
        }
    }, []);

    return {
        animatedStyle,
        fadeIn,
        fadeOut,
        toggle,
        opacity,
    };
}
