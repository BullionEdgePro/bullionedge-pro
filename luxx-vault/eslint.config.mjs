import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  { ignores: [".next/**", "node_modules/**", "audit/**", "public/**", "next-env.d.ts"] },
  ...nextVitals,
  ...nextTs,
];

export default config;
