module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // 1. Module Resolver (Fixes runtime paths for "~")
      ['module-resolver', {
        alias: {
          '~': './src',
        },
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      }],
      
    ],
  };
};