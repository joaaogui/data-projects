import type { Config } from "tailwindcss";
import { baseConfig } from "@data-projects/tailwind-config";

const config: Config = {
  ...baseConfig,
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    ...baseConfig.theme,
    extend: {
      ...baseConfig.theme?.extend,
      colors: {
        ...baseConfig.theme?.extend?.colors,
        spotify: {
          DEFAULT: "hsl(var(--spotify))",
          foreground: "hsl(var(--spotify-foreground))",
        },
      },
    },
  },
};

export default config;
