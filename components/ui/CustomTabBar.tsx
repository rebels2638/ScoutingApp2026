import { useBackendAuth } from '@/lib/backend/auth';
import { ensureContrast, useTheme } from '@/lib/theme';
import { useUIScale } from '@/lib/ui-scale';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React, { useEffect } from 'react';
import { Platform, Pressable, View } from 'react-native';
import Animated, {
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';

export const CUSTOM_TAB_BAR_HEIGHT = 64;
export const CUSTOM_TAB_BAR_MARGIN_BOTTOM = 16;
export const CUSTOM_TAB_BAR_MARGIN_HORIZONTAL = 20;

const AnimatedView = Animated.createAnimatedComponent(View);

export function useTabBarMetrics() {
    const { scaled } = useUIScale();

    return React.useMemo(
        () => ({
            height: scaled(CUSTOM_TAB_BAR_HEIGHT),
            marginBottom: scaled(CUSTOM_TAB_BAR_MARGIN_BOTTOM),
            marginHorizontal: scaled(CUSTOM_TAB_BAR_MARGIN_HORIZONTAL),
            containerRadius: scaled(20),
            containerPaddingHorizontal: scaled(6),
            containerPaddingVertical: scaled(4),
            itemRadius: scaled(16),
            itemPaddingVertical: scaled(8),
            itemPaddingHorizontal: scaled(12),
            itemGap: scaled(3),
            iconSize: scaled(20),
            labelFontSize: scaled(10),
        }),
        [scaled]
    );
}

interface TabItemProps {
    label: string;
    icon: (props: { color: string; size: number }) => React.ReactNode;
    isFocused: boolean;
    onPress: () => void;
    onLongPress: () => void;
    activeColor: string;
    inactiveColor: string;
    activeBackground: string;
    iconSize: number;
    labelFontSize: number;
    itemRadius: number;
    itemPaddingVertical: number;
    itemPaddingHorizontal: number;
    itemGap: number;
    accessibilityLabel?: string;
}

function TabItem({
    label,
    icon,
    isFocused,
    onPress,
    onLongPress,
    activeColor,
    inactiveColor,
    activeBackground,
    iconSize,
    labelFontSize,
    itemRadius,
    itemPaddingVertical,
    itemPaddingHorizontal,
    itemGap,
    accessibilityLabel,
}: TabItemProps) {
    const progress = useSharedValue(isFocused ? 1 : 0);
    const scale = useSharedValue(1);

    useEffect(() => {
        progress.value = withSpring(isFocused ? 1 : 0, {
            damping: 20,
            stiffness: 200,
            mass: 0.8,
        });
    }, [isFocused]);

    const animatedContainerStyle = useAnimatedStyle(() => {
        const backgroundColor = interpolateColor(
            progress.value,
            [0, 1],
            ['transparent', activeBackground]
        );

        return {
            backgroundColor,
            transform: [{ scale: scale.value }],
        };
    });

    const animatedIconStyle = useAnimatedStyle(() => {
        return {
            opacity: withTiming(isFocused ? 1 : 0.6, { duration: 200 }),
        };
    });

    const animatedLabelStyle = useAnimatedStyle(() => {
        return {
            opacity: withTiming(isFocused ? 1 : 0.55, { duration: 200 }),
        };
    });

    const handlePressIn = () => {
        scale.value = withSpring(0.92, {
            damping: 15,
            stiffness: 250,
        });
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, {
            damping: 15,
            stiffness: 200,
        });
    };

    const color = isFocused ? activeColor : inactiveColor;

    return (
        <Pressable
            onPress={onPress}
            onLongPress={onLongPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            accessibilityRole="button"
            accessibilityState={{ selected: isFocused }}
            accessibilityLabel={accessibilityLabel}
            style={{ flex: 1 }}
        >
            <AnimatedView
                style={[
                    animatedContainerStyle,
                    {
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingVertical: itemPaddingVertical,
                        paddingHorizontal: itemPaddingHorizontal,
                        borderRadius: itemRadius,
                        gap: itemGap,
                    },
                ]}
            >
                <AnimatedView style={animatedIconStyle}>
                    {icon({ color, size: iconSize })}
                </AnimatedView>
                <AnimatedView style={animatedLabelStyle}>
                    <Text
                        style={{
                            color,
                            fontSize: labelFontSize,
                            fontWeight: isFocused ? '600' : '500',
                            letterSpacing: 0.2,
                        }}
                    >
                        {label}
                    </Text>
                </AnimatedView>
            </AnimatedView>
        </Pressable>
    );
}

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
    const insets = useSafeAreaInsets();
    const { theme } = useTheme();
    const metrics = useTabBarMetrics();
    const { authState, userId } = useBackendAuth();
    const isBackendEnabled = authState === 'authenticated' && !!userId;

    const tabBarBackground = theme.colors.card;
    const activeBackground = theme.colors.secondaryElevated;
    const activeColor = React.useMemo(
        () => ensureContrast(theme.colors.primary, activeBackground, 4.5),
        [theme.colors.primary, activeBackground]
    );
    const inactiveColor = React.useMemo(
        () => ensureContrast(theme.colors.mutedForeground, tabBarBackground, 4.5),
        [theme.colors.mutedForeground, tabBarBackground]
    );

    const bottomOffset = Math.max(insets.bottom, metrics.marginBottom);
    const visibleRoutes = React.useMemo(
        () => state.routes.filter((route) => isBackendEnabled || route.name !== 'assignments'),
        [isBackendEnabled, state.routes]
    );

    return (
        <View
            style={{
                position: 'absolute',
                bottom: bottomOffset,
                left: metrics.marginHorizontal,
                right: metrics.marginHorizontal,
            }}
        >
            <View
                style={{
                    flexDirection: 'row',
                    height: metrics.height,
                    backgroundColor: tabBarBackground,
                    borderRadius: metrics.containerRadius,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    paddingHorizontal: metrics.containerPaddingHorizontal,
                    paddingVertical: metrics.containerPaddingVertical,
                    alignItems: 'center',
                    ...Platform.select({
                        ios: {
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 6 },
                            shadowOpacity: 0.12,
                            shadowRadius: 16,
                        },
                        android: {
                            elevation: 12,
                        },
                    }),
                }}
            >
                {visibleRoutes.map((route) => {
                    const routeIndex = state.routes.findIndex((entry) => entry.key === route.key);
                    const { options } = descriptors[route.key];
                    const label =
                        options.tabBarLabel !== undefined
                            ? String(options.tabBarLabel)
                            : options.title !== undefined
                                ? options.title
                                : route.name;

                    const isFocused = state.index === routeIndex;

                    const onPress = () => {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: route.key,
                            canPreventDefault: true,
                        });

                        if (!isFocused && !event.defaultPrevented) {
                            navigation.navigate(route.name, route.params);
                        }
                    };

                    const onLongPress = () => {
                        navigation.emit({
                            type: 'tabLongPress',
                            target: route.key,
                        });
                    };

                    const iconRenderer = options.tabBarIcon;

                    return (
                        <TabItem
                            key={route.key}
                            label={label}
                            icon={({ color, size }) =>
                                iconRenderer
                                    ? iconRenderer({ focused: isFocused, color, size })
                                    : null
                            }
                            isFocused={isFocused}
                            onPress={onPress}
                            onLongPress={onLongPress}
                            activeColor={activeColor}
                            inactiveColor={inactiveColor}
                            activeBackground={activeBackground}
                            iconSize={metrics.iconSize}
                            labelFontSize={metrics.labelFontSize}
                            itemRadius={metrics.itemRadius}
                            itemPaddingVertical={metrics.itemPaddingVertical}
                            itemPaddingHorizontal={metrics.itemPaddingHorizontal}
                            itemGap={metrics.itemGap}
                            accessibilityLabel={options.tabBarAccessibilityLabel}
                        />
                    );
                })}
            </View>
        </View>
    );
}
