import { toString as renderQrCodeToString, type QRCodeToStringOptions } from 'qrcode';
import type { ScoutingEntry } from './types';

const QR_TRANSFER_VERSION = 1;

const QR_RENDER_OPTIONS: QRCodeToStringOptions = {
    type: 'svg',
    errorCorrectionLevel: 'L',
    margin: 1,
    width: 512,
};

export const QR_COMMENTS_OMITTED_MESSAGE =
    'Comments were omitted because the full scouting record was too large for a single QR code.';

const INVALID_QR_TRANSFER_MESSAGE = 'This QR code does not contain valid Agath scouting data.';
const QR_TRANSFER_TOO_LARGE_MESSAGE =
    'This scouting entry is too large to fit in a single QR code, even without comments.';

type CompactMatchMetadata = [
    matchNumber: ScoutingEntry['matchMetadata']['matchNumber'],
    matchType: ScoutingEntry['matchMetadata']['matchType'],
    teamNumber: ScoutingEntry['matchMetadata']['teamNumber'],
    allianceColor: ScoutingEntry['matchMetadata']['allianceColor'],
];

type CompactAutonomousData = [
    preloadCount: ScoutingEntry['autonomous']['preloadCount'],
    leftStartingLine: ScoutingEntry['autonomous']['leftStartingLine'],
    crossedCenterLine: ScoutingEntry['autonomous']['crossedCenterLine'],
    fuelScoredBucket: ScoutingEntry['autonomous']['fuelScoredBucket'],
    climbResult: ScoutingEntry['autonomous']['climbResult'],
    eligibleForAutoClimbPoints: ScoutingEntry['autonomous']['eligibleForAutoClimbPoints'],
    autoPath: NonNullable<ScoutingEntry['autonomous']['autoPath']> | null,
];

type CompactTeleopData = [
    scoringCyclesActive: ScoutingEntry['teleop']['scoringCyclesActive'],
    wastedCyclesInactive: ScoutingEntry['teleop']['wastedCyclesInactive'],
    fuelShotsAttempted: NonNullable<ScoutingEntry['teleop']['fuelShotsAttempted']>,
    typicalFuelCarried: ScoutingEntry['teleop']['typicalFuelCarried'],
    primaryFuelSource: ScoutingEntry['teleop']['primaryFuelSource'],
    usesTrenchRoutes: ScoutingEntry['teleop']['usesTrenchRoutes'],
    playsDefense: ScoutingEntry['teleop']['playsDefense'],
];

type CompactActivePhaseData = [
    feedsFuelToAllianceZone: ScoutingEntry['activePhase']['feedsFuelToAllianceZone'],
    playsOffenseOnly: ScoutingEntry['activePhase']['playsOffenseOnly'],
    playsSomeDefenseWhileActive: ScoutingEntry['activePhase']['playsSomeDefenseWhileActive'],
];

type CompactInactivePhaseData = [
    holdsFuelAndWaits: ScoutingEntry['inactivePhase']['holdsFuelAndWaits'],
    feedsFuelToAllianceZone: ScoutingEntry['inactivePhase']['feedsFuelToAllianceZone'],
    collectsFromNeutralZone: ScoutingEntry['inactivePhase']['collectsFromNeutralZone'],
    playsDefense: ScoutingEntry['inactivePhase']['playsDefense'],
    stillShootsAnyway: ScoutingEntry['inactivePhase']['stillShootsAnyway'],
];

type CompactEndgameData = [
    attemptedClimb: ScoutingEntry['endgame']['attemptedClimb'],
    climbLevelAchieved: ScoutingEntry['endgame']['climbLevelAchieved'],
    climbSuccessState: ScoutingEntry['endgame']['climbSuccessState'],
    timeToClimb: ScoutingEntry['endgame']['timeToClimb'],
    parkedButNoClimb: ScoutingEntry['endgame']['parkedButNoClimb'],
    breakdown: ScoutingEntry['endgame']['breakdown'],
    mobilityIssues: ScoutingEntry['endgame']['mobilityIssues'],
    cards: ScoutingEntry['endgame']['cards'],
    extraComments: ScoutingEntry['endgame']['extraComments'],
];

interface CompactScoutingEntry {
    i: string;
    t: number;
    m: CompactMatchMetadata;
    a: CompactAutonomousData;
    p: CompactTeleopData;
    x: CompactActivePhaseData;
    n: CompactInactivePhaseData;
    g: CompactEndgameData;
}

interface ScoutingEntryQrPayload {
    v: typeof QR_TRANSFER_VERSION;
    c: 0 | 1;
    e: CompactScoutingEntry;
}

type UnknownRecord = Record<string, unknown>;

export interface ScoutingEntryQrExportResult {
    qrSvg: string;
    commentsIncluded: boolean;
}

