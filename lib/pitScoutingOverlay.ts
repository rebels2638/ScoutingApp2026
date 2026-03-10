import type { PitTeamProfile } from './backend/pitScouting';
import { estimateFuelCount, isFuelCountLabel, sanitizeFuelCountLabel } from './fuel';
import type { ScoutingEntry } from './types';

export type PitProfileMap = ReadonlyMap<number, PitTeamProfile>;

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
    const entryTypicalFuelCarried = sanitizeFuelCountLabel(entry.teleop.typicalFuelCarried);
    if (entryTypicalFuelCarried && isFuelCountLabel(entryTypicalFuelCarried)) {
        return entryTypicalFuelCarried;
    }

    const pitTypicalFuelCarried = sanitizeFuelCountLabel(pitProfile?.typicalFuelCarried ?? null);
    if (pitTypicalFuelCarried && isFuelCountLabel(pitTypicalFuelCarried)) {
        return pitTypicalFuelCarried;
    }

    return entryTypicalFuelCarried ?? pitTypicalFuelCarried;
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
    return estimateFuelCount(fuelLabel);
}
