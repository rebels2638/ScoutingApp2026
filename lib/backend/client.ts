import { Account, Client, Databases, Functions } from 'react-native-appwrite';

import {
    getBackendConfig,
    getBackendConfigError,
} from './config';

const APPWRITE_SESSION_HEADER = 'X-Appwrite-Session';

interface AppwriteServices {
    client: Client;
    account: Account;
    databases: Databases;
    functions: Functions;
}

let cachedAppwriteServices: AppwriteServices | null = null;

function getAppwriteServices(): AppwriteServices | null {
    if (cachedAppwriteServices) {
        return cachedAppwriteServices;
    }

    const config = getBackendConfig();
    if (!config) {
        return null;
    }

    const client = new Client()
        .setEndpoint(config.endpoint)
        .setProject(config.projectId)
        .setPlatform(config.platformId);

    cachedAppwriteServices = {
        client,
        account: new Account(client),
        databases: new Databases(client),
        functions: new Functions(client),
    };

    return cachedAppwriteServices;
}

function requireAppwriteServices(): AppwriteServices {
    const services = getAppwriteServices();
    if (!services) {
        throw getBackendConfigError() ?? new Error('Appwrite backend configuration is unavailable.');
    }

    return services;
}

export function getAppwriteAccount(): Account {
    return requireAppwriteServices().account;
}

export function getAppwriteDatabases(): Databases {
    return requireAppwriteServices().databases;
}

export function getAppwriteFunctions(): Functions {
    return requireAppwriteServices().functions;
}

export function setAppwriteSessionHeader(session: string | null | undefined): void {
    const services = getAppwriteServices();
    if (!services) {
        return;
    }

    if (!session) {
        clearAppwriteSessionHeader();
        return;
    }

    services.client.setSession(session);
}

export function clearAppwriteSessionHeader(): void {
    const services = getAppwriteServices();
    if (!services) {
        return;
    }

    delete services.client.headers[APPWRITE_SESSION_HEADER];
    services.client.config.session = '';
}

export function getAppwriteSessionHeader(): string | null {
    const services = getAppwriteServices();
    if (!services) {
        return null;
    }

    const session = services.client.headers[APPWRITE_SESSION_HEADER];
    return typeof session === 'string' && session ? session : null;
}