export interface ScoutingEntryQrImportResult {
    entry: ScoutingEntry;
    commentsIncluded: boolean;
}

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function isNullableFiniteNumber(value: unknown): value is number | null {
    return value === null || isFiniteNumber(value);
}

function isNullableString(value: unknown): value is string | null {
    return value === null || typeof value === 'string';
}

function isNullableBoolean(value: unknown): value is boolean | null {
    return value === null || typeof value === 'boolean';
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isCompactScoutingEntry(value: unknown): value is CompactScoutingEntry {
    if (
        !isRecord(value) ||
        typeof value.i !== 'string' ||
        !isFiniteNumber(value.t) ||
        !Array.isArray(value.m) ||
        !Array.isArray(value.a) ||
        !Array.isArray(value.p) ||
        !Array.isArray(value.x) ||
        !Array.isArray(value.n) ||
        !Array.isArray(value.g)
    ) {
        return false;
    }

    return (
        value.m.length === 4 &&
        isFiniteNumber(value.m[0]) &&
        typeof value.m[1] === 'string' &&
        isFiniteNumber(value.m[2]) &&
        typeof value.m[3] === 'string' &&
        value.a.length === 7 &&
        isNullableFiniteNumber(value.a[0]) &&
        typeof value.a[1] === 'boolean' &&
        typeof value.a[2] === 'boolean' &&
        typeof value.a[3] === 'string' &&
        typeof value.a[4] === 'string' &&
        typeof value.a[5] === 'boolean' &&
        isNullableString(value.a[6]) &&
        value.p.length === 7 &&
        isFiniteNumber(value.p[0]) &&
        isFiniteNumber(value.p[1]) &&
        isFiniteNumber(value.p[2]) &&
        isNullableString(value.p[3]) &&
        isNullableString(value.p[4]) &&
        isNullableBoolean(value.p[5]) &&
        typeof value.p[6] === 'boolean' &&
        value.x.length === 3 &&
        typeof value.x[0] === 'boolean' &&
        typeof value.x[1] === 'boolean' &&
        typeof value.x[2] === 'boolean' &&
        value.n.length === 5 &&
        typeof value.n[0] === 'boolean' &&
        typeof value.n[1] === 'boolean' &&
        typeof value.n[2] === 'boolean' &&
        typeof value.n[3] === 'boolean' &&
        typeof value.n[4] === 'boolean' &&
        value.g.length === 9 &&
        typeof value.g[0] === 'boolean' &&
        typeof value.g[1] === 'string' &&
        typeof value.g[2] === 'string' &&
        isFiniteNumber(value.g[3]) &&
        typeof value.g[4] === 'boolean' &&
        typeof value.g[5] === 'boolean' &&
        typeof value.g[6] === 'string' &&
        isStringArray(value.g[7]) &&
        typeof value.g[8] === 'string'
    );
}

function isScoutingEntryQrPayload(value: unknown): value is ScoutingEntryQrPayload {
    return (
        isRecord(value) &&
        value.v === QR_TRANSFER_VERSION &&
        (value.c === 0 || value.c === 1) &&
        isCompactScoutingEntry(value.e)
    );
}

function isQrCapacityError(error: unknown): boolean {
    return error instanceof Error &&
        /amount of data is too big|cannot contain this amount of data/i.test(error.message);
}

function createCompactScoutingEntry(
    entry: ScoutingEntry,
    commentsIncluded: boolean
): CompactScoutingEntry {
    return {
        i: entry.id,
        t: entry.timestamp,
        m: [
            entry.matchMetadata.matchNumber,
            entry.matchMetadata.matchType,
            entry.matchMetadata.teamNumber,
            entry.matchMetadata.allianceColor,
        ],
        a: [
            entry.autonomous.preloadCount,
            entry.autonomous.leftStartingLine,
            entry.autonomous.crossedCenterLine,
            entry.autonomous.fuelScoredBucket,
            entry.autonomous.climbResult,
            entry.autonomous.eligibleForAutoClimbPoints,
            entry.autonomous.autoPath ?? null,
        ],
        p: [
            entry.teleop.scoringCyclesActive,
            entry.teleop.wastedCyclesInactive,
            entry.teleop.fuelShotsAttempted ?? 0,
            entry.teleop.typicalFuelCarried,
            entry.teleop.primaryFuelSource,
            entry.teleop.usesTrenchRoutes,
            entry.teleop.playsDefense,
        ],
        x: [
            entry.activePhase.feedsFuelToAllianceZone,
            entry.activePhase.playsOffenseOnly,
            entry.activePhase.playsSomeDefenseWhileActive,
        ],
        n: [
            entry.inactivePhase.holdsFuelAndWaits,
            entry.inactivePhase.feedsFuelToAllianceZone,
            entry.inactivePhase.collectsFromNeutralZone,
            entry.inactivePhase.playsDefense,
            entry.inactivePhase.stillShootsAnyway,
        ],
        g: [
            entry.endgame.attemptedClimb,
            entry.endgame.climbLevelAchieved,
            entry.endgame.climbSuccessState,
            entry.endgame.timeToClimb,
            entry.endgame.parkedButNoClimb,
            entry.endgame.breakdown,
            entry.endgame.mobilityIssues,
            entry.endgame.cards,
            commentsIncluded ? entry.endgame.extraComments : '',
        ],
    };
}

function createQrPayload(entry: ScoutingEntry, commentsIncluded: boolean): ScoutingEntryQrPayload {
    return {
        v: QR_TRANSFER_VERSION,
        c: commentsIncluded ? 1 : 0,
        e: createCompactScoutingEntry(entry, commentsIncluded),
    };
}

function decodeCompactScoutingEntry(
    compactEntry: CompactScoutingEntry,
    commentsIncluded: boolean
): ScoutingEntry {
    return {
        id: compactEntry.i,
        timestamp: compactEntry.t,
        syncStatus: 'local',
        syncedAt: null,
        matchMetadata: {
            matchNumber: compactEntry.m[0],
            matchType: compactEntry.m[1],
            teamNumber: compactEntry.m[2],
            allianceColor: compactEntry.m[3],
        },
        autonomous: {
            preloadCount: compactEntry.a[0],
            leftStartingLine: compactEntry.a[1],
            crossedCenterLine: compactEntry.a[2],
            fuelScoredBucket: compactEntry.a[3],
            climbResult: compactEntry.a[4],
            eligibleForAutoClimbPoints: compactEntry.a[5],
            ...(compactEntry.a[6] ? { autoPath: compactEntry.a[6] } : {}),
        },
        teleop: {
            scoringCyclesActive: compactEntry.p[0],
            wastedCyclesInactive: compactEntry.p[1],
            fuelShotsAttempted: compactEntry.p[2],
            typicalFuelCarried: compactEntry.p[3],
            primaryFuelSource: compactEntry.p[4],
            usesTrenchRoutes: compactEntry.p[5],
            playsDefense: compactEntry.p[6],
        },
        activePhase: {
            feedsFuelToAllianceZone: compactEntry.x[0],
            playsOffenseOnly: compactEntry.x[1],
            playsSomeDefenseWhileActive: compactEntry.x[2],
        },
        inactivePhase: {
            holdsFuelAndWaits: compactEntry.n[0],
            feedsFuelToAllianceZone: compactEntry.n[1],
            collectsFromNeutralZone: compactEntry.n[2],
            playsDefense: compactEntry.n[3],
            stillShootsAnyway: compactEntry.n[4],
        },
        endgame: {
            attemptedClimb: compactEntry.g[0],
            climbLevelAchieved: compactEntry.g[1],
            climbSuccessState: compactEntry.g[2],
            timeToClimb: compactEntry.g[3],
            parkedButNoClimb: compactEntry.g[4],
            breakdown: compactEntry.g[5],
            mobilityIssues: compactEntry.g[6],
            cards: compactEntry.g[7],
            extraComments: commentsIncluded ? compactEntry.g[8] : '',
        },
    };
}

async function renderQrPayload(payload: ScoutingEntryQrPayload): Promise<string> {
    return renderQrCodeToString(JSON.stringify(payload), QR_RENDER_OPTIONS);
}

export async function prepareScoutingEntryQrExport(
    entry: ScoutingEntry
): Promise<ScoutingEntryQrExportResult> {
    try {
        const qrSvg = await renderQrPayload(createQrPayload(entry, true));
        return {
            qrSvg,
            commentsIncluded: true,
        };
    } catch (error) {
        if (!isQrCapacityError(error) || entry.endgame.extraComments.trim().length === 0) {
            throw error;
        }
    }

    try {
        const qrSvg = await renderQrPayload(createQrPayload(entry, false));
        return {
            qrSvg,
            commentsIncluded: false,
        };
    } catch (error) {
        if (isQrCapacityError(error)) {
            throw new Error(QR_TRANSFER_TOO_LARGE_MESSAGE);
        }

        throw error;
    }
}

export function parseScoutingEntryQrPayload(rawData: string): ScoutingEntryQrImportResult {
    let parsedPayload: unknown;

    try {
        parsedPayload = JSON.parse(rawData);
    } catch {
        throw new Error(INVALID_QR_TRANSFER_MESSAGE);
    }

    if (!isScoutingEntryQrPayload(parsedPayload)) {
        throw new Error(INVALID_QR_TRANSFER_MESSAGE);
    }

    return {
        entry: decodeCompactScoutingEntry(parsedPayload.e, parsedPayload.c === 1),
        commentsIncluded: parsedPayload.c === 1,
    };
}
