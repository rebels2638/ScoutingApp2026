import * as React from 'react';
import { View } from 'react-native';

import { FormField, FormSection, FormToggleField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Stepper } from '@/components/ui/Stepper';
import { teleopDefinitions } from '@/lib/definitions';
import { isFuelCountLabel, sanitizeFuelCountLabel } from '@/lib/fuel';
import type { PrimaryFuelSource, TeleopData } from '@/lib/types';
import { useUIScale } from '@/lib/ui-scale';

interface TeleopSectionProps {
    data: TeleopData;
    onChange: (data: TeleopData) => void;
    showPitManagedFields?: boolean;
}

const fuelSourceOptions = [
    { label: 'Neutral Zone', value: 'Neutral Zone' as PrimaryFuelSource },
    { label: 'Depot', value: 'Depot' as PrimaryFuelSource },
    { label: 'Outpost feed', value: 'Outpost feed' as PrimaryFuelSource },
    { label: 'Mixed', value: 'Mixed' as PrimaryFuelSource },
];

export const TeleopSection: React.FC<TeleopSectionProps> = ({
    data,
    onChange,
    showPitManagedFields = true,
}) => {
    const { scaleOption } = useUIScale();
    const stackFields = scaleOption === 'large' || scaleOption === 'extra-large';
    const [typicalFuelCarriedInput, setTypicalFuelCarriedInput] = React.useState(data.typicalFuelCarried ?? '');

    React.useEffect(() => {
        setTypicalFuelCarriedInput(data.typicalFuelCarried ?? '');
    }, [data.typicalFuelCarried]);

    const normalizedTypicalFuelCarriedInput = sanitizeFuelCountLabel(typicalFuelCarriedInput);
    const typicalFuelCarriedError =
        normalizedTypicalFuelCarriedInput !== null && !isFuelCountLabel(normalizedTypicalFuelCarriedInput)
            ? 'Use a number like 6 or a range like 6-8.'
            : undefined;

    function commitTypicalFuelCarriedInput(): void {
        const normalizedValue = sanitizeFuelCountLabel(typicalFuelCarriedInput);

        if (normalizedValue === null) {
            setTypicalFuelCarriedInput('');

            if (data.typicalFuelCarried !== null) {
                onChange({ ...data, typicalFuelCarried: null });
            }

            return;
        }

        if (!isFuelCountLabel(normalizedValue)) {
            setTypicalFuelCarriedInput(data.typicalFuelCarried ?? '');
            return;
        }

        setTypicalFuelCarriedInput(normalizedValue);

        if (normalizedValue !== data.typicalFuelCarried) {
            onChange({ ...data, typicalFuelCarried: normalizedValue });
        }
    }

    return (
        <FormSection
            title="Teleop Cycles + Strategy"
            subtitle="Scoring cycles and gameplay strategy"
        >
            <View className={stackFields ? 'gap-4' : 'flex-row gap-4'}>
                <View className="flex-1">
                    <FormField
                        label="Scoring Cycles (Active)"
                        definition={teleopDefinitions.scoringCyclesActive}
                    >
                        <Stepper
                            value={data.scoringCyclesActive}
                            onValueChange={(value) => onChange({ ...data, scoringCyclesActive: value })}
                            min={0}
                            max={50}
                        />
                    </FormField>
                </View>
                <View className="flex-1">
                    <FormField
                        label="Wasted Cycles (Inactive)"
                        definition={teleopDefinitions.wastedCyclesInactive}
                    >
                        <Stepper
                            value={data.wastedCyclesInactive}
                            onValueChange={(value) => onChange({ ...data, wastedCyclesInactive: value })}
                            min={0}
                            max={50}
                        />
                    </FormField>
                </View>
            </View>

            {showPitManagedFields ? (
                <>
                    <FormField
                        label="Typical FUEL Carried"
                        definition={teleopDefinitions.typicalFuelCarried}
                    >
                        <Input
                            value={typicalFuelCarriedInput}
                            onChangeText={setTypicalFuelCarriedInput}
                            onBlur={commitTypicalFuelCarriedInput}
                            placeholder="e.g. 6 or 6-8"
                            autoCapitalize="none"
                            autoCorrect={false}
                            error={typicalFuelCarriedError}
                            supportingText={typicalFuelCarriedError ? undefined : 'Use a single number or a range.'}
                        />
                    </FormField>

                    <FormField
                        label="Primary Fuel Source"
                        definition={teleopDefinitions.primaryFuelSource}
                    >
                        <Select
                            value={data.primaryFuelSource ?? 'Neutral Zone'}
                            onValueChange={(value) => onChange({ ...data, primaryFuelSource: value })}
                            options={fuelSourceOptions}
                        />
                    </FormField>

                    <FormToggleField
                        label="Uses TRENCH Routes"
                        definition={teleopDefinitions.usesTrenchRoutes}
                        checked={data.usesTrenchRoutes ?? false}
                        onCheckedChange={(checked) => onChange({ ...data, usesTrenchRoutes: checked })}
                    />
                </>
            ) : null}

            <FormToggleField
                label="Plays Defense"
                definition={teleopDefinitions.playsDefense}
                checked={data.playsDefense}
                onCheckedChange={(checked) => onChange({ ...data, playsDefense: checked })}
            />
        </FormSection>
    );
};
