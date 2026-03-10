import * as React from 'react';

import { FormField, FormSection, FormToggleField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Stepper } from '@/components/ui/Stepper';
import { autonomousDefinitions } from '@/lib/definitions';
import { isFuelCountLabel, sanitizeFuelCountLabel } from '@/lib/fuel';
import type { AutoClimbResult, AutonomousData } from '@/lib/types';

interface AutonomousSectionProps {
    data: AutonomousData;
    onChange: (data: AutonomousData) => void;
    showPitManagedFields?: boolean;
}

const climbResultOptions = [
    { label: 'None', value: 'None' as AutoClimbResult },
    { label: 'Attempted (failed)', value: 'Attempted (failed)' as AutoClimbResult },
    { label: 'Level 1 success', value: 'Level 1 success' as AutoClimbResult },
];

export const AutonomousSection: React.FC<AutonomousSectionProps> = ({
    data,
    onChange,
    showPitManagedFields = true,
}) => {
    const [fuelScoredInput, setFuelScoredInput] = React.useState(data.fuelScoredBucket);

    React.useEffect(() => {
        setFuelScoredInput(data.fuelScoredBucket);
    }, [data.fuelScoredBucket]);

    const normalizedFuelScoredInput = sanitizeFuelCountLabel(fuelScoredInput);
    const fuelScoredError = normalizedFuelScoredInput !== null && !isFuelCountLabel(normalizedFuelScoredInput)
        ? 'Use a number like 4 or a range like 4-6.'
        : undefined;

    function commitFuelScoredInput(): void {
        const normalizedValue = sanitizeFuelCountLabel(fuelScoredInput);

        if (normalizedValue === null) {
            setFuelScoredInput('0');

            if (data.fuelScoredBucket !== '0') {
                onChange({ ...data, fuelScoredBucket: '0' });
            }

            return;
        }

        if (!isFuelCountLabel(normalizedValue)) {
            setFuelScoredInput(data.fuelScoredBucket);
            return;
        }

        setFuelScoredInput(normalizedValue);

        if (normalizedValue !== data.fuelScoredBucket) {
            onChange({ ...data, fuelScoredBucket: normalizedValue });
        }
    }

    return (
        <FormSection
            title="Autonomous (20s)"
            subtitle="The first 20 seconds of the match"
        >
            {showPitManagedFields ? (
                <FormField
                    label="Preload Count"
                    definition={autonomousDefinitions.preloadCount}
                >
                    <Stepper
                        value={data.preloadCount ?? 0}
                        onValueChange={(value) => onChange({ ...data, preloadCount: value })}
                        min={0}
                        max={8}
                    />
                </FormField>
            ) : null}

            <FormToggleField
                label="Taxis"
                definition={autonomousDefinitions.leftStartingLine}
                checked={data.leftStartingLine}
                onCheckedChange={(checked) => onChange({ ...data, leftStartingLine: checked })}
            />

            <FormToggleField
                label="Crossed CENTER LINE"
                definition={autonomousDefinitions.crossedCenterLine}
                checked={data.crossedCenterLine}
                onCheckedChange={(checked) => onChange({ ...data, crossedCenterLine: checked })}
            />

            <FormField
                label="Fuel Scored"
                definition={autonomousDefinitions.fuelScoredBucket}
            >
                <Input
                    value={fuelScoredInput}
                    onChangeText={setFuelScoredInput}
                    onBlur={commitFuelScoredInput}
                    placeholder="e.g. 4 or 4-6"
                    autoCapitalize="none"
                    autoCorrect={false}
                    error={fuelScoredError}
                    supportingText={fuelScoredError ? undefined : 'Use a single number or a range.'}
                />
            </FormField>

            <FormField
                label="Climb Result"
                definition={autonomousDefinitions.climbResult}
            >
                <Select
                    value={data.climbResult}
                    onValueChange={(value) => onChange({ ...data, climbResult: value })}
                    options={climbResultOptions}
                />
            </FormField>

            <FormToggleField
                label="Eligible for Auto Climb Points?"
                definition={autonomousDefinitions.eligibleForAutoClimbPoints}
                checked={data.eligibleForAutoClimbPoints}
                onCheckedChange={(checked) => onChange({ ...data, eligibleForAutoClimbPoints: checked })}
            />
        </FormSection>
    );
};
