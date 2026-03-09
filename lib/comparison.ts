import { average, type TeamAnalysis } from '@/lib/analysisCore';

export interface ComparisonMetricDefinition {
    key: keyof TeamAnalysis;
    label: string;
    higherIsBetter: boolean;
    formatter: (value: number) => string;
}

export interface FormattedMetricCell {
    rawValue: number;
    value: string;
    isWinner: boolean;
}

export interface FormattedMetricRow {
    label: string;
    winnerIndexes: number[];
    cells: FormattedMetricCell[];
}

export interface HeadToHeadCategory {
    key: keyof TeamAnalysis;
    label: string;
    winnerIndexes: number[];
    values: number[];
}

export interface HeadToHeadSummary {
    categories: HeadToHeadCategory[];
    advantageCounts: Record<number, number>;
    teamAdvantages: Record<number, string[]>;
}

function formatDecimal(value: number): string {
    return value.toFixed(1);
}

function formatInteger(value: number): string {
    return value.toFixed(0);
}

function formatRate(value: number): string {
    return `${(value * 100).toFixed(0)}%`;
}

function formatPercent(value: number): string {
    return `${value.toFixed(0)}%`;
}

function metricSpread(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = average(values);
    const variance = average(values.map((value) => Math.pow(value - mean, 2)));
    return Math.sqrt(variance);
}

function magnitudeThreshold(values: number[], fallbackBase: number): number {
    const spread = metricSpread(values);
    if (spread > 0) {
        return spread;
    }
    return Math.max(Math.abs(fallbackBase) * 0.12, 0.5);
}

function valueDelta(
    value: number,
    baseline: number,
    higherIsBetter: boolean
): number {
    return higherIsBetter ? value - baseline : baseline - value;
}

export const comparisonTableMetrics: ComparisonMetricDefinition[] = [
    { key: 'matchCount', label: 'Matches Played', higherIsBetter: true, formatter: formatInteger },
    { key: 'scoringPotential', label: 'Scoring Potential', higherIsBetter: true, formatter: formatDecimal },
    { key: 'impactScore', label: 'Impact Score', higherIsBetter: true, formatter: formatDecimal },
    { key: 'autoFuelAvg', label: 'Auto Fuel Avg', higherIsBetter: true, formatter: formatDecimal },
    { key: 'autoFuelHigh', label: 'Auto Fuel High', higherIsBetter: true, formatter: formatInteger },
    { key: 'teleopFuelAvg', label: 'Teleop Fuel Avg', higherIsBetter: true, formatter: formatDecimal },
    { key: 'teleopFuelHigh', label: 'Teleop Fuel High', higherIsBetter: true, formatter: formatDecimal },
    { key: 'teleopCyclesAvg', label: 'Active Cycles Avg', higherIsBetter: true, formatter: formatDecimal },
    { key: 'teleopCyclesHigh', label: 'Active Cycles High', higherIsBetter: true, formatter: formatInteger },
    { key: 'inactiveWasteAvg', label: 'Inactive Waste Avg', higherIsBetter: false, formatter: formatDecimal },
    { key: 'autoTowerAvg', label: 'Auto Tower Avg', higherIsBetter: true, formatter: formatDecimal },
    { key: 'teleopTowerAvg', label: 'Teleop Tower Avg', higherIsBetter: true, formatter: formatDecimal },
    { key: 'endgamePointsAvg', label: 'Endgame Pts Avg', higherIsBetter: true, formatter: formatDecimal },
    { key: 'endgamePointsHigh', label: 'Endgame Pts High', higherIsBetter: true, formatter: formatInteger },
    { key: 'climbAttemptRate', label: 'Climb Attempt %', higherIsBetter: true, formatter: formatRate },
    { key: 'towerReliabilityPct', label: 'Tower Reliability %', higherIsBetter: true, formatter: formatPercent },
    { key: 'mechanicalReliabilityPct', label: 'Mechanical Reliability %', higherIsBetter: true, formatter: formatPercent },
    { key: 'strategicReliabilityPct', label: 'Strategic Reliability %', higherIsBetter: true, formatter: formatPercent },
    { key: 'breakdownRate', label: 'Breakdown Rate', higherIsBetter: false, formatter: formatRate },
    { key: 'mobilityIssueRate', label: 'Mobility Issue Rate', higherIsBetter: false, formatter: formatRate },
    { key: 'cardRate', label: 'Card Rate', higherIsBetter: false, formatter: formatRate },
];

const headToHeadMetrics = comparisonTableMetrics.filter(
    (metric) => metric.key !== 'matchCount'
);

const strengthMetrics = [
    headToHeadMetrics.find((metric) => metric.key === 'scoringPotential'),
    headToHeadMetrics.find((metric) => metric.key === 'impactScore'),
    headToHeadMetrics.find((metric) => metric.key === 'autoFuelAvg'),
    headToHeadMetrics.find((metric) => metric.key === 'teleopFuelAvg'),
    headToHeadMetrics.find((metric) => metric.key === 'towerReliabilityPct'),
    headToHeadMetrics.find((metric) => metric.key === 'strategicReliabilityPct'),
    headToHeadMetrics.find((metric) => metric.key === 'mechanicalReliabilityPct'),
    headToHeadMetrics.find((metric) => metric.key === 'breakdownRate'),
    headToHeadMetrics.find((metric) => metric.key === 'mobilityIssueRate'),
].filter((metric): metric is ComparisonMetricDefinition => metric !== undefined);

