import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActivePhaseSection } from '@/components/scouting/ActivePhaseSection';
import { AutonomousSection } from '@/components/scouting/AutonomousSection';
import { EndgameSection } from '@/components/scouting/EndgameSection';
import { InactivePhaseSection } from '@/components/scouting/InactivePhaseSection';
import { MatchMetadataSection } from '@/components/scouting/MatchMetadataSection';
import { TeleopSection } from '@/components/scouting/TeleopSection';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { type PendingScoutingAssignment } from '@/lib/backend/assignments';
import { useBackendAuth } from '@/lib/backend/auth';
import { getBackendConfig } from '@/lib/backend/config';
import { type PitTeamProfile } from '@/lib/backend/pitScouting';
import { usePitData } from '@/lib/backend/usePitData';
import { usePendingAssignments } from '@/lib/backend/usePendingAssignments';
import { generateId, saveScoutingEntry } from '@/lib/storage';
import { ThemedScrollView } from '@/lib/theme';
import { createDefaultScoutingEntry, type ScoutingEntry } from '@/lib/types';
import { useTabBarMetrics } from './_layout';

type ScoutingFormData = Omit<ScoutingEntry, 'id' | 'timestamp' | 'syncStatus' | 'syncedAt'>;
type PitDataStatus = 'idle' | 'checking' | 'ready' | 'waiting';
type ReadyPitTeamProfile = PitTeamProfile & {
    typicalPreloadCount: number;
    typicalFuelCarried: ScoutingEntry['teleop']['typicalFuelCarried'];
    primaryFuelSource: ScoutingEntry['teleop']['primaryFuelSource'];
    canFitTrench: boolean;
};

function hasRequiredPitData(pitProfile: PitTeamProfile | null): pitProfile is ReadyPitTeamProfile {
    return (
        pitProfile !== null &&
        pitProfile.typicalPreloadCount !== null &&
        pitProfile.typicalFuelCarried !== null &&
        pitProfile.primaryFuelSource !== null &&
        pitProfile.canFitTrench !== null
    );
}

