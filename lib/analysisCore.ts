import {
    getEstimatedFuelPerCycle,
    getPitProfileForEntry,
    getResolvedTypicalFuelCarried,
    type PitProfileMap,
} from '@/lib/pitScoutingOverlay';
import type { ClimbLevel, FuelScoredBucket, ScoutingEntry } from '@/lib/types';

export interface TeamAnalysis {
    teamNumber: number;
    matchCount: number;
    autoFuelAvg: number;
    autoFuelHigh: number;
    autoTowerAvg: number;
    autoPointsAvg: number;
    teleopCyclesAvg: number;
    teleopCyclesHigh: number;
    teleopFuelAvg: number;
    teleopFuelHigh: number;
    inactiveFuelAvg: number;
    inactiveWasteAvg: number;
    climbAttemptRate: number;
    climbSuccessRatePct: number;
    towerReliabilityPct: number;
    strategicReliabilityPct: number;
    mechanicalReliabilityPct: number;
    totalFuelScoredAnyHubAvg: number;
    avgClimbLevel: number;
    endgamePointsAvg: number;
    endgamePointsHigh: number;
    teleopTowerAvg: number;
    breakdownRate: number;
    mobilityIssueRate: number;
    cardRate: number;
    reliabilityScore: number;
    scoringPotential: number;
    impactScore: number;
}

export interface MatchTrendPoint {
    x: string;
    y: number;
}

export const AUTO_FUEL_POINTS: Record<FuelScoredBucket, number> = {
    '0': 0,
    '1-3': 2,
    '4-8': 6,
    '9+': 10,
};

export const ENDGAME_TOWER_POINTS: Record<ClimbLevel, number> = {
    None: 0,
    'Level 1': 10,
    'Level 2': 20,
    'Level 3': 30,
};

export function average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function max(values: number[]): number {
    if (values.length === 0) return 0;
    return Math.max(...values);
}

export function clamp(value: number, minValue: number, maxValue: number): number {
    return Math.min(Math.max(value, minValue), maxValue);
}

export function climbLevelToNumber(level: ClimbLevel): number {
    switch (level) {
        case 'Level 1':
            return 1;
        case 'Level 2':
            return 2;
        case 'Level 3':
            return 3;
        case 'None':
        default:
            return 0;
    }
}

export function getAutoFuelPoints(entry: ScoutingEntry): number {
    return AUTO_FUEL_POINTS[entry.autonomous.fuelScoredBucket];
}

export function getAutoClimbPoints(entry: ScoutingEntry): number {
    return entry.autonomous.climbResult === 'Level 1 success' && entry.autonomous.eligibleForAutoClimbPoints
        ? 15
        : 0;
}

export function getTeleopFuelEstimate(entry: ScoutingEntry, pitProfilesByTeam: PitProfileMap): number {
    const pitProfile = getPitProfileForEntry(entry, pitProfilesByTeam);
    const typicalFuelCarried = getResolvedTypicalFuelCarried(entry, pitProfile);
    return entry.teleop.scoringCyclesActive * getEstimatedFuelPerCycle(typicalFuelCarried);
}

export function getInactiveFuelEstimate(entry: ScoutingEntry, pitProfilesByTeam: PitProfileMap): number {
    const pitProfile = getPitProfileForEntry(entry, pitProfilesByTeam);
    const typicalFuelCarried = getResolvedTypicalFuelCarried(entry, pitProfile);
    return entry.teleop.wastedCyclesInactive * getEstimatedFuelPerCycle(typicalFuelCarried);
}

export function getEstimatedFuelShotsAttempted(entry: ScoutingEntry, pitProfilesByTeam: PitProfileMap): number {
    const fallbackTeleopEstimate =
        getTeleopFuelEstimate(entry, pitProfilesByTeam) + getInactiveFuelEstimate(entry, pitProfilesByTeam);
    const recordedTeleopAttempts = entry.teleop.fuelShotsAttempted;
    const teleopAttempts = recordedTeleopAttempts && recordedTeleopAttempts > 0
        ? recordedTeleopAttempts
        : fallbackTeleopEstimate;
    return getAutoFuelPoints(entry) + Math.max(teleopAttempts, 0);
}

export function getEndgamePoints(entry: ScoutingEntry): number {
    if (!entry.endgame.attemptedClimb || entry.endgame.climbSuccessState !== 'Success') {
        return 0;
    }
    return ENDGAME_TOWER_POINTS[entry.endgame.climbLevelAchieved];
}

export function buildMatchTrend(
    entries: ScoutingEntry[],
    metric: (entry: ScoutingEntry) => number
): MatchTrendPoint[] {
    const byMatch = new Map<number, number[]>();

    entries.forEach((entry) => {
        const key = entry.matchMetadata.matchNumber;
        const values = byMatch.get(key) ?? [];
        values.push(metric(entry));
        byMatch.set(key, values);
    });

    return Array.from(byMatch.entries())
        .sort(([left], [right]) => left - right)
        .map(([matchNumber, values]) => ({
            x: `M${matchNumber}`,
            y: average(values),
        }));
}

