import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Text } from '@/components/ui/Text';
import {
    clearAllScoutingEntries,
    deleteScoutingEntry,
    getScoutingEntries,
} from '@/lib/storage';
import { ThemedScrollView, ThemedView, useThemeColors } from '@/lib/theme';
import { MatchType, ScoutingEntry } from '@/lib/types';
import { useUIScale } from '@/lib/ui-scale';
import {
    Database,
    Eye,
    RefreshCw,
    Trash2,
    X,
} from 'lucide-react-native';
import { useTabBarMetrics } from './_layout';

type SortOption = 'timestamp' | 'match' | 'team';

const shouldStackForLargeScale = (scaleOption: string) =>
    scaleOption === 'large' || scaleOption === 'extra-large';

export default function DataTab() {
    const colors = useThemeColors();
    const [entries, setEntries] = useState<ScoutingEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<ScoutingEntry | null>(null);
    const [filterMatchType, setFilterMatchType] = useState<MatchType | 'All'>('All');
    const [sortBy, setSortBy] = useState<SortOption>('timestamp');
    const [searchQuery, setSearchQuery] = useState('');

    const loadEntries = async () => {
        try {
            const data = await getScoutingEntries();
            setEntries(data);
        } catch (error) {
            console.error('Error loading entries:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            void loadEntries();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        void loadEntries();
    };

    const handleDelete = (entry: ScoutingEntry) => {
        Alert.alert(
            'Delete Entry',
            `Are you sure you want to delete Team ${entry.matchMetadata.teamNumber} in Match ${entry.matchMetadata.matchNumber}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteScoutingEntry(entry.id);
                            await loadEntries();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete entry.');
                        }
                    },
                },
            ]
        );
    };

    const handleClearAll = () => {
        if (entries.length === 0) {
            Alert.alert('No Data', 'There are no entries to clear.');
            return;
        }

        Alert.alert(
            'Clear All Data',
            `Delete all ${entries.length} scouting entries? This cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear All',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await clearAllScoutingEntries();
                            await loadEntries();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to clear entries.');
                        }
                    },
                },
            ]
        );
    };

    const normalizedQuery = searchQuery.trim().toLowerCase();

    const filteredEntries = useMemo(() => {
        return entries
            .filter((entry) => {
                if (filterMatchType === 'All') return true;
                return entry.matchMetadata.matchType === filterMatchType;
            })
            .filter((entry) => {
                if (!normalizedQuery) return true;
                return (
                    String(entry.matchMetadata.teamNumber).includes(normalizedQuery) ||
                    String(entry.matchMetadata.matchNumber).includes(normalizedQuery)
                );
            })
            .sort((a, b) => {
                switch (sortBy) {
                    case 'match':
                        return a.matchMetadata.matchNumber - b.matchMetadata.matchNumber;
                    case 'team':
                        return a.matchMetadata.teamNumber - b.matchMetadata.teamNumber;
                    case 'timestamp':
                    default:
                        return b.timestamp - a.timestamp;
                }
            });
    }, [entries, filterMatchType, normalizedQuery, sortBy]);


    const hasActiveFilters = filterMatchType !== 'All' || sortBy !== 'timestamp' || normalizedQuery.length > 0;

    const resetFilters = () => {
        setFilterMatchType('All');
        setSortBy('timestamp');
        setSearchQuery('');
    };

    const matchTypeFilterOptions = [
        { label: 'All Match Types', value: 'All' as const },
        { label: 'Practice', value: 'Practice' as MatchType },
        { label: 'Qualification', value: 'Qualification' as MatchType },
        { label: 'Playoff', value: 'Playoff' as MatchType },
    ];

    const sortOptions = [
        { label: 'Newest First', value: 'timestamp' as const },
        { label: 'Match Number', value: 'match' as const },
        { label: 'Team Number', value: 'team' as const },
    ];

    const insets = useSafeAreaInsets();
    const { height: tabBarHeight, marginBottom: tabBarMarginBottom } = useTabBarMetrics();

    if (loading) {
        return (
            <ThemedView className="flex-1 items-center justify-center px-8">
                <View className="items-center gap-3">
                    <Database size={28} color={colors.mutedForeground} />
                    <Text className="text-lg font-semibold">Loading scouting data...</Text>
                    <Text className="text-center text-sm" style={{ color: colors.mutedForeground }}>
                        Syncing saved match entries and stats.
                    </Text>
                </View>
            </ThemedView>
        );
    }

    const bottomPadding = tabBarHeight + Math.max(insets.bottom, tabBarMarginBottom) + 16;

    return (
        <ThemedView className="flex-1" style={{ paddingTop: insets.top }}>
            <ThemedScrollView
                contentContainerStyle={{
                    paddingHorizontal: 14,
                    paddingTop: 12,
                    paddingBottom: bottomPadding,
                }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                <View className="gap-3">
                    <DataOverviewCard
                        entryCount={entries.length}
                        onRefresh={onRefresh}
                        onClearAll={handleClearAll}
                    />

                    <DataFilterCard
                        searchQuery={searchQuery}
                        onSearchQueryChange={setSearchQuery}
                        filterMatchType={filterMatchType}
                        setFilterMatchType={setFilterMatchType}
                        sortBy={sortBy}
                        setSortBy={setSortBy}
                        matchTypeFilterOptions={matchTypeFilterOptions}
                        sortOptions={sortOptions}
                        hasActiveFilters={hasActiveFilters}
                        onResetFilters={resetFilters}
                    />

                    {filteredEntries.length === 0 ? (
                        <EmptyState hasEntries={entries.length > 0} onResetFilters={resetFilters} />
                    ) : (
                        <View className="gap-3">
                            {filteredEntries.map((entry) => (
                                <EntryCard
                                    key={entry.id}
                                    entry={entry}
                                    onView={() => setSelectedEntry(entry)}
                                    onDelete={() => handleDelete(entry)}
                                />
                            ))}
                        </View>
                    )}
                </View>
            </ThemedScrollView>

            <EntryDetailModal
                entry={selectedEntry}
                onClose={() => setSelectedEntry(null)}
            />
        </ThemedView>
    );
}

