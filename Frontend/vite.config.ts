import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";

// Load SSL certificates generated by mkcert
const certPath = `${process.env.HOME}/.localhost_ssl`; // Path to the certificates
const key = fs.readFileSync(`${certPath}/localhost-key.pem`);
const cert = fs.readFileSync(`${certPath}/localhost.pem`);

export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    https: {
      key,
      cert,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});