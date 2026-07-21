module.exports = {
  preset: "jest-expo",
  moduleNameMapper: {
    "^lucide-react-native$": "<rootDir>/../node_modules/lucide-react-native/dist/cjs/lucide-react-native.js",
    "^react$": "<rootDir>/../node_modules/react",
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testMatch: ["<rootDir>/src/**/*.test.{ts,tsx}"],
  transformIgnorePatterns: [
    "node_modules/(?!((.bun/)?(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|expo-router|@react-navigation/.*|react-navigation|react-native-safe-area-context|react-native-svg|lucide-react-native))",
  ],
};
