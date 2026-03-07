import type { AllianceColor, ClimbLevel, FuelScoredBucket, MatchType, ScoutingEntry } from './types';

export interface TeamStats {
    teamNumber: number;
    matchCount: number;

    avgAutoFuel: number;
    autoFuelConsistency: number;
    taxiRate: number;
    autoCrossedCenterRate: number;
    autoClimbAttemptRate: number;
    autoClimbSuccessRate: number;

    avgScoringCycles: number;
    avgWastedCycles: number;
    cycleEfficiency: number;
    defenseRate: number;
    trenchUsageRate: number;

    activeOffenseOnlyRate: number;
    inactiveDefenseRate: number;
    feedsFuelRate: number;

    climbAttemptRate: number;
    climbSuccessRate: number;
    avgClimbLevel: number;
    climbLevelDistribution: Record<ClimbLevel, number>;
    avgClimbTime: number;

    breakdownRate: number;
    mobilityIssueRate: number;
    cardRate: number;

    opr: number;
    reliability: number;
    overallScore: number;
}

export interface MatchStats {
    total: number;
    byType: Record<MatchType, number>;
    byAlliance: Record<AllianceColor, number>;
}

export interface FilterOptions {
    teamNumber?: number;
    matchType?: MatchType | 'All';
    allianceColor?: AllianceColor | 'All';
    dateRange?: { start: Date; end: Date };
    minClimbLevel?: ClimbLevel;
    hasBreakdown?: boolean;
    defenseOnly?: boolean;
}

export interface AggregateStats {
    totalMatches: number;
    uniqueTeams: number;
    avgAutoFuel: number;
    avgTeleopCycles: number;
    climbSuccessRate: number;
    breakdownRate: number;
    avgClimbLevel: number;
}

function fuelBucketToAvg(bucket: FuelScoredBucket): number {
    switch (bucket) {
        case '0': return 0;
        case '1-3': return 2;
        case '4-8': return 6;
        case '9+': return 11;
    }
}

function climbLevelToNumber(level: ClimbLevel): number {
    switch (level) {
        case 'None': return 0;
        case 'Level 1': return 1;
        case 'Level 2': return 2;
        case 'Level 3': return 3;
    }
}

function calculateStdDev(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
}

export function filterEntries(entries: ScoutingEntry[], filters: FilterOptions): ScoutingEntry[] {
    return entries.filter((entry) => {
        if (filters.teamNumber && entry.matchMetadata.teamNumber !== filters.teamNumber) {
            return false;
        }
        if (filters.matchType && filters.matchType !== 'All' && entry.matchMetadata.matchType !== filters.matchType) {
            return false;
        }
        if (filters.allianceColor && filters.allianceColor !== 'All' && entry.matchMetadata.allianceColor !== filters.allianceColor) {
            return false;
        }
        if (filters.dateRange) {
            const entryDate = new Date(entry.timestamp);
            if (entryDate < filters.dateRange.start || entryDate > filters.dateRange.end) {
                return false;
            }
        }
        if (filters.minClimbLevel) {
            const minLevel = climbLevelToNumber(filters.minClimbLevel);
            const entryLevel = climbLevelToNumber(entry.endgame.climbLevelAchieved);
            if (entryLevel < minLevel) {
                return false;
            }
        }
        if (filters.hasBreakdown !== undefined && entry.endgame.breakdown !== filters.hasBreakdown) {
            return false;
        }
        if (filters.defenseOnly && !entry.teleop.playsDefense && !entry.inactivePhase.playsDefense) {
            return false;
        }
        return true;
    });
}

export function calculateMatchStats(entries: ScoutingEntry[]): MatchStats {
    const stats: MatchStats = {
        total: entries.length,
        byType: { Practice: 0, Qualification: 0, Playoff: 0 },
        byAlliance: { Red: 0, Blue: 0 },
    };

    entries.forEach((entry) => {
        stats.byType[entry.matchMetadata.matchType]++;
        stats.byAlliance[entry.matchMetadata.allianceColor]++;
    });

    return stats;
}

