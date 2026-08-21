import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  // Uniquement pour les liens de démo Cloudflare créés depuis le PC : Vite
  // refuse sinon le nom d'hôte externe avant même de servir l'application.
  server: { allowedHosts: [".trycloudflare.com"] },
});
