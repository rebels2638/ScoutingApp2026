import * as React from 'react';

import { getBackendConfig } from './config';
import {
    forceRefreshPitData,
    getCachedPitProfileForTeam,
    refreshPitDataIfStale,
    subscribeToPitDataRefresh,
    type PitTeamProfile,
} from './pitScouting';

interface UsePitDataOptions {
    enabled: boolean;
}

interface UsePitDataReturn {
    getProfileForTeam: (teamNumber: number) => Promise<PitTeamProfile | null>;
    refreshNow: () => Promise<void>;
    lastRefreshed: number | null;
}

export function usePitData({ enabled }: UsePitDataOptions): UsePitDataReturn {
    const [lastRefreshed, setLastRefreshed] = React.useState<number | null>(null);

    React.useEffect(() => {
        const config = getBackendConfig();
        if (!enabled || !config?.collectionPitScoutingId) {
            setLastRefreshed(null);
            return;
        }

        return subscribeToPitDataRefresh(() => {
            setLastRefreshed(Date.now());
        });
    }, [enabled]);

    React.useEffect(() => {
        const config = getBackendConfig();
        if (!enabled || !config?.collectionPitScoutingId) {
            return;
        }

        void refreshPitDataIfStale();
    }, [enabled]);

    const refreshNow = React.useCallback(async () => {
        const config = getBackendConfig();
        if (!enabled || !config?.collectionPitScoutingId) {
            setLastRefreshed(null);
            return;
        }

        await forceRefreshPitData();
    }, [enabled]);

    const getProfileForTeam = React.useCallback(
        async (teamNumber: number) => {
            const config = getBackendConfig();
            if (!enabled || !config?.collectionPitScoutingId) {
                return null;
            }

            return getCachedPitProfileForTeam(teamNumber);
        },
        [enabled]
    );

    return { getProfileForTeam, refreshNow, lastRefreshed };
}