interface DataOverviewCardProps {
    entryCount: number;
    onRefresh: () => void;
    onClearAll: () => void;
}

function DataOverviewCard({
    entryCount,
    onRefresh,
    onClearAll,
}: DataOverviewCardProps) {
    const colors = useThemeColors();
    const { scaleOption, scaled } = useUIScale();
    const stackLayout = shouldStackForLargeScale(scaleOption);
    const actionButtonClassName = stackLayout ? 'w-full' : '';

    return (
        <Card className="px-4 py-3" style={{ backgroundColor: colors.secondary }}>
            <View className={stackLayout ? 'gap-2' : 'flex-row items-start justify-between gap-2'}>
                <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                        <Database size={scaled(18)} color={colors.foreground} />
                        <Text className="text-lg font-semibold">Data</Text>
                    </View>
                    <Text className="mt-1 text-sm" style={{ color: colors.mutedForeground }}>
                        Review, filter, and manage your scouting data.
                    </Text>
                </View>

                <View className={stackLayout ? 'gap-2' : 'flex-row items-center gap-2'}>
                    <Button variant="outline" size="sm" onPress={onRefresh} className={actionButtonClassName}>
                        <View className="flex-row items-center justify-center gap-1.5">
                            <RefreshCw size={scaled(14)} color={colors.foreground} />
                            <Text className="text-sm font-medium" style={{ color: colors.foreground }}>
                                Refresh
                            </Text>
                        </View>
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        onPress={onClearAll}
                        className={actionButtonClassName}
                        disabled={entryCount === 0}
                    >
                        <View className="flex-row items-center justify-center gap-1.5">
                            <Trash2 size={scaled(14)} color={colors.destructiveForeground} />
                            <Text className="text-sm font-medium" style={{ color: colors.destructiveForeground }}>
                                Clear All
                            </Text>
                        </View>
                    </Button>
                </View>
            </View>
        </Card>
    );
}

interface DataFilterCardProps {
    searchQuery: string;
    onSearchQueryChange: (value: string) => void;
    filterMatchType: MatchType | 'All';
    setFilterMatchType: (value: MatchType | 'All') => void;
    sortBy: SortOption;
    setSortBy: (value: SortOption) => void;
    matchTypeFilterOptions: { label: string; value: MatchType | 'All' }[];
    sortOptions: { label: string; value: SortOption }[];
    hasActiveFilters: boolean;
    onResetFilters: () => void;
}

