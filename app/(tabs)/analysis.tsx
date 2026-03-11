import { BarChart, Leaderboard, LineChart, PieChart, RadarChart, StatCard } from '@/components/data';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { InfoButton } from '@/components/ui/InfoButton';
import { Select } from '@/components/ui/Select';
import { Text } from '@/components/ui/Text';
import {
    average,
    buildMatchTrend,
    buildTeamAnalytics,
    getAutoFuelPoints,
    getEndgamePoints,
    getInactiveFuelEstimate,
    getTeleopFuelEstimate,
} from '@/lib/analysisCore';
import { getCachedPitProfiles, type PitTeamProfile } from '@/lib/backend/pitScouting';
import type { FieldDefinition } from '@/lib/definitions';
import {
    buildPitProfileMap,
    getPitProfileForEntry,
    getResolvedPrimaryFuelSource,
} from '@/lib/pitScoutingOverlay';
import { getScoutingEntries } from '@/lib/storage';
import { ensureContrast, ThemedScrollView, ThemedView, useThemeColors } from '@/lib/theme';
import type { MatchType, ScoutingEntry } from '@/lib/types';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Activity, Gauge, ShieldCheck, TrendingUp } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarMetrics } from './_layout';

type MatchTypeFilter = MatchType | 'All';
type TeamSortMetric =
    | 'impactScore'
    | 'scoringPotential'
    | 'autoFuelAvg'
    | 'teleopFuelAvg'
    | 'teleopCyclesAvg'
    | 'climbSuccessRatePct'
    | 'reliabilityScore';
type ComparisonScope = 'all' | 'top' | 'selected';

const ANALYSIS_TERM_HELP: Array<{ term: string; definition: FieldDefinition }> = [
    {
        term: 'SP',
        definition: {
            label: 'SP (Scoring Potential)',
            description:
                'Average valid points per match using only active-HUB fuel plus legal tower points.',
            validation:
                'SP = Auto Fuel + Teleop Active Fuel + Auto Tower + Teleop Tower',
        },
    },
    {
        term: 'Impact',
        definition: {
            label: 'Impact Score',
            description:
                'Weighted offensive contribution that values Auto Fuel more due to Shift 1 deactivation leverage.',
            validation:
                'Impact = 1.5×Auto Fuel + 1.0×Teleop Active Fuel + Auto Tower + Teleop Tower',
        },
    },
    {
        term: 'MR%',
        definition: {
            label: 'Mechanical Reliability %',
            description:
                'How often launched FUEL physically scores, regardless of HUB state.',
            validation:
                'MR% = Total Fuel Scored (Any HUB State) / Estimated Total Fuel Attempted',
        },
    },
    {
        term: 'SR%',
        definition: {
            label: 'Strategic Reliability %',
            description: 'How often scored FUEL is in an active HUB state instead of wasted inactive scoring.',
            validation:
                'SR% = Fuel Scored in Active HUB / Fuel Scored in Any HUB State',
        },
    },
    {
        term: 'TR%',
        definition: {
            label: 'Tower Reliability %',
            description: 'Percent of climb attempts that end in a successful tower climb.',
            validation: 'TR% = Successful Climbs / Attempted Climbs',
        },
    },
    {
        term: 'RP',
        definition: {
            label: 'Alliance RP Projection',
            description:
                'Top-3 comparison teams are combined to estimate bonus RP thresholds from fuel and tower points.',
            validation:
                'Energized: Active Fuel >= 100, Supercharged: Active Fuel >= 360, Traversal: Tower Points >= 50',
        },
    },
];

const ANALYSIS_FORMULA_OVERVIEW = [
    'Auto Fuel Points = Auto Fuel Scored × 1',
    'Teleop Active Fuel Points = Teleop Active Fuel Scored × 1',
    'Inactive HUB Fuel = 0 points (tracked as wasted fuel)',
    'Auto Tower: L1=15, L2/L3=0 (illegal in auto)',
    'Teleop Tower: L1=10, L2=20, L3=30',
    'Valid Points = Auto Fuel + Teleop Active Fuel + Auto Tower + Teleop Tower',
    'Impact = 1.5×Auto Fuel + 1.0×Teleop Active Fuel + Auto Tower + Teleop Tower',
    'MR% = Fuel Scored (Any HUB State) / Estimated Fuel Attempted',
    'SR% = Fuel Scored in Active HUB / Fuel Scored in Any HUB State',
    'TR% = Successful Climbs / Attempted Climbs',
    'RP Thresholds: Active Fuel 100 (Energized), 360 (Supercharged), Tower 50 (Traversal)',
    'Fuel totals use bucket/cycle estimates from scouting entries and synced pit profiles when pit-managed fields are missing.',
    'MR% uses cycle-based fuel attempt estimates calibrated by pit scouting.',
];
const TOP_COMPARISON_TEAM_LIMIT = 8;
const COMPARE_ROUTE_TEAM_LIMIT = 6;

