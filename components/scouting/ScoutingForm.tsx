import * as React from 'react';
import { View } from 'react-native';
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
import type { ScoutingFormData } from '@/lib/scoutingForm';
import { ThemedScrollView } from '@/lib/theme';

interface ScoutingFormProps {
    formData: ScoutingFormData;
    onFormDataChange: (nextFormData: ScoutingFormData) => void;
    isPitScoutingEnabled: boolean;
    isPitDataPending: boolean;
    isSubmitting: boolean;
    onSubmit: () => void;
    onReset: () => void;
    submitLabel: string;
    submittingLabel: string;
    bottomPadding: number;
    headerContent?: React.ReactNode;
    lockMatchMetadata?: boolean;
    resetLabel?: string;
}

export function ScoutingForm({
    formData,
    onFormDataChange,
    isPitScoutingEnabled,
    isPitDataPending,
    isSubmitting,
    onSubmit,
    onReset,
    submitLabel,
    submittingLabel,
    bottomPadding,
    headerContent,
    lockMatchMetadata = false,
    resetLabel = 'Reset Form',
}: ScoutingFormProps) {
    const insets = useSafeAreaInsets();

    return (
        <ThemedScrollView
            contentContainerStyle={{
                paddingHorizontal: 16,
                paddingTop: insets.top + 16,
                paddingBottom: bottomPadding,
            }}
            keyboardShouldPersistTaps="handled"
        >
            <View className="gap-4">
                {headerContent}

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
                                Agath will keep checking automatically. You can still save or submit this match entry
                                now and let the backend combine pit data later.
                            </Text>
                        </CardContent>
                    </Card>
                ) : null}

                <MatchMetadataSection
                    data={formData.matchMetadata}
                    onChange={(nextMatchMetadata) =>
                        onFormDataChange({
                            ...formData,
                            matchMetadata: nextMatchMetadata,
                        })
                    }
                    disabled={lockMatchMetadata}
                />

                <AutonomousSection
                    data={formData.autonomous}
                    onChange={(nextAutonomousData) =>
                        onFormDataChange({
                            ...formData,
                            autonomous: nextAutonomousData,
                        })
                    }
                    showPitManagedFields={!isPitScoutingEnabled}
                />

                <TeleopSection
                    data={formData.teleop}
                    onChange={(nextTeleopData) =>
                        onFormDataChange({
                            ...formData,
                            teleop: nextTeleopData,
                        })
                    }
                    showPitManagedFields={!isPitScoutingEnabled}
                />

                <ActivePhaseSection
                    data={formData.activePhase}
                    onChange={(nextActivePhaseData) =>
                        onFormDataChange({
                            ...formData,
                            activePhase: nextActivePhaseData,
                        })
                    }
                />

                <InactivePhaseSection
                    data={formData.inactivePhase}
                    onChange={(nextInactivePhaseData) =>
                        onFormDataChange({
                            ...formData,
                            inactivePhase: nextInactivePhaseData,
                        })
                    }
                />

                <EndgameSection
                    data={formData.endgame}
                    onChange={(nextEndgameData) =>
                        onFormDataChange({
                            ...formData,
                            endgame: nextEndgameData,
                        })
                    }
                />
            </View>

            <View className="mt-8 gap-3">
                <Button
                    onPress={onSubmit}
                    disabled={isSubmitting}
                    size="lg"
                >
                    {isSubmitting ? submittingLabel : submitLabel}
                </Button>

                <Button
                    variant="outline"
                    onPress={onReset}
                    disabled={isSubmitting}
                >
                    {resetLabel}
                </Button>
            </View>
        </ThemedScrollView>
    );
}
