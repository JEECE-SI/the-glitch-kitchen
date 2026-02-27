import nextConfig from "eslint-config-next/core-web-vitals";

const eslintConfig = nextConfig.map((config) => {
  if (config.name === "next/typescript" || config.plugins?.["@typescript-eslint"]) {
    return {
      ...config,
      rules: {
        ...(config.rules || {}),
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unused-vars": "warn",
      }
    };
  }
  return config;
});

// Push general rules
eslintConfig.push({
  rules: {
    "react/no-unescaped-entities": "off",
    "react-hooks/exhaustive-deps": "warn",
    "react-hooks/set-state-in-effect": "off",
    "prefer-const": "warn"
  }
});

export default eslintConfig;
