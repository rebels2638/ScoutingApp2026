import { useThemeColors } from '@/lib/theme';
import React from 'react';
import { View } from 'react-native';
import { Text } from '../ui/Text';

export interface ProgressBarProps {
    label?: string;
    value: number;
    maxValue?: number;
    showValue?: boolean;
    color?: string;
    height?: number;
    formatValue?: (value: number) => string;
}

export function ProgressBar({
    label,
    value,
    maxValue = 100,
    showValue = true,
    color,
    height = 8,
    formatValue = (v) => `${v.toFixed(0)}%`,
}: ProgressBarProps) {
    const colors = useThemeColors();
    const percentage = Math.min((value / maxValue) * 100, 100);
    const barColor = color || colors.primary;

    return (
        <View className="gap-1">
            {(label || showValue) && (
                <View className="flex-row items-center justify-between">
                    {label && (
                        <Text style={{ color: colors.mutedForeground }} className="text-xs">
                            {label}
                        </Text>
                    )}
                    {showValue && (
                        <Text style={{ color: colors.foreground }} className="text-xs font-medium">
                            {formatValue(value)}
                        </Text>
                    )}
                </View>
            )}
            <View
                style={{ backgroundColor: colors.muted, height }}
                className="w-full overflow-hidden rounded-full"
            >
                <View
                    style={{
                        backgroundColor: barColor,
                        width: `${percentage}%`,
                        height: '100%',
                    }}
                    className="rounded-full"
                />
            </View>
        </View>
    );
}

export interface ProgressBarSegment {
    value: number;
    color: string;
    label?: string;
}

export interface MultiProgressBarProps {
    segments: ProgressBarSegment[];
    total?: number;
    height?: number;
    showLegend?: boolean;
}

export function MultiProgressBar({
    segments,
    total: customTotal,
    height = 8,
    showLegend = true,
}: MultiProgressBarProps) {
    const colors = useThemeColors();
    const total = customTotal || segments.reduce((sum, s) => sum + s.value, 0) || 1;

    return (
        <View className="gap-2">
            <View
                style={{ backgroundColor: colors.muted, height }}
                className="flex-row overflow-hidden rounded-full"
            >
                {segments.map((segment, index) => {
                    const percentage = (segment.value / total) * 100;
                    return (
                        <View
                            key={index}
                            style={{
                                backgroundColor: segment.color,
                                width: `${percentage}%`,
                                height: '100%',
                            }}
                        />
                    );
                })}
            </View>

            {showLegend && (
                <View className="flex-row flex-wrap gap-3">
                    {segments.map((segment, index) => (
                        <View key={index} className="flex-row items-center gap-1.5">
                            <View
                                style={{ backgroundColor: segment.color }}
                                className="h-2.5 w-2.5 rounded"
                            />
                            <Text style={{ color: colors.mutedForeground }} className="text-xs">
                                {segment.label || `${segment.value}`}
                            </Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
}
