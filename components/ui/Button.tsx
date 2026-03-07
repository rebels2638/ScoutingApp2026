import { useAnimatedScale } from '@/lib/animations';
import { useThemeColors } from '@/lib/theme';
import { useUIScale } from '@/lib/ui-scale';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Pressable, PressableProps, View, ViewStyle, StyleProp } from 'react-native';
import Animated from 'react-native-reanimated';
import { Text } from './Text';

const AnimatedView = Animated.createAnimatedComponent(View);

const buttonVariants = cva(
    'flex-row items-center justify-center rounded-md',
    {
        variants: {
            variant: {
                default: '',
                secondary: '',
                destructive: '',
                outline: 'border',
                ghost: '',
                link: '',
            },
            size: {
                default: 'h-10 px-4 gap-2',
                sm: 'h-9 px-3 gap-1.5',
                lg: 'h-11 px-6 gap-2',
                icon: 'h-10 w-10',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    }
);

export interface ButtonProps
    extends Omit<PressableProps, 'children' | 'style'>,
    VariantProps<typeof buttonVariants> {
    className?: string;
    textClassName?: string;

    pressedScale?: number;

    disableAnimation?: boolean;
    children?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
}

export const Button = React.forwardRef<View, ButtonProps>(
    ({
        className,
        textClassName,
        variant = 'default',
        size,
        children,
        disabled,
        pressedScale = 0.97,
        disableAnimation = false,
        onPressIn,
        onPressOut,
        style,
        ...props
    }, ref) => {
        const colors = useThemeColors();
        const { scaled } = useUIScale();
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

        const getVariantStyles = () => {
            switch (variant) {
                case 'default':
                    return { backgroundColor: colors.primary };
                case 'secondary':
                    return { backgroundColor: colors.secondary };
                case 'destructive':
                    return { backgroundColor: colors.destructive };
                case 'outline':
                    return { backgroundColor: 'transparent', borderColor: colors.border };
                case 'ghost':
                case 'link':
                    return { backgroundColor: 'transparent' };
                default:
                    return { backgroundColor: colors.primary };
            }
        };

        const getSizeStyles = () => {
            switch (size) {
                case 'sm':
                    return { height: scaled(36), paddingHorizontal: scaled(12), gap: scaled(6) };
                case 'lg':
                    return { height: scaled(44), paddingHorizontal: scaled(24), gap: scaled(8) };
                case 'icon':
                    return { height: scaled(40), width: scaled(40) };
                default:
                    return { height: scaled(40), paddingHorizontal: scaled(16), gap: scaled(8) };
            }
        };

        const getTextColor = () => {
            switch (variant) {
                case 'default':
                    return colors.primaryForeground;
                case 'secondary':
                    return colors.secondaryForeground;
                case 'destructive':
                    return colors.destructiveForeground;
                case 'outline':
                case 'ghost':
                case 'link':
                    return colors.foreground;
                default:
                    return colors.primaryForeground;
            }
        };

        return (
            <Pressable
                ref={ref}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={disabled}
                {...props}
            >
                <AnimatedView
                    style={[
                        getVariantStyles(),
                        getSizeStyles(),
                        disableAnimation ? undefined : animatedStyle,
                        style,
                    ]}
                    className={cn(
                        buttonVariants({ variant, size }),
                        disabled && 'opacity-50',
                        className
                    )}
                >
                    {typeof children === 'string' ? (
                        <Text
                            className={cn(
                                'font-medium text-sm',
                                variant === 'link' && 'underline',
                                textClassName
                            )}
                            style={{ color: getTextColor(), fontSize: scaled(14) }}
                        >
                            {children}
                        </Text>
                    ) : (
                        children
                    )}
                </AnimatedView>
            </Pressable>
        );
    }
);

Button.displayName = 'Button';

export { buttonVariants };
