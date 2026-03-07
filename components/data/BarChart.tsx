import { useThemeColors } from '@/lib/theme';
import React from 'react';
import { View } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { Text } from '../ui/Text';

export interface BarChartData {
    label: string;
    value: number;
    color?: string;
}

export interface BarChartProps {
    data: BarChartData[];
    title?: string;
    height?: number;
    horizontal?: boolean;
    showValues?: boolean;
    maxValue?: number;
    formatValue?: (value: number) => string;
}

export function BarChart({
    data,
    title,
    height = 200,
    horizontal = false,
    showValues = true,
    maxValue: customMaxValue,
    formatValue = (v) => v.toFixed(1),
}: BarChartProps) {
    const colors = useThemeColors();

    if (data.length === 0) {
        return (
            <View className="items-center justify-center py-8">
                <Text style={{ color: colors.mutedForeground }}>No data available</Text>
            </View>
        );
    }

    const maxValue = customMaxValue || Math.max(...data.map((d) => d.value), 1);
    const longestLabelLength = Math.max(...data.map((item) => item.label.length), 0);
    const horizontalLabelPadding = Math.min(140, Math.max(80, longestLabelLength * 7 + 16));
    const maxHorizontalLabelChars = Math.max(8, Math.floor((horizontalLabelPadding - 16) / 7));
    const maxVerticalLabelChars = data.length <= 4 ? 12 : data.length <= 6 ? 9 : 6;
    const padding = { top: 20, right: 20, bottom: horizontal ? 28 : 48, left: horizontal ? horizontalLabelPadding : 40 };
    const chartWidth = 320;
    const chartHeight = height;
    const innerWidth = chartWidth - padding.left - padding.right;
    const innerHeight = chartHeight - padding.top - padding.bottom;

    if (horizontal) {
        const barHeight = Math.min(30, (innerHeight - (data.length - 1) * 8) / data.length);
        const barGap = 8;

        return (
            <View>
                {title && (
                    <Text style={{ color: colors.foreground }} className="mb-2 text-base font-semibold">
                        {title}
                    </Text>
                )}
                <View style={{ backgroundColor: colors.card, borderColor: colors.border }} className="rounded-lg border p-3">
                    <Svg width={chartWidth} height={chartHeight}>
                        <G x={padding.left} y={padding.top}>

                            <Line
                                x1={0}
                                y1={0}
                                x2={0}
                                y2={innerHeight}
                                stroke={colors.border}
                                strokeWidth={1}
                            />

                            {data.map((item, index) => {
                                const barWidth = (item.value / maxValue) * innerWidth;
                                const y = index * (barHeight + barGap);

                                return (
                                    <G key={item.label}>

                                        <SvgText
                                            x={-8}
                                            y={y + barHeight / 2 + 4}
                                            textAnchor="end"
                                            fontSize={11}
                                            fill={colors.mutedForeground}
                                        >
                                            {item.label.length > maxHorizontalLabelChars
                                                ? `${item.label.substring(0, maxHorizontalLabelChars)}…`
                                                : item.label}
                                        </SvgText>

                                        <Rect
                                            x={0}
                                            y={y}
                                            width={Math.max(barWidth, 2)}
                                            height={barHeight}
                                            rx={4}
                                            fill={item.color || colors.primary}
                                        />

                                        {showValues && (
                                            <SvgText
                                                x={barWidth + 8}
                                                y={y + barHeight / 2 + 4}
                                                fontSize={11}
                                                fill={colors.foreground}
                                            >
                                                {formatValue(item.value)}
                                            </SvgText>
                                        )}
                                    </G>
                                );
                            })}
                        </G>
                    </Svg>
                </View>
            </View>
        );
    }

    const barWidth = Math.min(40, (innerWidth - (data.length - 1) * 8) / data.length);
    const barGap = 8;
    const totalBarsWidth = data.length * barWidth + (data.length - 1) * barGap;
    const startX = (innerWidth - totalBarsWidth) / 2;

    return (
        <View>
            {title && (
                <Text style={{ color: colors.foreground }} className="mb-2 text-base font-semibold">
                    {title}
                </Text>
            )}
            <View style={{ backgroundColor: colors.card, borderColor: colors.border }} className="rounded-lg border p-3">
                <Svg width={chartWidth} height={chartHeight}>
                    <G x={padding.left} y={padding.top}>

                        <Line
                            x1={0}
                            y1={innerHeight}
                            x2={innerWidth}
                            y2={innerHeight}
                            stroke={colors.border}
                            strokeWidth={1}
                        />

                        {[0.25, 0.5, 0.75, 1].map((ratio) => (
                            <Line
                                key={ratio}
                                x1={0}
                                y1={innerHeight * (1 - ratio)}
                                x2={innerWidth}
                                y2={innerHeight * (1 - ratio)}
                                stroke={colors.border}
                                strokeWidth={0.5}
                                strokeDasharray="4,4"
                            />
                        ))}

                        {data.map((item, index) => {
                            const barHeight = (item.value / maxValue) * innerHeight;
                            const x = startX + index * (barWidth + barGap);
                            const y = innerHeight - barHeight;

                            return (
                                <G key={item.label}>
                                    <Rect
                                        x={x}
                                        y={y}
                                        width={barWidth}
                                        height={Math.max(barHeight, 2)}
                                        rx={4}
                                        fill={item.color || colors.primary}
                                    />

                                    <SvgText
                                        x={x + barWidth / 2}
                                        y={innerHeight + 18}
                                        textAnchor="middle"
                                        fontSize={10}
                                        fill={colors.mutedForeground}
                                    >
                                        {item.label.length > maxVerticalLabelChars
                                            ? `${item.label.substring(0, maxVerticalLabelChars)}…`
                                            : item.label}
                                    </SvgText>

                                    {showValues && (
                                        <SvgText
                                            x={x + barWidth / 2}
                                            y={y - 6}
                                            textAnchor="middle"
                                            fontSize={10}
                                            fill={colors.foreground}
                                        >
                                            {formatValue(item.value)}
                                        </SvgText>
                                    )}
                                </G>
                            );
                        })}
                    </G>
                </Svg>
            </View>
        </View>
    );
}
