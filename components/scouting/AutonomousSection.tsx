import { FormField, FormSection, FormToggleField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { Stepper } from '@/components/ui/Stepper';
import { autonomousDefinitions } from '@/lib/definitions';
import type { AutoClimbResult, AutonomousData, FuelScoredBucket } from '@/lib/types';
import * as React from 'react';

interface AutonomousSectionProps {
    data: AutonomousData;
    onChange: (data: AutonomousData) => void;
}

const fuelScoredOptions = [
    { label: '0', value: '0' as FuelScoredBucket },
    { label: '1-3', value: '1-3' as FuelScoredBucket },
    { label: '4-8', value: '4-8' as FuelScoredBucket },
    { label: '9+', value: '9+' as FuelScoredBucket },
];

const climbResultOptions = [
    { label: 'None', value: 'None' as AutoClimbResult },
    { label: 'Attempted (failed)', value: 'Attempted (failed)' as AutoClimbResult },
    { label: 'Level 1 success', value: 'Level 1 success' as AutoClimbResult },
];

export const AutonomousSection: React.FC<AutonomousSectionProps> = ({
    data,
    onChange,
}) => {
    return (
        <FormSection
            title="Autonomous (20s)"
            subtitle="The first 20 seconds of the match"
        >
            <FormField
                label="Preload Count"
                definition={autonomousDefinitions.preloadCount}
            >
                <Stepper
                    value={data.preloadCount}
                    onValueChange={(value) => onChange({ ...data, preloadCount: value })}
                    min={0}
                    max={8}
                />
            </FormField>

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
                label="Fuel Scored Bucket"
                definition={autonomousDefinitions.fuelScoredBucket}
            >
                <Select
                    value={data.fuelScoredBucket}
                    onValueChange={(value) => onChange({ ...data, fuelScoredBucket: value })}
                    options={fuelScoredOptions}
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
