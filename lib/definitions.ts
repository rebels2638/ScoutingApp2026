export interface FieldDefinition {
    label: string;
    description: string;
    validation?: string;
}

export const matchMetadataDefinitions: Record<string, FieldDefinition> = {
    matchNumber: {
        label: 'Match Number',
        description: 'Match identifier.',
        validation: 'Min 1',
    },
    matchType: {
        label: 'Match Type',
        description: 'Match phase.',
        validation: 'Practice / Qualification / Playoff',
    },
    teamNumber: {
        label: 'Team Number',
        description: 'Team being scouted.',
        validation: '1–99999',
    },
    allianceColor: {
        label: 'Alliance Color',
        description: 'Alliance color for this match.',
        validation: 'Red / Blue',
    },
};

export const autonomousDefinitions: Record<string, FieldDefinition> = {
    preloadCount: {
        label: 'Auto: Preload Count',
        description: 'Number of FUEL visibly preloaded in the robot at match start.',
        validation: '0–8 (robot may preload up to 8 FUEL)',
    },
    leftStartingLine: {
        label: 'Auto: Taxis',
        description: 'Robot leaves its ROBOT STARTING LINE during AUTO.',
        validation: 'Yes/No',
    },
    crossedCenterLine: {
        label: 'Auto: Crossed CENTER LINE',
        description: "Yes if the robot's BUMPERS become completely across the white CENTER LINE at any point during AUTO (CENTER LINE bisects the NEUTRAL ZONE in half).",
        validation: 'Yes/No',
    },
    fuelScoredBucket: {
        label: 'Auto: Fuel Scored Bucket',
        description: 'Estimated count of FUEL that this robot scores during AUTO; "scored" means the FUEL passes through the HUB opening and through the sensor array.',
        validation: '0 / 1–3 / 4–8 / 9+',
    },
    climbResult: {
        label: 'Auto: Climb Result',
        description: 'AUTO climb result for this robot.',
        validation: 'None / Attempted (failed) / Level 1 success',
    },
    eligibleForAutoClimbPoints: {
        label: 'Auto: Eligible for Auto Climb Points?',
        description: 'Mark Yes only if this robot is one of the alliance robots clearly qualifying for AUTO climb scoring.',
        validation: 'Yes/No (max 2 robots can get AUTO Level 1 TOWER points)',
    },
    autoPath: {
        label: 'Auto Path',
        description: 'Sketch of auto movement/path.',
        validation: 'Optional',
    },
};

export const pitCalibrationDefinitions: Record<string, FieldDefinition> = {
    preloadFullnessReference: {
        label: 'Capacity: Preload Fullness Reference',
        description: 'With 8 preloaded FUEL, how full does their storage system look?',
        validation: 'About half / About three-quarters / Completely full',
    },
    maxObservedFuel: {
        label: 'Capacity: Max Observed FUEL at Once',
        description: 'Biggest amount of FUEL observed being carried/controlled at once (coarse range).',
        validation: '1–4 / 5–8 / 9–12 / 13–16 / 17+',
    },
};

export const teleopDefinitions: Record<string, FieldDefinition> = {
    scoringCyclesActive: {
        label: 'Teleop: Scoring Cycles (HUB Active)',
        description: 'Count cycles where the robot completes a collect-to-score action while its alliance HUB is active.',
        validation: 'Min 0 (each "acquire → shoot/dump while HUB active")',
    },
    wastedCyclesInactive: {
        label: 'Teleop: Wasted Cycles (HUB Inactive)',
        description: 'Count cycles where the robot shoots while its alliance HUB is inactive (0-point action).',
        validation: 'Min 0',
    },
    fuelShotsAttempted: {
        label: 'Teleop: Total FUEL Shots Attempted',
        description: 'Estimated total number of FUEL pieces launched/dumped during teleop (active and inactive HUB states).',
        validation: 'Min 0 (used for mechanical reliability)',
    },
    typicalFuelCarried: {
        label: 'Teleop: Typical FUEL Carried per Scoring Cycle',
        description: 'Typical amount carried on an active scoring cycle (use the preload fullness reference to calibrate).',
        validation: '1–4 / 5–8 / 9–12 / 13–16 / 17+',
    },
    primaryFuelSource: {
        label: 'Teleop: Primary Fuel Source',
        description: 'Main source location for collected FUEL.',
        validation: 'Neutral Zone / Depot / Outpost feed / Mixed',
    },
    usesTrenchRoutes: {
        label: 'Teleop: Uses TRENCH Routes',
        description: 'Uses the TRENCH as a major travel lane.',
        validation: 'Yes/No',
    },
    playsDefense: {
        label: 'Teleop: Plays Defense',
        description: 'Any deliberate defensive gameplay.',
        validation: 'Yes/No',
    },
};

