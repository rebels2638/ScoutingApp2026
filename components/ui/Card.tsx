import { useThemeColors } from '@/lib/theme';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { View, ViewProps } from 'react-native';
import { Text } from './Text';

export interface CardProps extends ViewProps {
    className?: string;
    variant?: 'default' | 'outline';
}

export const Card = React.forwardRef<View, CardProps>(
    ({ className, variant = 'default', style, ...props }, ref) => {
        const colors = useThemeColors();

        const variantStyle = variant === 'default'
            ? { backgroundColor: colors.card, borderColor: colors.border }
            : { backgroundColor: 'transparent', borderColor: colors.border };

        return (
            <View
                ref={ref}
                style={[variantStyle, { borderWidth: 1 }, style]}
                className={cn('rounded-lg p-4', className)}
                {...props}
            />
        );
    }
);

Card.displayName = 'Card';

export interface CardHeaderProps extends ViewProps {
    className?: string;
}

export const CardHeader = React.forwardRef<View, CardHeaderProps>(
    ({ className, ...props }, ref) => {
        return (
            <View
                ref={ref}
                className={cn('flex-row items-center justify-between pb-3', className)}
                {...props}
            />
        );
    }
);

CardHeader.displayName = 'CardHeader';

export interface CardTitleProps {
    className?: string;
    children: React.ReactNode;
}

export const CardTitle: React.FC<CardTitleProps> = ({ className, children }) => {
    return (
        <Text className={cn('text-lg font-semibold', className)}>
            {children}
        </Text>
    );
};

export interface CardDescriptionProps {
    className?: string;
    children: React.ReactNode;
}

export const CardDescription: React.FC<CardDescriptionProps> = ({ className, children }) => {
    const colors = useThemeColors();
    return (
        <Text className={cn('text-sm', className)} style={{ color: colors.mutedForeground }}>
            {children}
        </Text>
    );
};

export interface CardContentProps extends ViewProps {
    className?: string;
}

export const CardContent = React.forwardRef<View, CardContentProps>(
    ({ className, ...props }, ref) => {
        return (
            <View
                ref={ref}
                className={cn('gap-3', className)}
                {...props}
            />
        );
    }
);

CardContent.displayName = 'CardContent';

export interface CardFooterProps extends ViewProps {
    className?: string;
}

export const CardFooter = React.forwardRef<View, CardFooterProps>(
    ({ className, ...props }, ref) => {
        return (
            <View
                ref={ref}
                className={cn('flex-row items-center pt-3', className)}
                {...props}
            />
        );
    }
);

CardFooter.displayName = 'CardFooter';
