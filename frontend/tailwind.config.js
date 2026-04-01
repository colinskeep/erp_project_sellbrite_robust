export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#6366f1ff",   // Indigo (modern SaaS look)
        secondary: "#0f172a", // Slate dark
        muted: "#64748b",
        bg: "#2b4a6aff"
      }
    },
  },
  plugins: [],
}