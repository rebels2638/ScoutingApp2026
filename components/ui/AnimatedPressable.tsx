import { useAnimatedScale } from '@/lib/animations';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { Pressable, PressableProps, View } from 'react-native';
import Animated from 'react-native-reanimated';

const AnimatedView = Animated.createAnimatedComponent(View);

export interface AnimatedPressableProps extends Omit<PressableProps, 'children'> {
    className?: string;

    pressedScale?: number;

    disableAnimation?: boolean;
    children?: React.ReactNode;
}

export const AnimatedPressable = React.forwardRef<View, AnimatedPressableProps>(
    ({
        className,
        pressedScale = 0.97,
        disableAnimation = false,
        onPressIn,
        onPressOut,
        children,
        disabled,
        ...props
    }, ref) => {
        const { animatedStyle, onPressIn: scaleIn, onPressOut: scaleOut } = useAnimatedScale({
            pressedScale,
        });

        const handlePressIn = React.useCallback((e: any) => {
            if (!disableAnimation && !disabled) {
                scaleIn();
            }
            onPressIn?.(e);
        }, [disableAnimation, disabled, scaleIn, onPressIn]);

        const handlePressOut = React.useCallback((e: any) => {
            if (!disableAnimation && !disabled) {
                scaleOut();
            }
            onPressOut?.(e);
        }, [disableAnimation, disabled, scaleOut, onPressOut]);

        return (
            <Pressable
                ref={ref}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={disabled}
                {...props}
            >
                <AnimatedView
                    style={disableAnimation ? undefined : animatedStyle}
                    className={cn(className)}
                >
                    {children}
                </AnimatedView>
            </Pressable>
        );
    }
);

AnimatedPressable.displayName = 'AnimatedPressable';
