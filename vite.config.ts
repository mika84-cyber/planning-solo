import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { USEFUL_CONTACTS_DATA } from "./netlify/lib/usefulContactsData.mts";
export default defineConfig({
  plugins: [
    react(),
    {
      name: "planning-local-contacts",
      configureServer(server) {
        server.middlewares.use("/api/contacts", (request, response, next) => {
          if ((request as { method?: string }).method !== "GET") return next();
          response.statusCode = 200;
          response.setHeader("content-type", "application/json; charset=utf-8");
          response.setHeader("cache-control", "no-store");
          response.end(JSON.stringify(USEFUL_CONTACTS_DATA));
        });
      },
    },
  ],
  // Uniquement pour les liens de démo Cloudflare créés depuis le PC : Vite
  // refuse sinon le nom d'hôte externe avant même de servir l'application.
  server: { allowedHosts: [".trycloudflare.com"] },
});
