// This resolver helps TypeScript understand how to resolve ES modules

// Suppress all warnings except critical ones
process.removeAllListeners('warning')
process.on('warning', (warning) => {
  // Only show critical warnings
  if (warning.name === 'FatalError') {
    console.warn(warning)
  }
})

// Disable debug logging
process.env.DEBUG = ''
process.env.NODE_DEBUG = ''

import { register } from 'node:module'
import { resolve as resolveTs } from 'ts-node/esm'
import * as tsConfigPaths from 'tsconfig-paths'
import { pathToFileURL, fileURLToPath } from 'url'
import { resolve as resolvePath, dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load the paths from tsconfig.json
const configLoaderResult = tsConfigPaths.loadConfig(resolvePath(__dirname, 'tsconfig.json'))
const matchPath = configLoaderResult.resultType === 'success' 
  ? tsConfigPaths.createMatchPath(configLoaderResult.absoluteBaseUrl, configLoaderResult.paths)
  : null

const { load: tsLoad, getFormat: tsGetFormat, transformSource: tsTransformSource } = resolveTs

const hook = {
  resolve(specifier, context, nextResolve) {
    // Convert relative paths to absolute file URLs
    if (specifier.startsWith('./') || specifier.startsWith('../')) {
      const resolvedPath = resolvePath(dirname(fileURLToPath(context.parentURL || import.meta.url)), specifier)
      return nextResolve(pathToFileURL(resolvedPath).href)
    }
    
    // Handle webpack runtime imports
    if (specifier.includes('webpack-runtime') || specifier.includes('chunks/')) {
      const parentPath = fileURLToPath(context.parentURL || '')
      const resolvedPath = resolvePath(dirname(parentPath), specifier)
      return nextResolve(pathToFileURL(resolvedPath).href)
    }
    
    // Handle TypeScript path aliases
    if (matchPath) {
      const match = matchPath(specifier)
      if (match) {
        return nextResolve(pathToFileURL(match).href)
      }
    }
    
    return nextResolve(specifier)
  },

  load(url, context, nextLoad) {
    // Handle TypeScript files
    if (url.endsWith('.ts')) {
      return tsLoad(url, context, nextLoad)
    }
    return nextLoad(url)
  },

  getFormat(url, context, nextFormat) {
    // Handle TypeScript files
    if (url.endsWith('.ts')) {
      return tsGetFormat(url, context, nextFormat)
    }
    return nextFormat(url)
  },

  transformSource(source, context, nextTransform) {
    // Handle TypeScript files
    if (context.url.endsWith('.ts')) {
      return tsTransformSource(source, context, nextTransform)
    }
    return nextTransform(source, context)
  }
}

register(hook)
