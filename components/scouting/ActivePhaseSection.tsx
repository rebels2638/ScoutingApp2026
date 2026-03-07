import { FormSection, FormToggleField } from '@/components/ui/FormField';
import { activePhaseDefinitions } from '@/lib/definitions';
import type { ActivePhaseData } from '@/lib/types';
import * as React from 'react';

interface ActivePhaseSectionProps {
    data: ActivePhaseData;
    onChange: (data: ActivePhaseData) => void;
}

export const ActivePhaseSection: React.FC<ActivePhaseSectionProps> = ({
    data,
    onChange,
}) => {
    return (
        <FormSection
            title="Active-Phase Strategy"
            subtitle="Strategy when HUB is active"
            defaultExpanded={false}
        >
            <FormToggleField
                label="Feeds Fuel to Alliance Zone"
                definition={activePhaseDefinitions.feedsFuelToAllianceZone}
                checked={data.feedsFuelToAllianceZone}
                onCheckedChange={(checked) => onChange({ ...data, feedsFuelToAllianceZone: checked })}
            />

            <FormToggleField
                label="Plays Offense Only"
                definition={activePhaseDefinitions.playsOffenseOnly}
                checked={data.playsOffenseOnly}
                onCheckedChange={(checked) => onChange({ ...data, playsOffenseOnly: checked })}
            />

            <FormToggleField
                label="Plays Some Defense While Active"
                definition={activePhaseDefinitions.playsSomeDefenseWhileActive}
                checked={data.playsSomeDefenseWhileActive}
                onCheckedChange={(checked) => onChange({ ...data, playsSomeDefenseWhileActive: checked })}
            />
        </FormSection>
    );
};
