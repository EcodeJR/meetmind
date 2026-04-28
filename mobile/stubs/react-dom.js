// Stub for react-dom in React Native
// Clerk's web utilities (useCustomElementPortal) import react-dom,
// but these are not used in React Native. Providing an empty stub
// allows the imports to succeed without breaking the bundler.

module.exports = {
  createPortal: () => null,
  createRoot: () => null,
  render: () => null,
};