export function buildAverageTeamAnalysis(teams: TeamAnalysis[]): TeamAnalysis | null {
    if (teams.length === 0) return null;

    const metricAverage = <Key extends keyof TeamAnalysis>(key: Key) => average(teams.map((team) => team[key]));

    return {
        teamNumber: 0,
        matchCount: metricAverage('matchCount'),
        autoFuelAvg: metricAverage('autoFuelAvg'),
        autoFuelHigh: metricAverage('autoFuelHigh'),
        autoTowerAvg: metricAverage('autoTowerAvg'),
        autoPointsAvg: metricAverage('autoPointsAvg'),
        teleopCyclesAvg: metricAverage('teleopCyclesAvg'),
        teleopCyclesHigh: metricAverage('teleopCyclesHigh'),
        teleopFuelAvg: metricAverage('teleopFuelAvg'),
        teleopFuelHigh: metricAverage('teleopFuelHigh'),
        inactiveFuelAvg: metricAverage('inactiveFuelAvg'),
        inactiveWasteAvg: metricAverage('inactiveWasteAvg'),
        climbAttemptRate: metricAverage('climbAttemptRate'),
        climbSuccessRatePct: metricAverage('climbSuccessRatePct'),
        towerReliabilityPct: metricAverage('towerReliabilityPct'),
        strategicReliabilityPct: metricAverage('strategicReliabilityPct'),
        mechanicalReliabilityPct: metricAverage('mechanicalReliabilityPct'),
        totalFuelScoredAnyHubAvg: metricAverage('totalFuelScoredAnyHubAvg'),
        avgClimbLevel: metricAverage('avgClimbLevel'),
        endgamePointsAvg: metricAverage('endgamePointsAvg'),
        endgamePointsHigh: metricAverage('endgamePointsHigh'),
        teleopTowerAvg: metricAverage('teleopTowerAvg'),
        breakdownRate: metricAverage('breakdownRate'),
        mobilityIssueRate: metricAverage('mobilityIssueRate'),
        cardRate: metricAverage('cardRate'),
        reliabilityScore: metricAverage('reliabilityScore'),
        scoringPotential: metricAverage('scoringPotential'),
        impactScore: metricAverage('impactScore'),
    };
}

export function formatMetricRow(
    label: string,
    values: number[],
    options?: {
        formatter?: (value: number) => string;
        higherIsBetter?: boolean;
        epsilon?: number;
    }
): FormattedMetricRow {
    const formatter = options?.formatter ?? formatDecimal;
    const higherIsBetter = options?.higherIsBetter ?? true;
    const epsilon = options?.epsilon ?? 0.001;

    if (values.length === 0) {
        return {
            label,
            winnerIndexes: [],
            cells: [],
        };
    }

    const targetValue = higherIsBetter ? Math.max(...values) : Math.min(...values);
    const winnerIndexes = values
        .map((value, index) => Math.abs(value - targetValue) <= epsilon ? index : -1)
        .filter((index) => index !== -1);

    return {
        label,
        winnerIndexes,
        cells: values.map((rawValue, index) => ({
            rawValue,
            value: formatter(rawValue),
            isWinner: winnerIndexes.includes(index),
        })),
    };
}

export function buildHeadToHead(teams: TeamAnalysis[]): HeadToHeadSummary {
    const advantageCounts: Record<number, number> = {};
    const teamAdvantages: Record<number, string[]> = {};

    teams.forEach((team) => {
        advantageCounts[team.teamNumber] = 0;
        teamAdvantages[team.teamNumber] = [];
    });

    const categories = headToHeadMetrics.map((metric) => {
        const values = teams.map((team) => team[metric.key]);
        const row = formatMetricRow(metric.label, values, {
            formatter: metric.formatter,
            higherIsBetter: metric.higherIsBetter,
        });

        if (row.winnerIndexes.length === 1) {
            const winnerTeam = teams[row.winnerIndexes[0]];
            advantageCounts[winnerTeam.teamNumber] += 1;
            teamAdvantages[winnerTeam.teamNumber].push(metric.label);
        }

        return {
            key: metric.key,
            label: metric.label,
            winnerIndexes: row.winnerIndexes,
            values,
        };
    });

    return {
        categories,
        advantageCounts,
        teamAdvantages,
    };
}

export function getTeamStrengths(
    team: TeamAnalysis,
    eventAvg: TeamAnalysis,
    teamPool: TeamAnalysis[] = []
): string[] {
    return strengthMetrics
        .filter((metric) => {
            const values = teamPool.length > 0 ? teamPool.map((candidate) => candidate[metric.key]) : [team[metric.key], eventAvg[metric.key]];
            const threshold = magnitudeThreshold(values, eventAvg[metric.key]);
            return valueDelta(team[metric.key], eventAvg[metric.key], metric.higherIsBetter) > threshold;
        })
        .map((metric) => metric.label);
}

export function getTeamWeaknesses(
    team: TeamAnalysis,
    eventAvg: TeamAnalysis,
    teamPool: TeamAnalysis[] = []
): string[] {
    return strengthMetrics
        .filter((metric) => {
            const values = teamPool.length > 0 ? teamPool.map((candidate) => candidate[metric.key]) : [team[metric.key], eventAvg[metric.key]];
            const threshold = magnitudeThreshold(values, eventAvg[metric.key]);
            return valueDelta(team[metric.key], eventAvg[metric.key], metric.higherIsBetter) < -threshold;
        })
        .map((metric) => metric.label);
}