function clearPitManagedData(formData: ScoutingFormData): ScoutingFormData {
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

export default function ScoutTab() {
    const [formData, setFormData] = useState<ScoutingFormData>(createDefaultScoutingEntry());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [pitDataStatus, setPitDataStatus] = useState<PitDataStatus>('idle');
    const { authState, userId } = useBackendAuth();
    const isBackendEnabled = authState === 'authenticated' && !!userId;
    const isPitScoutingEnabled = isBackendEnabled && !!getBackendConfig()?.collectionPitScoutingId;
    const { assignments: pendingAssignments } = usePendingAssignments({
        enabled: isBackendEnabled,
        userId,
    });
    const { getProfileForTeam, lastRefreshed } = usePitData({ enabled: isPitScoutingEnabled });
    const nextAssignment = pendingAssignments[0] ?? null;

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

    const isPitDataPending =
        isPitScoutingEnabled &&
        formData.matchMetadata.teamNumber > 0 &&
        pitDataStatus !== 'ready';

    const handleUseAssignment = (assignment: PendingScoutingAssignment) => {
        setFormData((previous) => ({
            ...previous,
            matchMetadata: {
                ...previous.matchMetadata,
                matchNumber: assignment.matchNumber ?? previous.matchMetadata.matchNumber,
                teamNumber: assignment.teamNumber ?? previous.matchMetadata.teamNumber,
            },
        }));
    };

    const handleSubmit = async () => {
        if (formData.matchMetadata.matchNumber < 1) {
            Alert.alert('Validation Error', 'Please enter a valid match number.');
            return;
        }
        if (formData.matchMetadata.teamNumber < 1) {
            Alert.alert('Validation Error', 'Please enter a valid team number.');
            return;
        }

        setIsSubmitting(true);
        try {
            const entryData = isPitScoutingEnabled ? clearPitManagedData(formData) : formData;
            const entry: ScoutingEntry = {
                id: generateId(),
                timestamp: Date.now(),
                ...entryData,
            };
            await saveScoutingEntry(entry);
            const savedMessage = `Scouting data for Team ${formData.matchMetadata.teamNumber} in Match ${formData.matchMetadata.matchNumber} has been saved locally.`;
            const alertMessage = isBackendEnabled
                ? `${savedMessage} Upload it from the Data tab when you are ready.`
                : savedMessage;

            Alert.alert(
                'Saved locally',
                alertMessage,
                [
                    {
                        text: 'New Entry',
                        onPress: () => {
                            const newData = createDefaultScoutingEntry();
                            newData.matchMetadata.matchNumber = formData.matchMetadata.matchNumber + 1;
                            newData.matchMetadata.matchType = formData.matchMetadata.matchType;
                            setFormData(isPitScoutingEnabled ? clearPitManagedData(newData) : newData);
                        },
                    },
                    {
                        text: 'Keep Editing',
                        style: 'cancel',
                    },
                ]
            );
        } catch (error) {
            console.error('Error saving scouting entry:', error);
            Alert.alert('Error', 'Failed to save scouting data. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReset = () => {
        Alert.alert(
            'Reset Form',
            'Are you sure you want to clear all form data?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reset',
                    style: 'destructive',
                    onPress: () => {
                        const newData = createDefaultScoutingEntry();
                        setFormData(isPitScoutingEnabled ? clearPitManagedData(newData) : newData);
                    },
                },
            ]
        );
    };

    const insets = useSafeAreaInsets();
    const { height: tabBarHeight, marginBottom: tabBarMarginBottom } = useTabBarMetrics();
    const bottomPadding = tabBarHeight + Math.max(insets.bottom, tabBarMarginBottom) + 16;

    return (
        <ThemedScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: bottomPadding }}
            keyboardShouldPersistTaps="handled"
        >
            <View className="gap-4">
                {isBackendEnabled && nextAssignment ? (
                    <Card variant="outline">
                        <CardHeader className="flex-col items-start gap-1 pb-2">
                            <CardTitle className="text-base">Pending Assignment</CardTitle>
                            <CardDescription>
                                {pendingAssignments.length === 1
                                    ? '1 pending assignment'
                                    : `${pendingAssignments.length} pending assignments`}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Text className="text-sm">
                                Match {nextAssignment.matchNumber ?? '—'} • Team {nextAssignment.teamNumber ?? '—'}
                                {nextAssignment.matchType ? ` • ${nextAssignment.matchType}` : ''}
                                {nextAssignment.allianceColor ? ` • ${nextAssignment.allianceColor}` : ''}
                            </Text>
                            <Button
                                variant="secondary"
                                size="sm"
                                onPress={() => handleUseAssignment(nextAssignment)}
                                disabled={
                                    isSubmitting ||
                                    nextAssignment.matchNumber == null ||
                                    nextAssignment.teamNumber == null
                                }
                            >
                                Use Assignment Values
                            </Button>
                        </CardContent>
                    </Card>
                ) : null}

                {isPitDataPending ? (
                    <Card variant="outline">
                        <CardHeader className="flex-col items-start gap-1 pb-2">
                            <CardTitle className="text-base">Pit Scouting Pending</CardTitle>
                            <CardDescription>
                                Team {formData.matchMetadata.teamNumber} pit scouting data is not ready yet.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Text className="text-sm">
                                Agath will keep checking automatically. You can still save this match entry now and let
                                the backend combine pit data later.
                            </Text>
                        </CardContent>
                    </Card>
                ) : null}

                <MatchMetadataSection
                    data={formData.matchMetadata}
                    onChange={(data) => setFormData({ ...formData, matchMetadata: data })}
                />

                <AutonomousSection
                    data={formData.autonomous}
                    onChange={(data) => setFormData({ ...formData, autonomous: data })}
                    showPitManagedFields={!isPitScoutingEnabled}
                />

                <TeleopSection
                    data={formData.teleop}
                    onChange={(data) => setFormData({ ...formData, teleop: data })}
                    showPitManagedFields={!isPitScoutingEnabled}
                />

                <ActivePhaseSection
                    data={formData.activePhase}
                    onChange={(data) => setFormData({ ...formData, activePhase: data })}
                />

                <InactivePhaseSection
                    data={formData.inactivePhase}
                    onChange={(data) => setFormData({ ...formData, inactivePhase: data })}
                />

                <EndgameSection
                    data={formData.endgame}
                    onChange={(data) => setFormData({ ...formData, endgame: data })}
                />
            </View>

            <View className="mt-8 gap-3">
                <Button
                    onPress={handleSubmit}
                    disabled={isSubmitting}
                    size="lg"
                >
                    {isSubmitting ? 'Saving...' : 'Save Data!'}
                </Button>

                <Button
                    variant="outline"
                    onPress={handleReset}
                    disabled={isSubmitting}
                >
                    Reset Form
                </Button>
            </View>
        </ThemedScrollView>
    );
}
