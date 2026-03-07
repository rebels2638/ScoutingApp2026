import { ensureContrast, useThemeColors } from '@/lib/theme';
import { ArrowDown, ArrowUp, Info, Minus } from 'lucide-react-native';
import React from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Text } from '../ui/Text';

export interface StatCardProps {
    label: string;
    value: string | number;
    subtitle?: string;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
    icon?: React.ReactNode;
    color?: 'default' | 'success' | 'warning' | 'danger';
    variant?: 'default' | 'snapshot';
    info?: string;
}

export function StatCard({
    label,
    value,
    subtitle,
    trend,
    trendValue,
    icon,
    color = 'default',
    variant = 'default',
    info,
}: StatCardProps) {
    const colors = useThemeColors();
    const isSnapshotVariant = variant === 'snapshot';
    const semanticColors = React.useMemo(
        () => ({
            success: ensureContrast('#10B981', colors.card, 4.5),
            warning: ensureContrast('#F59E0B', colors.card, 4.5),
            destructive: ensureContrast(colors.destructive, colors.card, 4.5),
            muted: ensureContrast(colors.mutedForeground, colors.card, 4.5),
        }),
        [colors.card, colors.destructive, colors.mutedForeground]
    );

    const getTrendColor = () => {
        switch (trend) {
            case 'up': return semanticColors.success;
            case 'down': return semanticColors.destructive;
            case 'neutral': return semanticColors.muted;
            default: return semanticColors.muted;
        }
    };

    const getTrendIcon = () => {
        switch (trend) {
            case 'up': return <ArrowUp size={12} color={getTrendColor()} />;
            case 'down': return <ArrowDown size={12} color={getTrendColor()} />;
            case 'neutral': return <Minus size={12} color={getTrendColor()} />;
            default: return null;
        }
    };

    const getValueColor = () => {
        switch (color) {
            case 'success': return semanticColors.success;
            case 'warning': return semanticColors.warning;
            case 'danger': return semanticColors.destructive;
            default: return colors.foreground;
        }
    };

    return (
        <View
            style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
                minHeight: isSnapshotVariant ? 124 : 110,
                justifyContent: 'space-between',
            }}
            className={isSnapshotVariant ? 'w-full rounded-lg border p-3.5' : 'w-full rounded-lg border p-3'}
        >
            <View>

                <View className="flex-row items-start justify-between">
                    <View className="flex-row items-center gap-2 flex-1 pr-1">
                        {icon && (
                            <View
                                style={{ backgroundColor: colors.secondaryElevated }}
                                className={isSnapshotVariant ? 'rounded-lg p-2' : 'rounded-md p-1.5'}
                            >
                                {icon}
                            </View>
                        )}
                        <Text
                            style={{ color: colors.mutedForeground }}
                            className={isSnapshotVariant
                                ? 'flex-1 text-[11px] font-medium uppercase tracking-wide'
                                : 'flex-1 text-xs'}
                            numberOfLines={2}
                        >
                            {label}
                        </Text>
                    </View>
                    {info && (
                        <Pressable
                            onPress={() => Alert.alert(label, info)}
                            hitSlop={8}
                            style={{ marginTop: 2 }}
                        >
                            <Info size={12} color={colors.mutedForeground} />
                        </Pressable>
                    )}
                </View>

                {subtitle && (
                    <Text
                        style={{ color: colors.mutedForeground }}
                        className={isSnapshotVariant ? 'mt-1.5 text-xs' : 'mt-1 text-xs'}
                        numberOfLines={1}
                    >
                        {subtitle}
                    </Text>
                )}
            </View>

            <View className={isSnapshotVariant ? 'mt-3 flex-row items-end justify-between' : 'mt-2 flex-row items-end justify-between'}>
                <Text
                    style={{ color: getValueColor() }}
                    className={isSnapshotVariant ? 'text-[30px] leading-tight font-semibold' : 'text-2xl font-bold'}
                >
                    {typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(1)) : value}
                </Text>

                {trend && (
                    <View className="flex-row items-center gap-0.5">
                        {getTrendIcon()}
                        {trendValue && (
                            <Text style={{ color: getTrendColor() }} className="text-xs">
                                {trendValue}
                            </Text>
                        )}
                    </View>
                )}
            </View>
        </View>
    );
}

export function StatCardGrid({ children }: { children: React.ReactNode }) {
    return (
        <View className="flex-row flex-wrap gap-3">
            {children}
        </View>
    );
}
