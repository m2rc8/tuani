const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [monorepoRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
]

// Force single instance of packages that register native views — prevents duplicate registration crash
const DEDUPE = ['react', 'react-native-svg']
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const base = moduleName.split('/')[0]
  if (DEDUPE.includes(base) || DEDUPE.some(p => moduleName === p || moduleName.startsWith(p + '/'))) {
    const filePath = require.resolve(moduleName, { paths: [path.resolve(projectRoot, 'node_modules')] })
    return { filePath, type: 'sourceFile' }
  }
  return context.resolveRequest(context, moduleName, platform)
}

// react-native-qrcode-svg ships ESM — must be transformed by Babel
const defaultTransformIgnore = config.transformer?.transformIgnorePatterns?.[0] ??
  'node_modules/(?!(react-native|@react-native|expo|@expo|@unimodules|react-navigation|@react-navigation)/)'
config.transformer = {
  ...config.transformer,
  transformIgnorePatterns: [
    defaultTransformIgnore.replace(
      'node_modules/(?!(',
      'node_modules/(?!(react-native-qrcode-svg|react-native-svg|'
    ),
  ],
}

module.exports = config
