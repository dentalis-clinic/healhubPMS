import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Cloudflare (OpenNext) build output — generated, gitignored.
    ".open-next/**",
    ".wrangler/**",
    "cloudflare-env.d.ts",
  ]),
  {
    // next/image optimisation is disabled on Workers (images.unoptimized in
    // next.config.ts), so <Image> would add nothing over a plain <img>.
    rules: { "@next/next/no-img-element": "off" },
  },
]);

export default eslintConfig;
