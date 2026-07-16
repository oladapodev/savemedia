module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testMatch: ["<rootDir>/src/**/*.test.{ts,tsx}"],
  transformIgnorePatterns: [
    "node_modules/(?!((.bun/)?(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|expo-router|@react-navigation/.*|react-navigation|react-native-safe-area-context))",
  ],
};
