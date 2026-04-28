const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Stub out react-dom for React Native builds
// Clerk's web components (useCustomElementPortal) import react-dom,
// but these aren't used in React Native. We provide an empty stub to prevent bundler errors.
config.resolver.extraNodeModules = {
  'react-dom': path.resolve(__dirname, './stubs/react-dom.js'),
};

module.exports = config;
