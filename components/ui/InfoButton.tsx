import { springConfigs, useAnimatedScale } from '@/lib/animations';
import type { FieldDefinition } from '@/lib/definitions';
import { useTheme, useThemeColors } from '@/lib/theme';
import { useUIScale } from '@/lib/ui-scale';
import { cn } from '@/lib/utils';
import { Info, X } from 'lucide-react-native';
import * as React from 'react';
import { Modal, Pressable, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { Text } from './Text';

export interface InfoButtonProps {
    definition: FieldDefinition;
    className?: string;
}

export const InfoButton: React.FC<InfoButtonProps> = ({
    definition,
    className,
}) => {
    const colors = useThemeColors();
    const { isDark } = useTheme();
    const { scaled } = useUIScale();
    const [open, setOpen] = React.useState(false);

    const { animatedStyle: buttonAnimatedStyle, onPressIn, onPressOut } = useAnimatedScale({
        pressedScale: 0.9,
    });

    const modalScale = useSharedValue(0.9);
    const modalOpacity = useSharedValue(0);

    React.useEffect(() => {
        if (open) {
            modalScale.value = withSpring(1, springConfigs.gentle);
            modalOpacity.value = withTiming(1, { duration: 150, easing: Easing.out(Easing.cubic) });
        } else {
            modalScale.value = 0.9;
            modalOpacity.value = 0;
        }
    }, [open]);

    const modalContentAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: modalScale.value }],
        opacity: modalOpacity.value,
    }));

    return (
        <>
            <Pressable
                onPress={() => setOpen(true)}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                hitSlop={8}
            >
                <Animated.View
                    style={[buttonAnimatedStyle, { height: scaled(24), width: scaled(24) }]}
                    className={cn(
                        'items-center justify-center rounded-full',
                        className
                    )}
                >
                    <Info size={scaled(16)} color={colors.mutedForeground} />
                </Animated.View>
            </Pressable>

            <Modal
                visible={open}
                transparent
                animationType="fade"
                presentationStyle="overFullScreen"
                onRequestClose={() => setOpen(false)}
            >
                <Pressable
                    className="flex-1 items-center justify-center bg-black/60 px-4"
                    onPress={() => setOpen(false)}
                >
                    <Animated.View
                        style={[
                            { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
                            modalContentAnimatedStyle,
                        ]}
                        className="w-full max-w-sm rounded-lg p-5"
                    >
                        <View className="flex-row items-start justify-between pb-4">
                            <Text
                                className="flex-1 pr-4 font-semibold"
                                style={{ color: colors.foreground, fontSize: scaled(18) }}
                            >
                                {definition.label}
                            </Text>
                            <Pressable
                                onPress={() => setOpen(false)}
                                className="items-center justify-center rounded-md"
                                style={{ height: scaled(32), width: scaled(32) }}
                                hitSlop={8}
                            >
                                <X size={scaled(18)} color={colors.mutedForeground} />
                            </Pressable>
                        </View>

                        <Text
                            className="pb-4 leading-relaxed"
                            style={{ color: colors.foreground, fontSize: scaled(16) }}
                        >
                            {definition.description}
                        </Text>

                        {definition.validation && (
                            <View
                                className="rounded-md p-3"
                                style={{
                                    backgroundColor: isDark ? 'rgba(250, 250, 250, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                }}
                            >
                                <Text
                                    className="pb-1 font-medium uppercase tracking-wider"
                                    style={{ color: colors.mutedForeground, fontSize: scaled(12) }}
                                >
                                    Options / Validation
                                </Text>
                                <Text
                                    style={{ color: colors.mutedForeground, fontSize: scaled(14) }}
                                >
                                    {definition.validation}
                                </Text>
                            </View>
                        )}
                    </Animated.View>
                </Pressable>
            </Modal>
        </>
    );
};

InfoButton.displayName = 'InfoButton';
