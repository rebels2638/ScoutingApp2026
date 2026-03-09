import { ComparisonTable, LineChart, RadarChart, StatCard } from '@/components/data';
import { Button } from '@/components/ui/Button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { Text } from '@/components/ui/Text';
import { buildTeamAnalytics, getAutoFuelPoints, getEndgamePoints, getInactiveFuelEstimate, getTeleopFuelEstimate } from '@/lib/analysisCore';
import { getCachedPitProfiles, type PitTeamProfile } from '@/lib/backend/pitScouting';
import {
    buildAverageTeamAnalysis,
    buildHeadToHead,
    comparisonTableMetrics,
    formatMetricRow,
    getTeamStrengths,
    getTeamWeaknesses,
} from '@/lib/comparison';
import {
    activePhaseDefinitions,
    autonomousDefinitions,
    endgameDefinitions,
    inactivePhaseDefinitions,
    matchMetadataDefinitions,
    teleopDefinitions,
    type FieldDefinition,
} from '@/lib/definitions';
import { buildPitProfileMap } from '@/lib/pitScoutingOverlay';
import { getScoutingEntries } from '@/lib/storage';
import { ensureContrast, ThemedScrollView, ThemedView, useThemeColors } from '@/lib/theme';
import type { ScoutingEntry } from '@/lib/types';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ChevronDown, ChevronRight, Gauge, ShieldCheck, TrendingUp } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DEFAULT_COMPARE_TEAM_COUNT = 3;
const MAX_COMPARE_TEAMS = 6;

type RawFieldValue = boolean | number | string | string[] | null | undefined;

interface RawDataSection {
    title: string;
    definitions: Record<string, FieldDefinition>;
    values: Record<string, RawFieldValue>;
}

function parseTeamParams(rawParam: string | string[] | undefined): string[] {
    const rawValue = Array.isArray(rawParam) ? rawParam.join(',') : rawParam ?? '';
    const seen = new Set<string>();

    return rawValue
        .split(',')
        .map((value) => value.trim())
        .filter((value) => /^\d+$/.test(value))
        .filter((value) => {
            if (seen.has(value)) {
                return false;
            }

            seen.add(value);
            return true;
        });
}

function joinLabels(labels: string[]): string {
    if (labels.length === 0) return '';
    if (labels.length === 1) return labels[0];
    if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
    return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

function formatRawValue(value: RawFieldValue): string {
    if (Array.isArray(value)) {
        return value.length > 0 ? value.join(', ') : 'None';
    }
    if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
    }
    if (value === null || value === undefined || value === '') {
        return '—';
    }
    return String(value);
}

