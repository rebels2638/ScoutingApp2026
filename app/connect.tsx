import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { getActivationKeyValidationError, useBackendAuth } from '@/lib/backend/auth';
import { ThemedView } from '@/lib/theme';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ConnectScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { activateKey, continueAsGuest, isActivating, isBackendAvailable } = useBackendAuth();
    const [rawKey, setRawKey] = useState('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isContinuingGuest, setIsContinuingGuest] = useState(false);
    const trimmedKey = rawKey.trim();

    const handleActivate = async () => {
        const validationError = getActivationKeyValidationError(rawKey);
        if (validationError) {
            setErrorMessage(validationError);
            return;
        }

        setErrorMessage(null);

        const result = await activateKey(trimmedKey);
        if (!result.ok) {
            setErrorMessage(
                result.error === 'backend_unavailable'
                    ? 'Backend sync is unavailable on this build'
                    : result.error === 'invalid_key'
                        ? 'Invalid or inactive key'
                        : result.error === 'invalid_format'
                            ? 'Enter a valid key'
                            : result.error === 'rate_limited'
                                ? 'Wait a moment before trying again'
                                : 'Unable to activate key right now'
            );
            return;
        }

        setRawKey('');
        router.replace('/(tabs)');
    };

    const handleContinueWithoutKey = async () => {
        setErrorMessage(null);
        setIsContinuingGuest(true);

        try {
            await continueAsGuest();
            router.replace('/(tabs)');
        } finally {
            setIsContinuingGuest(false);
        }
    };

    return (
        <ThemedView
            style={{
                paddingTop: insets.top + 16,
                paddingBottom: insets.bottom + 16,
                paddingHorizontal: 16,
            }}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                className="flex-1 justify-center">
                <Card>
                    <CardHeader className="flex-col items-start gap-1">
                        <CardTitle>Optional backend mode</CardTitle>
                        <CardDescription>
                            {isBackendAvailable
                                ? 'Enter a API Key to enable sync scouting data and receive assignments.'
                                : 'Backend sync is unavailable on this build. Agath will keep running in local mode.'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Input
                            label="Backend Key"
                            value={rawKey}
                            onChangeText={(value) => {
                                setRawKey(value);
                                if (errorMessage) {
                                    setErrorMessage(null);
                                }
                            }}
                            autoCapitalize="none"
                            autoComplete="off"
                            autoCorrect={false}
                            importantForAutofill="no"
                            secureTextEntry
                            editable={isBackendAvailable && !isActivating && !isContinuingGuest}
                            error={errorMessage ?? undefined}
                            placeholder={isBackendAvailable ? 'Paste backend key' : 'Backend unavailable'}
                            textContentType="none"
                        />
                        <Button
                            disabled={!isBackendAvailable || isActivating || isContinuingGuest || trimmedKey.length === 0}
                            onPress={() => {
                                void handleActivate();
                            }}>
                            {!isBackendAvailable ? 'Backend unavailable' : isActivating ? 'Activating...' : 'Enable backend mode'}
                        </Button>
                        <Button
                            variant="outline"
                            disabled={isActivating || isContinuingGuest}
                            onPress={() => {
                                void handleContinueWithoutKey();
                            }}>
                            {isContinuingGuest ? 'Opening app...' : 'Use local mode'}
                        </Button>
                    </CardContent>
                </Card>
            </KeyboardAvoidingView>
        </ThemedView>
    );
}