export function buildTeamAnalytics(entries: ScoutingEntry[], pitProfilesByTeam: PitProfileMap): TeamAnalysis[] {
    const byTeam = new Map<number, ScoutingEntry[]>();

    entries.forEach((entry) => {
        const teamNumber = entry.matchMetadata.teamNumber;
        const teamEntries = byTeam.get(teamNumber) ?? [];
        teamEntries.push(entry);
        byTeam.set(teamNumber, teamEntries);
    });

    return Array.from(byTeam.entries())
        .map(([teamNumber, teamEntries]) => {
            const matchCount = teamEntries.length;

            const autoFuelValues = teamEntries.map(getAutoFuelPoints);
            const autoTowerValues = teamEntries.map(getAutoClimbPoints);
            const teleopCycleValues = teamEntries.map((entry) => entry.teleop.scoringCyclesActive);
            const teleopFuelValues = teamEntries.map((entry) => getTeleopFuelEstimate(entry, pitProfilesByTeam));
            const inactiveFuelValues = teamEntries.map((entry) => getInactiveFuelEstimate(entry, pitProfilesByTeam));
            const inactiveWasteValues = teamEntries.map((entry) => entry.teleop.wastedCyclesInactive);
            const teleopTowerValues = teamEntries.map(getEndgamePoints);

            const climbAttempts = teamEntries.filter((entry) => entry.endgame.attemptedClimb);
            const climbSuccesses = climbAttempts.filter((entry) => entry.endgame.climbSuccessState === 'Success');
            const climbAttemptRate = matchCount > 0 ? climbAttempts.length / matchCount : 0;
            const towerReliabilityPct = climbAttempts.length > 0
                ? (climbSuccesses.length / climbAttempts.length) * 100
                : 0;
            const climbSuccessRatePct = towerReliabilityPct;

            const breakdownRate = teamEntries.filter((entry) => entry.endgame.breakdown).length / matchCount;
            const mobilityIssueRate = teamEntries.filter((entry) => entry.endgame.mobilityIssues !== 'None').length / matchCount;
            const cardRate = teamEntries.filter((entry) => entry.endgame.cards.some((card) => card !== 'None')).length / matchCount;

            const totalAutoFuel = autoFuelValues.reduce((sum, value) => sum + value, 0);
            const totalTeleopFuel = teleopFuelValues.reduce((sum, value) => sum + value, 0);
            const totalInactiveFuel = inactiveFuelValues.reduce((sum, value) => sum + value, 0);
            const totalFuelScoredAnyHub = totalAutoFuel + totalTeleopFuel + totalInactiveFuel;
            const totalFuelScoredActiveHub = totalAutoFuel + totalTeleopFuel;
            const totalFuelShotsAttempted = teamEntries.reduce(
                (sum, entry) => sum + getEstimatedFuelShotsAttempted(entry, pitProfilesByTeam),
                0
            );
            const normalizedShotsAttempted = Math.max(totalFuelShotsAttempted, totalFuelScoredAnyHub);
            const mechanicalReliabilityPct = normalizedShotsAttempted > 0
                ? clamp((totalFuelScoredAnyHub / normalizedShotsAttempted) * 100, 0, 100)
                : 0;
            const strategicReliabilityPct = totalFuelScoredAnyHub > 0
                ? clamp((totalFuelScoredActiveHub / totalFuelScoredAnyHub) * 100, 0, 100)
                : 0;

            const autoFuelAvg = average(autoFuelValues);
            const autoTowerAvg = average(autoTowerValues);
            const teleopFuelAvg = average(teleopFuelValues);
            const teleopTowerAvg = average(teleopTowerValues);
            const autoPointsAvg = autoFuelAvg + autoTowerAvg;
            const endgamePointsAvg = teleopTowerAvg;
            const scoringPotential = autoFuelAvg + teleopFuelAvg + autoTowerAvg + teleopTowerAvg;
            const impactScore = autoFuelAvg * 1.5 + teleopFuelAvg + autoTowerAvg + teleopTowerAvg;
            const reliabilityScore = strategicReliabilityPct;

            return {
                teamNumber,
                matchCount,
                autoFuelAvg,
                autoFuelHigh: max(autoFuelValues),
                autoTowerAvg,
                autoPointsAvg,
                teleopCyclesAvg: average(teleopCycleValues),
                teleopCyclesHigh: max(teleopCycleValues),
                teleopFuelAvg,
                teleopFuelHigh: max(teleopFuelValues),
                inactiveFuelAvg: average(inactiveFuelValues),
                inactiveWasteAvg: average(inactiveWasteValues),
                climbAttemptRate,
                climbSuccessRatePct,
                towerReliabilityPct,
                strategicReliabilityPct,
                mechanicalReliabilityPct,
                totalFuelScoredAnyHubAvg: average(
                    teamEntries.map(
                        (entry) =>
                            getAutoFuelPoints(entry) +
                            getTeleopFuelEstimate(entry, pitProfilesByTeam) +
                            getInactiveFuelEstimate(entry, pitProfilesByTeam)
                    )
                ),
                avgClimbLevel: average(teamEntries.map((entry) => climbLevelToNumber(entry.endgame.climbLevelAchieved))),
                endgamePointsAvg,
                endgamePointsHigh: max(teleopTowerValues),
                teleopTowerAvg,
                breakdownRate,
                mobilityIssueRate,
                cardRate,
                reliabilityScore,
                scoringPotential,
                impactScore,
            };
        })
        .sort((left, right) => right.impactScore - left.impactScore);
}
