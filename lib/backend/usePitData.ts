import * as React from 'react';

import { getBackendConfig } from './config';
import {
    forceRefreshPitData,
    getCachedPitProfileForTeam,
    refreshPitDataIfStale,
    type PitTeamProfile,
} from './pitScouting';

const POLL_INTERVAL_MS = 60 * 60 * 1000;

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

        let cancelled = false;

        const doRefresh = async () => {
            const didRefresh = await refreshPitDataIfStale();
            if (!cancelled && didRefresh) {
                setLastRefreshed(Date.now());
            }
        };

        void doRefresh();

        const interval = setInterval(() => {
            void doRefresh();
        }, POLL_INTERVAL_MS);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [enabled]);

    const refreshNow = React.useCallback(async () => {
        const config = getBackendConfig();
        if (!enabled || !config?.collectionPitScoutingId) {
            setLastRefreshed(null);
            return;
        }

        await forceRefreshPitData();
        setLastRefreshed(Date.now());
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
