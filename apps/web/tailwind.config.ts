import type { Config } from "tailwindcss";
export default { content: ["./app/**/*.{ts,tsx}"], theme: { extend: { colors: { ink: "#10231d", mint: "#dff5eb", brand: "#117a5a" }, boxShadow: { float: "0 24px 70px rgba(16,35,29,.16)" } } }, plugins: [] } satisfies Config;
