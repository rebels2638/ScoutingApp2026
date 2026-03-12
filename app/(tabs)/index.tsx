import * as React from 'react';
import { Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScoutingForm } from '@/components/scouting/ScoutingForm';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { useBackendAuth } from '@/lib/backend/auth';
import { getBackendConfig } from '@/lib/backend/config';
import { useScoutingFormState } from '@/lib/scoutingForm';
import { generateId, saveScoutingEntry } from '@/lib/storage';
import { createDefaultScoutingEntry, type ScoutingEntry } from '@/lib/types';
import { useTabBarMetrics } from './_layout';

export default function ScoutTab() {
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const insets = useSafeAreaInsets();
    const { height: tabBarHeight, marginBottom: tabBarMarginBottom } = useTabBarMetrics();
    const bottomPadding = tabBarHeight + Math.max(insets.bottom, tabBarMarginBottom) + 16;
    const { authState, userId } = useBackendAuth();
    const isBackendEnabled = authState === 'authenticated' && !!userId;
    const isPitScoutingEnabled = isBackendEnabled && !!getBackendConfig()?.collectionPitScoutingId;
    const {
        formData,
        setFormData,
        isPitDataPending,
        resetForm,
        prepareFormData,
    } = useScoutingFormState({
        isPitScoutingEnabled,
    });

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
            const entryData = prepareFormData();
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
                            resetForm(newData);
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
                        resetForm();
                    },
                },
            ]
        );
    };

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
            onReset={handleReset}
            submitLabel="Save Data"
            submittingLabel="Saving..."
            bottomPadding={bottomPadding}
            headerContent={
                isBackendEnabled ? (
                    <Card variant="outline">
                        <CardHeader className="flex-col items-start gap-1 pb-2">
                            <CardTitle className="text-base">Manual Scout Entry</CardTitle>
                            <CardDescription>
                                Use the Assignments tab for backend work orders. This screen is best for manual or extra
                                scouting records.
                            </CardDescription>
                        </CardHeader>
                    </Card>
                ) : null
            }
        />
    );
}
