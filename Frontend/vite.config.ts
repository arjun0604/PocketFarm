import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";

// Check for local SSL certificates (fallback gracefully if not present)
const localKey = path.resolve(__dirname, "./localhost-key.pem");
const localCert = path.resolve(__dirname, "./localhost.pem");
const hasHttps = fs.existsSync(localKey) && fs.existsSync(localCert);

export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    ...(hasHttps
      ? {
          https: {
            key: fs.readFileSync(localKey),
            cert: fs.readFileSync(localCert),
          },
        }
      : {}),
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});