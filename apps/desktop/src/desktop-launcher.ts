import { join } from 'node:path'

export const DESKTOP_RESOURCE_ROOT_ENV = 'DURABULL_DESKTOP_RESOURCE_ROOT'

export function resolveDesktopResourceRoot({
  appPath,
  envRoot,
  isPackaged,
  resourcesPath,
}: {
  appPath: string
  envRoot?: string
  isPackaged: boolean
  resourcesPath: string
}): string {
  if (envRoot) {
    return envRoot
  }

  return isPackaged ? resourcesPath : join(appPath, 'dist')
}

export function getDesktopDevResourceRoot(desktopRoot: string): string {
  return join(desktopRoot, 'dist')
}

export function buildDesktopLauncherEnv(
  env: NodeJS.ProcessEnv,
  desktopRoot: string
): NodeJS.ProcessEnv {
  return {
    ...env,
    [DESKTOP_RESOURCE_ROOT_ENV]: getDesktopDevResourceRoot(desktopRoot),
  }
}

export function replacePlistString(contents: string, key: string, value: string): string {
  const pattern = new RegExp(`(<key>${key}</key>\\s*<string>)([^<]*)(</string>)`)

  if (!pattern.test(contents)) {
    throw new Error(`Unable to locate ${key} in the macOS app Info.plist.`)
  }

  return contents.replace(pattern, `$1${value}$3`)
}

export function brandMacAppBundlePlist(
  plistContents: string,
  { bundleId, productName }: { bundleId: string; productName: string }
): string {
  let updated = replacePlistString(plistContents, 'CFBundleDisplayName', productName)
  updated = replacePlistString(updated, 'CFBundleExecutable', productName)
  updated = replacePlistString(updated, 'CFBundleIdentifier', bundleId)
  updated = replacePlistString(updated, 'CFBundleName', productName)

  return updated
}