function DataFilterCard({
    searchQuery,
    onSearchQueryChange,
    filterMatchType,
    setFilterMatchType,
    sortBy,
    setSortBy,
    matchTypeFilterOptions,
    sortOptions,
    hasActiveFilters,
    onResetFilters,
}: DataFilterCardProps) {
    const colors = useThemeColors();
    const { scaleOption } = useUIScale();
    const stackLayout = shouldStackForLargeScale(scaleOption);

    return (
        <Card className="p-3">
            <CardHeader className={stackLayout ? 'flex-col items-start gap-2 pb-2' : 'pb-2'}>
                <View className="flex-1">
                    <CardTitle className="text-base">Filters & Sorting</CardTitle>
                    <Text className="mt-1 text-sm" style={{ color: colors.mutedForeground }}>
                        Search by team or match number, then sort the results.
                    </Text>
                </View>
                {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onPress={onResetFilters}>
                        Reset
                    </Button>
                )}
            </CardHeader>

            <CardContent className="gap-2">
                <Input
                    value={searchQuery}
                    onChangeText={onSearchQueryChange}
                    label="Search"
                    placeholder="Type team or match number"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="number-pad"
                />

                <View className={stackLayout ? 'gap-2' : 'flex-row gap-2'}>
                    <View className="flex-1">
                        <Select
                            value={filterMatchType}
                            onValueChange={setFilterMatchType}
                            options={matchTypeFilterOptions}
                            label="Match Type"
                            placeholder="Select a match type"
                        />
                    </View>
                    <View className="flex-1">
                        <Select
                            value={sortBy}
                            onValueChange={setSortBy}
                            options={sortOptions}
                            label="Sort By"
                            placeholder="Select sorting"
                        />
                    </View>
                </View>
            </CardContent>
        </Card>
    );
}

interface EntryCardProps {
    entry: ScoutingEntry;
    onView: () => void;
    onDelete: () => void;
}

function EntryCard({ entry, onView, onDelete }: EntryCardProps) {
    const colors = useThemeColors();
    const { scaleOption, scaled } = useUIScale();
    const stackLayout = shouldStackForLargeScale(scaleOption);

    const { matchMetadata, autonomous, teleop, endgame } = entry;

    const timestampLabel = new Date(entry.timestamp).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    return (
        <Card className="p-0">
            <View className="px-3 py-3">
                <View className={stackLayout ? 'gap-2' : 'flex-row items-start justify-between gap-2'}>
                    <View className="flex-1 flex-row items-start gap-2">
                        <View
                            style={{
                                backgroundColor:
                                    matchMetadata.allianceColor === 'Red'
                                        ? colors.allianceRedMuted
                                        : colors.allianceBlueMuted,
                            }}
                            className="rounded-md px-2 py-1"
                        >
                            <Text
                                className="text-xs font-semibold"
                                style={{
                                    color:
                                        matchMetadata.allianceColor === 'Red'
                                            ? colors.allianceRedForeground
                                            : colors.allianceBlueForeground,
                                }}
                            >
                                {matchMetadata.allianceColor} Alliance
                            </Text>
                        </View>
                        <View className="flex-1">
                            <Text className="text-base font-semibold">Team {matchMetadata.teamNumber}</Text>
                            <Text className="text-sm" style={{ color: colors.mutedForeground }}>
                                {matchMetadata.matchType} Match {matchMetadata.matchNumber}
                            </Text>
                            <Text className="mt-0.5 text-xs" style={{ color: colors.mutedForeground }}>
                                {timestampLabel}
                            </Text>
                        </View>
                    </View>

                    <View className={stackLayout ? 'flex-row self-start gap-2' : 'flex-row gap-2'}>
                        <Button variant="outline" size="icon" onPress={onView} accessibilityLabel="View entry details">
                            <Eye size={scaled(14)} color={colors.foreground} />
                        </Button>
                        <Button variant="destructive" size="icon" onPress={onDelete} accessibilityLabel="Delete entry">
                            <Trash2 size={scaled(14)} color={colors.destructiveForeground} />
                        </Button>
                    </View>
                </View>
            </View>
        </Card>
    );
}


