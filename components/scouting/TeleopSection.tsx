import * as React from 'react';
import { View } from 'react-native';

import { FormField, FormSection, FormToggleField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { Stepper } from '@/components/ui/Stepper';
import { teleopDefinitions } from '@/lib/definitions';
import { useUIScale } from '@/lib/ui-scale';
import type { FuelRange, PrimaryFuelSource, TeleopData } from '@/lib/types';

interface TeleopSectionProps {
    data: TeleopData;
    onChange: (data: TeleopData) => void;
    showPitManagedFields?: boolean;
}

const fuelRangeOptions = [
    { label: '1-4', value: '1-4' as FuelRange },
    { label: '5-8', value: '5-8' as FuelRange },
    { label: '9-12', value: '9-12' as FuelRange },
    { label: '13-16', value: '13-16' as FuelRange },
    { label: '17+', value: '17+' as FuelRange },
];

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

            <FormField
                label="Total FUEL Shots Attempted"
                definition={teleopDefinitions.fuelShotsAttempted}
            >
                <Stepper
                    value={data.fuelShotsAttempted ?? 0}
                    onValueChange={(value) => onChange({ ...data, fuelShotsAttempted: value })}
                    min={0}
                    max={200}
                />
            </FormField>

            {showPitManagedFields ? (
                <>
                    <FormField
                        label="Typical FUEL Carried"
                        definition={teleopDefinitions.typicalFuelCarried}
                    >
                        <Select
                            value={data.typicalFuelCarried ?? '1-4'}
                            onValueChange={(value) => onChange({ ...data, typicalFuelCarried: value })}
                            options={fuelRangeOptions}
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
