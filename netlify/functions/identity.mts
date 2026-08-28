import type { Config, UserLoginEvent } from "@netlify/functions";
import { sendGuestLoginAlertOnce } from "../lib/guestLoginAlert.mts";

export default {
  async userLogin(event: UserLoginEvent) {
    try {
      const status = await sendGuestLoginAlertOnce(event.user.id, event.user.email);
      console.info("Planning Solo: événement de connexion traité", status);
    } catch (error) {
      console.warn(
        "Planning Solo: connexion autorisée mais alerte administrateur indisponible",
        error instanceof Error ? error.message : error,
      );
    }
  },
};

export const config: Config = { background: true };