export function calculateAggregateStats(entries: ScoutingEntry[]): AggregateStats {
    if (entries.length === 0) {
        return {
            totalMatches: 0,
            uniqueTeams: 0,
            avgAutoFuel: 0,
            avgTeleopCycles: 0,
            climbSuccessRate: 0,
            breakdownRate: 0,
            avgClimbLevel: 0,
        };
    }

    const uniqueTeams = new Set(entries.map((e) => e.matchMetadata.teamNumber)).size;
    const avgAutoFuel = entries.reduce((sum, e) => sum + fuelBucketToAvg(e.autonomous.fuelScoredBucket), 0) / entries.length;
    const avgTeleopCycles = entries.reduce((sum, e) => sum + e.teleop.scoringCyclesActive, 0) / entries.length;

    const climbAttempts = entries.filter((e) => e.endgame.attemptedClimb);
    const climbSuccesses = climbAttempts.filter((e) => e.endgame.climbSuccessState === 'Success');
    const climbSuccessRate = climbAttempts.length > 0 ? climbSuccesses.length / climbAttempts.length : 0;

    const breakdownRate = entries.filter((e) => e.endgame.breakdown).length / entries.length;
    const avgClimbLevel = entries.reduce((sum, e) => sum + climbLevelToNumber(e.endgame.climbLevelAchieved), 0) / entries.length;

    return {
        totalMatches: entries.length,
        uniqueTeams,
        avgAutoFuel,
        avgTeleopCycles,
        climbSuccessRate,
        breakdownRate,
        avgClimbLevel,
    };
}

