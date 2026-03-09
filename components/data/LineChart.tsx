import { ensureContrast, useThemeColors } from '@/lib/theme';
import React from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { Text } from '../ui/Text';

export interface LineChartDataPoint {
    x: number | string;
    y: number;
}

export interface LineChartSeries {
    data: LineChartDataPoint[];
    color?: string;
    label?: string;
}

export interface LineChartProps {
    series: LineChartSeries[];
    title?: string;
    height?: number;
    showDots?: boolean;
    showGrid?: boolean;
    xAxisLabel?: string;
    yAxisLabel?: string;
    formatY?: (value: number) => string;
}

export function LineChart({
    series,
    title,
    height = 180,
    showDots = true,
    showGrid = true,
    xAxisLabel,
    yAxisLabel,
    formatY = (v) => v.toFixed(1),
}: LineChartProps) {
    const colors = useThemeColors();

    const allPoints = series.flatMap((s) => s.data);
    if (allPoints.length === 0) {
        return (
            <View className="items-center justify-center py-8">
                <Text style={{ color: colors.mutedForeground }}>No data available</Text>
            </View>
        );
    }

    const padding = { top: 20, right: 30, bottom: 40, left: 45 };
    const { width } = useWindowDimensions();
    const screenWidth = Math.max(width - 64, 260);
    const xLabels = Array.from(
        new Set(
            allPoints.map((point) => String(point.x))
        )
    ).sort((leftLabel, rightLabel) => {
        const leftMatch = leftLabel.match(/^M?(\d+)$/);
        const rightMatch = rightLabel.match(/^M?(\d+)$/);

        if (leftMatch && rightMatch) {
            return Number(leftMatch[1]) - Number(rightMatch[1]);
        }

        return leftLabel.localeCompare(rightLabel);
    });
    const xLabelToIndex = new Map(xLabels.map((label, index) => [label, index]));
    const maxPoints = Math.max(xLabels.length, 1);
    const minPointSpacing = 24;
    const fitSpacing =
        maxPoints > 1 ? (screenWidth - padding.left - padding.right) / (maxPoints - 1) : screenWidth;
    const shouldScroll = maxPoints > 1 && fitSpacing < minPointSpacing;
    const pointSpacing = shouldScroll ? minPointSpacing : fitSpacing;
    const chartWidth = shouldScroll
        ? (maxPoints - 1) * pointSpacing + padding.left + padding.right
        : screenWidth;
    const chartHeight = height;
    const innerWidth = chartWidth - padding.left - padding.right;
    const innerHeight = chartHeight - padding.top - padding.bottom;

    const yValues = allPoints.map((p) => p.y);
    const minY = Math.min(...yValues, 0);
    const maxY = Math.max(...yValues, 1);
    const yRange = maxY - minY || 1;

    const getPointX = React.useCallback((label: string) => {
        if (maxPoints <= 1) {
            return innerWidth / 2;
        }

        const index = xLabelToIndex.get(label) ?? 0;
        return (innerWidth / (maxPoints - 1)) * index;
    }, [innerWidth, maxPoints, xLabelToIndex]);

    const defaultColors = React.useMemo(
        () =>
            ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'].map((color) =>
                ensureContrast(color, colors.card, 3)
            ),
        [colors.card]
    );

    const chartSvg = (
        <Svg width={chartWidth} height={chartHeight}>
            <G x={padding.left} y={padding.top}>

                {showGrid && (
                    <>
                        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
                            <G key={ratio}>
                                <Line
                                    x1={0}
                                    y1={innerHeight * (1 - ratio)}
                                    x2={innerWidth}
                                    y2={innerHeight * (1 - ratio)}
                                    stroke={colors.border}
                                    strokeWidth={0.5}
                                    strokeDasharray={ratio === 0 ? undefined : '4,4'}
                                />
                                <SvgText
                                    x={-8}
                                    y={innerHeight * (1 - ratio) + 4}
                                    textAnchor="end"
                                    fontSize={9}
                                    fill={colors.mutedForeground}
                                >
                                    {formatY(minY + yRange * ratio)}
                                </SvgText>
                            </G>
                        ))}
                    </>
                )}

                <Line
                    x1={0}
                    y1={0}
                    x2={0}
                    y2={innerHeight}
                    stroke={colors.border}
                    strokeWidth={1}
                />

                <Line
                    x1={0}
                    y1={innerHeight}
                    x2={innerWidth}
                    y2={innerHeight}
                    stroke={colors.border}
                    strokeWidth={1}
                />

                {series.map((s, seriesIndex) => {
                    if (s.data.length === 0) return null;

                    const lineColor = s.color || defaultColors[seriesIndex % defaultColors.length];
                    const points = s.data
                        .slice()
                        .sort(
                            (leftPoint, rightPoint) =>
                                (xLabelToIndex.get(String(leftPoint.x)) ?? 0) -
                                (xLabelToIndex.get(String(rightPoint.x)) ?? 0)
                        )
                        .map((point) => ({
                            x: getPointX(String(point.x)),
                            y: innerHeight - ((point.y - minY) / yRange) * innerHeight,
                        }));

                    const pathD = points
                        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
                        .join(' ');

                    return (
                        <G key={seriesIndex}>
                            <Path
                                d={pathD}
                                stroke={lineColor}
                                strokeWidth={2}
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            {showDots && points.map((p, i) => (
                                <Circle
                                    key={i}
                                    cx={p.x}
                                    cy={p.y}
                                    r={4}
                                    fill={colors.card}
                                    stroke={lineColor}
                                    strokeWidth={2}
                                />
                            ))}
                        </G>
                    );
                })}

                {xLabels.map((label, i) => {
                    const showLabel = xLabels.length <= 6 || i % Math.ceil(xLabels.length / 6) === 0;
                    if (!showLabel) return null;

                    return (
                        <SvgText
                            key={label}
                            x={getPointX(label)}
                            y={innerHeight + 16}
                            textAnchor="middle"
                            fontSize={9}
                            fill={colors.mutedForeground}
                        >
                            {label.length > 6 ? `${label.substring(0, 6)}…` : label}
                        </SvgText>
                    );
                })}

                {xAxisLabel && (
                    <SvgText
                        x={innerWidth / 2}
                        y={innerHeight + 32}
                        textAnchor="middle"
                        fontSize={10}
                        fill={colors.mutedForeground}
                    >
                        {xAxisLabel}
                    </SvgText>
                )}
            </G>
        </Svg>
    );

    return (
        <View>
            {title && (
                <Text style={{ color: colors.foreground }} className="mb-2 text-base font-semibold">
                    {title}
                </Text>
            )}
            <View style={{ backgroundColor: colors.card, borderColor: colors.border }} className="rounded-lg border p-3">
                {shouldScroll ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
                        {chartSvg}
                    </ScrollView>
                ) : (
                    chartSvg
                )}

                {shouldScroll && (
                    <Text style={{ color: colors.mutedForeground }} className="mt-2 text-xs">
                        Swipe horizontally to view all matches.
                    </Text>
                )}

                {series.length > 1 && (
                    <View className="mt-2 flex-row flex-wrap justify-center gap-3">
                        {series.map((s, i) => (
                            <View key={i} className="flex-row items-center gap-1.5">
                                <View
                                    style={{ backgroundColor: s.color || defaultColors[i % defaultColors.length] }}
                                    className="h-2.5 w-2.5 rounded-full"
                                />
                                <Text style={{ color: colors.mutedForeground }} className="text-xs">
                                    {s.label || `Series ${i + 1}`}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}
            </View>
        </View>
    );
}
