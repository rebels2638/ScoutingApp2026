import { Easing, WithSpringConfig, WithTimingConfig } from 'react-native-reanimated';

export const springConfigs = {
    snappy: {
        damping: 15,
        stiffness: 150,
        mass: 1,
    } as WithSpringConfig,

    gentle: {
        damping: 20,
        stiffness: 100,
        mass: 1,
    } as WithSpringConfig,

    bouncy: {
        damping: 10,
        stiffness: 180,
        mass: 1,
    } as WithSpringConfig,

    stiff: {
        damping: 25,
        stiffness: 300,
        mass: 1,
    } as WithSpringConfig,
};

export const timingConfigs = {
    fast: {
        duration: 150,
        easing: Easing.out(Easing.cubic),
    } as WithTimingConfig,

    normal: {
        duration: 250,
        easing: Easing.inOut(Easing.cubic),
    } as WithTimingConfig,

    slow: {
        duration: 400,
        easing: Easing.inOut(Easing.cubic),
    } as WithTimingConfig,

    easeOut: {
        duration: 200,
        easing: Easing.out(Easing.cubic),
    } as WithTimingConfig,

    easeIn: {
        duration: 150,
        easing: Easing.in(Easing.cubic),
    } as WithTimingConfig,
};

export const scaleValues = {
    pressed: 0.97,
    active: 0.95,
    normal: 1,
    emphasized: 1.02,
};

export const opacityValues = {
    hidden: 0,
    dimmed: 0.5,
    visible: 1,
};

export const durations = {
    instant: 0,
    fast: 150,
    normal: 250,
    slow: 400,
    emphasis: 600,
};
