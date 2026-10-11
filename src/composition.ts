import { ApplicationBuilder } from "@veap/kernel";
import { CommunicationServiceProvider } from "./provider.js";

/**
 * Mail configuration options supported in veap.config.ts.
 */
export interface MailConfig {
  /**
   * Transport driver: "smtp" (default), "console", or "custom".
   */
  transport?: "smtp" | "console" | "custom" | string;
  /**
   * Nodemailer well-known service (e.g. "gmail", "sendgrid").
   */
  service?: string;
  /**
   * SMTP server hostname.
   */
  host?: string;
  /**
   * SMTP server port (e.g. 587, 465, 25, 1025).
   */
  port?: number | string;
  /**
   * Use TLS/SSL directly (default: true for port 465, false otherwise).
   */
  secure?: boolean;
  /**
   * Ignore TLS certificate issues (useful for local dev/test servers).
   */
  ignoreTLS?: boolean;
  /**
   * SMTP authentication username.
   */
  username?: string;
  /**
   * SMTP authentication password.
   */
  password?: string;
  /**
   * Default sender address (e.g. "noreply@example.com" or "Acme <noreply@example.com>").
   */
  from?: string;
  /**
   * Default sender name (e.g. "Acme").
   */
  fromName?: string;
}

declare module "@veap/kernel" {
  interface ApplicationBuilder {
    /**
     * Registers the communication/mail service provider into the application.
     */
    withMail(): this;

    /**
     * Alias for `withMail()`.
     */
    withCommunication(): this;
  }

  interface VeapConfig {
    /**
     * Communication and mail transport configuration.
     */
    mail?: MailConfig;
  }
}

ApplicationBuilder.prototype.withMail = function (
  this: ApplicationBuilder,
): ApplicationBuilder {
  return this.use(CommunicationServiceProvider);
};

ApplicationBuilder.prototype.withCommunication = function (
  this: ApplicationBuilder,
): ApplicationBuilder {
  return this.use(CommunicationServiceProvider);
};
