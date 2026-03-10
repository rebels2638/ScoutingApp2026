import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { Alert, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScoutingForm } from '@/components/scouting/ScoutingForm';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { findMatchingAssignment, type PendingScoutingAssignment } from '@/lib/backend/assignments';
import { useBackendAuth } from '@/lib/backend/auth';
import { getBackendConfig } from '@/lib/backend/config';
import { submitScoutingEntryWithQueue } from '@/lib/backend/submissions';
import { usePendingAssignments } from '@/lib/backend/usePendingAssignments';
import { getPublicErrorMessage } from '@/lib/error-utils';
import { createScoutingFormDataFromAssignment, useScoutingFormState } from '@/lib/scoutingForm';
import { generateId, saveScoutingEntry } from '@/lib/storage';
import { ThemedScrollView } from '@/lib/theme';
import { type ScoutingEntry } from '@/lib/types';
import { useTabBarMetrics } from './_layout';

type LocalAssignmentSubmissionStatus = 'queued' | 'saved';

function isAssignmentReady(assignment: PendingScoutingAssignment): boolean {
    return (
        assignment.matchNumber != null &&
        assignment.teamNumber != null &&
        assignment.matchType != null
    );
}

function formatAssignmentSummary(assignment: PendingScoutingAssignment): string {
    const summaryParts = [
        `Match ${assignment.matchNumber ?? '—'}`,
        `Team ${assignment.teamNumber ?? '—'}`,
    ];

    if (assignment.matchType) {
        summaryParts.push(assignment.matchType);
    }

    if (assignment.allianceColor) {
        summaryParts.push(assignment.allianceColor);
    }

    return summaryParts.join(' • ');
}

