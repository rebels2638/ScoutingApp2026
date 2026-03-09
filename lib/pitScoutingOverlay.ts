import type { PitTeamProfile } from './backend/pitScouting';
import type { ScoutingEntry } from './types';

export type PitProfileMap = ReadonlyMap<number, PitTeamProfile>;

const canonicalFuelPerCycleEstimates: Record<string, number> = {
    '1-4': 2.5,
    '5-8': 6.5,
    '9-12': 10.5,
    '13-16': 14.5,
    '17+': 18,
};

function normalizeFuelLabel(value: string): string {
    return value
        .trim()
        .replace(/[\u2010-\u2015\u2212]/g, '-')
        .replace(/\s*-\s*/g, '-')
        .replace(/\s*\+\s*/g, '+')
        .replace(/\s+/g, ' ');
}

export function buildPitProfileMap(profiles: PitTeamProfile[]): Map<number, PitTeamProfile> {
    const pitProfilesByTeam = new Map<number, PitTeamProfile>();

    for (const profile of profiles) {
        pitProfilesByTeam.set(profile.teamNumber, profile);
    }

    return pitProfilesByTeam;
}

export function getPitProfileForEntry(
    entry: Pick<ScoutingEntry, 'matchMetadata'>,
    pitProfilesByTeam: PitProfileMap
): PitTeamProfile | null {
    return pitProfilesByTeam.get(entry.matchMetadata.teamNumber) ?? null;
}

export function getResolvedPreloadCount(
    entry: ScoutingEntry,
    pitProfile: PitTeamProfile | null
): number | null {
    return entry.autonomous.preloadCount ?? pitProfile?.typicalPreloadCount ?? null;
}

export function getResolvedTypicalFuelCarried(
    entry: ScoutingEntry,
    pitProfile: PitTeamProfile | null
): string | null {
    return entry.teleop.typicalFuelCarried ?? pitProfile?.typicalFuelCarried ?? null;
}

export function getResolvedPrimaryFuelSource(
    entry: ScoutingEntry,
    pitProfile: PitTeamProfile | null
): string | null {
    return entry.teleop.primaryFuelSource ?? pitProfile?.primaryFuelSource ?? null;
}

export function getResolvedUsesTrenchRoutes(
    entry: ScoutingEntry,
    pitProfile: PitTeamProfile | null
): boolean | null {
    return entry.teleop.usesTrenchRoutes ?? pitProfile?.canFitTrench ?? null;
}

export function getEstimatedFuelPerCycle(fuelLabel: string | null): number {
    if (!fuelLabel) {
        return 0;
    }

    const normalizedLabel = normalizeFuelLabel(fuelLabel);
    const canonicalEstimate = canonicalFuelPerCycleEstimates[normalizedLabel];
    if (canonicalEstimate !== undefined) {
        return canonicalEstimate;
    }

    const rangeMatch = normalizedLabel.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
        const minimum = Number.parseInt(rangeMatch[1], 10);
        const maximum = Number.parseInt(rangeMatch[2], 10);
        return Number.isFinite(minimum) && Number.isFinite(maximum) ? (minimum + maximum) / 2 : 0;
    }

    const plusMatch = normalizedLabel.match(/^(\d+)\+$/);
    if (plusMatch) {
        const minimum = Number.parseInt(plusMatch[1], 10);
        return Number.isFinite(minimum) ? minimum + 1 : 0;
    }

    return 0;
}
