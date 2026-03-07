import { ensureContrast, useThemeColors } from '@/lib/theme';
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Polygon, Text as SvgText } from 'react-native-svg';
import { Text } from '../ui/Text';

export interface RadarChartAxis {
    key: string;
    label: string;
    maxValue?: number;
}

export interface RadarChartData {
    label: string;
    values: Record<string, number>;
    color?: string;
}

export interface RadarChartProps {
    axes: RadarChartAxis[];
    data: RadarChartData[];
    title?: string;
    size?: number;
    showLegend?: boolean;
}

export function RadarChart({
    axes,
    data,
    title,
    size = 220,
    showLegend = true,
}: RadarChartProps) {
    const colors = useThemeColors();

    if (axes.length < 3 || data.length === 0) {
        return (
            <View className="items-center justify-center py-8">
                <Text style={{ color: colors.mutedForeground }}>Insufficient data</Text>
            </View>
        );
    }

    const chartPadding = 40;
    const canvasSize = size + chartPadding * 2;
    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;
    const radius = Math.max(size / 2 - 40, 45);
    const angleStep = (2 * Math.PI) / axes.length;
    const levels = 4;

    const defaultColors = React.useMemo(
        () =>
            ['#3B82F6', '#10B981', '#F59E0B'].map((color) =>
                ensureContrast(color, colors.card, 3)
            ),
        [colors.card]
    );

    const getPoint = (axisIndex: number, value: number, maxValue: number) => {
        const angle = axisIndex * angleStep - Math.PI / 2;
        const r = (value / maxValue) * radius;
        return {
            x: centerX + r * Math.cos(angle),
            y: centerY + r * Math.sin(angle),
        };
    };

    const levelPolygons = Array.from({ length: levels }, (_, level) => {
        const levelRadius = ((level + 1) / levels) * radius;
        const points = axes
            .map((_, i) => {
                const angle = i * angleStep - Math.PI / 2;
                return `${centerX + levelRadius * Math.cos(angle)},${centerY + levelRadius * Math.sin(angle)}`;
            })
            .join(' ');
        return points;
    });

    const axisLines = axes.map((_, i) => {
        const angle = i * angleStep - Math.PI / 2;
        return {
            x2: centerX + radius * Math.cos(angle),
            y2: centerY + radius * Math.sin(angle),
        };
    });

    const dataPolygons = data.map((d, dataIndex) => {
        const points = axes
            .map((axis, i) => {
                const value = d.values[axis.key] || 0;
                const maxValue = axis.maxValue || 100;
                const point = getPoint(i, value, maxValue);
                return `${point.x},${point.y}`;
            })
            .join(' ');

        return {
            points,
            color: d.color || defaultColors[dataIndex % defaultColors.length],
            label: d.label,
        };
    });

    const axisLabels = axes.map((axis, i) => {
        const angle = i * angleStep - Math.PI / 2;
        const labelRadius = radius + 18;
        const cos = Math.cos(angle);
        const textAnchor: 'start' | 'middle' | 'end' = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle';
        return {
            x: centerX + labelRadius * Math.cos(angle),
            y: centerY + labelRadius * Math.sin(angle),
            label: axis.label,
            textAnchor,
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
                <View className="items-center">
                    <Svg width={canvasSize} height={canvasSize}>
                        <G>

                        {levelPolygons.map((points, i) => (
                            <Polygon
                                key={i}
                                points={points}
                                fill="none"
                                stroke={colors.border}
                                strokeWidth={0.5}
                            />
                        ))}

                        {axisLines.map((line, i) => (
                            <Line
                                key={i}
                                x1={centerX}
                                y1={centerY}
                                x2={line.x2}
                                y2={line.y2}
                                stroke={colors.border}
                                strokeWidth={0.5}
                            />
                        ))}

                        {dataPolygons.map((polygon, i) => (
                            <G key={i}>
                                <Polygon
                                    points={polygon.points}
                                    fill={polygon.color}
                                    fillOpacity={0.2}
                                    stroke={polygon.color}
                                    strokeWidth={2}
                                />

                                {axes.map((axis, axisIndex) => {
                                    const value = data[i].values[axis.key] || 0;
                                    const maxValue = axis.maxValue || 100;
                                    const point = getPoint(axisIndex, value, maxValue);
                                    return (
                                        <Circle
                                            key={axisIndex}
                                            cx={point.x}
                                            cy={point.y}
                                            r={3}
                                            fill={polygon.color}
                                        />
                                    );
                                })}
                            </G>
                        ))}

                            {axisLabels.map((label, i) => (
                                <SvgText
                                    key={i}
                                    x={label.x}
                                    y={label.y}
                                    textAnchor={label.textAnchor}
                                    alignmentBaseline="middle"
                                    fontSize={9}
                                    fill={colors.mutedForeground}
                                >
                                    {label.label.length > 14 ? `${label.label.substring(0, 14)}…` : label.label}
                                </SvgText>
                            ))}

                        <Circle
                            cx={centerX}
                            cy={centerY}
                            r={2}
                            fill={colors.border}
                        />
                        </G>
                    </Svg>
                </View>

                {showLegend && data.length > 0 && (
                    <View className="mt-2 flex-row flex-wrap justify-center gap-3">
                        {dataPolygons.map((polygon, i) => (
                            <View key={i} className="flex-row items-center gap-1.5">
                                <View
                                    style={{ backgroundColor: polygon.color }}
                                    className="h-2.5 w-2.5 rounded-full"
                                />
                                <Text style={{ color: colors.foreground }} className="text-xs font-medium">
                                    {polygon.label}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}
            </View>
        </View>
    );
}
