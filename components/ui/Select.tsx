import { springConfigs, timingConfigs } from '@/lib/animations';
import { useThemeColors } from '@/lib/theme';
import { useUIScale } from '@/lib/ui-scale';
import { cn } from '@/lib/utils';
import { Check, ChevronDown } from 'lucide-react-native';
import * as React from 'react';
import { Modal, Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
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

interface DropdownFrame {
    top: number;
    left: number;
    width: number;
    maxHeight: number;
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
    const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
    const triggerRef = React.useRef<View>(null);

    const [modalVisible, setModalVisible] = React.useState(false);
    const [isAnimating, setIsAnimating] = React.useState(false);
    const [dropdownFrame, setDropdownFrame] = React.useState<DropdownFrame | null>(null);

    const chevronRotation = useSharedValue(0);

    const modalScale = useSharedValue(0.95);
    const modalOpacity = useSharedValue(0);
    const isWeb = Platform.OS === 'web';
    const dropdownMargin = scaled(16);
    const dropdownOffset = scaled(8);
    const dropdownMaxHeight = scaled(320);
    const dropdownMinHeight = scaled(140);

    const updateDropdownFrame = React.useCallback(() => {
        if (!isWeb) {
            return;
        }

        triggerRef.current?.measureInWindow((x, y, width, height) => {
            if (
                ![x, y, width, height].every((entry) => Number.isFinite(entry)) ||
                width <= 0 ||
                height <= 0
            ) {
                setDropdownFrame(null);
                return;
            }

            const maxAllowedWidth = Math.max(viewportWidth - dropdownMargin * 2, scaled(160));
            const minPreferredWidth = Math.min(scaled(220), maxAllowedWidth);
            const dropdownWidth = Math.min(Math.max(width, minPreferredWidth), maxAllowedWidth);
            const availableBelow = Math.max(
                viewportHeight - (y + height) - dropdownMargin - dropdownOffset,
                dropdownMinHeight
            );
            const availableAbove = Math.max(
                y - dropdownMargin - dropdownOffset,
                dropdownMinHeight
            );
            const shouldOpenAbove = availableBelow < scaled(220) && availableAbove > availableBelow;
            const maxHeight = Math.min(
                dropdownMaxHeight,
                shouldOpenAbove ? availableAbove : availableBelow
            );
            const left = Math.min(
                Math.max(x, dropdownMargin),
                Math.max(dropdownMargin, viewportWidth - dropdownWidth - dropdownMargin)
            );
            const top = shouldOpenAbove
                ? Math.max(dropdownMargin, y - maxHeight - dropdownOffset)
                : Math.min(
                    Math.max(dropdownMargin, viewportHeight - maxHeight - dropdownMargin),
                    y + height + dropdownOffset
                );

            setDropdownFrame({
                top,
                left,
                width: dropdownWidth,
                maxHeight,
            });
        });
    }, [
        dropdownMargin,
        dropdownMaxHeight,
        dropdownMinHeight,
        dropdownOffset,
        isWeb,
        scaled,
        viewportHeight,
        viewportWidth,
    ]);

    const openModal = React.useCallback(() => {
        if (disabled || isAnimating) return;
        if (isWeb) {
            updateDropdownFrame();
        }
        setIsAnimating(true);
        setModalVisible(true);
        chevronRotation.value = withSpring(180, springConfigs.snappy);
        modalScale.value = withSpring(1, springConfigs.gentle);
        modalOpacity.value = withTiming(1, timingConfigs.fast, () => {
            runOnJS(setIsAnimating)(false);
        });
    }, [disabled, isAnimating, isWeb, updateDropdownFrame]);

    const closeModal = React.useCallback(() => {
        if (isAnimating) return;
        setIsAnimating(true);
        chevronRotation.value = withSpring(0, springConfigs.snappy);
        modalScale.value = withTiming(0.95, timingConfigs.fast);
        modalOpacity.value = withTiming(0, timingConfigs.fast, () => {
            runOnJS(setModalVisible)(false);
            runOnJS(setIsAnimating)(false);
            runOnJS(setDropdownFrame)(null);
        });
    }, [isAnimating]);

    const chevronAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${chevronRotation.value}deg` }],
    }));

    const modalContentAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: modalScale.value }],
        opacity: modalOpacity.value,
    }));

    React.useEffect(() => {
        if (!modalVisible || !isWeb) {
            return;
        }

        const frame = requestAnimationFrame(() => {
            updateDropdownFrame();
        });

        return () => {
            cancelAnimationFrame(frame);
        };
    }, [isWeb, modalVisible, options.length, updateDropdownFrame, viewportHeight, viewportWidth]);

    const selectedOption = options.find((opt) => opt.value === value);
    const shouldUseAnchoredDropdown = isWeb && dropdownFrame !== null;

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
            <View ref={triggerRef} collapsable={false}>
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
                        className="mr-2 flex-1"
                        numberOfLines={1}
                    >
                        {selectedOption?.label || placeholder}
                    </Text>
                    <Animated.View style={chevronAnimatedStyle}>
                        <ChevronDown size={scaled(18)} color={colors.mutedForeground} />
                    </Animated.View>
                </Pressable>
            </View>

            <Modal
                visible={modalVisible}
                transparent
                animationType="none"
                onRequestClose={closeModal}
                statusBarTranslucent
            >
                <View className={shouldUseAnchoredDropdown ? 'flex-1' : 'flex-1 items-center justify-center'}>
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
                            shouldUseAnchoredDropdown
                                ? {
                                    left: dropdownFrame.left,
                                    maxHeight: dropdownFrame.maxHeight,
                                    position: 'absolute',
                                    top: dropdownFrame.top,
                                    width: dropdownFrame.width,
                                }
                                : undefined,
                        ]}
                        className={cn(
                            'rounded-lg border p-1',
                            !shouldUseAnchoredDropdown && 'mx-6 w-full max-w-sm'
                        )}
                    >
                        <ScrollView
                            className={cn(!shouldUseAnchoredDropdown && 'max-h-80')}
                            style={shouldUseAnchoredDropdown ? { maxHeight: dropdownFrame.maxHeight } : undefined}
                            keyboardShouldPersistTaps="handled"
                            scrollEnabled={!isAnimating}
                            showsVerticalScrollIndicator
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
