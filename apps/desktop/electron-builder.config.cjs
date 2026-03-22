const rootPackage = require('../../package.json')

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'com.durabull.desktop',
  productName: 'Durabull',
  icon: '../web/public/favicon-512x512.png',
  asar: true,
  directories: {
    output: 'release',
  },
  files: ['dist/main.js', 'package.json'],
  extraMetadata: {
    version: rootPackage.version,
  },
  extraResources: [
    {
      from: 'dist/app-bundle',
      to: 'app-bundle',
      filter: ['**/*'],
    },
    {
      from: 'dist/bin',
      to: 'bin',
      filter: ['**/*'],
    },
  ],
  mac: {
    category: 'public.app-category.developer-tools',
    target: ['dmg', 'zip'],
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'entitlements.mac.plist',
    entitlementsInherit: 'entitlements.mac.plist',
    notarize: process.env.APPLE_TEAM_ID
      ? { teamId: process.env.APPLE_TEAM_ID }
      : false,
  },
  win: {
    target: ['nsis', 'zip'],
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
  },
}
