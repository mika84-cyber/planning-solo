import nodemailer from "nodemailer";

export type GmailCredentials = { user: string; appPassword: string };

export type GmailMessage = {
  from: string;
  to: string;
  replyTo: string;
  subject: string;
  text: string;
  html: string;
};

export type GmailSender = (credentials: GmailCredentials, message: GmailMessage) => Promise<void>;
export type GmailVerifier = (credentials: GmailCredentials) => Promise<void>;

function gmailTransport(credentials: GmailCredentials) {
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: credentials.user, pass: credentials.appPassword },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
}

export const sendGmailEmail: GmailSender = async (credentials, message) => {
  await gmailTransport(credentials).sendMail({
    ...message,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
};

/** Gmail accepte-t-il ces identifiants ? Se connecte sans rien envoyer. */
export const verifyGmailLogin: GmailVerifier = async (credentials) => {
  await gmailTransport(credentials).verify();
};
