import type { FieldDefinition } from '@/lib/definitions';
import { useThemeColors } from '@/lib/theme';
import { useUIScale } from '@/lib/ui-scale';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { InfoButton } from './InfoButton';
import { Switch } from './Switch';
import { Text } from './Text';

export interface FormFieldProps {
    label: string;
    definition?: FieldDefinition;
    children: React.ReactNode;
    className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
    label,
    definition,
    children,
    className,
}) => {
    const { scaled } = useUIScale();
    return (
        <View className={cn('gap-1.5', className)}>
            <View className="flex-row items-center gap-2">
                <Text className="flex-1 font-medium" style={{ fontSize: scaled(14) }}>{label}</Text>
                {definition && <InfoButton definition={definition} />}
            </View>
            {children}
        </View>
    );
};

FormField.displayName = 'FormField';

export interface FormToggleFieldProps {
    label: string;
    definition?: FieldDefinition;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
    className?: string;
}

export const FormToggleField: React.FC<FormToggleFieldProps> = ({
    label,
    definition,
    checked,
    onCheckedChange,
    disabled = false,
    className,
}) => {
    const { scaled } = useUIScale();
    return (
        <View className={cn('flex-row items-center justify-between gap-4 py-2', className)}>
            <View className="flex-1 flex-row items-center gap-2">
                <Text className="flex-1" style={{ fontSize: scaled(16) }}>{label}</Text>
                {definition && <InfoButton definition={definition} />}
            </View>
            <Switch
                checked={checked}
                onCheckedChange={onCheckedChange}
                disabled={disabled}
            />
        </View>
    );
};

FormToggleField.displayName = 'FormToggleField';

export interface FormSectionProps {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    defaultExpanded?: boolean;
    className?: string;
}

export const FormSection: React.FC<FormSectionProps> = ({
    title,
    subtitle,
    children,
    defaultExpanded = true,
    className,
}) => {
    const colors = useThemeColors();
    const { scaled } = useUIScale();
    const [expanded, setExpanded] = React.useState(defaultExpanded);

    const toggleExpanded = () => {
        setExpanded(!expanded);
    };

    return (
        <View
            className={cn('rounded-lg overflow-hidden', className)}
            style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }}
        >
            <Pressable
                onPress={toggleExpanded}
                className="flex-row items-center justify-between p-4"
            >
                <View className="flex-1">
                    <Text className="font-medium" style={{ fontSize: scaled(16) }}>{title}</Text>
                    {subtitle && (
                        <Text className="mt-0.5" style={{ color: colors.mutedForeground, fontSize: scaled(12) }}>{subtitle}</Text>
                    )}
                </View>
                <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
                    <ChevronDown size={scaled(18)} color={colors.mutedForeground} />
                </View>
            </Pressable>

            {expanded && (
                <View
                    className="gap-4 px-4 pb-4 pt-4"
                    style={{ borderTopWidth: 1, borderTopColor: colors.border }}
                >
                    {children}
                </View>
            )}
        </View>
    );
};

FormSection.displayName = 'FormSection';
