import {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    WithSpringConfig,
} from 'react-native-reanimated';
import { springConfigs } from './animationConfigs';

type Direction = 'horizontal' | 'vertical';

interface UseAnimatedSlideOptions {
    direction?: Direction;

    initialPosition?: number;

    springConfig?: WithSpringConfig;
}

export function useAnimatedSlide(options: UseAnimatedSlideOptions = {}) {
    const {
        direction = 'horizontal',
        initialPosition = 0,
        springConfig = springConfigs.gentle,
    } = options;

    const position = useSharedValue(initialPosition);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: direction === 'horizontal'
            ? [{ translateX: position.value }]
            : [{ translateY: position.value }],
    }));

    const slideTo = (newPosition: number) => {
        position.value = withSpring(newPosition, springConfig);
    };

    const slideBy = (delta: number) => {
        position.value = withSpring(position.value + delta, springConfig);
    };

    const reset = () => {
        position.value = withSpring(initialPosition, springConfig);
    };

    return {
        animatedStyle,
        slideTo,
        slideBy,
        reset,
        position,
    };
}
