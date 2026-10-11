// Note: intentionally no `server-only` import here - this file must stay
// importable from plain Node (unit tests, CLI, non-Next hosts). Client bundles
// never reach it because the communication entry is a server entry.
import type { SendMailOptions, Transporter } from "nodemailer";
import nodemailer from "nodemailer";
import type { MailMessage, MailRecipient } from "../mail-message.js";
import type { IMailer } from "../mailer.js";

export interface NodemailerMailConfig {
  getService?: () => string | undefined;
  getHost?: () => string | undefined;
  getPort?: () => number | string | undefined;
  getSecure?: () => boolean | undefined;
  getIgnoreTLS?: () => boolean | undefined;
  getUsername?: () => string | undefined;
  getPassword?: () => string | undefined;
  getFromAddress?: () => string | undefined;
  getFromName?: () => string | undefined;
}

/**
 * SMTP transport (Nodemailer) implementing the {@link IMailer} port.
 *
 * A pure delivery service: takes `MailMessage`s and transmits them. It knows
 * nothing about verification codes, resets or i18n - content is decided by
 * the mailables in `application/communication/mail.ts` (the Laravel split:
 * `Mailable` = content, `Transport` = delivery).
 *
 * The only place in the codebase that knows Nodemailer exists; Nodemailer's
 * field names are a superset of the DTO, so mapping is one spread plus a
 * default sender.
 */
export class NodemailerMailService implements IMailer {
  private transporter: Transporter;
  private fromAddress: MailRecipient;

  constructor(config: NodemailerMailConfig) {
    const fromAddress = config.getFromAddress?.();
    const fromName = config.getFromName?.();
    const username = config.getUsername?.();
    const password = config.getPassword?.();

    if (fromAddress) {
      this.fromAddress =
        fromName && !fromAddress.includes("<")
          ? `${fromName} <${fromAddress}>`
          : fromAddress;
    } else if (username) {
      this.fromAddress = fromName
        ? `${fromName} <${username}>`
        : `Veap <${username}>`;
    } else {
      this.fromAddress = "Veap";
    }

    const host = config.getHost?.();
    const port = config.getPort?.();
    const service = config.getService?.();
    const secure = config.getSecure?.();
    const ignoreTLS = config.getIgnoreTLS?.();

    const auth =
      username || password
        ? {
            user: username,
            pass: password,
          }
        : undefined;

    if (host) {
      const parsedPort = port ? Number(port) : 587;
      this.transporter = nodemailer.createTransport({
        host,
        port: parsedPort,
        secure: secure !== undefined ? Boolean(secure) : parsedPort === 465,
        ignoreTLS: Boolean(ignoreTLS),
        auth,
      } as any);
    } else if (service) {
      this.transporter = nodemailer.createTransport({
        service,
        auth,
      } as any);
    } else {
      // Default local or fallback SMTP transport
      this.transporter = nodemailer.createTransport({
        host: "localhost",
        port: 587,
        auth,
      } as any);
    }
  }

  /** The sender used when a message does not specify one. */
  public get defaultFrom(): MailRecipient {
    return this.fromAddress;
  }

  /** Exposed for tests and provider-agnostic integrations. */
  public toSendMailOptions(message: MailMessage): SendMailOptions {
    return {
      ...message,
      from: message.from ?? this.fromAddress,
    };
  }

  public async sendMail(message: MailMessage): Promise<void> {
    await this.transporter.sendMail(this.toSendMailOptions(message));
  }
}
