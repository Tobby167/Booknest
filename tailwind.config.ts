import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        mist: "#f8fafc",
        fern: "#7c3aed",
        sage: "#8b5cf6",
        blush: "#f5f3ff",
        clay: "#ec4899",
        gold: "#f59e0b"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(17, 24, 39, 0.10)"
      }
    }
  },
  plugins: []
};

export default config;
