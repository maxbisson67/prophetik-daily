// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    // Includes Expo Router transforms in SDK 50+
    presets: ['babel-preset-expo'],
    plugins: [
      // Optional: keep if you use "@src/..." imports
      [
        'module-resolver',
        {
          root: ['./'],
          alias: { '@src': './src' },
          extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
        },
      ],

      // ⚠️ MUST be last
      'react-native-reanimated/plugin',
    ],
  };
};