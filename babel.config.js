module.exports = function (api) {
  api.cache(true);
  return {
    // NativeWind v4 works as a preset in this version
    presets: ["babel-preset-expo", "nativewind/babel"],
  };
};
