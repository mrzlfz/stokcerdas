const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  transformer: {
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
  },
  resolver: {
    assetExts: ['bin', 'txt', 'jpg', 'png', 'json', 'mp4', 'ttf', 'otf', 'woff', 'woff2'],
    sourceExts: ['js', 'json', 'ts', 'tsx', 'jsx', 'svg'],
    alias: {
      '@': './src',
      '@/components': './src/components',
      '@/screens': './src/screens',
      '@/navigation': './src/navigation',
      '@/services': './src/services',
      '@/store': './src/store',
      '@/utils': './src/utils',
      '@/types': './src/types',
      '@/constants': './src/constants',
      '@/hooks': './src/hooks',
      '@/assets': './src/assets',
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);