export const activePhaseDefinitions: Record<string, FieldDefinition> = {
    feedsFuelToAllianceZone: {
        label: 'Active: Feeds Fuel to Alliance Zone',
        description: 'Helps partners by repositioning FUEL advantageously while their HUB is active.',
        validation: 'Yes/No (moves fuel into own zone while HUB active)',
    },
    playsOffenseOnly: {
        label: 'Active: Plays Offense Only',
        description: 'Stays focused on collecting/scoring rather than defense while active.',
        validation: 'Yes/No',
    },
    playsSomeDefenseWhileActive: {
        label: 'Active: Plays Some Defense While Active',
        description: 'Plays defense even during active windows.',
        validation: 'Yes/No',
    },
};

export const inactivePhaseDefinitions: Record<string, FieldDefinition> = {
    holdsFuelAndWaits: {
        label: 'Inactive: Holds Fuel and Waits',
        description: 'Stores FUEL and waits for next active window to score.',
        validation: 'Yes/No (keeps fuel for future active window)',
    },
    feedsFuelToAllianceZone: {
        label: 'Inactive: Feeds Fuel to Alliance Zone',
        description: 'Moves FUEL into better positions for partners while inactive.',
        validation: 'Yes/No',
    },
    collectsFromNeutralZone: {
        label: 'Inactive: Collects/Hoards from Neutral Zone',
        description: 'Uses inactive time to collect/prep FUEL.',
        validation: 'Yes/No',
    },
    playsDefense: {
        label: 'Inactive: Plays Defense',
        description: 'Primarily defends while inactive.',
        validation: 'Yes/No',
    },
    stillShootsAnyway: {
        label: 'Inactive: Still Shoots Anyway (Wastes)',
        description: 'Shoots into HUB while inactive (0-point action).',
        validation: 'Yes/No',
    },
};

export const endgameDefinitions: Record<string, FieldDefinition> = {
    attemptedClimb: {
        label: 'Endgame: Attempted Climb',
        description: 'Any clear attempt to climb during endgame.',
        validation: 'Yes/No',
    },
    climbLevelAchieved: {
        label: 'Endgame: Climb Level Achieved',
        description: 'Final achieved level at match end.',
        validation: 'None / Level 1 / Level 2 / Level 3',
    },
    climbSuccessState: {
        label: 'Endgame: Climb Success State',
        description: 'Quality/reliability of climb attempt.',
        validation: 'Success / Failed / Fell off / N/A',
    },
    timeToClimb: {
        label: 'Endgame: Time to Climb',
        description: 'Rough time spent committing to climb.',
        validation: '0–30 seconds (optional)',
    },
    parkedButNoClimb: {
        label: 'Endgame: Parked but No Climb',
        description: 'Parked/positioned but no climb attempt.',
        validation: 'Yes/No (optional)',
    },
    breakdown: {
        label: 'Breakdown',
        description: 'Robot breaks / becomes mostly non-functional.',
        validation: 'Yes/No',
    },
    mobilityIssues: {
        label: 'Mobility Issues',
        description: 'Major mobility problems observed.',
        validation: 'None / Brownout-ish / Tipped / Stuck / Other',
    },
    cards: {
        label: 'Cards',
        description: 'If shown on the match results display.',
        validation: 'None / Yellow / Red (multi-select)',
    },
    extraComments: {
        label: 'Extra Comments',
        description: 'Anything unusual.',
        validation: 'Optional freeform notes',
    },
};
