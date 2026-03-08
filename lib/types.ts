export type MatchType = 'Practice' | 'Qualification' | 'Playoff';
export type AllianceColor = 'Red' | 'Blue';
export type FuelScoredBucket = '0' | '1-3' | '4-8' | '9+';
export type AutoClimbResult = 'None' | 'Attempted (failed)' | 'Level 1 success';
export type PreloadFullnessReference = 'About half' | 'About three-quarters' | 'Completely full';
export type FuelRange = '1-4' | '5-8' | '9-12' | '13-16' | '17+';
export type PrimaryFuelSource = 'Neutral Zone' | 'Depot' | 'Outpost feed' | 'Mixed';
export type ClimbLevel = 'None' | 'Level 1' | 'Level 2' | 'Level 3';
export type ClimbSuccessState = 'Success' | 'Failed' | 'Fell off' | 'N/A';
export type MobilityIssue = 'None' | 'Brownout-ish' | 'Tipped' | 'Stuck' | 'Other';
export type Card = 'None' | 'Yellow' | 'Red';
export type DrivetrainType = 'Swerve' | 'West Coast' | 'Mecanum' | 'Tank' | 'Other';
export type ScoutingEntrySyncStatus = 'local' | 'queued' | 'synced';

export interface MatchMetadata {
    matchNumber: number;
    matchType: MatchType;
    teamNumber: number;
    allianceColor: AllianceColor;
}

export interface AutonomousData {
    preloadCount: number | null;
    leftStartingLine: boolean;
    crossedCenterLine: boolean;
    fuelScoredBucket: FuelScoredBucket;
    climbResult: AutoClimbResult;
    eligibleForAutoClimbPoints: boolean;
    autoPath?: string;
}

export interface PitCalibrationData {
    preloadFullnessReference: PreloadFullnessReference;
    maxObservedFuel: FuelRange;
}

export interface TeleopData {
    scoringCyclesActive: number;
    wastedCyclesInactive: number;
    fuelShotsAttempted?: number;
    typicalFuelCarried: FuelRange | null;
    primaryFuelSource: PrimaryFuelSource | null;
    usesTrenchRoutes: boolean | null;
    playsDefense: boolean;
}

export interface ActivePhaseData {
    feedsFuelToAllianceZone: boolean;
    playsOffenseOnly: boolean;
    playsSomeDefenseWhileActive: boolean;
}

export interface InactivePhaseData {
    holdsFuelAndWaits: boolean;
    feedsFuelToAllianceZone: boolean;
    collectsFromNeutralZone: boolean;
    playsDefense: boolean;
    stillShootsAnyway: boolean;
}

export interface EndgameData {
    attemptedClimb: boolean;
    climbLevelAchieved: ClimbLevel;
    climbSuccessState: ClimbSuccessState;
    timeToClimb: number;
    parkedButNoClimb: boolean;
    breakdown: boolean;
    mobilityIssues: MobilityIssue;
    cards: Card[];
    extraComments: string;
}

export interface ScoutingEntry {
    id: string;
    timestamp: number;
    syncStatus?: ScoutingEntrySyncStatus;
    syncedAt?: number | null;
    matchMetadata: MatchMetadata;
    autonomous: AutonomousData;
    teleop: TeleopData;
    activePhase: ActivePhaseData;
    inactivePhase: InactivePhaseData;
    endgame: EndgameData;
}

export interface PitScoutingEntry {
    id: string;
    timestamp: number;
    teamNumber: number;
    calibration: PitCalibrationData;
}

export function createDefaultScoutingEntry(): Omit<
    ScoutingEntry,
    'id' | 'timestamp' | 'syncStatus' | 'syncedAt'
> {
    return {
        matchMetadata: {
            matchNumber: 1,
            matchType: 'Qualification',
            teamNumber: 0,
            allianceColor: 'Red',
        },
        autonomous: {
            preloadCount: 0,
            leftStartingLine: false,
            crossedCenterLine: false,
            fuelScoredBucket: '0',
            climbResult: 'None',
            eligibleForAutoClimbPoints: false,
        },
        teleop: {
            scoringCyclesActive: 0,
            wastedCyclesInactive: 0,
            fuelShotsAttempted: 0,
            typicalFuelCarried: '1-4',
            primaryFuelSource: 'Neutral Zone',
            usesTrenchRoutes: false,
            playsDefense: false,
        },
        activePhase: {
            feedsFuelToAllianceZone: false,
            playsOffenseOnly: false,
            playsSomeDefenseWhileActive: false,
        },
        inactivePhase: {
            holdsFuelAndWaits: false,
            feedsFuelToAllianceZone: false,
            collectsFromNeutralZone: false,
            playsDefense: false,
            stillShootsAnyway: false,
        },
        endgame: {
            attemptedClimb: false,
            climbLevelAchieved: 'None',
            climbSuccessState: 'N/A',
            timeToClimb: 0,
            parkedButNoClimb: false,
            breakdown: false,
            mobilityIssues: 'None',
            cards: [],
            extraComments: '',
        },
    };
}
