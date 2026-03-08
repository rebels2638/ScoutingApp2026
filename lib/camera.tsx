import {
    createPermissionHook,
    requireNativeModule,
    requireNativeViewManager,
    type PermissionResponse,
} from 'expo-modules-core';
import React from 'react';
import type { ViewProps } from 'react-native';

export type CameraType = 'front' | 'back';
export type FlashMode = 'off' | 'on' | 'auto';
export type FocusMode = 'on' | 'off';
export type BarcodeType =
    | 'aztec'
    | 'ean13'
    | 'ean8'
    | 'qr'
    | 'pdf417'
    | 'upc_e'
    | 'datamatrix'
    | 'code39'
    | 'code93'
    | 'itf14'
    | 'codabar'
    | 'code128'
    | 'upc_a';

interface Point {
    x: number;
    y: number;
}

interface BarcodeBounds {
    origin: Point;
    size: {
        width: number;
        height: number;
    };
}

export interface BarcodeScanningResult {
    type: string;
    data: string;
    raw?: string;
    cornerPoints: Point[];
    bounds: BarcodeBounds;
}

export interface CameraMountError {
    message: string;
}

interface BarcodeScannerSettings {
    barcodeTypes: BarcodeType[];
}

interface NativeCameraModule {
    getCameraPermissionsAsync(): Promise<PermissionResponse>;
    requestCameraPermissionsAsync(): Promise<PermissionResponse>;
}

interface NativeCameraViewProps extends ViewProps {
    facing?: CameraType;
    flashMode?: FlashMode;
    autoFocus?: FocusMode;
    mute?: boolean;
    enableTorch?: boolean;
    barcodeScannerEnabled?: boolean;
    barcodeScannerSettings?: BarcodeScannerSettings;
    onMountError?: (event: { nativeEvent: CameraMountError }) => void;
    onBarcodeScanned?: (event: { nativeEvent: BarcodeScanningResult }) => void;
}

export interface CameraViewProps extends ViewProps {
    facing?: CameraType;
    flash?: FlashMode;
    autofocus?: FocusMode;
    mute?: boolean;
    enableTorch?: boolean;
    barcodeScannerSettings?: BarcodeScannerSettings;
    onMountError?: (error: CameraMountError) => void;
    onBarcodeScanned?: (result: BarcodeScanningResult) => void;
}

const CameraModule = requireNativeModule<NativeCameraModule>('ExpoCamera');
const NativeCameraView = requireNativeViewManager('ExpoCamera') as React.ComponentType<NativeCameraViewProps>;

async function getCameraPermissionsAsync(): Promise<PermissionResponse> {
    return CameraModule.getCameraPermissionsAsync();
}

async function requestCameraPermissionsAsync(): Promise<PermissionResponse> {
    return CameraModule.requestCameraPermissionsAsync();
}

export const useCameraPermissions = createPermissionHook({
    getMethod: getCameraPermissionsAsync,
    requestMethod: requestCameraPermissionsAsync,
});

export function CameraView({
    flash = 'off',
    autofocus = 'off',
    mute = false,
    onMountError,
    onBarcodeScanned,
    ...props
}: CameraViewProps) {
    const handleMountError = React.useCallback((event: { nativeEvent: CameraMountError }) => {
        onMountError?.(event.nativeEvent);
    }, [onMountError]);

    const handleBarcodeScanned = React.useCallback((event: { nativeEvent: BarcodeScanningResult }) => {
        onBarcodeScanned?.(event.nativeEvent);
    }, [onBarcodeScanned]);

    return (
        <NativeCameraView
            {...props}
            flashMode={flash}
            autoFocus={autofocus}
            mute={mute}
            barcodeScannerEnabled={!!onBarcodeScanned}
            onMountError={onMountError ? handleMountError : undefined}
            onBarcodeScanned={onBarcodeScanned ? handleBarcodeScanned : undefined}
        />
    );
}
