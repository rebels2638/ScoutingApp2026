import { springConfigs, timingConfigs } from '@/lib/animations';
import { useThemeColors } from '@/lib/theme';
import { useUIScale } from '@/lib/ui-scale';
import { cn } from '@/lib/utils';
import { Check, ChevronDown } from 'lucide-react-native';
import * as React from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { Text } from './Text';

export interface SelectOption<T = string> {
    label: string;
    value: T;
}

export interface SelectProps<T = string> {
    value: T;
    onValueChange: (value: T) => void;
    options: SelectOption<T>[];
    placeholder?: string;
    label?: string;
    disabled?: boolean;
    className?: string;
}

export function Select<T extends string>({
    value,
    onValueChange,
    options,
    placeholder = 'Select an option',
    label,
    disabled = false,
    className,
}: SelectProps<T>) {
    const colors = useThemeColors();
    const { scaled } = useUIScale();

    const [modalVisible, setModalVisible] = React.useState(false);
    const [isAnimating, setIsAnimating] = React.useState(false);

    const chevronRotation = useSharedValue(0);

    const modalScale = useSharedValue(0.95);
    const modalOpacity = useSharedValue(0);

    const openModal = React.useCallback(() => {
        if (disabled || isAnimating) return;
        setIsAnimating(true);
        setModalVisible(true);
        chevronRotation.value = withSpring(180, springConfigs.snappy);
        modalScale.value = withSpring(1, springConfigs.gentle);
        modalOpacity.value = withTiming(1, timingConfigs.fast, () => {
            runOnJS(setIsAnimating)(false);
        });
    }, [disabled, isAnimating]);

    const closeModal = React.useCallback(() => {
        if (isAnimating) return;
        setIsAnimating(true);
        chevronRotation.value = withSpring(0, springConfigs.snappy);
        modalScale.value = withTiming(0.95, timingConfigs.fast);
        modalOpacity.value = withTiming(0, timingConfigs.fast, () => {
            runOnJS(setModalVisible)(false);
            runOnJS(setIsAnimating)(false);
        });
    }, [isAnimating]);

    const chevronAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${chevronRotation.value}deg` }],
    }));

    const modalContentAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: modalScale.value }],
        opacity: modalOpacity.value,
    }));

    const selectedOption = options.find((opt) => opt.value === value);

    const handleOptionSelect = React.useCallback((optionValue: T) => {
        if (isAnimating) return;
        onValueChange(optionValue);
        closeModal();
    }, [isAnimating, onValueChange, closeModal]);

    return (
        <View className={cn('gap-1.5', className)}>
            {label && (
                <Text className="font-medium" style={{ fontSize: scaled(14) }}>{label}</Text>
            )}
            <Pressable
                onPress={openModal}
                style={{
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    height: scaled(40),
                    paddingHorizontal: scaled(12),
                }}
                className={cn(
                    'flex-row items-center justify-between rounded-md border',
                    disabled && 'opacity-50'
                )}
                disabled={disabled || isAnimating}
            >
                <Text
                    style={{ color: selectedOption ? colors.foreground : colors.mutedForeground, fontSize: scaled(16) }}
                    className="flex-1 mr-2"
                    numberOfLines={1}
                >
                    {selectedOption?.label || placeholder}
                </Text>
                <Animated.View style={chevronAnimatedStyle}>
                    <ChevronDown size={scaled(18)} color={colors.mutedForeground} />
                </Animated.View>
            </Pressable>

            <Modal
                visible={modalVisible}
                transparent
                animationType="none"
                onRequestClose={closeModal}
                statusBarTranslucent
            >
                <View className="flex-1 items-center justify-center">
                    <Animated.View
                        style={{ opacity: modalOpacity }}
                        className="absolute inset-0 bg-black/60"
                    >
                        <Pressable
                            className="flex-1"
                            onPress={closeModal}
                            disabled={isAnimating}
                        />
                    </Animated.View>
                    <Animated.View
                        style={[
                            modalContentAnimatedStyle,
                            {
                                backgroundColor: colors.card,
                                borderColor: colors.border,
                            },
                        ]}
                        className="mx-6 w-full max-w-sm rounded-lg border p-1"
                    >
                        <ScrollView
                            className="max-h-80"
                            keyboardShouldPersistTaps="handled"
                            scrollEnabled={!isAnimating}
                        >
                            {options.map((option) => (
                                <Pressable
                                    key={String(option.value)}
                                    onPress={() => handleOptionSelect(option.value)}
                                    disabled={isAnimating}
                                    style={option.value === value ? { backgroundColor: colors.secondary } : undefined}
                                    className={cn(
                                        'flex-row items-center justify-between rounded-md px-3 py-2.5'
                                    )}
                                >
                                    <Text
                                        className={cn(
                                            option.value === value && 'font-medium'
                                        )}
                                        style={{ fontSize: scaled(16) }}
                                    >
                                        {option.label}
                                    </Text>
                                    {option.value === value && (
                                        <Check size={scaled(16)} color={colors.foreground} />
                                    )}
                                </Pressable>
                            ))}
                        </ScrollView>
                    </Animated.View>
                </View>
            </Modal>
        </View>
    );
}

Select.displayName = 'Select';