export function calculateTeamStats(entries: ScoutingEntry[], teamNumber: number): TeamStats | null {
    const teamEntries = entries.filter((e) => e.matchMetadata.teamNumber === teamNumber);
    if (teamEntries.length === 0) return null;

    const matchCount = teamEntries.length;

    const autoFuelValues = teamEntries.map((e) => fuelBucketToAvg(e.autonomous.fuelScoredBucket));
    const avgAutoFuel = autoFuelValues.reduce((a, b) => a + b, 0) / matchCount;
    const autoFuelStdDev = calculateStdDev(autoFuelValues);
    const autoFuelConsistency = avgAutoFuel > 0 ? Math.max(0, 1 - (autoFuelStdDev / avgAutoFuel)) : 1;
    const taxiRate = teamEntries.filter((e) => e.autonomous.leftStartingLine).length / matchCount;
    const autoCrossedCenterRate = teamEntries.filter((e) => e.autonomous.crossedCenterLine).length / matchCount;
    const autoClimbAttempts = teamEntries.filter((e) => e.autonomous.climbResult !== 'None');
    const autoClimbAttemptRate = autoClimbAttempts.length / matchCount;
    const autoClimbSuccessRate = autoClimbAttempts.length > 0
        ? autoClimbAttempts.filter((e) => e.autonomous.climbResult === 'Level 1 success').length / autoClimbAttempts.length
        : 0;

    const avgScoringCycles = teamEntries.reduce((sum, e) => sum + e.teleop.scoringCyclesActive, 0) / matchCount;
    const avgWastedCycles = teamEntries.reduce((sum, e) => sum + e.teleop.wastedCyclesInactive, 0) / matchCount;
    const totalCycles = avgScoringCycles + avgWastedCycles;
    const cycleEfficiency = totalCycles > 0 ? avgScoringCycles / totalCycles : 1;
    const defenseRate = teamEntries.filter((e) => e.teleop.playsDefense).length / matchCount;
    const trenchUsageRate = teamEntries.filter((e) => e.teleop.usesTrenchRoutes).length / matchCount;

    const activeOffenseOnlyRate = teamEntries.filter((e) => e.activePhase.playsOffenseOnly).length / matchCount;
    const inactiveDefenseRate = teamEntries.filter((e) => e.inactivePhase.playsDefense).length / matchCount;
    const feedsFuelRate = teamEntries.filter((e) =>
        e.activePhase.feedsFuelToAllianceZone || e.inactivePhase.feedsFuelToAllianceZone
    ).length / matchCount;

    const climbAttempts = teamEntries.filter((e) => e.endgame.attemptedClimb);
    const climbAttemptRate = climbAttempts.length / matchCount;
    const climbSuccesses = climbAttempts.filter((e) => e.endgame.climbSuccessState === 'Success');
    const climbSuccessRate = climbAttempts.length > 0 ? climbSuccesses.length / climbAttempts.length : 0;
    const avgClimbLevel = teamEntries.reduce((sum, e) => sum + climbLevelToNumber(e.endgame.climbLevelAchieved), 0) / matchCount;
    const climbLevelDistribution: Record<ClimbLevel, number> = {
        'None': 0, 'Level 1': 0, 'Level 2': 0, 'Level 3': 0
    };
    teamEntries.forEach((e) => {
        climbLevelDistribution[e.endgame.climbLevelAchieved]++;
    });
    const climbingEntries = teamEntries.filter((e) => e.endgame.timeToClimb > 0);
    const avgClimbTime = climbingEntries.length > 0
        ? climbingEntries.reduce((sum, e) => sum + e.endgame.timeToClimb, 0) / climbingEntries.length
        : 0;

    const breakdownRate = teamEntries.filter((e) => e.endgame.breakdown).length / matchCount;
    const mobilityIssueRate = teamEntries.filter((e) => e.endgame.mobilityIssues !== 'None').length / matchCount;
    const cardRate = teamEntries.filter((e) => e.endgame.cards.some((c) => c !== 'None')).length / matchCount;

    const autoPoints = (taxiRate * 2) + avgAutoFuel + (autoClimbSuccessRate * autoClimbAttemptRate * 6);
    const teleopPoints = avgScoringCycles * 4;
    const endgamePoints = avgClimbLevel * 4;
    const opr = autoPoints + teleopPoints + endgamePoints;

    const reliability = Math.max(0, 100 * (1 - breakdownRate) * (1 - mobilityIssueRate * 0.5) * (1 - cardRate * 0.3));

    const offensiveScore = Math.min(100, (opr / 50) * 100);
    const overallScore = (offensiveScore * 0.7) + (reliability * 0.15) + (climbSuccessRate * 100 * 0.15);

    return {
        teamNumber,
        matchCount,
        avgAutoFuel,
        autoFuelConsistency,
        taxiRate,
        autoCrossedCenterRate,
        autoClimbAttemptRate,
        autoClimbSuccessRate,
        avgScoringCycles,
        avgWastedCycles,
        cycleEfficiency,
        defenseRate,
        trenchUsageRate,
        activeOffenseOnlyRate,
        inactiveDefenseRate,
        feedsFuelRate,
        climbAttemptRate,
        climbSuccessRate,
        avgClimbLevel,
        climbLevelDistribution,
        avgClimbTime,
        breakdownRate,
        mobilityIssueRate,
        cardRate,
        opr,
        reliability,
        overallScore,
    };
}

export function calculateAllTeamStats(entries: ScoutingEntry[]): TeamStats[] {
    const teamNumbers = [...new Set(entries.map((e) => e.matchMetadata.teamNumber))];
    return teamNumbers
        .map((teamNumber) => calculateTeamStats(entries, teamNumber))
        .filter((stats): stats is TeamStats => stats !== null)
        .sort((a, b) => b.overallScore - a.overallScore);
}

export interface TrendDataPoint {
    matchNumber: number;
    timestamp: number;
    value: number;
}

export function calculateTeamTrend(
    entries: ScoutingEntry[],
    teamNumber: number,
    metric: 'autoFuel' | 'scoringCycles' | 'climbLevel'
): TrendDataPoint[] {
    const teamEntries = entries
        .filter((e) => e.matchMetadata.teamNumber === teamNumber)
        .sort((a, b) => a.timestamp - b.timestamp);

    return teamEntries.map((entry) => {
        let value: number;
        switch (metric) {
            case 'autoFuel':
                value = fuelBucketToAvg(entry.autonomous.fuelScoredBucket);
                break;
            case 'scoringCycles':
                value = entry.teleop.scoringCyclesActive;
                break;
            case 'climbLevel':
                value = climbLevelToNumber(entry.endgame.climbLevelAchieved);
                break;
        }
        return {
            matchNumber: entry.matchMetadata.matchNumber,
            timestamp: entry.timestamp,
            value,
        };
    });
}