function EmptyState({ hasEntries, onResetFilters }: { hasEntries: boolean; onResetFilters: () => void }) {
    const colors = useThemeColors();

    return (
        <Card className="p-3">
            <CardContent className="items-center py-7">
                <Database size={26} color={colors.mutedForeground} />
                <Text className="mt-3 text-lg font-semibold">
                    {hasEntries ? 'No matching entries' : 'No entries yet'}
                </Text>
                <Text className="mt-1 text-center text-sm" style={{ color: colors.mutedForeground }}>
                    {hasEntries
                        ? 'Try a different search or reset the filters to view more scouting data.'
                        : 'Submit scouting entries from the Scout tab to populate this screen.'}
                </Text>
                {hasEntries && (
                    <Button variant="outline" size="sm" className="mt-4" onPress={onResetFilters}>
                        Show All Entries
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}

interface EntryDetailModalProps {
    entry: ScoutingEntry | null;
    onClose: () => void;
}

function EntryDetailModal({ entry, onClose }: EntryDetailModalProps) {
    const colors = useThemeColors();
    const { scaleOption, scaled } = useUIScale();
    const stackLayout = shouldStackForLargeScale(scaleOption);

    if (!entry) return null;

    const { matchMetadata, autonomous, teleop, activePhase, inactivePhase, endgame } = entry;

    return (
        <Modal
            visible={!!entry}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <ThemedView className="flex-1">
                <View
                    style={{ backgroundColor: colors.card, borderBottomColor: colors.border }}
                    className={stackLayout ? 'gap-3 border-b px-4 py-4' : 'flex-row items-start justify-between border-b px-4 py-4'}
                >
                    <View className="flex-1">
                        <Text className="text-xl font-bold">Team {matchMetadata.teamNumber}</Text>
                        <Text className="mt-1 text-sm" style={{ color: colors.mutedForeground }}>
                            {matchMetadata.matchType} Match {matchMetadata.matchNumber}
                        </Text>
                    </View>

                    <Button variant="outline" size="icon" onPress={onClose} className={stackLayout ? 'self-start' : ''}>
                        <X size={scaled(18)} color={colors.foreground} />
                    </Button>
                </View>

                <ThemedScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
                    <View className="gap-4">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">Snapshot</CardTitle>
                            </CardHeader>
                            <CardContent className="gap-0">
                                <DetailRow label="Alliance" value={matchMetadata.allianceColor} />
                                <DetailRow label="Auto Fuel" value={autonomous.fuelScoredBucket} />
                                <DetailRow label="Climb" value={endgame.climbLevelAchieved} />
                                <DetailRow label="Recorded" value={new Date(entry.timestamp).toLocaleString()} />
                            </CardContent>
                        </Card>

                        <DetailSection title="Autonomous">
                            <DetailRow label="Preload Count" value={String(autonomous.preloadCount)} />
                            <DetailRow label="Left Starting Line" value={autonomous.leftStartingLine ? 'Yes' : 'No'} />
                            <DetailRow label="Crossed Center Line" value={autonomous.crossedCenterLine ? 'Yes' : 'No'} />
                            <DetailRow label="Fuel Scored" value={autonomous.fuelScoredBucket} />
                            <DetailRow label="Climb Result" value={autonomous.climbResult} />
                            <DetailRow
                                label="Eligible for Auto Climb"
                                value={autonomous.eligibleForAutoClimbPoints ? 'Yes' : 'No'}
                            />
                        </DetailSection>

                        <DetailSection title="Teleop">
                            <DetailRow label="Scoring Cycles (Active)" value={String(teleop.scoringCyclesActive)} />
                            <DetailRow label="Wasted Cycles (Inactive)" value={String(teleop.wastedCyclesInactive)} />
                            <DetailRow label="Fuel Shots Attempted" value={String(teleop.fuelShotsAttempted ?? 0)} />
                            <DetailRow label="Typical Fuel Carried" value={teleop.typicalFuelCarried} />
                            <DetailRow label="Primary Fuel Source" value={teleop.primaryFuelSource} />
                            <DetailRow label="Uses Trench Routes" value={teleop.usesTrenchRoutes ? 'Yes' : 'No'} />
                            <DetailRow label="Plays Defense" value={teleop.playsDefense ? 'Yes' : 'No'} />
                        </DetailSection>

                        <DetailSection title="Active Phase Strategy">
                            <DetailRow
                                label="Feeds Fuel to Alliance Zone"
                                value={activePhase.feedsFuelToAllianceZone ? 'Yes' : 'No'}
                            />
                            <DetailRow label="Plays Offense Only" value={activePhase.playsOffenseOnly ? 'Yes' : 'No'} />
                            <DetailRow
                                label="Some Defense While Active"
                                value={activePhase.playsSomeDefenseWhileActive ? 'Yes' : 'No'}
                            />
                        </DetailSection>

                        <DetailSection title="Inactive Phase Strategy">
                            <DetailRow label="Holds Fuel and Waits" value={inactivePhase.holdsFuelAndWaits ? 'Yes' : 'No'} />
                            <DetailRow
                                label="Feeds Fuel to Alliance Zone"
                                value={inactivePhase.feedsFuelToAllianceZone ? 'Yes' : 'No'}
                            />
                            <DetailRow
                                label="Collects from Neutral Zone"
                                value={inactivePhase.collectsFromNeutralZone ? 'Yes' : 'No'}
                            />
                            <DetailRow label="Plays Defense" value={inactivePhase.playsDefense ? 'Yes' : 'No'} />
                            <DetailRow
                                label="Still Shoots Anyway"
                                value={inactivePhase.stillShootsAnyway ? 'Yes' : 'No'}
                            />
                        </DetailSection>

                        <DetailSection title="Endgame + Reliability">
                            <DetailRow label="Attempted Climb" value={endgame.attemptedClimb ? 'Yes' : 'No'} />
                            <DetailRow label="Climb Level" value={endgame.climbLevelAchieved} />
                            <DetailRow label="Climb Success State" value={endgame.climbSuccessState} />
                            <DetailRow label="Time to Climb" value={`${endgame.timeToClimb}s`} />
                            <DetailRow label="Parked but No Climb" value={endgame.parkedButNoClimb ? 'Yes' : 'No'} />
                            <DetailRow label="Breakdown" value={endgame.breakdown ? 'Yes' : 'No'} />
                            <DetailRow label="Mobility Issues" value={endgame.mobilityIssues} />
                            <DetailRow label="Cards" value={endgame.cards.length > 0 ? endgame.cards.join(', ') : 'None'} />
                            {endgame.extraComments && <ExtraCommentsBox comments={endgame.extraComments} />}
                        </DetailSection>
                    </View>
                </ThemedScrollView>
            </ThemedView>
        </Modal>
    );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
    const colors = useThemeColors();
    return (
        <Card className="p-0">
            <View style={{ borderBottomColor: colors.border }} className="border-b px-4 py-3">
                <Text className="text-base font-semibold">{title}</Text>
            </View>
            <CardContent className="gap-0 px-4 py-1">{children}</CardContent>
        </Card>
    );
}

function DetailRow({ label, value }: { label: string; value: string }) {
    const colors = useThemeColors();
    const { scaleOption } = useUIScale();
    const stackRow = shouldStackForLargeScale(scaleOption);

    return (
        <View
            style={{ borderBottomColor: colors.border }}
            className={
                stackRow
                    ? 'gap-1 border-b py-2.5 last:border-b-0'
                    : 'flex-row items-center justify-between border-b py-2.5 last:border-b-0'
            }
        >
            <Text className="text-sm" style={{ color: colors.mutedForeground, flexShrink: 1 }}>
                {label}
            </Text>
            <Text
                className={stackRow ? 'text-sm font-medium' : 'text-sm font-medium text-right'}
                style={{ color: colors.foreground, flexShrink: 1 }}
            >
                {value}
            </Text>
        </View>
    );
}

function ExtraCommentsBox({ comments }: { comments: string }) {
    const colors = useThemeColors();
    return (
        <View style={{ backgroundColor: colors.secondaryElevated }} className="mt-2 rounded-md p-3">
            <Text className="text-sm font-medium" style={{ color: colors.mutedForeground }}>
                Comments
            </Text>
            <Text className="mt-1" style={{ color: colors.secondaryElevatedForeground }}>
                {comments}
            </Text>
        </View>
    );
}
