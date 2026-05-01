declare const __DURABULL_APP_VERSION__: string | undefined
declare const __DURABULL_BUILD_ID__: string | undefined
declare const __DURABULL_BUILD_TIME__: string | null | undefined

function readDefinedString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

export const APP_BUILD_INFO = {
  version: readDefinedString(
    typeof __DURABULL_APP_VERSION__ === 'undefined' ? undefined : __DURABULL_APP_VERSION__,
    'unknown'
  ),
  buildId: readDefinedString(
    typeof __DURABULL_BUILD_ID__ === 'undefined' ? undefined : __DURABULL_BUILD_ID__,
    'unknown'
  ),
  buildTime:
    typeof __DURABULL_BUILD_TIME__ === 'string' && __DURABULL_BUILD_TIME__.trim()
      ? __DURABULL_BUILD_TIME__.trim()
      : null,
} as const
