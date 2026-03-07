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
import { submitScoutingEntryWithQueue } from '@/lib/backend/submissions';
import { usePendingAssignments } from '@/lib/backend/usePendingAssignments';
import { generateId, saveScoutingEntry } from '@/lib/storage';
import { ThemedScrollView } from '@/lib/theme';
import { createDefaultScoutingEntry, type ScoutingEntry } from '@/lib/types';
import { useTabBarMetrics } from './_layout';

export default function ScoutTab() {
    const [formData, setFormData] = useState(createDefaultScoutingEntry());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { authState, userId } = useBackendAuth();
    const isBackendEnabled = authState === 'authenticated' && !!userId;
    const { assignments: pendingAssignments, refreshAssignments } = usePendingAssignments({
        enabled: isBackendEnabled,
        userId,
    });
    const nextAssignment = pendingAssignments[0] ?? null;

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
            const entry: ScoutingEntry = {
                id: generateId(),
                timestamp: Date.now(),
                ...formData,
            };
            await saveScoutingEntry(entry);
            let backendSubmitStatus: 'uploaded' | 'queued' | 'failed' | 'skipped' = 'skipped';

            if (isBackendEnabled && userId) {
                const matchingAssignment =
                    pendingAssignments.find(
                        (assignment) =>
                            assignment.matchNumber === entry.matchMetadata.matchNumber &&
                            assignment.teamNumber === entry.matchMetadata.teamNumber
                    ) ?? null;

                const backendSubmitResult = await submitScoutingEntryWithQueue({
                    keyId: userId,
                    entry,
                    assignmentId: matchingAssignment?.id,
                });

                backendSubmitStatus = backendSubmitResult.status;

                if (backendSubmitResult.status === 'uploaded') {
                    await refreshAssignments();
                }
            }

            const savedMessage = `Scouting data for Team ${formData.matchMetadata.teamNumber} in Match ${formData.matchMetadata.matchNumber} has been saved.`;
            let alertTitle = 'Success!';
            let alertMessage = savedMessage;

            if (backendSubmitStatus === 'uploaded') {
                alertMessage = `${savedMessage} Uploaded to backend.`;
            } else if (backendSubmitStatus === 'queued') {
                alertTitle = 'Saved locally';
                alertMessage = `${savedMessage} Backend upload failed and was queued for retry.`;
            } else if (backendSubmitStatus === 'failed') {
                alertTitle = 'Saved locally';
                alertMessage = `${savedMessage} Backend upload failed and could not be queued.`;
            }

            Alert.alert(
                alertTitle,
                alertMessage,
                [
                    {
                        text: 'New Entry',
                        onPress: () => {
                            const newData = createDefaultScoutingEntry();
                            newData.matchMetadata.matchNumber = formData.matchMetadata.matchNumber + 1;
                            newData.matchMetadata.matchType = formData.matchMetadata.matchType;
                            setFormData(newData);
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
                    onPress: () => setFormData(createDefaultScoutingEntry()),
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

                <MatchMetadataSection
                    data={formData.matchMetadata}
                    onChange={(data) => setFormData({ ...formData, matchMetadata: data })}
                />

                <AutonomousSection
                    data={formData.autonomous}
                    onChange={(data) => setFormData({ ...formData, autonomous: data })}
                />

                <TeleopSection
                    data={formData.teleop}
                    onChange={(data) => setFormData({ ...formData, teleop: data })}
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
