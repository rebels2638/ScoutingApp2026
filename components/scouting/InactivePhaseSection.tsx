import { FormSection, FormToggleField } from '@/components/ui/FormField';
import { inactivePhaseDefinitions } from '@/lib/definitions';
import type { InactivePhaseData } from '@/lib/types';
import * as React from 'react';

interface InactivePhaseSectionProps {
    data: InactivePhaseData;
    onChange: (data: InactivePhaseData) => void;
}

export const InactivePhaseSection: React.FC<InactivePhaseSectionProps> = ({
    data,
    onChange,
}) => {
    return (
        <FormSection
            title="Inactive-Phase Strategy"
            subtitle="Strategy during ALLIANCE SHIFTS when HUB is inactive"
            defaultExpanded={false}
        >
            <FormToggleField
                label="Holds Fuel and Waits"
                definition={inactivePhaseDefinitions.holdsFuelAndWaits}
                checked={data.holdsFuelAndWaits}
                onCheckedChange={(checked) => onChange({ ...data, holdsFuelAndWaits: checked })}
            />

            <FormToggleField
                label="Feeds Fuel to Alliance Zone"
                definition={inactivePhaseDefinitions.feedsFuelToAllianceZone}
                checked={data.feedsFuelToAllianceZone}
                onCheckedChange={(checked) => onChange({ ...data, feedsFuelToAllianceZone: checked })}
            />

            <FormToggleField
                label="Collects/Hoards from Neutral Zone"
                definition={inactivePhaseDefinitions.collectsFromNeutralZone}
                checked={data.collectsFromNeutralZone}
                onCheckedChange={(checked) => onChange({ ...data, collectsFromNeutralZone: checked })}
            />

            <FormToggleField
                label="Plays Defense"
                definition={inactivePhaseDefinitions.playsDefense}
                checked={data.playsDefense}
                onCheckedChange={(checked) => onChange({ ...data, playsDefense: checked })}
            />

            <FormToggleField
                label="Still Shoots Anyway (Wastes)"
                definition={inactivePhaseDefinitions.stillShootsAnyway}
                checked={data.stillShootsAnyway}
                onCheckedChange={(checked) => onChange({ ...data, stillShootsAnyway: checked })}
            />
        </FormSection>
    );
};
