import {
    CUSTOM_TAB_BAR_HEIGHT,
    CUSTOM_TAB_BAR_MARGIN_BOTTOM,
    CustomTabBar,
    useTabBarMetrics,
} from '@/components/ui/CustomTabBar';
import { useTheme } from '@/lib/theme';
import { Tabs } from 'expo-router';
import { BarChart3, ClipboardCheck, ClipboardList, Database, Settings } from 'lucide-react-native';
import React from 'react';

function TabBarIcon({ icon: Icon, color, size }: { icon: typeof ClipboardList; color: string; size?: number }) {
    return <Icon size={size ?? 20} color={color} />;
}

export const TAB_BAR_HEIGHT = CUSTOM_TAB_BAR_HEIGHT;
export const TAB_BAR_MARGIN_BOTTOM = CUSTOM_TAB_BAR_MARGIN_BOTTOM;
export { useTabBarMetrics };

export default function TabLayout() {
    const { theme } = useTheme();

    return (
        <Tabs
            tabBar={(props) => <CustomTabBar {...props} />}
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: theme.colors.primary,
                tabBarInactiveTintColor: theme.colors.mutedForeground,
            }}>
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Scout',
                    tabBarIcon: ({ color, size }) => <TabBarIcon icon={ClipboardList} color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="assignments"
                options={{
                    title: 'Assign',
                    tabBarIcon: ({ color, size }) => <TabBarIcon icon={ClipboardCheck} color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="data"
                options={{
                    title: 'Data',
                    tabBarIcon: ({ color, size }) => <TabBarIcon icon={Database} color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="analysis"
                options={{
                    title: 'Analysis',
                    tabBarIcon: ({ color, size }) => <TabBarIcon icon={BarChart3} color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: 'Settings',
                    tabBarIcon: ({ color, size }) => <TabBarIcon icon={Settings} color={color} size={size} />,
                }}
            />
        </Tabs>
    );
}
