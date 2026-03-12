import * as React from 'react';
import { ActivityIndicator, Image, View } from 'react-native';

import { useTheme } from '@/lib/theme';

const splashIcon = require('../../assets/images/splash-icon.png');

export function AppStartupScreen() {
    const { theme } = useTheme();
    const surfaceColor = theme.isDark ? '#111114' : theme.colors.card;

    return (
        <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: theme.colors.background }}>
            <View
                className="items-center justify-center border"
                style={{
                    width: 116,
                    height: 116,
                    borderRadius: 30,
                    backgroundColor: surfaceColor,
                    borderColor: theme.colors.border,
                }}>
                <Image source={splashIcon} resizeMode="contain" style={{ width: 70, height: 70 }} />
            </View>

            <ActivityIndicator
                color={theme.colors.mutedForeground}
                size="small"
                style={{ marginTop: 32 }}
            />
        </View>
    );
}