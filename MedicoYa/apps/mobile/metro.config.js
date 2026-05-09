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

// Force single React 19 instance — prevents dual-React crash with monorepo root React 18
const reactPath = path.resolve(projectRoot, 'node_modules', 'react')
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react' ||
      moduleName === 'react/jsx-runtime' ||
      moduleName === 'react/jsx-dev-runtime' ||
      moduleName === 'react/compiler-runtime') {
    const filePath = require.resolve(moduleName, { paths: [reactPath + '/..'] })
    return { filePath, type: 'sourceFile' }
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
