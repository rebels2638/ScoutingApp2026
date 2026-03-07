import { FormField, FormSection } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Select } from '@/components/ui/Select';
import { matchMetadataDefinitions } from '@/lib/definitions';
import { useUIScale } from '@/lib/ui-scale';
import type { AllianceColor, MatchMetadata, MatchType } from '@/lib/types';
import * as React from 'react';
import { View } from 'react-native';

interface MatchMetadataSectionProps {
    data: MatchMetadata;
    onChange: (data: MatchMetadata) => void;
}

const matchTypeOptions = [
    { label: 'Practice', value: 'Practice' as MatchType },
    { label: 'Qualification', value: 'Qualification' as MatchType },
    { label: 'Playoff', value: 'Playoff' as MatchType },
];

const allianceOptions = [
    { label: 'Red', value: 'Red' as AllianceColor },
    { label: 'Blue', value: 'Blue' as AllianceColor },
];

export const MatchMetadataSection: React.FC<MatchMetadataSectionProps> = ({
    data,
    onChange,
}) => {
    const { scaleOption } = useUIScale();
    const stackFields = scaleOption === 'large' || scaleOption === 'extra-large';

    return (
        <FormSection title="Match Metadata" subtitle="Basic match information">
            <View className={stackFields ? 'gap-4' : 'flex-row gap-4'}>
                <View className="flex-1">
                    <FormField
                        label="Match Number"
                        definition={matchMetadataDefinitions.matchNumber}
                    >
                        <Input
                            value={data.matchNumber > 0 ? String(data.matchNumber) : ''}
                            onChangeText={(text) => {
                                const num = parseInt(text, 10);
                                onChange({ ...data, matchNumber: isNaN(num) ? 0 : Math.max(1, num) });
                            }}
                            keyboardType="number-pad"
                            placeholder="1"
                        />
                    </FormField>
                </View>
                <View className="flex-1">
                    <FormField
                        label="Team Number"
                        definition={matchMetadataDefinitions.teamNumber}
                    >
                        <Input
                            value={data.teamNumber > 0 ? String(data.teamNumber) : ''}
                            onChangeText={(text) => {
                                const num = parseInt(text, 10);
                                onChange({ ...data, teamNumber: isNaN(num) ? 0 : Math.max(1, Math.min(99999, num)) });
                            }}
                            keyboardType="number-pad"
                            placeholder="2638"
                        />
                    </FormField>
                </View>
            </View>

            <FormField
                label="Match Type"
                definition={matchMetadataDefinitions.matchType}
            >
                <Select
                    value={data.matchType}
                    onValueChange={(value) => onChange({ ...data, matchType: value })}
                    options={matchTypeOptions}
                />
            </FormField>

            <FormField
                label="Alliance Color"
                definition={matchMetadataDefinitions.allianceColor}
            >
                <SegmentedControl
                    value={data.allianceColor}
                    onValueChange={(value) => onChange({ ...data, allianceColor: value })}
                    options={allianceOptions}
                />
            </FormField>
        </FormSection>
    );
};
