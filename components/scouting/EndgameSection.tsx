import { Checkbox } from '@/components/ui/Checkbox';
import { FormField, FormSection, FormToggleField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { endgameDefinitions } from '@/lib/definitions';
import { useUIScale } from '@/lib/ui-scale';
import type { Card, ClimbLevel, ClimbSuccessState, EndgameData, MobilityIssue } from '@/lib/types';
import * as React from 'react';
import { View } from 'react-native';

interface EndgameSectionProps {
    data: EndgameData;
    onChange: (data: EndgameData) => void;
}

const climbLevelOptions = [
    { label: 'None', value: 'None' as ClimbLevel },
    { label: 'Level 1', value: 'Level 1' as ClimbLevel },
    { label: 'Level 2', value: 'Level 2' as ClimbLevel },
    { label: 'Level 3', value: 'Level 3' as ClimbLevel },
];

const climbSuccessOptions = [
    { label: 'N/A', value: 'N/A' as ClimbSuccessState },
    { label: 'Success', value: 'Success' as ClimbSuccessState },
    { label: 'Failed', value: 'Failed' as ClimbSuccessState },
    { label: 'Fell off', value: 'Fell off' as ClimbSuccessState },
];

const mobilityOptions = [
    { label: 'None', value: 'None' as MobilityIssue },
    { label: 'Brownout-ish', value: 'Brownout-ish' as MobilityIssue },
    { label: 'Tipped', value: 'Tipped' as MobilityIssue },
    { label: 'Stuck', value: 'Stuck' as MobilityIssue },
    { label: 'Other', value: 'Other' as MobilityIssue },
];

const cardOptions: Card[] = ['None', 'Yellow', 'Red'];

export const EndgameSection: React.FC<EndgameSectionProps> = ({
    data,
    onChange,
}) => {
    const { scaleOption } = useUIScale();
    const stackFields = scaleOption === 'large' || scaleOption === 'extra-large';

    const toggleCard = (card: Card) => {
        if (card === 'None') {
            onChange({ ...data, cards: [] });
        } else {
            const newCards = data.cards.includes(card)
                ? data.cards.filter((c) => c !== card)
                : [...data.cards.filter((c) => c !== 'None'), card];
            onChange({ ...data, cards: newCards });
        }
    };

    return (
        <FormSection
            title="Endgame + Reliability"
            subtitle="End of match performance and robot status"
        >
            <FormToggleField
                label="Attempted Climb"
                definition={endgameDefinitions.attemptedClimb}
                checked={data.attemptedClimb}
                onCheckedChange={(checked) => onChange({ ...data, attemptedClimb: checked })}
            />

            <View className={stackFields ? 'gap-4' : 'flex-row gap-4'}>
                <View className="flex-1">
                    <FormField
                        label="Climb Level Achieved"
                        definition={endgameDefinitions.climbLevelAchieved}
                    >
                        <Select
                            value={data.climbLevelAchieved}
                            onValueChange={(value) => onChange({ ...data, climbLevelAchieved: value })}
                            options={climbLevelOptions}
                        />
                    </FormField>
                </View>
                <View className="flex-1">
                    <FormField
                        label="Climb Success State"
                        definition={endgameDefinitions.climbSuccessState}
                    >
                        <Select
                            value={data.climbSuccessState}
                            onValueChange={(value) => onChange({ ...data, climbSuccessState: value })}
                            options={climbSuccessOptions}
                        />
                    </FormField>
                </View>
            </View>

            <FormField
                label="Time to Climb (seconds)"
                definition={endgameDefinitions.timeToClimb}
            >
                <Input
                    value={data.timeToClimb > 0 ? String(data.timeToClimb) : ''}
                    onChangeText={(text) => {
                        const num = parseInt(text, 10);
                        onChange({ ...data, timeToClimb: isNaN(num) ? 0 : Math.max(0, Math.min(30, num)) });
                    }}
                    keyboardType="number-pad"
                    placeholder="0-30"
                />
            </FormField>

            <FormToggleField
                label="Parked but No Climb"
                definition={endgameDefinitions.parkedButNoClimb}
                checked={data.parkedButNoClimb}
                onCheckedChange={(checked) => onChange({ ...data, parkedButNoClimb: checked })}
            />

            <FormToggleField
                label="Breakdown"
                definition={endgameDefinitions.breakdown}
                checked={data.breakdown}
                onCheckedChange={(checked) => onChange({ ...data, breakdown: checked })}
            />

            <FormField
                label="Mobility Issues"
                definition={endgameDefinitions.mobilityIssues}
            >
                <Select
                    value={data.mobilityIssues}
                    onValueChange={(value) => onChange({ ...data, mobilityIssues: value })}
                    options={mobilityOptions}
                />
            </FormField>

            <FormField
                label="Cards"
                definition={endgameDefinitions.cards}
            >
                <View className="flex-row flex-wrap gap-4">
                    {cardOptions.map((card) => (
                        <Checkbox
                            key={card}
                            label={card}
                            checked={card === 'None' ? data.cards.length === 0 : data.cards.includes(card)}
                            onCheckedChange={() => toggleCard(card)}
                        />
                    ))}
                </View>
            </FormField>

            <FormField
                label="Extra Comments"
                definition={endgameDefinitions.extraComments}
            >
                <Textarea
                    value={data.extraComments}
                    onChangeText={(text) => onChange({ ...data, extraComments: text })}
                    placeholder="Any unusual observations or notes..."
                    rows={3}
                />
            </FormField>
        </FormSection>
    );
};
