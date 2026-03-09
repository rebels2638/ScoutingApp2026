import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { ensureContrast, useThemeColors } from '@/lib/theme';
import React from 'react';
import { ScrollView, View } from 'react-native';

export interface ComparisonTableTeam {
    key: string;
    label: string;
    accentColor?: string;
}

export interface ComparisonTableCell {
    value: string;
    isWinner?: boolean;
}

export interface ComparisonTableRow {
    key: string;
    label: string;
    cells: ComparisonTableCell[];
}

export interface ComparisonTableProps {
    teams: ComparisonTableTeam[];
    rows: ComparisonTableRow[];
    title?: string;
    description?: string;
}

export function ComparisonTable({
    teams,
    rows,
    title,
    description,
}: ComparisonTableProps) {
    const colors = useThemeColors();
    const winnerColor = ensureContrast('#10B981', colors.card, 4.5);
    const metricColumnWidth = 148;
    const teamColumnWidth = 118;
    const headerHeight = 54;
    const rowHeight = 56;

    if (teams.length === 0 || rows.length === 0) {
        return (
            <Card>
                {title && (
                    <CardHeader>
                        <CardTitle>{title}</CardTitle>
                    </CardHeader>
                )}
                <CardContent>
                    <Text style={{ color: colors.mutedForeground }} className="text-sm">
                        Select teams to populate the comparison table.
                    </Text>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            {(title || description) && (
                <CardHeader className="flex-col items-start gap-1">
                    {title ? <CardTitle>{title}</CardTitle> : null}
                    {description ? (
                        <Text style={{ color: colors.mutedForeground }} className="text-sm">
                            {description}
                        </Text>
                    ) : null}
                </CardHeader>
            )}
            <CardContent className="gap-2">
                <View style={{ borderColor: colors.border }} className="overflow-hidden rounded-md border">
                    <View className="flex-row">
                        <View
                            style={{ width: metricColumnWidth, backgroundColor: colors.secondaryElevated }}
                            className="border-r"
                        >
                            <View
                                style={{ height: headerHeight, borderColor: colors.border }}
                                className="justify-center border-b px-3"
                            >
                                <Text className="text-xs font-semibold">Metric</Text>
                            </View>
                            {rows.map((row, rowIndex) => (
                                <View
                                    key={row.key}
                                    style={{
                                        minHeight: rowHeight,
                                        borderBottomColor: rowIndex === rows.length - 1 ? 'transparent' : colors.border,
                                    }}
                                    className="justify-center border-b px-3 py-2"
                                >
                                    <Text className="text-sm font-medium">{row.label}</Text>
                                </View>
                            ))}
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
                            <View className="flex-row">
                                {teams.map((team, teamIndex) => (
                                    <View
                                        key={team.key}
                                        style={{
                                            width: teamColumnWidth,
                                            borderLeftColor: teamIndex === 0 ? 'transparent' : colors.border,
                                        }}
                                        className="border-l"
                                    >
                                        <View
                                            style={{ height: headerHeight, borderColor: colors.border }}
                                            className="border-b"
                                        >
                                            <View
                                                style={{ backgroundColor: team.accentColor ?? colors.primary }}
                                                className="h-1.5"
                                            />
                                            <View className="flex-1 items-center justify-center px-2">
                                                <Text className="text-center text-xs font-semibold">
                                                    {team.label}
                                                </Text>
                                            </View>
                                        </View>

                                        {rows.map((row, rowIndex) => {
                                            const cell = row.cells[teamIndex];

                                            return (
                                                <View
                                                    key={`${row.key}-${team.key}`}
                                                    style={{
                                                        minHeight: rowHeight,
                                                        borderBottomColor: rowIndex === rows.length - 1 ? 'transparent' : colors.border,
                                                        backgroundColor: cell?.isWinner ? colors.secondaryElevated : colors.card,
                                                    }}
                                                    className="items-center justify-center border-b px-2 py-2"
                                                >
                                                    <Text
                                                        style={{ color: cell?.isWinner ? winnerColor : colors.foreground }}
                                                        className={`text-center text-sm ${cell?.isWinner ? 'font-semibold' : 'font-medium'}`}
                                                    >
                                                        {cell?.value ?? '—'}
                                                    </Text>
                                                </View>
                                            );
                                        })}
                                    </View>
                                ))}
                            </View>
                        </ScrollView>
                    </View>
                </View>

                {teams.length > 3 ? (
                    <Text style={{ color: colors.mutedForeground }} className="text-xs">
                        Swipe horizontally to see every team column.
                    </Text>
                ) : null}
            </CardContent>
        </Card>
    );
}
