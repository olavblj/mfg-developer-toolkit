import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { mfgBundle } from "@mfg/sdk/vite";
export default defineConfig({ base: "./", plugins: [react(), mfgBundle(import.meta.dirname, { external: true })] });