function buildRawDataSections(entry: ScoutingEntry): RawDataSection[] {
    return [
        {
            title: 'Match',
            definitions: matchMetadataDefinitions,
            values: {
                matchNumber: entry.matchMetadata.matchNumber,
                matchType: entry.matchMetadata.matchType,
                teamNumber: entry.matchMetadata.teamNumber,
                allianceColor: entry.matchMetadata.allianceColor,
            },
        },
        {
            title: 'Autonomous',
            definitions: autonomousDefinitions,
            values: {
                preloadCount: entry.autonomous.preloadCount,
                leftStartingLine: entry.autonomous.leftStartingLine,
                crossedCenterLine: entry.autonomous.crossedCenterLine,
                fuelScoredBucket: entry.autonomous.fuelScoredBucket,
                climbResult: entry.autonomous.climbResult,
                eligibleForAutoClimbPoints: entry.autonomous.eligibleForAutoClimbPoints,
                autoPath: entry.autonomous.autoPath,
            },
        },
        {
            title: 'Teleop',
            definitions: teleopDefinitions,
            values: {
                scoringCyclesActive: entry.teleop.scoringCyclesActive,
                wastedCyclesInactive: entry.teleop.wastedCyclesInactive,
                fuelShotsAttempted: entry.teleop.fuelShotsAttempted,
                typicalFuelCarried: entry.teleop.typicalFuelCarried,
                primaryFuelSource: entry.teleop.primaryFuelSource,
                usesTrenchRoutes: entry.teleop.usesTrenchRoutes,
                playsDefense: entry.teleop.playsDefense,
            },
        },
        {
            title: 'Active Phase',
            definitions: activePhaseDefinitions,
            values: {
                feedsFuelToAllianceZone: entry.activePhase.feedsFuelToAllianceZone,
                playsOffenseOnly: entry.activePhase.playsOffenseOnly,
                playsSomeDefenseWhileActive: entry.activePhase.playsSomeDefenseWhileActive,
            },
        },
        {
            title: 'Inactive Phase',
            definitions: inactivePhaseDefinitions,
            values: {
                holdsFuelAndWaits: entry.inactivePhase.holdsFuelAndWaits,
                feedsFuelToAllianceZone: entry.inactivePhase.feedsFuelToAllianceZone,
                collectsFromNeutralZone: entry.inactivePhase.collectsFromNeutralZone,
                playsDefense: entry.inactivePhase.playsDefense,
                stillShootsAnyway: entry.inactivePhase.stillShootsAnyway,
            },
        },
        {
            title: 'Endgame',
            definitions: endgameDefinitions,
            values: {
                attemptedClimb: entry.endgame.attemptedClimb,
                climbLevelAchieved: entry.endgame.climbLevelAchieved,
                climbSuccessState: entry.endgame.climbSuccessState,
                timeToClimb: entry.endgame.timeToClimb,
                parkedButNoClimb: entry.endgame.parkedButNoClimb,
                breakdown: entry.endgame.breakdown,
                mobilityIssues: entry.endgame.mobilityIssues,
                cards: entry.endgame.cards,
                extraComments: entry.endgame.extraComments,
            },
        },
    ];
}

