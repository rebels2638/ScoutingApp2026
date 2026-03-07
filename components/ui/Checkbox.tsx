import { useThemeColors } from '@/lib/theme';
import { useUIScale } from '@/lib/ui-scale';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './Text';

export interface CheckboxProps {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    label?: string;
    disabled?: boolean;
    className?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
    checked,
    onCheckedChange,
    label,
    disabled = false,
    className,
}) => {
    const colors = useThemeColors();
    const { scaled } = useUIScale();

    return (
        <Pressable
            onPress={() => !disabled && onCheckedChange(!checked)}
            className={cn(
                'flex-row items-center gap-3',
                disabled && 'opacity-50',
                className
            )}
            disabled={disabled}
        >
            <View
                style={{
                    backgroundColor: checked ? colors.primary : 'transparent',
                    borderColor: checked ? colors.primary : colors.border,
                    height: scaled(20),
                    width: scaled(20),
                }}
                className="items-center justify-center rounded-sm border-2"
            >
                {checked && <Check size={scaled(14)} color={colors.primaryForeground} strokeWidth={3} />}
            </View>
            {label && (
                <Text className="text-base" style={{ fontSize: scaled(16) }}>{label}</Text>
            )}
        </Pressable>
    );
};

Checkbox.displayName = 'Checkbox';
