import { ensureContrast, useThemeColors } from '@/lib/theme';
import { Medal, Trophy } from 'lucide-react-native';
import React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '../ui/Text';

export interface LeaderboardItem {
    rank: number;
    teamNumber: number;
    value: number;
    matchCount: number;
}

export interface LeaderboardProps {
    title?: string;
    data: LeaderboardItem[];
    metricLabel?: string;
    formatValue?: (value: number) => string;
    onTeamPress?: (teamNumber: number) => void;
}

export function Leaderboard({
    title,
    data,
    metricLabel = 'Score',
    formatValue = (v) => v.toFixed(1),
    onTeamPress,
}: LeaderboardProps) {
    const colors = useThemeColors();
    const podiumColors = React.useMemo(
        () => ({
            1: ensureContrast('#FFD700', colors.card, 3),
            2: ensureContrast('#C0C0C0', colors.card, 3),
            3: ensureContrast('#CD7F32', colors.card, 3),
        }),
        [colors.card]
    );

    if (data.length === 0) {
        return (
            <View className="items-center justify-center py-8">
                <Text style={{ color: colors.mutedForeground }}>No teams to display</Text>
            </View>
        );
    }

    const getRankIcon = (rank: number) => {
        switch (rank) {
            case 1:
                return <Trophy size={16} color={podiumColors[1]} />;
            case 2:
                return <Medal size={16} color={podiumColors[2]} />;
            case 3:
                return <Medal size={16} color={podiumColors[3]} />;
            default:
                return null;
        }
    };

    const getRankColor = (rank: number) => {
        switch (rank) {
            case 1: return podiumColors[1];
            case 2: return podiumColors[2];
            case 3: return podiumColors[3];
            default: return colors.mutedForeground;
        }
    };

    return (
        <View>
            {title && (
                <Text style={{ color: colors.foreground }} className="mb-2 text-base font-semibold">
                    {title}
                </Text>
            )}
            <View style={{ backgroundColor: colors.card, borderColor: colors.border }} className="overflow-hidden rounded-lg border">

                <View
                    style={{ backgroundColor: colors.secondaryElevated }}
                    className="flex-row items-center px-3 py-2"
                >
                    <Text style={{ color: colors.mutedForeground }} className="w-10 text-xs font-medium">
                        #
                    </Text>
                    <Text style={{ color: colors.mutedForeground }} className="flex-1 text-xs font-medium">
                        Team
                    </Text>
                    <Text style={{ color: colors.mutedForeground }} className="w-16 text-right text-xs font-medium">
                        Matches
                    </Text>
                    <Text style={{ color: colors.mutedForeground }} className="w-20 text-right text-xs font-medium">
                        {metricLabel}
                    </Text>
                </View>

                {data.map((item, index) => (
                    <Pressable
                        key={item.teamNumber}
                        onPress={() => onTeamPress?.(item.teamNumber)}
                        style={({ pressed }) => [
                            {
                                backgroundColor: pressed ? colors.secondaryElevated : 'transparent',
                                borderBottomColor: colors.border,
                            },
                        ]}
                        className={`flex-row items-center px-3 py-2.5 ${index < data.length - 1 ? 'border-b' : ''}`}
                    >
                        <View className="w-10 flex-row items-center">
                            {getRankIcon(item.rank)}
                            <Text
                                style={{ color: item.rank <= 3 ? getRankColor(item.rank) : colors.mutedForeground }}
                                className={`${item.rank <= 3 ? 'ml-1 font-bold' : ''} text-sm`}
                            >
                                {item.rank <= 3 ? '' : item.rank}
                            </Text>
                        </View>
                        <Text style={{ color: colors.foreground }} className="flex-1 text-sm font-medium">
                            Team {item.teamNumber}
                        </Text>
                        <Text style={{ color: colors.mutedForeground }} className="w-16 text-right text-xs">
                            {item.matchCount}
                        </Text>
                        <Text style={{ color: colors.foreground }} className="w-20 text-right text-sm font-semibold">
                            {formatValue(item.value)}
                        </Text>
                    </Pressable>
                ))}
            </View>
        </View>
    );
}
