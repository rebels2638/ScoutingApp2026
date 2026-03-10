export const ONE_MINUTE_COOLDOWN_MS = 60 * 1000;

export function getCooldownRemainingMs(
    lastAttemptAt: number,
    cooldownMs: number,
    now = Date.now()
): number {
    return Math.max(0, cooldownMs - (now - lastAttemptAt));
}