export default function AnalysisTab() {
    const colors = useThemeColors();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [entries, setEntries] = useState<ScoutingEntry[]>([]);
    const [pitProfiles, setPitProfiles] = useState<PitTeamProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [matchTypeFilter, setMatchTypeFilter] = useState<MatchTypeFilter>('All');
    const [comparisonScope, setComparisonScope] = useState<ComparisonScope>('all');
    const [selectedComparisonTeams, setSelectedComparisonTeams] = useState<string[]>([]);
    const [deepDiveTeam, setDeepDiveTeam] = useState<string>('None');
    const [minScoringPotential, setMinScoringPotential] = useState('0');
    const [minReliability, setMinReliability] = useState('0');
    const [minClimbSuccess, setMinClimbSuccess] = useState('0');
    const [sortMetric, setSortMetric] = useState<TeamSortMetric>('impactScore');
    const [showFormulaHelp, setShowFormulaHelp] = useState(false);
    const [showTermHelp, setShowTermHelp] = useState(false);
    const pitProfilesByTeam = useMemo(() => buildPitProfileMap(pitProfiles), [pitProfiles]);

    const loadEntries = useCallback(async () => {
        try {
            const [data, cachedPitProfiles] = await Promise.all([
                getScoutingEntries(),
                getCachedPitProfiles(),
            ]);
            setEntries(data);
            setPitProfiles(cachedPitProfiles);
        } catch (error) {
            console.error('Error loading analysis entries:', error);
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

    const onRefresh = () => {
        setRefreshing(true);
        void loadEntries();
    };

    const scopedEntries = useMemo(
        () =>
            entries.filter((entry) => {
                if (matchTypeFilter === 'All') return true;
                return entry.matchMetadata.matchType === matchTypeFilter;
            }),
        [entries, matchTypeFilter]
    );

    const teamAnalytics = useMemo(
        () => buildTeamAnalytics(scopedEntries, pitProfilesByTeam),
        [pitProfilesByTeam, scopedEntries]
    );

    const sortedTeams = useMemo(() => {
        const minSP = Number(minScoringPotential);
        const minReliabilityScore = Number(minReliability);
        const minClimbSuccessPct = Number(minClimbSuccess);

        return teamAnalytics
            .filter((team) => {
                return (
                    team.scoringPotential >= minSP &&
                    team.reliabilityScore >= minReliabilityScore &&
                    team.climbSuccessRatePct >= minClimbSuccessPct
                );
            })
            .sort((a, b) => {
                const diff = b[sortMetric] - a[sortMetric];
                return diff !== 0 ? diff : a.teamNumber - b.teamNumber;
            });
    }, [minClimbSuccess, minReliability, minScoringPotential, sortMetric, teamAnalytics]);

    useEffect(() => {
        setSelectedComparisonTeams((previous) =>
            previous.filter((teamNumber) => sortedTeams.some((team) => String(team.teamNumber) === teamNumber))
        );
    }, [sortedTeams]);

    const comparisonTeamNumbers = useMemo(() => {
        if (comparisonScope === 'top') {
            return sortedTeams.slice(0, TOP_COMPARISON_TEAM_LIMIT).map((team) => team.teamNumber);
        }

        if (comparisonScope === 'selected') {
            if (selectedComparisonTeams.length === 0) return [];
            const selectedTeamSet = new Set(selectedComparisonTeams.map(Number));
            return sortedTeams
                .filter((team) => selectedTeamSet.has(team.teamNumber))
                .map((team) => team.teamNumber);
        }

        return sortedTeams.map((team) => team.teamNumber);
    }, [comparisonScope, selectedComparisonTeams, sortedTeams]);

    const comparisonTeamNumberSet = useMemo(() => new Set(comparisonTeamNumbers), [comparisonTeamNumbers]);

    const comparisonTeams = useMemo(
        () => sortedTeams.filter((team) => comparisonTeamNumberSet.has(team.teamNumber)),
        [comparisonTeamNumberSet, sortedTeams]
    );

    const comparisonEntries = useMemo(() => {
        if (comparisonTeams.length === 0) return [];
        return scopedEntries.filter((entry) => comparisonTeamNumberSet.has(entry.matchMetadata.teamNumber));
    }, [comparisonTeamNumberSet, comparisonTeams.length, scopedEntries]);

    useEffect(() => {
        if (deepDiveTeam === 'None') return;
        if (!comparisonTeams.some((team) => String(team.teamNumber) === deepDiveTeam)) {
            setDeepDiveTeam('None');
        }
    }, [comparisonTeams, deepDiveTeam]);

    const comparisonSelectableTeams = useMemo(
        () =>
            sortedTeams
                .slice()
                .sort((a, b) => a.teamNumber - b.teamNumber)
                .map((team) => ({
                    label: `Team ${team.teamNumber}`,
                    value: String(team.teamNumber),
                })),
        [sortedTeams]
    );

    const deepDiveTeamOptions = useMemo(
        () => [
            { label: 'No team selected', value: 'None' },
            ...comparisonTeams
                .slice()
                .sort((a, b) => a.teamNumber - b.teamNumber)
                .map((team) => ({
                    label: `Team ${team.teamNumber}`,
                    value: String(team.teamNumber),
                })),
        ],
        [comparisonTeams]
    );

    const selectedTeamStats = useMemo(() => {
        if (deepDiveTeam === 'None') return null;
        return comparisonTeams.find((team) => team.teamNumber === Number(deepDiveTeam)) ?? null;
    }, [comparisonTeams, deepDiveTeam]);

    const selectedTeamEntries = useMemo(() => {
        if (!selectedTeamStats) return [];
        return comparisonEntries
            .filter((entry) => entry.matchMetadata.teamNumber === selectedTeamStats.teamNumber)
            .sort((a, b) => a.matchMetadata.matchNumber - b.matchMetadata.matchNumber);
    }, [comparisonEntries, selectedTeamStats]);

    const toggleComparisonTeam = useCallback((teamNumber: string) => {
        setSelectedComparisonTeams((current) =>
            current.includes(teamNumber)
                ? current.filter((value) => value !== teamNumber)
                : [...current, teamNumber]
        );
    }, []);

    const selectTopComparisonTeams = useCallback((count: number) => {
        setSelectedComparisonTeams(
            sortedTeams.slice(0, count).map((team) => String(team.teamNumber))
        );
    }, [sortedTeams]);

    const clearComparisonTeams = useCallback(() => {
        setSelectedComparisonTeams([]);
    }, []);

    const compareRouteTeamNumbers = useMemo(
        () => selectedComparisonTeams.slice(0, COMPARE_ROUTE_TEAM_LIMIT),
        [selectedComparisonTeams]
    );

    const canOpenCompare = comparisonScope === 'selected' && compareRouteTeamNumbers.length >= 2;

    const leaderboardMetricLabel = useMemo(() => {
        switch (sortMetric) {
            case 'impactScore':
                return 'Impact';
            case 'scoringPotential':
                return 'Valid Pts';
            case 'autoFuelAvg':
                return 'Auto';
            case 'teleopFuelAvg':
                return 'Tele Fuel';
            case 'teleopCyclesAvg':
                return 'Cycles';
            case 'climbSuccessRatePct':
                return 'Climb %';
            case 'reliabilityScore':
                return 'Strategic Rel %';
            default:
                return 'Value';
        }
    }, [sortMetric]);

    const leaderboardData = useMemo(
        () =>
            comparisonTeams.slice(0, 10).map((team, index) => ({
                rank: index + 1,
                teamNumber: team.teamNumber,
                value: team[sortMetric],
                matchCount: team.matchCount,
            })),
        [comparisonTeams, sortMetric]
    );

    const summary = useMemo(() => {
        const averageScoringPotential = average(comparisonTeams.map((team) => team.scoringPotential));
        const averageStrategicReliability = average(comparisonTeams.map((team) => team.strategicReliabilityPct));
        const averageTowerReliability = average(comparisonTeams.map((team) => team.towerReliabilityPct));
        const topTeam = comparisonTeams[0];

        return {
            totalEntries: comparisonEntries.length,
            teamCount: comparisonTeams.length,
            averageScoringPotential,
            averageStrategicReliability,
            averageTowerReliability,
            topTeam,
        };
    }, [comparisonEntries.length, comparisonTeams]);

    const allianceProjection = useMemo(() => {
        const teams = comparisonTeams.slice(0, 3);
        const allianceActiveFuel = teams.reduce((sum, team) => sum + team.autoFuelAvg + team.teleopFuelAvg, 0);
        const allianceTowerPoints = teams.reduce((sum, team) => sum + team.autoTowerAvg + team.teleopTowerAvg, 0);

        return {
            teams,
            allianceActiveFuel,
            allianceTowerPoints,
            energizedRp: allianceActiveFuel >= 100,
            superchargedRp: allianceActiveFuel >= 360,
            traversalRp: allianceTowerPoints >= 50,
        };
    }, [comparisonTeams]);

    const scoringPotentialBarTeams = useMemo(
        () => comparisonScope === 'selected'
            ? comparisonTeams
            : comparisonTeams.slice(0, TOP_COMPARISON_TEAM_LIMIT),
        [comparisonScope, comparisonTeams]
    );

    const scoringPotentialBars = useMemo(
        () =>
            scoringPotentialBarTeams.map((team) => ({
                label: String(team.teamNumber),
                value: team.scoringPotential,
            })),
        [scoringPotentialBarTeams]
    );

    const scoringPotentialChartHeight = useMemo(
        () => Math.max(240, scoringPotentialBars.length * 30 + 64),
        [scoringPotentialBars.length]
    );
    const analysisSemanticColors = useMemo(
        () => ({
            info: ensureContrast('#3B82F6', colors.card, 3),
            success: ensureContrast('#10B981', colors.card, 3),
            warning: ensureContrast('#F59E0B', colors.card, 3),
            successText: ensureContrast('#10B981', colors.card, 4.5),
            snapshotIcon: ensureContrast(colors.primary, colors.secondaryElevated, 4.5),
        }),
        [colors.card, colors.primary, colors.secondaryElevated]
    );

    const eventTrendSeries = useMemo(
        () => [
            {
                label: 'Auto Fuel',
                color: analysisSemanticColors.info,
                data: buildMatchTrend(comparisonEntries, getAutoFuelPoints),
            },
            {
                label: 'Teleop Active Fuel',
                color: analysisSemanticColors.success,
                data: buildMatchTrend(comparisonEntries, (entry) => getTeleopFuelEstimate(entry, pitProfilesByTeam)),
            },
            {
                label: 'Endgame Pts',
                color: analysisSemanticColors.warning,
                data: buildMatchTrend(comparisonEntries, getEndgamePoints),
            },
        ],
        [
            analysisSemanticColors.info,
            analysisSemanticColors.success,
            analysisSemanticColors.warning,
            comparisonEntries,
            pitProfilesByTeam,
        ]
    );

    const sourceDistribution = useMemo(() => {
        const preferredOrder = ['Neutral Zone', 'Depot', 'Outpost feed', 'Mixed'];
        const counts = new Map<string, number>();

        for (const entry of comparisonEntries) {
            const pitProfile = getPitProfileForEntry(entry, pitProfilesByTeam);
            const source = getResolvedPrimaryFuelSource(entry, pitProfile);
            if (!source) {
                continue;
            }

            counts.set(source, (counts.get(source) ?? 0) + 1);
        }

        return Array.from(counts.entries())
            .sort(([leftLabel], [rightLabel]) => {
                const leftIndex = preferredOrder.indexOf(leftLabel);
                const rightIndex = preferredOrder.indexOf(rightLabel);

                if (leftIndex !== -1 || rightIndex !== -1) {
                    if (leftIndex === -1) {
                        return 1;
                    }
                    if (rightIndex === -1) {
                        return -1;
                    }

                    return leftIndex - rightIndex;
                }

                return leftLabel.localeCompare(rightLabel);
            })
            .map(([label, value]) => ({ label, value }));
    }, [comparisonEntries, pitProfilesByTeam]);

    const climbDistribution = useMemo(() => {
        return [
            {
                label: 'No climb',
                value: comparisonEntries.filter((entry) => !entry.endgame.attemptedClimb).length,
            },
            {
                label: 'L1 success',
                value: comparisonEntries.filter(
                    (entry) =>
                        entry.endgame.climbSuccessState === 'Success' &&
                        entry.endgame.climbLevelAchieved === 'Level 1'
                ).length,
            },
            {
                label: 'L2 success',
                value: comparisonEntries.filter(
                    (entry) =>
                        entry.endgame.climbSuccessState === 'Success' &&
                        entry.endgame.climbLevelAchieved === 'Level 2'
                ).length,
            },
            {
                label: 'L3 success',
                value: comparisonEntries.filter(
                    (entry) =>
                        entry.endgame.climbSuccessState === 'Success' &&
                        entry.endgame.climbLevelAchieved === 'Level 3'
                ).length,
            },
            {
                label: 'Failed/Fell',
                value: comparisonEntries.filter(
                    (entry) => entry.endgame.attemptedClimb && entry.endgame.climbSuccessState !== 'Success'
                ).length,
            },
        ];
    }, [comparisonEntries]);

    const eventAverageProfile = useMemo(() => {
        if (comparisonTeams.length === 0) return null;
        return {
            scoringPotential: average(comparisonTeams.map((team) => team.scoringPotential)),
            autoPointsAvg: average(comparisonTeams.map((team) => team.autoPointsAvg)),
            teleopFuelAvg: average(comparisonTeams.map((team) => team.teleopFuelAvg)),
            towerReliabilityPct: average(comparisonTeams.map((team) => team.towerReliabilityPct)),
            strategicReliabilityPct: average(comparisonTeams.map((team) => team.strategicReliabilityPct)),
        };
    }, [comparisonTeams]);

    const teamRadarAxes = useMemo(() => {
        return [
            {
                key: 'scoringPotential',
                label: 'Valid Points',
                maxValue: Math.max(1, ...comparisonTeams.map((team) => team.scoringPotential)),
            },
            {
                key: 'autoPointsAvg',
                label: 'Auto',
                maxValue: Math.max(1, ...comparisonTeams.map((team) => team.autoPointsAvg)),
            },
            {
                key: 'teleopFuelAvg',
                label: 'Teleop Fuel',
                maxValue: Math.max(1, ...comparisonTeams.map((team) => team.teleopFuelAvg)),
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
    }, [comparisonTeams]);

    const teamRadarData = useMemo(() => {
        if (!selectedTeamStats || !eventAverageProfile) return [];
        return [
            {
                label: `Team ${selectedTeamStats.teamNumber}`,
                color: analysisSemanticColors.info,
                values: {
                    scoringPotential: selectedTeamStats.scoringPotential,
                    autoPointsAvg: selectedTeamStats.autoPointsAvg,
                    teleopFuelAvg: selectedTeamStats.teleopFuelAvg,
                    towerReliabilityPct: selectedTeamStats.towerReliabilityPct,
                    strategicReliabilityPct: selectedTeamStats.strategicReliabilityPct,
                },
            },
            {
                label: 'Event Avg',
                color: analysisSemanticColors.success,
                values: {
                    scoringPotential: eventAverageProfile.scoringPotential,
                    autoPointsAvg: eventAverageProfile.autoPointsAvg,
                    teleopFuelAvg: eventAverageProfile.teleopFuelAvg,
                    towerReliabilityPct: eventAverageProfile.towerReliabilityPct,
                    strategicReliabilityPct: eventAverageProfile.strategicReliabilityPct,
                },
            },
        ];
    }, [analysisSemanticColors.info, analysisSemanticColors.success, eventAverageProfile, selectedTeamStats]);

    const selectedTeamTrends = useMemo(() => {
        if (!selectedTeamStats) return [];
        return [
            {
                label: 'Auto Fuel',
                color: analysisSemanticColors.info,
                data: selectedTeamEntries.map((entry) => ({
                    x: `M${entry.matchMetadata.matchNumber}`,
                    y: getAutoFuelPoints(entry),
                })),
            },
            {
                label: 'Teleop Active Fuel',
                color: analysisSemanticColors.success,
                data: selectedTeamEntries.map((entry) => ({
                    x: `M${entry.matchMetadata.matchNumber}`,
                    y: getTeleopFuelEstimate(entry, pitProfilesByTeam),
                })),
            },
            {
                label: 'Endgame Pts',
                color: analysisSemanticColors.warning,
                data: selectedTeamEntries.map((entry) => ({
                    x: `M${entry.matchMetadata.matchNumber}`,
                    y: getEndgamePoints(entry),
                })),
            },
        ];
    }, [
        analysisSemanticColors.info,
        analysisSemanticColors.success,
        analysisSemanticColors.warning,
        pitProfilesByTeam,
        selectedTeamEntries,
        selectedTeamStats,
    ]);

    const matchTypeOptions = [
        { label: 'All Match Types', value: 'All' as const },
        { label: 'Practice', value: 'Practice' as MatchType },
        { label: 'Qualification', value: 'Qualification' as MatchType },
        { label: 'Playoff', value: 'Playoff' as MatchType },
    ];

    const minScoringOptions = [
        { label: 'Scoring Potential: Any', value: '0' },
        { label: 'Scoring Potential: 20+', value: '20' },
        { label: 'Scoring Potential: 30+', value: '30' },
        { label: 'Scoring Potential: 40+', value: '40' },
        { label: 'Scoring Potential: 50+', value: '50' },
    ];

    const minReliabilityOptions = [
        { label: 'Strategic Reliability: Any', value: '0' },
        { label: 'Strategic Reliability: 60%+', value: '60' },
        { label: 'Strategic Reliability: 75%+', value: '75' },
        { label: 'Strategic Reliability: 90%+', value: '90' },
    ];

    const minClimbSuccessOptions = [
        { label: 'Tower Reliability: Any', value: '0' },
        { label: 'Tower Reliability: 40%+', value: '40' },
        { label: 'Tower Reliability: 60%+', value: '60' },
        { label: 'Tower Reliability: 80%+', value: '80' },
    ];

    const sortOptions = [
        { label: 'Impact Score', value: 'impactScore' as const },
        { label: 'Scoring Potential', value: 'scoringPotential' as const },
        { label: 'Auto Fuel', value: 'autoFuelAvg' as const },
        { label: 'Teleop Active Fuel', value: 'teleopFuelAvg' as const },
        { label: 'Active Cycles', value: 'teleopCyclesAvg' as const },
        { label: 'Tower Reliability %', value: 'climbSuccessRatePct' as const },
        { label: 'Strategic Reliability %', value: 'reliabilityScore' as const },
    ];

    const comparisonScopeOptions = [
        { label: 'All Filtered Teams', value: 'all' as const },
        { label: `Top ${TOP_COMPARISON_TEAM_LIMIT} Filtered Teams`, value: 'top' as const },
        { label: 'Selected Teams', value: 'selected' as const },
    ];

    const comparisonScopeDescription = useMemo(() => {
        if (comparisonScope === 'selected') {
            return `${comparisonTeams.length} selected team${comparisonTeams.length === 1 ? '' : 's'} in charts`;
        }
        if (comparisonScope === 'top') {
            return `Top ${Math.min(TOP_COMPARISON_TEAM_LIMIT, sortedTeams.length)} teams by current sort metric`;
        }
        return `${comparisonTeams.length} filtered team${comparisonTeams.length === 1 ? '' : 's'} in charts`;
    }, [comparisonScope, comparisonTeams.length, sortedTeams.length]);

    const deepDiveEmptyMessage = useMemo(() => {
        if (comparisonScope === 'selected' && comparisonTeams.length === 0) {
            return 'Select comparison teams above to unlock match-by-match trends, profile comparison, and reliability signals.';
        }
        return 'Choose a team to get details about that team as well as specific analysis.';
    }, [comparisonScope, comparisonTeams.length]);

    const { height: tabBarHeight, marginBottom: tabBarMarginBottom } = useTabBarMetrics();
    const bottomPadding = tabBarHeight + Math.max(insets.bottom, tabBarMarginBottom) + 16;

    if (loading) {
        return (
            <ThemedView className="flex-1 items-center justify-center">
                <Text>Loading analysis...</Text>
            </ThemedView>
        );
    }

    if (entries.length === 0) {
        return (
            <ThemedView className="flex-1 items-center justify-center px-8">
                <Text className="text-center text-lg font-semibold">No scouting data yet</Text>
                <Text style={{ color: colors.mutedForeground }} className="mt-2 text-center text-sm">
                    Submit match scouting entries first, then return here for team filters, rankings, and trend graphs.
                </Text>
            </ThemedView>
        );
    }

    return (
        <ThemedView className="flex-1" style={{ paddingTop: insets.top }}>
            <ThemedScrollView
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomPadding, paddingTop: 16, gap: 16 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                <Card>
                    <CardHeader>
                        <CardTitle>2026 REBUILT - Important Match Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Text style={{ color: colors.mutedForeground }} className="text-sm">
                            Fuel in an active HUB is 1 point; auto L1 climb is 15 points; teleop tower L1/L2/L3 is 10/20/30.
                            Bonus RP thresholds (regional/district) are Energized 100 fuel, Supercharged 360 fuel, and Traversal 50 tower points.
                        </Text>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Analysis Filters</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <View className="gap-3">
                            <View className="flex-row gap-3">
                                <View className="flex-1">
                                    <Select
                                        value={matchTypeFilter}
                                        onValueChange={setMatchTypeFilter}
                                        options={matchTypeOptions}
                                        placeholder="Match Type"
                                    />
                                </View>
                                <View className="flex-1">
                                    <Select
                                        value={sortMetric}
                                        onValueChange={setSortMetric}
                                        options={sortOptions}
                                        placeholder="Sort By"
                                    />
                                </View>
                            </View>
                            <View className="flex-row gap-3">
                                <View className="flex-1">
                                    <Select
                                        value={minScoringPotential}
                                        onValueChange={setMinScoringPotential}
                                        options={minScoringOptions}
                                        placeholder="Min Scoring Potential"
                                    />
                                </View>
                                <View className="flex-1">
                                    <Select
                                        value={minReliability}
                                        onValueChange={setMinReliability}
                                        options={minReliabilityOptions}
                                        placeholder="Min Strategic Reliability"
                                    />
                                </View>
                            </View>
                            <View className="flex-row gap-3">
                                <View className="flex-1">
                                    <Select
                                        value={minClimbSuccess}
                                        onValueChange={setMinClimbSuccess}
                                        options={minClimbSuccessOptions}
                                        placeholder="Min Tower Reliability"
                                    />
                                </View>
                                <View className="flex-1">
                                    <Select
                                        value={comparisonScope}
                                        onValueChange={setComparisonScope}
                                        options={comparisonScopeOptions}
                                        placeholder="Comparison Scope"
                                    />
                                </View>
                            </View>
                            <Text style={{ color: colors.mutedForeground }} className="text-xs">
                                {comparisonScopeDescription}
                            </Text>
                            {comparisonScope === 'selected' && (
                                <View
                                    style={{ borderColor: colors.border, backgroundColor: colors.secondaryElevated }}
                                    className="gap-2 rounded-md border p-2.5"
                                >
                                    <View className="flex-row flex-wrap items-center justify-between gap-2">
                                        <Text className="text-xs font-medium">
                                            Selected Teams ({comparisonTeams.length}/{comparisonSelectableTeams.length})
                                        </Text>
                                        <View className="flex-row gap-2">
                                            <Pressable
                                                onPress={() => selectTopComparisonTeams(3)}
                                                style={({ pressed }) => ({
                                                    borderColor: colors.border,
                                                    backgroundColor: pressed ? colors.secondary : colors.background,
                                                })}
                                                className="rounded-md border px-2.5 py-1.5"
                                            >
                                                <Text className="text-xs font-medium">Top 3</Text>
                                            </Pressable>
                                            <Pressable
                                                onPress={clearComparisonTeams}
                                                style={({ pressed }) => ({
                                                    borderColor: colors.border,
                                                    backgroundColor: pressed ? colors.secondary : colors.background,
                                                })}
                                                className="rounded-md border px-2.5 py-1.5"
                                            >
                                                <Text className="text-xs font-medium">Clear</Text>
                                            </Pressable>
                                        </View>
                                    </View>

                                    {comparisonSelectableTeams.length === 0 ? (
                                        <Text style={{ color: colors.mutedForeground }} className="text-xs">
                                            No teams match the current filters.
                                        </Text>
                                    ) : (
                                        <View className="flex-row flex-wrap gap-y-2">
                                            {comparisonSelectableTeams.map((team) => (
                                                <View key={team.value} style={{ width: '50%' }}>
                                                    <Checkbox
                                                        checked={selectedComparisonTeams.includes(team.value)}
                                                        onCheckedChange={() => toggleComparisonTeam(team.value)}
                                                        label={team.label}
                                                    />
                                                </View>
                                            ))}
                                        </View>
                                    )}

                                    {comparisonSelectableTeams.length > 0 && comparisonTeams.length === 0 && (
                                        <Text style={{ color: colors.mutedForeground }} className="text-xs">
                                            Select at least one team to populate all charts.
                                        </Text>
                                    )}
                                </View>
                            )}
                            <View className="gap-2">
                                <Button
                                    variant={canOpenCompare ? 'default' : 'outline'}
                                    disabled={!canOpenCompare}
                                    onPress={() => {
                                        router.push({
                                            pathname: '/compare',
                                            params: {
                                                teams: compareRouteTeamNumbers.join(','),
                                            },
                                        });
                                    }}
                                >
                                    {canOpenCompare ? `Compare ${compareRouteTeamNumbers.length} Teams` : 'Select teams to compare'}
                                </Button>
                                <Text style={{ color: colors.mutedForeground }} className="text-xs">
                                    {comparisonScope !== 'selected'
                                        ? 'Switch comparison type to Selected Teams to open a team vs team based comparison window.'
                                        : selectedComparisonTeams.length < 2
                                            ? 'Choose at least two teams to compare robots.'
                                            : selectedComparisonTeams.length > COMPARE_ROUTE_TEAM_LIMIT
                                                ? `The compare screen opens the first ${COMPARE_ROUTE_TEAM_LIMIT} selected teams.`
                                                : 'Open a window with team vs team comparisons.'}
                                </Text>
                            </View>
                            <View className="mt-1 gap-2">
                                <Text style={{ color: colors.mutedForeground }} className="text-xs font-medium">
                                    Metric Help
                                </Text>
                                <View className="flex-row flex-wrap gap-2">
                                    <Pressable
                                        onPress={() => setShowFormulaHelp((prev) => !prev)}
                                        style={({ pressed }) => ({
                                            borderColor: colors.border,
                                            backgroundColor: pressed || showFormulaHelp ? colors.secondaryElevated : colors.background,
                                        })}
                                        className="rounded-md border px-2.5 py-1.5"
                                    >
                                        <Text className="text-xs font-medium">
                                            {showFormulaHelp ? 'Hide formulas' : 'Show formulas'}
                                        </Text>
                                    </Pressable>
                                    <Pressable
                                        onPress={() => setShowTermHelp((prev) => !prev)}
                                        style={({ pressed }) => ({
                                            borderColor: colors.border,
                                            backgroundColor: pressed || showTermHelp ? colors.secondaryElevated : colors.background,
                                        })}
                                        className="rounded-md border px-2.5 py-1.5"
                                    >
                                        <Text className="text-xs font-medium">
                                            {showTermHelp ? 'Hide term help' : 'Show term help'}
                                        </Text>
                                    </Pressable>
                                </View>

                                {!showFormulaHelp && !showTermHelp && (
                                    <Text style={{ color: colors.mutedForeground }} className="text-xs">
                                        Expand as needed to view formulas and metric definitions.
                                    </Text>
                                )}

                                {showFormulaHelp && (
                                    <View
                                        style={{ borderColor: colors.border, backgroundColor: colors.secondaryElevated }}
                                        className="gap-1.5 rounded-md border p-2.5"
                                    >
                                        {ANALYSIS_FORMULA_OVERVIEW.map((formula, index) => (
                                            <View key={formula} className="flex-row items-start gap-2">
                                                <Text style={{ color: colors.mutedForeground }} className="text-xs font-semibold">
                                                    {index + 1}.
                                                </Text>
                                                <Text style={{ color: colors.mutedForeground }} className="flex-1 text-xs">
                                                    {formula}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {showTermHelp && (
                                    <View className="flex-row flex-wrap gap-3">
                                        {ANALYSIS_TERM_HELP.map((item) => (
                                            <View key={item.term} className="flex-row items-center gap-1">
                                                <Text className="text-xs font-semibold">{item.term}</Text>
                                                <InfoButton definition={item.definition} />
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                        </View>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Comparison Snapshot</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <View className="flex-row flex-wrap gap-3">
                            <View style={{ minWidth: 150, flexGrow: 1, flexBasis: '47%' }}>
                                <StatCard
                                    label="Compared Teams"
                                    value={summary.teamCount}
                                    subtitle={`${summary.totalEntries} matches in scope`}
                                    icon={<Activity size={14} color={analysisSemanticColors.snapshotIcon} />}
                                    variant="snapshot"
                                />
                            </View>
                            <View style={{ minWidth: 150, flexGrow: 1, flexBasis: '47%' }}>
                                <StatCard
                                    label="Avg Scoring"
                                    value={summary.averageScoringPotential}
                                    subtitle="Valid points / match"
                                    icon={<TrendingUp size={14} color={analysisSemanticColors.snapshotIcon} />}

                                    info="Average of valid points only: auto fuel, teleop active fuel, auto tower, and teleop tower."
                                    variant="snapshot"
                                />
                            </View>
                            <View style={{ minWidth: 150, flexGrow: 1, flexBasis: '47%' }}>
                                <StatCard
                                    label="Avg Strategic Rel."
                                    value={`${summary.averageStrategicReliability.toFixed(0)}%`}
                                    subtitle="Active-HUB discipline"
                                    icon={<ShieldCheck size={14} color={analysisSemanticColors.snapshotIcon} />}
                                    color={summary.averageStrategicReliability >= 80 ? 'success' : summary.averageStrategicReliability >= 65 ? 'warning' : 'danger'}
                                    info="Strategic Reliability = active-HUB fuel scored divided by total fuel scored in any HUB state."
                                    variant="snapshot"
                                />
                            </View>
                            <View style={{ minWidth: 150, flexGrow: 1, flexBasis: '47%' }}>
                                <StatCard
                                    label="Top Team Impact"
                                    value={summary.topTeam ? summary.topTeam.impactScore : '-'}
                                    subtitle={summary.topTeam ? `Team ${summary.topTeam.teamNumber}` : 'No team in scope'}
                                    icon={<Gauge size={14} color={analysisSemanticColors.snapshotIcon} />}
                                    info="Impact = 1.5x Auto Fuel + Teleop Active Fuel + Auto Tower + Teleop Tower."
                                    variant="snapshot"
                                />
                            </View>
                        </View>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Alliance RP Projection (Top 3 Teams)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {allianceProjection.teams.length < 3 ? (
                            <Text style={{ color: colors.mutedForeground }} className="text-sm">
                                Include at least 3 comparison teams to project alliance RP thresholds.
                            </Text>
                        ) : (
                            <View className="gap-2">
                                <Text className="text-sm">
                                    Projected Alliance: {allianceProjection.teams.map((team) => team.teamNumber).join(' + ')}
                                </Text>
                                <Text style={{ color: colors.mutedForeground }} className="text-xs">
                                    Active Fuel (Auto + Teleop Active): {allianceProjection.allianceActiveFuel.toFixed(1)}
                                </Text>
                                <Text style={{ color: colors.mutedForeground }} className="text-xs">
                                    Tower Points (Auto + Teleop): {allianceProjection.allianceTowerPoints.toFixed(1)}
                                </Text>
                                <Text
                                    style={{ color: allianceProjection.energizedRp ? analysisSemanticColors.successText : colors.mutedForeground }}
                                    className="text-xs"
                                >
                                    Energized RP (at least 100 Active Fuel): {allianceProjection.energizedRp ? 'Met' : 'Not met'}
                                </Text>
                                <Text
                                    style={{ color: allianceProjection.superchargedRp ? analysisSemanticColors.successText : colors.mutedForeground }}
                                    className="text-xs"
                                >
                                    Supercharged RP (at least 360 Active Fuel): {allianceProjection.superchargedRp ? 'Met' : 'Not met'}
                                </Text>
                                <Text
                                    style={{ color: allianceProjection.traversalRp ? analysisSemanticColors.successText : colors.mutedForeground }}
                                    className="text-xs"
                                >
                                    Traversal RP (at least 50 Tower Points): {allianceProjection.traversalRp ? 'Met' : 'Not met'}
                                </Text>
                            </View>
                        )}
                    </CardContent>
                </Card>

                <Leaderboard
                    title="Team Leaderboard"
                    data={leaderboardData}
                    metricLabel={leaderboardMetricLabel}
                    formatValue={(value) =>
                        sortMetric === 'climbSuccessRatePct' || sortMetric === 'reliabilityScore'
                            ? `${value.toFixed(0)}%`
                            : value.toFixed(1)
                    }
                />

                <BarChart
                    title="Valid Points by Team"
                    data={scoringPotentialBars}
                    horizontal
                    height={scoringPotentialChartHeight}
                    formatValue={(value) => value.toFixed(1)}
                />

                <LineChart
                    title="Event Trend by Match"
                    series={eventTrendSeries}
                    height={220}
                    xAxisLabel="Match Number"
                    formatY={(value) => value.toFixed(1)}
                />

                <PieChart
                    title="Primary Fuel Source Distribution"
                    data={sourceDistribution}
                    donut
                />

                <PieChart
                    title="Endgame Climb Outcome Distribution"
                    data={climbDistribution}
                    donut
                />

                <Card>
                    <CardHeader>
                        <CardTitle>
                            {selectedTeamStats
                                ? `Team ${selectedTeamStats.teamNumber} Analysis`
                                : 'Individual Team Analysis'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <View className="gap-4">
                            <Select
                                value={deepDiveTeam}
                                onValueChange={setDeepDiveTeam}
                                options={deepDiveTeamOptions}
                                placeholder="Select Team for Analysis"
                            />
                            {!selectedTeamStats ? (
                                <Text style={{ color: colors.mutedForeground }} className="text-sm">
                                    {deepDiveEmptyMessage}
                                </Text>
                            ) : (
                                <View className="gap-4">
                                    <View className="flex-row flex-wrap gap-3">
                                        <View style={{ minWidth: 145, flex: 1 }}>
                                            <StatCard
                                                label="Scoring Potential"
                                                value={selectedTeamStats.scoringPotential}
                                                info="Average valid points per match (Auto Fuel + Teleop Active Fuel + Auto Tower + Teleop Tower)."
                                            />
                                        </View>
                                        <View style={{ minWidth: 145, flex: 1 }}>
                                            <StatCard label="Auto Fuel Avg / High" value={`${selectedTeamStats.autoFuelAvg.toFixed(1)} / ${selectedTeamStats.autoFuelHigh.toFixed(0)}`} />
                                        </View>
                                        <View style={{ minWidth: 145, flex: 1 }}>
                                            <StatCard label="Teleop Fuel Avg / High" value={`${selectedTeamStats.teleopFuelAvg.toFixed(1)} / ${selectedTeamStats.teleopFuelHigh.toFixed(0)}`} />
                                        </View>
                                        <View style={{ minWidth: 145, flex: 1 }}>
                                            <StatCard
                                                label="Mechanical Reliability %"
                                                value={`${selectedTeamStats.mechanicalReliabilityPct.toFixed(0)}%`}
                                                info="Fuel scored (any HUB state) divided by estimated total fuel attempted from cycles and pit scouting."
                                            />
                                        </View>
                                        <View style={{ minWidth: 145, flex: 1 }}>
                                            <StatCard
                                                label="Strategic Reliability %"
                                                value={`${selectedTeamStats.strategicReliabilityPct.toFixed(0)}%`}
                                                info="Fuel scored in active HUB divided by all fuel scored regardless of HUB state."
                                            />
                                        </View>
                                        <View style={{ minWidth: 145, flex: 1 }}>
                                            <StatCard
                                                label="Tower Reliability %"
                                                value={`${selectedTeamStats.towerReliabilityPct.toFixed(0)}%`}
                                                info="Successful climbs divided by attempted climbs."
                                            />
                                        </View>
                                    </View>

                                    <LineChart
                                        title="Team Fuel + Tower Trend"
                                        series={selectedTeamTrends}
                                        height={220}
                                        xAxisLabel="Match Number"
                                        formatY={(value) => value.toFixed(1)}
                                    />

                                    <BarChart
                                        title="Team Point Profile"
                                        data={[
                                            { label: 'Auto Fuel', value: selectedTeamStats.autoFuelAvg },
                                            { label: 'Tele Active', value: selectedTeamStats.teleopFuelAvg },
                                            { label: 'Auto Tower', value: selectedTeamStats.autoTowerAvg },
                                            { label: 'Tele Tower', value: selectedTeamStats.teleopTowerAvg },
                                        ]}
                                        horizontal
                                        height={220}
                                        formatValue={(value) => value.toFixed(1)}
                                    />

                                    <RadarChart
                                        title="Team vs Event Average"
                                        axes={teamRadarAxes}
                                        data={teamRadarData}
                                        size={210}
                                    />

                                    <View className="gap-2">
                                        <Text className="text-sm font-semibold">Recent Matches</Text>
                                        {selectedTeamEntries.slice(-5).reverse().map((entry) => (
                                            <View
                                                key={entry.id}
                                                style={{ borderColor: colors.border, backgroundColor: colors.card }}
                                                className="rounded-md border px-3 py-2"
                                            >
                                                <View className="flex-row items-center justify-between">
                                                    <Text className="font-medium">Match {entry.matchMetadata.matchNumber}</Text>
                                                    <Text style={{ color: colors.mutedForeground }} className="text-xs">
                                                        {new Date(entry.timestamp).toLocaleDateString()}
                                                    </Text>
                                                </View>
                                                <Text style={{ color: colors.mutedForeground }} className="mt-1 text-xs">
                                                    Auto Fuel {getAutoFuelPoints(entry).toFixed(0)} • Tele Active Fuel {getTeleopFuelEstimate(entry, pitProfilesByTeam).toFixed(1)} • Inactive Fuel {getInactiveFuelEstimate(entry, pitProfilesByTeam).toFixed(1)} • Tower {getEndgamePoints(entry).toFixed(0)} pts
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}
                        </View>
                    </CardContent>
                </Card>
            </ThemedScrollView>
        </ThemedView>
    );
}