export default function AssignmentsTab() {
    const router = useRouter();
    const isFocused = useIsFocused();
    const insets = useSafeAreaInsets();
    const { height: tabBarHeight, marginBottom: tabBarMarginBottom } = useTabBarMetrics();
    const bottomPadding = tabBarHeight + Math.max(insets.bottom, tabBarMarginBottom) + 16;
    const { authState, userId } = useBackendAuth();
    const isBackendEnabled = authState === 'authenticated' && !!userId;
    const isPitScoutingEnabled = isBackendEnabled && !!getBackendConfig()?.collectionPitScoutingId;
    const { assignments, isLoading, error, refreshAssignments } = usePendingAssignments({
        enabled: isBackendEnabled,
        userId,
    });
    const {
        formData,
        setFormData,
        isPitDataPending,
        resetForm,
        prepareFormData,
    } = useScoutingFormState({
        isPitScoutingEnabled,
    });
    const [activeAssignmentId, setActiveAssignmentId] = React.useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [refreshing, setRefreshing] = React.useState(false);
    const [localSubmissionStates, setLocalSubmissionStates] = React.useState<
        Record<string, LocalAssignmentSubmissionStatus>
    >({});
    const activeAssignment = React.useMemo(
        () => assignments.find((assignment) => assignment.id === activeAssignmentId) ?? null,
        [activeAssignmentId, assignments]
    );

    React.useEffect(() => {
        if (isBackendEnabled) {
            return;
        }

        setActiveAssignmentId(null);
        setLocalSubmissionStates({});
        resetForm();
    }, [isBackendEnabled, resetForm]);

    React.useEffect(() => {
        if (isBackendEnabled || !isFocused) {
            return;
        }

        router.replace('/(tabs)');
    }, [isBackendEnabled, isFocused, router]);

    React.useEffect(() => {
        const activeAssignmentStillExists = activeAssignmentId
            ? assignments.some((assignment) => assignment.id === activeAssignmentId)
            : false;

        if (!activeAssignmentId || activeAssignmentStillExists) {
            return;
        }

        setActiveAssignmentId(null);
        resetForm();
    }, [activeAssignmentId, assignments, resetForm]);

    React.useEffect(() => {
        setLocalSubmissionStates((current) => {
            const assignmentIdSet = new Set(assignments.map((assignment) => assignment.id));
            const nextEntries = Object.entries(current).filter(([assignmentId]) => assignmentIdSet.has(assignmentId));

            if (nextEntries.length === Object.keys(current).length) {
                return current;
            }

            return Object.fromEntries(nextEntries);
        });
    }, [assignments]);

    const handleRefresh = React.useCallback(async () => {
        setRefreshing(true);
        try {
            await refreshAssignments();
        } finally {
            setRefreshing(false);
        }
    }, [refreshAssignments]);

    const handleStartAssignment = React.useCallback((assignment: PendingScoutingAssignment) => {
        setActiveAssignmentId(assignment.id);
        resetForm(createScoutingFormDataFromAssignment(assignment));
    }, [resetForm]);

    const handleBackToList = React.useCallback(() => {
        Alert.alert(
            'Leave assignment?',
            'Your current scouting form will close and any unsaved changes on this screen will be discarded.',
            [
                { text: 'Keep scouting', style: 'cancel' },
                {
                    text: 'Back to list',
                    onPress: () => {
                        setActiveAssignmentId(null);
                        resetForm();
                    },
                },
            ]
        );
    }, [resetForm]);

    const handleSubmit = React.useCallback(async () => {
        if (!userId || !activeAssignment) {
            Alert.alert('Backend mode required', 'Reconnect to the backend before submitting assignments.');
            return;
        }

        if (formData.matchMetadata.matchNumber < 1) {
            Alert.alert('Validation Error', 'Please enter a valid match number.');
            return;
        }

        if (formData.matchMetadata.teamNumber < 1) {
            Alert.alert('Validation Error', 'Please enter a valid team number.');
            return;
        }

        const entryData = prepareFormData();
        const matchingAssignment = findMatchingAssignment([activeAssignment], entryData.matchMetadata);
        if (!matchingAssignment) {
            Alert.alert(
                'Assignment mismatch',
                'This scouting record no longer matches the active assignment. Go back to the assignments list and start it again.'
            );
            return;
        }

        setIsSubmitting(true);
        try {
            const entry: ScoutingEntry = {
                id: generateId(),
                timestamp: Date.now(),
                ...entryData,
            };

            await saveScoutingEntry(entry);

            const result = await submitScoutingEntryWithQueue({
                keyId: userId,
                entry,
                assignmentId: matchingAssignment.id,
            });

            if (result.status === 'uploaded') {
                setLocalSubmissionStates((current) => {
                    const nextState = { ...current };
                    delete nextState[matchingAssignment.id];
                    return nextState;
                });
                setActiveAssignmentId(null);
                resetForm();
                await refreshAssignments({ bypassCooldown: true });

                Alert.alert(
                    'Assignment submitted',
                    result.assignmentStatus === 'failed'
                        ? 'The scouting record uploaded, but Agath could not confirm the assignment was marked complete. Refresh the list to verify it cleared.'
                        : 'The scouting record uploaded and the assignment was marked complete.'
                );
                return;
            }

            if (result.status === 'queued') {
                setLocalSubmissionStates((current) => ({
                    ...current,
                    [matchingAssignment.id]: 'queued',
                }));
                setActiveAssignmentId(null);
                resetForm();

                Alert.alert(
                    'Assignment queued',
                    'The scouting record was saved locally and queued for upload. This assignment will stay visible until the queued upload finishes.'
                );
                return;
            }

            if (result.status === 'failed') {
                setLocalSubmissionStates((current) => ({
                    ...current,
                    [matchingAssignment.id]: 'saved',
                }));
                setActiveAssignmentId(null);
                resetForm();

                Alert.alert(
                    'Saved locally',
                    'The scouting record was saved locally, but the upload could not be started. Open the Data tab to retry this saved record later.'
                );
                return;
            }

            Alert.alert(
                'Already submitted',
                'This scouting record has already been uploaded or queued. Open the Data tab if you need to review saved records.'
            );
        } catch (error) {
            console.error('Error submitting assignment scouting entry:', error);
            Alert.alert(
                'Submission failed',
                getPublicErrorMessage(error, 'Failed to submit the assignment scouting entry. Please try again.')
            );
        } finally {
            setIsSubmitting(false);
        }
    }, [
        activeAssignment,
        formData.matchMetadata,
        prepareFormData,
        refreshAssignments,
        resetForm,
        userId,
    ]);

    const queuedAssignmentCount = React.useMemo(
        () => Object.values(localSubmissionStates).filter((status) => status === 'queued').length,
        [localSubmissionStates]
    );
    const savedAssignmentCount = React.useMemo(
        () => Object.values(localSubmissionStates).filter((status) => status === 'saved').length,
        [localSubmissionStates]
    );

    if (activeAssignment) {
        return (
            <ScoutingForm
                formData={formData}
                onFormDataChange={setFormData}
                isPitScoutingEnabled={isPitScoutingEnabled}
                isPitDataPending={isPitDataPending}
                isSubmitting={isSubmitting}
                onSubmit={() => {
                    void handleSubmit();
                }}
                onReset={handleBackToList}
                submitLabel="Submit Assignment"
                submittingLabel="Submitting..."
                resetLabel="Back to Assignments"
                bottomPadding={bottomPadding}
                lockMatchMetadata
                headerContent={
                    <Card variant="outline">
                        <CardHeader className="flex-col items-start gap-1 pb-2">
                            <CardTitle className="text-base">Active Assignment</CardTitle>
                            <CardDescription>{formatAssignmentSummary(activeAssignment)}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Text className="text-sm">
                                Match details are locked here so the finished scouting record stays attached to the
                                correct assignment.
                            </Text>
                            <Button
                                variant="secondary"
                                size="sm"
                                onPress={handleBackToList}
                                disabled={isSubmitting}
                            >
                                Back to Assignments
                            </Button>
                        </CardContent>
                    </Card>
                }
            />
        );
    }

    return (
        <ThemedScrollView
            contentContainerStyle={{
                paddingHorizontal: 16,
                paddingTop: insets.top + 16,
                paddingBottom: bottomPadding,
            }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
            <View className="gap-4">
                <Card>
                    <CardHeader className="flex-col items-start gap-1 pb-2">
                        <CardTitle>Assignments</CardTitle>
                        <CardDescription>
                            {assignments.length === 1 ? '1 pending assignment' : `${assignments.length} pending assignments`}
                            {queuedAssignmentCount > 0 ? ` • ${queuedAssignmentCount} queued locally` : ''}
                            {savedAssignmentCount > 0 ? ` • ${savedAssignmentCount} saved locally` : ''}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Text className="text-sm">
                            Start an assignment here to autofill details in the match metadata section. When you are done scouting for that match you may submit it directly through this page.
                        </Text>
                        <Button
                            variant="secondary"
                            size="sm"
                            onPress={() => {
                                void handleRefresh();
                            }}
                            disabled={refreshing || isLoading}
                        >
                            {refreshing || isLoading ? 'Refreshing...' : 'Refresh Assignments'}
                        </Button>
                    </CardContent>
                </Card>

                {error ? (
                    <Card variant="outline">
                        <CardHeader className="flex-col items-start gap-1 pb-2">
                            <CardTitle className="text-base">Unable to load assignments</CardTitle>
                            <CardDescription>{error}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button
                                variant="secondary"
                                size="sm"
                                onPress={() => {
                                    void handleRefresh();
                                }}
                                disabled={refreshing}
                            >
                                Try Again
                            </Button>
                        </CardContent>
                    </Card>
                ) : null}

                {!isLoading && assignments.length === 0 ? (
                    <Card variant="outline">
                        <CardHeader className="flex-col items-start gap-1 pb-2">
                            <CardTitle className="text-base">No assignments yet</CardTitle>
                            <CardDescription>
                                New assignments will appear here as soon as they are available for you, you may manually refresh for assignments if needed.
                            </CardDescription>
                        </CardHeader>
                    </Card>
                ) : null}

                {assignments.map((assignment) => {
                    const assignmentReady = isAssignmentReady(assignment);
                    const localSubmissionStatus = localSubmissionStates[assignment.id];

                    return (
                        <Card key={assignment.id} variant="outline">
                            <CardHeader className="flex-col items-start gap-1 pb-2">
                                <CardTitle className="text-base">{formatAssignmentSummary(assignment)}</CardTitle>
                                <CardDescription>
                                    {localSubmissionStatus === 'queued'
                                        ? 'Queued locally until the backend upload finishes.'
                                        : localSubmissionStatus === 'saved'
                                            ? 'Saved locally. Upload it from the Data tab when ready.'
                                            : assignmentReady
                                                ? 'Ready to scout and submit from this tab.'
                                                : 'This assignment is missing required match details from the backend.'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <View className="flex-row gap-3">
                                    {localSubmissionStatus ? (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onPress={() => router.push('/(tabs)/data')}
                                        >
                                            Open Data Tab
                                        </Button>
                                    ) : (
                                        <Button
                                            size="sm"
                                            onPress={() => handleStartAssignment(assignment)}
                                            disabled={!assignmentReady}
                                        >
                                            Start Assignment
                                        </Button>
                                    )}
                                </View>
                            </CardContent>
                        </Card>
                    );
                })}
            </View>
        </ThemedScrollView>
    );
}
