import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14151a",
        paper: "#f7f4ef",
        ember: "#d45f3c",
        mint: "#2f9b7b",
        sky: "#3478a4"
      }
    }
  },
  plugins: []
};

export default config;
