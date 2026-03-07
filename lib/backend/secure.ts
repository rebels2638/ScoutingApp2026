import * as SecureStore from 'expo-secure-store';

import { warnWithError } from '../error-utils';
import {
    BACKEND_AUTH_MODES,
    BACKEND_SECURE_STORE_AUTH_MODE_KEY,
    BACKEND_SECURE_STORE_DEVICE_ID_KEY,
    BACKEND_SECURE_STORE_GUEST_KEY,
    BACKEND_SECURE_STORE_SESSION_KEY,
    BACKEND_SECURE_STORE_USER_ID_KEY,
    type BackendAuthMode,
} from './config';

const backendAuthModes = new Set<string>(BACKEND_AUTH_MODES);

async function getSecureValue(key: string): Promise<string | null> {
    try {
        return await SecureStore.getItemAsync(key);
    } catch (error) {
        warnWithError('Failed to read secure storage', error);
        return null;
    }
}

async function setSecureValue(key: string, value: string | null): Promise<void> {
    if (!value) {
        await deleteSecureValue(key);
        return;
    }

    await SecureStore.setItemAsync(key, value);
}

async function deleteSecureValue(key: string): Promise<void> {
    try {
        await SecureStore.deleteItemAsync(key);
    } catch (error) {
        warnWithError('Failed to clear secure storage', error);
    }
}

export async function getBackendSession(): Promise<string | null> {
    return getSecureValue(BACKEND_SECURE_STORE_SESSION_KEY);
}

export async function setBackendSession(session: string | null): Promise<void> {
    await setSecureValue(BACKEND_SECURE_STORE_SESSION_KEY, session);
}

export async function deleteBackendSession(): Promise<void> {
    await deleteSecureValue(BACKEND_SECURE_STORE_SESSION_KEY);
}

export async function getBackendUserId(): Promise<string | null> {
    return getSecureValue(BACKEND_SECURE_STORE_USER_ID_KEY);
}

export async function setBackendUserId(userId: string | null): Promise<void> {
    await setSecureValue(BACKEND_SECURE_STORE_USER_ID_KEY, userId);
}

export async function deleteBackendUserId(): Promise<void> {
    await deleteSecureValue(BACKEND_SECURE_STORE_USER_ID_KEY);
}

export async function getBackendGuestKey(): Promise<string | null> {
    return getSecureValue(BACKEND_SECURE_STORE_GUEST_KEY);
}

export async function setBackendGuestKey(guestKey: string | null): Promise<void> {
    await setSecureValue(BACKEND_SECURE_STORE_GUEST_KEY, guestKey);
}

export async function deleteBackendGuestKey(): Promise<void> {
    await deleteSecureValue(BACKEND_SECURE_STORE_GUEST_KEY);
}

export async function getBackendDeviceId(): Promise<string | null> {
    return getSecureValue(BACKEND_SECURE_STORE_DEVICE_ID_KEY);
}

export async function setBackendDeviceId(deviceId: string | null): Promise<void> {
    await setSecureValue(BACKEND_SECURE_STORE_DEVICE_ID_KEY, deviceId);
}

export async function deleteBackendDeviceId(): Promise<void> {
    await deleteSecureValue(BACKEND_SECURE_STORE_DEVICE_ID_KEY);
}

export async function getBackendAuthMode(): Promise<BackendAuthMode | null> {
    const authMode = await getSecureValue(BACKEND_SECURE_STORE_AUTH_MODE_KEY);
    if (!authMode || !backendAuthModes.has(authMode)) {
        return null;
    }

    return authMode as BackendAuthMode;
}

export async function setBackendAuthMode(authMode: BackendAuthMode | null): Promise<void> {
    await setSecureValue(BACKEND_SECURE_STORE_AUTH_MODE_KEY, authMode);
}

export async function deleteBackendAuthMode(): Promise<void> {
    await deleteSecureValue(BACKEND_SECURE_STORE_AUTH_MODE_KEY);
}
