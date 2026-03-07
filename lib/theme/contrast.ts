export function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return { r, g, b };
}

export function rgbToHex(r: number, g: number, b: number): string {
    const toHex = (n: number) => {
        const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function getLuminance(hex: string): number {
    const { r, g, b } = hexToRgb(hex);

    const sRGB = [r, g, b].map((c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
}

export function getContrastRatio(foreground: string, background: string): number {
    const lum1 = getLuminance(foreground);
    const lum2 = getLuminance(background);
    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);
    return (lighter + 0.05) / (darker + 0.05);
}

export function isDarkColor(hex: string): boolean {
    return getLuminance(hex) < 0.5;
}

export function lightenColor(hex: string, percent: number): string {
    const { r, g, b } = hexToRgb(hex);
    const amount = (percent / 100) * 255;
    return rgbToHex(r + amount, g + amount, b + amount);
}

export function darkenColor(hex: string, percent: number): string {
    const { r, g, b } = hexToRgb(hex);
    const factor = 1 - percent / 100;
    return rgbToHex(r * factor, g * factor, b * factor);
}

export function ensureContrast(
    foreground: string,
    background: string,
    minRatio: number = 4.5
): string {
    let current = foreground;
    let currentRatio = getContrastRatio(current, background);

    if (currentRatio >= minRatio) {
        return current;
    }

    const bgIsDark = isDarkColor(background);

    for (let i = 0; i < 20; i++) {
        if (bgIsDark) {
            current = lightenColor(current, 10);
        } else {
            current = darkenColor(current, 10);
        }
        currentRatio = getContrastRatio(current, background);
        if (currentRatio >= minRatio) {
            break;
        }
    }

    return current;
}

export function getContrastingForeground(
    background: string,
    lightColor: string = '#FFFFFF',
    darkColor: string = '#000000'
): string {
    const lightRatio = getContrastRatio(lightColor, background);
    const darkRatio = getContrastRatio(darkColor, background);
    return lightRatio > darkRatio ? lightColor : darkColor;
}

export function meetsWcagAA(
    foreground: string,
    background: string,
    isLargeText: boolean = false
): boolean {
    const ratio = getContrastRatio(foreground, background);
    return isLargeText ? ratio >= 3 : ratio >= 4.5;
}

export function mixColors(color1: string, color2: string, weight: number = 0.5): string {
    const c1 = hexToRgb(color1);
    const c2 = hexToRgb(color2);

    const r = c1.r * weight + c2.r * (1 - weight);
    const g = c1.g * weight + c2.g * (1 - weight);
    const b = c1.b * weight + c2.b * (1 - weight);

    return rgbToHex(r, g, b);
}
