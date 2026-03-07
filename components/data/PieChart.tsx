import { ensureContrast, useThemeColors } from '@/lib/theme';
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';
import { Text } from '../ui/Text';

export interface PieChartData {
    label: string;
    value: number;
    color?: string;
}

export interface PieChartProps {
    data: PieChartData[];
    title?: string;
    size?: number;
    donut?: boolean;
    showLegend?: boolean;
    showPercentages?: boolean;
}

const BASE_DEFAULT_COLORS = [
    '#3B82F6',
    '#10B981',
    '#F59E0B',
    '#EF4444',
    '#8B5CF6',
    '#EC4899',
    '#06B6D4',
    '#84CC16',
];

export function PieChart({
    data,
    title,
    size = 160,
    donut = true,
    showLegend = true,
    showPercentages = true,
}: PieChartProps) {
    const colors = useThemeColors();
    const defaultColors = React.useMemo(
        () => BASE_DEFAULT_COLORS.map((color) => ensureContrast(color, colors.card, 3)),
        [colors.card]
    );

    if (data.length === 0 || data.every((d) => d.value === 0)) {
        return (
            <View className="items-center justify-center py-8">
                <Text style={{ color: colors.mutedForeground }}>No data available</Text>
            </View>
        );
    }

    const total = data.reduce((sum, d) => sum + d.value, 0);
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2 - 10;
    const innerRadius = donut ? radius * 0.6 : 0;

    let currentAngle = -90;

    const slices = data.map((item, index) => {
        const percentage = (item.value / total) * 100;
        const angle = (item.value / total) * 360;
        const startAngle = currentAngle;
        const endAngle = currentAngle + angle;
        currentAngle = endAngle;

        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (endAngle * Math.PI) / 180;

        const x1 = centerX + radius * Math.cos(startRad);
        const y1 = centerY + radius * Math.sin(startRad);
        const x2 = centerX + radius * Math.cos(endRad);
        const y2 = centerY + radius * Math.sin(endRad);

        const x1Inner = centerX + innerRadius * Math.cos(startRad);
        const y1Inner = centerY + innerRadius * Math.sin(startRad);
        const x2Inner = centerX + innerRadius * Math.cos(endRad);
        const y2Inner = centerY + innerRadius * Math.sin(endRad);

        const largeArcFlag = angle > 180 ? 1 : 0;

        const path = donut
            ? `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${x2Inner} ${y2Inner} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x1Inner} ${y1Inner} Z`
            : `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

        return {
            ...item,
            path,
            color: item.color || defaultColors[index % defaultColors.length],
            percentage,
            midAngle: (startAngle + endAngle) / 2,
        };
    });

    return (
        <View>
            {title && (
                <Text style={{ color: colors.foreground }} className="mb-2 text-base font-semibold">
                    {title}
                </Text>
            )}
            <View style={{ backgroundColor: colors.card, borderColor: colors.border }} className="rounded-lg border p-3">
                <View className="flex-row flex-wrap items-center justify-center gap-4">
                    <Svg width={size} height={size}>
                        <G>
                            {slices.map((slice, index) => (
                                <Path
                                    key={index}
                                    d={slice.path}
                                    fill={slice.color}
                                    stroke={colors.card}
                                    strokeWidth={2}
                                />
                            ))}

                            {donut && (
                                <>
                                    <Circle
                                        cx={centerX}
                                        cy={centerY}
                                        r={innerRadius - 4}
                                        fill={colors.card}
                                    />
                                    <SvgText
                                        x={centerX}
                                        y={centerY - 6}
                                        textAnchor="middle"
                                        fontSize={20}
                                        fontWeight="bold"
                                        fill={colors.foreground}
                                    >
                                        {total}
                                    </SvgText>
                                    <SvgText
                                        x={centerX}
                                        y={centerY + 12}
                                        textAnchor="middle"
                                        fontSize={10}
                                        fill={colors.mutedForeground}
                                    >
                                        Total
                                    </SvgText>
                                </>
                            )}
                        </G>
                    </Svg>

                    {showLegend && (
                        <View className="gap-1.5">
                            {slices.map((slice, index) => (
                                <View key={index} className="flex-row items-center gap-2">
                                    <View
                                        style={{ backgroundColor: slice.color }}
                                        className="h-3 w-3 rounded"
                                    />
                                    <Text style={{ color: colors.foreground }} className="text-xs">
                                        {slice.label}
                                    </Text>
                                    {showPercentages && (
                                        <Text style={{ color: colors.mutedForeground }} className="text-xs">
                                            {slice.percentage.toFixed(0)}%
                                        </Text>
                                    )}
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
}
