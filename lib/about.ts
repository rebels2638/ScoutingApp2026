export interface AboutDeveloper {
    name: string;
    role: string;
    url?: string;
}

export interface OpenSourceNotice {
    name: string;
    license: string;
}

export const APP_DESCRIPTION = 'A scouting app designed for the FRC 2026 game, Rebuilt.';
export const APP_TEAM_NAME = 'Built by FRC Team 2638';
export const APP_REPOSITORY_URL = 'https://github.com/rebels2638/ScoutingApp2026';
export const APP_ISSUES_URL = 'https://github.com/rebels2638/ScoutingApp2026/issues';
export const APP_LICENSE_NAME = 'GNU GPL v3.0';
export const APP_LICENSE_URL = 'https://www.gnu.org/licenses/gpl-3.0.en.html';
export const APP_LICENSE_SUMMARY = 'Agath is open source under the GNU GPL v3.0. You may use, study, share, and modify it, but redistributed versions must keep the same license and provide source code. The app is provided without warranty.';

export const APP_DEVELOPERS: AboutDeveloper[] = [
    {
        name: 'Ethan Kang',
        role: 'Lead Developer',
        url: 'https://github.com/EthanDevCode',
    },
]; 

export const OPEN_SOURCE_PACKAGES: OpenSourceNotice[] = [
    { name: '@expo/vector-icons', license: 'MIT' },
    { name: '@react-native-async-storage/async-storage', license: 'MIT' },
    { name: '@react-navigation/native', license: 'MIT' },
    { name: 'class-variance-authority', license: 'Apache-2.0' },
    { name: 'clsx', license: 'MIT' },
    { name: 'expo', license: 'MIT' },
    { name: 'expo-camera', license: 'MIT' },
    { name: 'expo-constants', license: 'MIT' },
    { name: 'expo-crypto', license: 'MIT' },
    { name: 'expo-document-picker', license: 'MIT' },
    { name: 'expo-file-system', license: 'MIT' },
    { name: 'expo-font', license: 'MIT' },
    { name: 'expo-linking', license: 'MIT' },
    { name: 'expo-router', license: 'MIT' },
    { name: 'expo-screen-orientation', license: 'MIT' },
    { name: 'expo-secure-store', license: 'MIT' },
    { name: 'expo-sharing', license: 'MIT' },
    { name: 'expo-splash-screen', license: 'MIT' },
    { name: 'expo-status-bar', license: 'MIT' },
    { name: 'expo-web-browser', license: 'MIT' },
    { name: 'lucide-react-native', license: 'ISC' },
    { name: 'nativewind', license: 'MIT' },
    { name: 'qrcode', license: 'MIT' },
    { name: 'react', license: 'MIT' },
    { name: 'react-dom', license: 'MIT' },
    { name: 'react-native', license: 'MIT' },
    { name: 'react-native-appwrite', license: 'BSD-3-Clause' },
    { name: 'react-native-reanimated', license: 'MIT' },
    { name: 'react-native-safe-area-context', license: 'MIT' },
    { name: 'react-native-screens', license: 'MIT' },
    { name: 'react-native-svg', license: 'MIT' },
    { name: 'react-native-url-polyfill', license: 'MIT' },
    { name: 'react-native-web', license: 'MIT' },
    { name: 'react-native-worklets', license: 'MIT' },
    { name: 'tailwind-merge', license: 'MIT' },
    { name: 'tailwindcss', license: 'MIT' },
];