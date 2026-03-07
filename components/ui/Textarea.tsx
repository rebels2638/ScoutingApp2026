import { useThemeColors } from '@/lib/theme';
import { useUIScale } from '@/lib/ui-scale';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { TextInput, TextInputProps, View } from 'react-native';
import { Text } from './Text';

export interface TextareaProps extends Omit<TextInputProps, 'multiline'> {
    className?: string;
    label?: string;
    error?: string;
    supportingText?: string;
    rows?: number;
}

export const Textarea = React.forwardRef<TextInput, TextareaProps>(
    ({ className, label, error, supportingText, rows = 4, onFocus, onBlur, ...props }, ref) => {
        const colors = useThemeColors();
        const { scaled } = useUIScale();
        const [focused, setFocused] = React.useState(false);

        const handleFocus = (e: any) => {
            setFocused(true);
            onFocus?.(e);
        };

        const handleBlur = (e: any) => {
            setFocused(false);
            onBlur?.(e);
        };

        return (
            <View className="gap-1.5">
                {label && (
                    <Text className="font-medium" style={{ fontSize: scaled(14) }}>{label}</Text>
                )}
                <View
                    style={{
                        borderColor: error ? colors.destructive : focused ? colors.ring : colors.border,
                        borderWidth: 1,
                        backgroundColor: colors.background,
                    }}
                    className="rounded-md"
                >
                    <TextInput
                        ref={ref}
                        multiline
                        textAlignVertical="top"
                        className={cn(
                            'px-3 py-3 text-base',
                            className
                        )}
                        style={{ minHeight: rows * scaled(24), color: colors.foreground, fontSize: scaled(16) }}
                        placeholderTextColor={colors.mutedForeground}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        {...props}
                    />
                </View>
                {(error || supportingText) && (
                    <Text
                        className="text-xs"
                        style={{ color: error ? colors.destructive : colors.mutedForeground, fontSize: scaled(12) }}
                    >
                        {error || supportingText}
                    </Text>
                )}
            </View>
        );
    }
);

Textarea.displayName = 'Textarea';
