import { useThemeColors } from '@/lib/theme';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { Text as RNText, TextProps as RNTextProps } from 'react-native';

export interface TextProps extends RNTextProps {
    className?: string;
}

export const Text = React.forwardRef<RNText, TextProps>(
    ({ className, style, ...props }, ref) => {
        const colors = useThemeColors();
        return (
            <RNText
                ref={ref}
                className={cn('', className)}
                style={[{ color: colors.foreground }, style]}
                {...props}
            />
        );
    }
);

Text.displayName = 'Text';