export default function CompareScreen() {
    const colors = useThemeColors();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { teams } = useLocalSearchParams<{ teams?: string | string[] }>();

    const [entries, setEntries] = useState<ScoutingEntry[]>([]);
    const [pitProfiles, setPitProfiles] = useState<PitTeamProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedTeamNumbers, setSelectedTeamNumbers] = useState<string[]>([]);
    const [expandedRawTeams, setExpandedRawTeams] = useState<string[]>([]);

    const parsedTeamParams = useMemo(() => parseTeamParams(teams), [teams]);
    const paramSelectionWasTrimmed = parsedTeamParams.length > MAX_COMPARE_TEAMS;
    const pitProfilesByTeam = useMemo(() => buildPitProfileMap(pitProfiles), [pitProfiles]);

    const loadEntries = useCallback(async () => {
        try {
            const [scoutingEntries, cachedPitProfiles] = await Promise.all([
                getScoutingEntries(),
                getCachedPitProfiles(),
            ]);
            setEntries(scoutingEntries);
            setPitProfiles(cachedPitProfiles);
        } catch (error) {
            console.error('Error loading comparison data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            void loadEntries();
        }, [loadEntries])
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        void loadEntries();
    }, [loadEntries]);

    const teamAnalytics = useMemo(
        () => buildTeamAnalytics(entries, pitProfilesByTeam),
        [entries, pitProfilesByTeam]
    );

    useEffect(() => {
        if (teamAnalytics.length === 0) {
            return;
        }

        setSelectedTeamNumbers((current) => {
            const validCurrent = current.filter((teamNumber) =>
                teamAnalytics.some((team) => String(team.teamNumber) === teamNumber)
            );
            if (validCurrent.length > 0) {
                return validCurrent.slice(0, MAX_COMPARE_TEAMS);
            }

            const seededTeams = parsedTeamParams
                .filter((teamNumber) => teamAnalytics.some((team) => String(team.teamNumber) === teamNumber))
                .slice(0, MAX_COMPARE_TEAMS);
            if (seededTeams.length > 0) {
                return seededTeams;
            }

            return teamAnalytics
                .slice(0, Math.min(DEFAULT_COMPARE_TEAM_COUNT, teamAnalytics.length))
                .map((team) => String(team.teamNumber));
        });
    }, [parsedTeamParams, teamAnalytics]);

    useEffect(() => {
        setExpandedRawTeams((current) => {
            const validCurrent = current.filter((teamNumber) => selectedTeamNumbers.includes(teamNumber));
            if (validCurrent.length > 0 || selectedTeamNumbers.length === 0) {
                return validCurrent;
            }
            return [selectedTeamNumbers[0]];
        });
    }, [selectedTeamNumbers]);

    const selectedTeamSet = useMemo(() => new Set(selectedTeamNumbers), [selectedTeamNumbers]);

    const comparisonTeams = useMemo(() => {
        const order = new Map(selectedTeamNumbers.map((teamNumber, index) => [teamNumber, index]));

        return teamAnalytics
            .filter((team) => selectedTeamSet.has(String(team.teamNumber)))
            .sort(
                (left, right) =>
                    (order.get(String(left.teamNumber)) ?? Number.MAX_SAFE_INTEGER) -
                    (order.get(String(right.teamNumber)) ?? Number.MAX_SAFE_INTEGER)
            );
    }, [selectedTeamNumbers, selectedTeamSet, teamAnalytics]);

    const comparisonEntriesByTeam = useMemo(() => {
        const scopedEntries = entries.filter((entry) => selectedTeamSet.has(String(entry.matchMetadata.teamNumber)));
        const groupedEntries = new Map<number, ScoutingEntry[]>();

        scopedEntries.forEach((entry) => {
            const teamEntries = groupedEntries.get(entry.matchMetadata.teamNumber) ?? [];
            teamEntries.push(entry);
            groupedEntries.set(entry.matchMetadata.teamNumber, teamEntries);
        });

        groupedEntries.forEach((teamEntries) => {
            teamEntries.sort((left, right) => left.matchMetadata.matchNumber - right.matchMetadata.matchNumber);
        });

        return groupedEntries;
    }, [entries, selectedTeamSet]);

    const eventAverage = useMemo(() => buildAverageTeamAnalysis(teamAnalytics), [teamAnalytics]);
    const headToHead = useMemo(() => buildHeadToHead(comparisonTeams), [comparisonTeams]);

    const teamPalette = useMemo(
        () =>
            ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'].map((color) =>
                ensureContrast(color, colors.card, 3)
            ),
        [colors.card]
    );

    const teamColors = useMemo(() => {
        const colorMap = new Map<number, string>();

        comparisonTeams.forEach((team, index) => {
            colorMap.set(team.teamNumber, teamPalette[index % teamPalette.length]);
        });

        return colorMap;
    }, [comparisonTeams, teamPalette]);

    const compareTableRows = useMemo(
        () =>
            comparisonTableMetrics.map((metric) => {
                const formatted = formatMetricRow(
                    metric.label,
                    comparisonTeams.map((team) => team[metric.key]),
                    {
                        formatter: metric.formatter,
                        higherIsBetter: metric.higherIsBetter,
                    }
                );

                return {
                    key: String(metric.key),
                    label: metric.label,
                    cells: formatted.cells.map((cell) => ({
                        value: cell.value,
                        isWinner: cell.isWinner,
                    })),
                };
            }),
        [comparisonTeams]
    );

    const hasEnoughTeams = comparisonTeams.length >= 2;

    const selectorOptions = useMemo(
        () =>
            teamAnalytics
                .slice()
                .sort((left, right) => left.teamNumber - right.teamNumber)
                .map((team) => ({
                    label: `Team ${team.teamNumber}`,
                    value: String(team.teamNumber),
                })),
        [teamAnalytics]
    );

    const compareSummaryText = useMemo(() => {
        if (!hasEnoughTeams) {
            return 'Select at least two teams to unlock side-by-side comparison, shared trends, and category winners.';
        }

        return comparisonTeams
            .map((team) => {
                const advantages = headToHead.teamAdvantages[team.teamNumber] ?? [];
                if (advantages.length === 0) {
                    return `Team ${team.teamNumber} is mostly even across the tracked categories.`;
                }

                const visibleAdvantages = advantages.slice(0, 3);
                const remainingCount = advantages.length - visibleAdvantages.length;

                return `Team ${team.teamNumber} leads in ${joinLabels(visibleAdvantages)}${remainingCount > 0 ? ` plus ${remainingCount} more category${remainingCount === 1 ? '' : 'ies'}` : ''}.`;
            })
            .join(' ');
    }, [comparisonTeams, hasEnoughTeams, headToHead.teamAdvantages]);

    const radarAxes = useMemo(() => {
        const contextTeams = eventAverage ? [...comparisonTeams, eventAverage] : comparisonTeams;

        return [
            {
                key: 'scoringPotential',
                label: 'Valid Points',
                maxValue: Math.max(1, ...contextTeams.map((team) => team.scoringPotential)),
            },
            {
                key: 'autoPointsAvg',
                label: 'Auto',
                maxValue: Math.max(1, ...contextTeams.map((team) => team.autoPointsAvg)),
            },
            {
                key: 'teleopFuelAvg',
                label: 'Teleop Fuel',
                maxValue: Math.max(1, ...contextTeams.map((team) => team.teleopFuelAvg)),
            },
            {
                key: 'towerReliabilityPct',
                label: 'Tower Rel %',
                maxValue: 100,
            },
            {
                key: 'strategicReliabilityPct',
                label: 'Strategic Rel %',
                maxValue: 100,
            },
        ];
    }, [comparisonTeams, eventAverage]);

    const radarData = useMemo(() => {
        const selectedTeamData = comparisonTeams.map((team) => ({
            label: `Team ${team.teamNumber}`,
            color: teamColors.get(team.teamNumber),
            values: {
                scoringPotential: team.scoringPotential,
                autoPointsAvg: team.autoPointsAvg,
                teleopFuelAvg: team.teleopFuelAvg,
                towerReliabilityPct: team.towerReliabilityPct,
                strategicReliabilityPct: team.strategicReliabilityPct,
            },
        }));

        if (!eventAverage) {
            return selectedTeamData;
        }

        return [
            ...selectedTeamData,
            {
                label: 'Event Avg',
                color: ensureContrast(colors.mutedForeground, colors.card, 3),
                values: {
                    scoringPotential: eventAverage.scoringPotential,
                    autoPointsAvg: eventAverage.autoPointsAvg,
                    teleopFuelAvg: eventAverage.teleopFuelAvg,
                    towerReliabilityPct: eventAverage.towerReliabilityPct,
                    strategicReliabilityPct: eventAverage.strategicReliabilityPct,
                },
            },
        ];
    }, [colors.card, colors.mutedForeground, comparisonTeams, eventAverage, teamColors]);

    const buildTrendSeries = useCallback(
        (metric: (entry: ScoutingEntry) => number) =>
            comparisonTeams.map((team) => ({
                label: `Team ${team.teamNumber}`,
                color: teamColors.get(team.teamNumber),
                data: (comparisonEntriesByTeam.get(team.teamNumber) ?? []).map((entry) => ({
                    x: `M${entry.matchMetadata.matchNumber}`,
                    y: metric(entry),
                })),
            })),
        [comparisonEntriesByTeam, comparisonTeams, teamColors]
    );

    const autoTrendSeries = useMemo(
        () => buildTrendSeries(getAutoFuelPoints),
        [buildTrendSeries]
    );

    const teleopTrendSeries = useMemo(
        () => buildTrendSeries((entry) => getTeleopFuelEstimate(entry, pitProfilesByTeam)),
        [buildTrendSeries, pitProfilesByTeam]
    );

    const endgameTrendSeries = useMemo(
        () => buildTrendSeries(getEndgamePoints),
        [buildTrendSeries]
    );

    const allianceProjection = useMemo(() => {
        if (comparisonTeams.length !== 3) {
            return null;
        }

        const allianceActiveFuel = comparisonTeams.reduce(
            (sum, team) => sum + team.autoFuelAvg + team.teleopFuelAvg,
            0
        );
        const allianceTowerPoints = comparisonTeams.reduce(
            (sum, team) => sum + team.autoTowerAvg + team.teleopTowerAvg,
            0
        );

        return {
            allianceActiveFuel,
            allianceTowerPoints,
            energizedRp: allianceActiveFuel >= 100,
            superchargedRp: allianceActiveFuel >= 360,
            traversalRp: allianceTowerPoints >= 50,
        };
    }, [comparisonTeams]);

    const toggleSelectedTeam = useCallback((teamNumber: string) => {
        setSelectedTeamNumbers((current) => {
            if (current.includes(teamNumber)) {
                return current.filter((value) => value !== teamNumber);
            }
            if (current.length >= MAX_COMPARE_TEAMS) {
                return current;
            }
            return [...current, teamNumber];
        });
    }, []);

    const selectTopTeams = useCallback((count: number) => {
        setSelectedTeamNumbers(
            teamAnalytics
                .slice(0, Math.min(count, MAX_COMPARE_TEAMS))
                .map((team) => String(team.teamNumber))
        );
    }, [teamAnalytics]);

    const clearSelectedTeams = useCallback(() => {
        setSelectedTeamNumbers([]);
    }, []);

    const toggleExpandedTeam = useCallback((teamNumber: string) => {
        setExpandedRawTeams((current) =>
            current.includes(teamNumber)
                ? current.filter((value) => value !== teamNumber)
                : [...current, teamNumber]
        );
    }, []);

    const summaryCards = useMemo(
        () =>
            comparisonTeams.map((team) => {
                const strengths = eventAverage ? getTeamStrengths(team, eventAverage, teamAnalytics) : [];
                const weaknesses = eventAverage ? getTeamWeaknesses(team, eventAverage, teamAnalytics) : [];

                return {
                    team,
                    strengths,
                    weaknesses,
                    advantageCount: headToHead.advantageCounts[team.teamNumber] ?? 0,
                    leads: headToHead.teamAdvantages[team.teamNumber] ?? [],
                };
            }),
        [comparisonTeams, eventAverage, headToHead.advantageCounts, headToHead.teamAdvantages, teamAnalytics]
    );

    if (loading) {
        return (
            <ThemedView className="flex-1 items-center justify-center">
                <Text>Loading comparison...</Text>
            </ThemedView>
        );
    }

    if (entries.length === 0) {
        return (
            <ThemedView className="flex-1 items-center justify-center px-8">
                <Text className="text-center text-lg font-semibold">No scouting data yet</Text>
                <Text style={{ color: colors.mutedForeground }} className="mt-2 text-center text-sm">
                    Submit match scouting entries first, then return here to compare teams side by side.
                </Text>
            </ThemedView>
        );
    }

    return (
        <ThemedView className="flex-1" style={{ paddingTop: insets.top }}>
            <ThemedScrollView
                contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingTop: 16,
                    paddingBottom: insets.bottom + 24,
                    gap: 16,
                }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                <View className="flex-row items-center justify-between gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onPress={() => router.replace('/(tabs)/analysis')}
                    >
                        <View className="flex-row items-center gap-2">
                            <ArrowLeft size={16} color={colors.foreground} />
                            <Text>Back to Analysis</Text>
                        </View>
                    </Button>
                    <Text style={{ color: colors.mutedForeground }} className="flex-1 text-right text-xs">
                        Comparisons
                    </Text>
                </View>

                <Card>
                    <CardHeader className="flex-col items-start gap-1">
                        <CardTitle>Compare Teams</CardTitle>
                        <CardDescription>
                            Side by side comparisons with the same math, trends, and raw match details.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="gap-3">
                        <Text style={{ color: colors.mutedForeground }} className="text-sm">
                            Select 2 to 6 teams. Scoring, reliability, endgame, and raw match values stay visible in one place.
                        </Text>

                        <View className="flex-row flex-wrap gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onPress={() => selectTopTeams(3)}
                            >
                                Top 3
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onPress={() => selectTopTeams(MAX_COMPARE_TEAMS)}
                            >
                                Top 6
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onPress={clearSelectedTeams}
                            >
                                Clear
                            </Button>
                        </View>

                        <Text style={{ color: colors.mutedForeground }} className="text-xs">
                            Selected {comparisonTeams.length} / {MAX_COMPARE_TEAMS} teams
                            {paramSelectionWasTrimmed ? ' • Route params were trimmed to the first 6 teams.' : ''}
                        </Text>

                        <View className="flex-row flex-wrap gap-y-2">
                            {selectorOptions.map((team) => {
                                const isChecked = selectedTeamNumbers.includes(team.value);
                                const isDisabled = !isChecked && selectedTeamNumbers.length >= MAX_COMPARE_TEAMS;

                                return (
                                    <View key={team.value} style={{ width: '50%' }}>
                                        <Checkbox
                                            checked={isChecked}
                                            onCheckedChange={() => toggleSelectedTeam(team.value)}
                                            disabled={isDisabled}
                                            label={team.label}
                                        />
                                    </View>
                                );
                            })}
                        </View>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex-col items-start gap-1">
                        <CardTitle>General Summary</CardTitle>
                        <CardDescription>
                            Pros, cons, and different leads for the selected teams.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="gap-3">
                        <Text style={{ color: colors.mutedForeground }} className="text-sm">
                            {compareSummaryText}
                        </Text>

                        {hasEnoughTeams ? (
                            <View className="gap-3">
                                {summaryCards.map(({ team, strengths, weaknesses, advantageCount, leads }) => {
                                    const teamColor = teamColors.get(team.teamNumber) ?? colors.primary;

                                    return (
                                        <View
                                            key={team.teamNumber}
                                            style={{ borderColor: colors.border, backgroundColor: colors.card }}
                                            className="overflow-hidden rounded-md border"
                                        >
                                            <View style={{ backgroundColor: teamColor }} className="h-1.5" />
                                            <View className="gap-3 p-3">
                                                <View className="flex-row flex-wrap gap-3">
                                                    <View style={{ minWidth: 160, flex: 1 }}>
                                                        <StatCard
                                                            label={`Team ${team.teamNumber}`}
                                                            value={advantageCount}
                                                            subtitle="Category wins"
                                                            icon={<Gauge size={14} color={teamColor} />}
                                                        />
                                                    </View>
                                                    <View style={{ minWidth: 160, flex: 1 }}>
                                                        <StatCard
                                                            label="Scoring Potential"
                                                            value={team.scoringPotential}
                                                            subtitle="Valid points / match"
                                                            icon={<TrendingUp size={14} color={teamColor} />}
                                                        />
                                                    </View>
                                                    <View style={{ minWidth: 160, flex: 1 }}>
                                                        <StatCard
                                                            label="Strategic Reliability"
                                                            value={`${team.strategicReliabilityPct.toFixed(0)}%`}
                                                            subtitle="Active-HUB discipline"
                                                            icon={<ShieldCheck size={14} color={teamColor} />}
                                                        />
                                                    </View>
                                                </View>

                                                <View className="gap-1.5">
                                                    <Text className="text-sm font-semibold">Leads</Text>
                                                    <Text style={{ color: colors.mutedForeground }} className="text-sm">
                                                        {leads.length > 0 ? joinLabels(leads) : 'No solo category wins yet.'}
                                                    </Text>
                                                </View>

                                                <View className="gap-1.5">
                                                    <Text className="text-sm font-semibold">Strengths vs event</Text>
                                                    <Text style={{ color: colors.mutedForeground }} className="text-sm">
                                                        {strengths.length > 0 ? joinLabels(strengths) : 'Within normal event range.'}
                                                    </Text>
                                                </View>

                                                <View className="gap-1.5">
                                                    <Text className="text-sm font-semibold">Red flags</Text>
                                                    <Text style={{ color: colors.mutedForeground }} className="text-sm">
                                                        {weaknesses.length > 0 ? joinLabels(weaknesses) : 'No major red flags against the event average.'}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        ) : null}
                    </CardContent>
                </Card>

                {hasEnoughTeams ? (
                    <>
                        <ComparisonTable
                            title="Stat Table"
                            description="Best values are highlighted. Lower is better for inactive waste, breakdowns, mobility issues, and cards."
                            teams={comparisonTeams.map((team) => ({
                                key: String(team.teamNumber),
                                label: `Team ${team.teamNumber}`,
                                accentColor: teamColors.get(team.teamNumber),
                            }))}
                            rows={compareTableRows}
                        />

                        <RadarChart
                            title="Selected Teams vs Event Average"
                            axes={radarAxes}
                            data={radarData}
                            size={260}
                        />

                        <LineChart
                            title="Auto Fuel Trends"
                            series={autoTrendSeries}
                            height={240}
                            xAxisLabel="Match Number"
                            formatY={(value) => value.toFixed(1)}
                        />

                        <LineChart
                            title="Teleop Active Fuel Trends"
                            series={teleopTrendSeries}
                            height={240}
                            xAxisLabel="Match Number"
                            formatY={(value) => value.toFixed(1)}
                        />

                        <LineChart
                            title="Endgame Points Trends"
                            series={endgameTrendSeries}
                            height={240}
                            xAxisLabel="Match Number"
                            formatY={(value) => value.toFixed(1)}
                        />

                        <Card>
                            <CardHeader className="flex-col items-start gap-1">
                                <CardTitle>Alliance RP Projection</CardTitle>
                                <CardDescription>
                                    Best used when exactly three teams are selected for a likely alliance combination.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="gap-2">
                                {allianceProjection ? (
                                    <>
                                        <Text className="text-sm">
                                            Projected alliance: {comparisonTeams.map((team) => team.teamNumber).join(' + ')}
                                        </Text>
                                        <Text style={{ color: colors.mutedForeground }} className="text-sm">
                                            Active Fuel (Auto + Teleop): {allianceProjection.allianceActiveFuel.toFixed(1)}
                                        </Text>
                                        <Text style={{ color: colors.mutedForeground }} className="text-sm">
                                            Tower Points (Auto + Teleop): {allianceProjection.allianceTowerPoints.toFixed(1)}
                                        </Text>
                                        <Text
                                            style={{ color: allianceProjection.energizedRp ? ensureContrast('#10B981', colors.card, 4.5) : colors.mutedForeground }}
                                            className="text-sm"
                                        >
                                            Energized RP (100 fuel): {allianceProjection.energizedRp ? 'Met' : 'Not met'}
                                        </Text>
                                        <Text
                                            style={{ color: allianceProjection.superchargedRp ? ensureContrast('#10B981', colors.card, 4.5) : colors.mutedForeground }}
                                            className="text-sm"
                                        >
                                            Supercharged RP (360 fuel): {allianceProjection.superchargedRp ? 'Met' : 'Not met'}
                                        </Text>
                                        <Text
                                            style={{ color: allianceProjection.traversalRp ? ensureContrast('#10B981', colors.card, 4.5) : colors.mutedForeground }}
                                            className="text-sm"
                                        >
                                            Traversal RP (50 tower pts): {allianceProjection.traversalRp ? 'Met' : 'Not met'}
                                        </Text>
                                    </>
                                ) : (
                                    <Text style={{ color: colors.mutedForeground }} className="text-sm">
                                        Select exactly three teams to project alliance RP thresholds.
                                    </Text>
                                )}
                            </CardContent>
                        </Card>
                    </>
                ) : null}

                <Card>
                    <CardHeader className="flex-col items-start gap-1">
                        <CardTitle>Raw Match Data</CardTitle>
                        <CardDescription>
                            Expand a team to inspect the last five scouted matches field by field.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="gap-3">
                        {comparisonTeams.length === 0 ? (
                            <Text style={{ color: colors.mutedForeground }} className="text-sm">
                                Select teams above to inspect match-by-match raw scouting values.
                            </Text>
                        ) : (
                            comparisonTeams.map((team) => {
                                const teamEntries = comparisonEntriesByTeam.get(team.teamNumber) ?? [];
                                const recentEntries = teamEntries.slice(-5).reverse();
                                const isExpanded = expandedRawTeams.includes(String(team.teamNumber));
                                const teamColor = teamColors.get(team.teamNumber) ?? colors.primary;

                                return (
                                    <View
                                        key={team.teamNumber}
                                        style={{ borderColor: colors.border, backgroundColor: colors.card }}
                                        className="overflow-hidden rounded-md border"
                                    >
                                        <Pressable
                                            onPress={() => toggleExpandedTeam(String(team.teamNumber))}
                                            style={{ backgroundColor: colors.secondaryElevated }}
                                            className="px-3 py-3"
                                        >
                                            <View className="flex-row items-center justify-between gap-3">
                                                <View className="flex-1 gap-1">
                                                    <View className="flex-row items-center gap-2">
                                                        <View
                                                            style={{ backgroundColor: teamColor }}
                                                            className="h-2.5 w-2.5 rounded-full"
                                                        />
                                                        <Text className="font-semibold">Team {team.teamNumber}</Text>
                                                    </View>
                                                    <Text style={{ color: colors.mutedForeground }} className="text-xs">
                                                        {teamEntries.length} match{teamEntries.length === 1 ? '' : 'es'} • Avg teleop fuel {team.teleopFuelAvg.toFixed(1)}
                                                    </Text>
                                                </View>
                                                {isExpanded ? (
                                                    <ChevronDown size={18} color={colors.foreground} />
                                                ) : (
                                                    <ChevronRight size={18} color={colors.foreground} />
                                                )}
                                            </View>
                                        </Pressable>

                                        {isExpanded ? (
                                            <View className="gap-3 p-3">
                                                {recentEntries.length === 0 ? (
                                                    <Text style={{ color: colors.mutedForeground }} className="text-sm">
                                                        No matches found for this team.
                                                    </Text>
                                                ) : (
                                                    recentEntries.map((entry) => (
                                                        <View
                                                            key={entry.id}
                                                            style={{ borderColor: colors.border, backgroundColor: colors.background }}
                                                            className="gap-3 rounded-md border p-3"
                                                        >
                                                            <View className="flex-row flex-wrap items-center justify-between gap-2">
                                                                <Text className="font-semibold">
                                                                    Match {entry.matchMetadata.matchNumber}
                                                                </Text>
                                                                <Text style={{ color: colors.mutedForeground }} className="text-xs">
                                                                    {new Date(entry.timestamp).toLocaleDateString()}
                                                                </Text>
                                                            </View>

                                                            <Text style={{ color: colors.mutedForeground }} className="text-xs">
                                                                Auto Fuel {getAutoFuelPoints(entry).toFixed(0)} • Tele Active Fuel {getTeleopFuelEstimate(entry, pitProfilesByTeam).toFixed(1)} • Inactive Fuel {getInactiveFuelEstimate(entry, pitProfilesByTeam).toFixed(1)} • Tower {getEndgamePoints(entry).toFixed(0)} pts
                                                            </Text>

                                                            <View className="gap-3">
                                                                {buildRawDataSections(entry).map((section) => (
                                                                    <View key={`${entry.id}-${section.title}`} className="gap-2">
                                                                        <Text className="text-sm font-semibold">{section.title}</Text>
                                                                        <View className="gap-2">
                                                                            {Object.entries(section.definitions).map(([key, definition]) => (
                                                                                <View
                                                                                    key={`${entry.id}-${section.title}-${key}`}
                                                                                    style={{ backgroundColor: colors.secondaryElevated }}
                                                                                    className="gap-0.5 rounded-md px-2.5 py-2"
                                                                                >
                                                                                    <Text style={{ color: colors.mutedForeground }} className="text-xs font-medium">
                                                                                        {definition.label}
                                                                                    </Text>
                                                                                    <Text className="text-sm">
                                                                                        {formatRawValue(section.values[key])}
                                                                                    </Text>
                                                                                </View>
                                                                            ))}
                                                                        </View>
                                                                    </View>
                                                                ))}
                                                            </View>
                                                        </View>
                                                    ))
                                                )}
                                            </View>
                                        ) : null}
                                    </View>
                                );
                            })
                        )}
                    </CardContent>
                </Card>
            </ThemedScrollView>
        </ThemedView>
    );
}
