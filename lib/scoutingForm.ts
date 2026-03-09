import * as React from 'react';

import type { PendingScoutingAssignment } from './backend/assignments';
import type { PitTeamProfile } from './backend/pitScouting';
import { usePitData } from './backend/usePitData';
import { createDefaultScoutingEntry, type ScoutingEntry } from './types';

export type ScoutingFormData = Omit<ScoutingEntry, 'id' | 'timestamp' | 'syncStatus' | 'syncedAt'>;

type PitDataStatus = 'idle' | 'checking' | 'ready' | 'waiting';

interface UseScoutingFormStateOptions {
    isPitScoutingEnabled: boolean;
    initialData?: ScoutingFormData;
}

interface UseScoutingFormStateResult {
    formData: ScoutingFormData;
    setFormData: React.Dispatch<React.SetStateAction<ScoutingFormData>>;
    isPitDataPending: boolean;
    resetForm: (nextData?: ScoutingFormData) => void;
    prepareFormData: () => ScoutingFormData;
}

export function cloneScoutingFormData(formData: ScoutingFormData): ScoutingFormData {
    return {
        matchMetadata: {
            ...formData.matchMetadata,
        },
        autonomous: {
            ...formData.autonomous,
        },
        teleop: {
            ...formData.teleop,
        },
        activePhase: {
            ...formData.activePhase,
        },
        inactivePhase: {
            ...formData.inactivePhase,
        },
        endgame: {
            ...formData.endgame,
            cards: [...formData.endgame.cards],
        },
    };
}

function hasRequiredPitData(pitProfile: PitTeamProfile | null): boolean {
    return (
        pitProfile !== null &&
        pitProfile.typicalPreloadCount !== null &&
        pitProfile.typicalFuelCarried !== null &&
        pitProfile.primaryFuelSource !== null &&
        pitProfile.canFitTrench !== null
    );
}

export function clearPitManagedData(formData: ScoutingFormData): ScoutingFormData {
    return {
        ...formData,
        autonomous: {
            ...formData.autonomous,
            preloadCount: null,
        },
        teleop: {
            ...formData.teleop,
            typicalFuelCarried: null,
            primaryFuelSource: null,
            usesTrenchRoutes: null,
        },
    };
}

export function createScoutingFormDataFromAssignment(
    assignment: PendingScoutingAssignment
): ScoutingFormData {
    const nextFormData = createDefaultScoutingEntry();

    if (assignment.matchNumber != null) {
        nextFormData.matchMetadata.matchNumber = assignment.matchNumber;
    }

    if (assignment.teamNumber != null) {
        nextFormData.matchMetadata.teamNumber = assignment.teamNumber;
    }

    if (assignment.matchType) {
        nextFormData.matchMetadata.matchType = assignment.matchType;
    }

    if (assignment.allianceColor) {
        nextFormData.matchMetadata.allianceColor = assignment.allianceColor;
    }

    return nextFormData;
}

function resolveBaseFormData(initialData?: ScoutingFormData): ScoutingFormData {
    if (!initialData) {
        return createDefaultScoutingEntry();
    }

    return cloneScoutingFormData(initialData);
}

export function useScoutingFormState({
    isPitScoutingEnabled,
    initialData,
}: UseScoutingFormStateOptions): UseScoutingFormStateResult {
    const [formData, setFormData] = React.useState<ScoutingFormData>(() => {
        const nextFormData = resolveBaseFormData(initialData);
        return isPitScoutingEnabled ? clearPitManagedData(nextFormData) : nextFormData;
    });
    const [pitDataStatus, setPitDataStatus] = React.useState<PitDataStatus>('idle');
    const { getProfileForTeam, lastRefreshed } = usePitData({ enabled: isPitScoutingEnabled });

    React.useEffect(() => {
        if (!isPitScoutingEnabled) {
            return;
        }

        setFormData((previous) => clearPitManagedData(previous));
    }, [isPitScoutingEnabled]);

    React.useEffect(() => {
        const teamNumber = formData.matchMetadata.teamNumber;

        if (!isPitScoutingEnabled || teamNumber < 1) {
            setPitDataStatus('idle');
            return;
        }

        let cancelled = false;
        setPitDataStatus('checking');

        const syncPitProfile = async () => {
            const pitProfile = await getProfileForTeam(teamNumber);

            if (cancelled) {
                return;
            }

            if (!hasRequiredPitData(pitProfile)) {
                setPitDataStatus('waiting');
                return;
            }

            setPitDataStatus('ready');
        };

        void syncPitProfile();

        return () => {
            cancelled = true;
        };
    }, [formData.matchMetadata.teamNumber, getProfileForTeam, isPitScoutingEnabled, lastRefreshed]);

    const resetForm = React.useCallback((nextData?: ScoutingFormData) => {
        const baseFormData = resolveBaseFormData(nextData);
        setFormData(isPitScoutingEnabled ? clearPitManagedData(baseFormData) : baseFormData);
    }, [isPitScoutingEnabled]);

    const prepareFormData = React.useCallback(() => {
        const nextFormData = cloneScoutingFormData(formData);
        return isPitScoutingEnabled ? clearPitManagedData(nextFormData) : nextFormData;
    }, [formData, isPitScoutingEnabled]);

    const isPitDataPending =
        isPitScoutingEnabled &&
        formData.matchMetadata.teamNumber > 0 &&
        pitDataStatus !== 'ready';

    return {
        formData,
        setFormData,
        isPitDataPending,
        resetForm,
        prepareFormData,
    };
}
