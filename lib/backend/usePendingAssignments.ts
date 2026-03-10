import * as React from 'react';

import { warnWithError } from '../error-utils';
import {
    fetchPendingAssignments,
    type FetchPendingAssignmentsOptions,
    getCachedPendingAssignments,
    isPendingAssignmentsRateLimitedError,
    subscribeToPendingAssignments,
    type PendingScoutingAssignment,
} from './assignments';

interface UsePendingAssignmentsOptions {
    enabled: boolean;
    userId: string | null;
}

interface UsePendingAssignmentsResult {
    assignments: PendingScoutingAssignment[];
    isLoading: boolean;
    error: string | null;
    refreshAssignments: (options?: FetchPendingAssignmentsOptions) => Promise<void>;
}

export function usePendingAssignments({
    enabled,
    userId,
}: UsePendingAssignmentsOptions): UsePendingAssignmentsResult {
    const [assignments, setAssignments] = React.useState<PendingScoutingAssignment[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const refreshAssignments = React.useCallback(async (options: FetchPendingAssignmentsOptions = {}) => {
        if (!enabled || !userId) {
            setAssignments([]);
            setError(null);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const nextAssignments = await fetchPendingAssignments(userId, options);
            setAssignments(nextAssignments);
            setError(null);
        } catch (loadError) {
            if (isPendingAssignmentsRateLimitedError(loadError)) {
                return;
            }
            warnWithError('Failed to load pending assignments', loadError);
            setAssignments([]);
            setError('Unable to load pending assignments.');
        } finally {
            setIsLoading(false);
        }
    }, [enabled, userId]);

    React.useEffect(() => {
        if (!enabled || !userId) {
            setAssignments([]);
            setError(null);
            setIsLoading(false);
            return;
        }

        setAssignments(getCachedPendingAssignments(userId));

        return subscribeToPendingAssignments((updatedUserId) => {
            if (updatedUserId !== userId) {
                return;
            }

            setAssignments(getCachedPendingAssignments(userId));
            setError(null);
            setIsLoading(false);
        });
    }, [enabled, userId]);

    React.useEffect(() => {
        void refreshAssignments();
    }, [refreshAssignments]);

    return { assignments, isLoading, error, refreshAssignments };
}
