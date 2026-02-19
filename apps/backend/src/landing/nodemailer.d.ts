/** Optional dependency: npm install nodemailer. Used when NEWSLETTER_NOTIFY_EMAIL + SMTP_* are set. */
declare module 'nodemailer' {
  function createTransport(options: {
    host: string;
    port: number;
    secure?: boolean;
    auth: { user: string; pass: string };
  }): {
    sendMail(options: { from: string; to: string; subject: string; text: string; html?: string }): Promise<unknown>;
  };
  const defaultExport: { createTransport: typeof createTransport };
  export default defaultExport;
}
