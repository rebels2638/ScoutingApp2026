import * as Crypto from 'expo-crypto';

import { warnWithError } from '../error-utils';
import { deleteBackendDeviceId, getBackendDeviceId, setBackendDeviceId } from './secure';

export async function getInstallUuid(): Promise<string | null> {
    return getBackendDeviceId();
}

export async function getOrCreateInstallUuid(): Promise<string | null> {
    const existingInstallUuid = await getInstallUuid();
    if (existingInstallUuid) {
        return existingInstallUuid;
    }

    try {
        const installUuid = Crypto.randomUUID();
        await setBackendDeviceId(installUuid);
        return installUuid;
    } catch (error) {
        warnWithError('Failed to generate install UUID', error);
        return null;
    }
}

export async function clearInstallUuid(): Promise<void> {
    await deleteBackendDeviceId();
}
