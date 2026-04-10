import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0e2230",
        mist: "#f5fbff",
        tide: "#dff5fb",
        aqua: "#55c1ce",
        teal: "#0f7c90",
        coral: "#ef7b6b",
        gold: "#d7a542",
        sage: "#7aa57a"
      },
      fontFamily: {
        sans: ['"Sora"', '"Avenir Next"', '"Segoe UI"', "sans-serif"],
        display: ['"Fraunces"', '"Iowan Old Style"', "serif"]
      },
      boxShadow: {
        float: "0 18px 45px rgba(15, 124, 144, 0.14)",
        card: "0 12px 28px rgba(14, 34, 48, 0.08)"
      },
      backgroundImage: {
        mesh:
          "radial-gradient(circle at top, rgba(85,193,206,0.28), transparent 38%), radial-gradient(circle at 78% 16%, rgba(239,123,107,0.16), transparent 22%), linear-gradient(180deg, rgba(245,251,255,1) 0%, rgba(232,246,250,1) 100%)"
      },
      keyframes: {
        pulseSoft: {
          "0%, 100%": { opacity: "0.5", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.03)" }
        },
        drift: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-4px)" }
        }
      },
      animation: {
        "pulse-soft": "pulseSoft 2.2s ease-in-out infinite",
        drift: "drift 6s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

export default config;
