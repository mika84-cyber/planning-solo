import nodemailer from "nodemailer";

export type GmailMessage = {
  from: string;
  to: string;
  replyTo: string;
  subject: string;
  text: string;
  html: string;
};

export type GmailSender = (
  credentials: { user: string; appPassword: string },
  message: GmailMessage,
) => Promise<void>;

export const sendGmailEmail: GmailSender = async (credentials, message) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: credentials.user, pass: credentials.appPassword },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  await transporter.sendMail({
    ...message,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
};