export interface TeamComparison {
    team1: TeamStats;
    team2: TeamStats;
    winner: 'team1' | 'team2' | 'tie';
    advantages: {
        category: string;
        team1Value: number;
        team2Value: number;
        winner: 'team1' | 'team2' | 'tie';
    }[];
}

export function compareTeams(entries: ScoutingEntry[], team1: number, team2: number): TeamComparison | null {
    const stats1 = calculateTeamStats(entries, team1);
    const stats2 = calculateTeamStats(entries, team2);

    if (!stats1 || !stats2) return null;

    const categories = [
        { key: 'avgAutoFuel', label: 'Auto Fuel' },
        { key: 'avgScoringCycles', label: 'Teleop Cycles' },
        { key: 'avgClimbLevel', label: 'Climb Level' },
        { key: 'reliability', label: 'Reliability' },
        { key: 'cycleEfficiency', label: 'Cycle Efficiency' },
    ] as const;

    const advantages = categories.map((cat) => {
        const v1 = stats1[cat.key];
        const v2 = stats2[cat.key];
        return {
            category: cat.label,
            team1Value: v1,
            team2Value: v2,
            winner: v1 > v2 ? 'team1' as const : v1 < v2 ? 'team2' as const : 'tie' as const,
        };
    });

    const team1Wins = advantages.filter((a) => a.winner === 'team1').length;
    const team2Wins = advantages.filter((a) => a.winner === 'team2').length;

    return {
        team1: stats1,
        team2: stats2,
        winner: team1Wins > team2Wins ? 'team1' : team1Wins < team2Wins ? 'team2' : 'tie',
        advantages,
    };
}

export type LeaderboardMetric = 'overallScore' | 'opr' | 'avgAutoFuel' | 'avgScoringCycles' | 'avgClimbLevel' | 'reliability';

export interface LeaderboardEntry {
    rank: number;
    teamNumber: number;
    value: number;
    matchCount: number;
}

export function getLeaderboard(entries: ScoutingEntry[], metric: LeaderboardMetric, limit: number = 10): LeaderboardEntry[] {
    const allStats = calculateAllTeamStats(entries);

    return allStats
        .sort((a, b) => b[metric] - a[metric])
        .slice(0, limit)
        .map((stats, index) => ({
            rank: index + 1,
            teamNumber: stats.teamNumber,
            value: stats[metric],
            matchCount: stats.matchCount,
        }));
}

export interface Distribution {
    labels: string[];
    values: number[];
    percentages: number[];
}

export function getClimbDistribution(entries: ScoutingEntry[]): Distribution {
    const levels: ClimbLevel[] = ['None', 'Level 1', 'Level 2', 'Level 3'];
    const counts = levels.map((level) =>
        entries.filter((e) => e.endgame.climbLevelAchieved === level).length
    );
    const total = entries.length || 1;

    return {
        labels: levels,
        values: counts,
        percentages: counts.map((c) => (c / total) * 100),
    };
}

export function getFuelSourceDistribution(entries: ScoutingEntry[]): Distribution {
    const sources = ['Neutral Zone', 'Depot', 'Outpost feed', 'Mixed'] as const;
    const counts = sources.map((source) =>
        entries.filter((e) => e.teleop.primaryFuelSource === source).length
    );
    const total = entries.length || 1;

    return {
        labels: [...sources],
        values: counts,
        percentages: counts.map((c) => (c / total) * 100),
    };
}

export function getScoringCycleDistribution(entries: ScoutingEntry[]): Distribution {
    const ranges = ['0-2', '3-5', '6-8', '9-11', '12+'];
    const counts = [0, 0, 0, 0, 0];

    entries.forEach((entry) => {
        const cycles = entry.teleop.scoringCyclesActive;
        if (cycles <= 2) counts[0]++;
        else if (cycles <= 5) counts[1]++;
        else if (cycles <= 8) counts[2]++;
        else if (cycles <= 11) counts[3]++;
        else counts[4]++;
    });

    const total = entries.length || 1;

    return {
        labels: ranges,
        values: counts,
        percentages: counts.map((c) => (c / total) * 100),
    };
}
