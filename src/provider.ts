import { ConfigService, logger, ServiceProvider } from "@veap/kernel";
import { bindCommunicationContext } from "./context.js";
import type { IMailer } from "./mailer.js";
import { CUSTOM_MAILER, MAILER } from "./mailer.js";
import { ConsoleMailService } from "./providers/console.provider.js";
import { NodemailerMailService } from "./providers/nodemailer.provider.js";
import { setMailTranslatorFactory } from "./translator.js";

/**
 * Composition root of the communication context.
 *
 * Selects the mail transport exactly once (in `boot()`) from `MAIL_TRANSPORT`
 * and binds it into `CommunicationContext`, so facades and services never
 * look transports up themselves:
 *
 * - `smtp` (default) - Nodemailer (`MAIL_SERVICE`, `MAIL_HOST`, `MAIL_PORT`,
 *   `MAIL_USERNAME`/`MAIL_PASSWORD` or `GOOGLE_SMTP_APP_*`, `MAIL_FROM_ADDRESS`)
 * - `console` - logs the message; dev/test with zero mail configuration
 * - `custom` - resolves `CUSTOM_MAILER`; bring your own SES/Postmark/Resend…
 */
export class CommunicationServiceProvider extends ServiceProvider {
  register(): void {
    // Default registration: the Nodemailer transport under the port token,
    // with config getters wired here at the composition root (the adapter
    // itself takes plain functions, so it stays container-agnostic).
    // Replaced with a `useValue` binding in `boot()` when MAIL_TRANSPORT
    // selects another transport.
    this.container.register({
      token: MAILER,
      useFactory: (config?: ConfigService) => {
        const getEnv = (key: string): string | undefined => {
          return (
            config?.get?.(key) ??
            (typeof process !== "undefined" ? process.env[key] : undefined)
          );
        };

        return new NodemailerMailService({
          getService: () => getEnv("MAIL_SERVICE"),
          getHost: () => getEnv("MAIL_HOST"),
          getPort: () => getEnv("MAIL_PORT"),
          getSecure: () => {
            const val = getEnv("MAIL_SECURE");
            return val ? val === "true" || val === "1" : undefined;
          },
          getIgnoreTLS: () => {
            const val = getEnv("MAIL_IGNORE_TLS");
            return val ? val === "true" || val === "1" : undefined;
          },
          getUsername: () =>
            getEnv("GOOGLE_SMTP_APP_USERNAME") ?? getEnv("MAIL_USERNAME"),
          getPassword: () =>
            getEnv("GOOGLE_SMTP_APP_PASSWORD") ?? getEnv("MAIL_PASSWORD"),
          getFromAddress: () => getEnv("MAIL_FROM_ADDRESS"),
          getFromName: () => getEnv("MAIL_FROM_NAME"),
        });
      },
      inject: [ConfigService],
      singleton: true,
    });
  }

  async boot(): Promise<void> {
    // Bind the default translation factory that supports `{placeholder}`
    // interpolation into the message text.
    setMailTranslatorFactory(
      async () => (key: string, params?: Record<string, unknown>) => {
        if (!params) return key;
        return Object.entries(params).reduce(
          (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)),
          key,
        );
      },
    );

    const config = this.container.has(ConfigService)
      ? await this.container.resolve(ConfigService)
      : undefined;

    const mailer = await this.selectTransport(config);

    // Rebind the port token to the selected transport and expose it through
    // the typed context boundary.
    this.container.register({
      token: MAILER,
      useValue: mailer,
      singleton: true,
    });
    bindCommunicationContext({ mailer });

    logger.debug(
      "veap:communication",
      `Mail transport bound: ${mailer.constructor.name}`,
    );
  }

  private async selectTransport(config?: ConfigService): Promise<IMailer> {
    const getVal = (key: string): string | undefined => {
      return (
        config?.get?.(key) ??
        (typeof process !== "undefined" ? process.env[key] : undefined)
      );
    };

    const transport = getVal("MAIL_TRANSPORT")?.trim().toLowerCase();

    if (transport === "custom") {
      if (!this.container.has(CUSTOM_MAILER)) {
        throw new Error(
          "[Communication] MAIL_TRANSPORT=custom but no provider is registered under the CUSTOM_MAILER token (register an IMailer in a ServiceProvider).",
        );
      }
      return this.container.resolve<IMailer>(CUSTOM_MAILER);
    }

    if (transport === "console") {
      return new ConsoleMailService((line) => logger.info("veap:mail", line));
    }

    const hasSmtpCredentials =
      Boolean(getVal("GOOGLE_SMTP_APP_USERNAME") || getVal("MAIL_USERNAME")) &&
      Boolean(getVal("GOOGLE_SMTP_APP_PASSWORD") || getVal("MAIL_PASSWORD"));

    const hasSmtpHostOrService = Boolean(
      getVal("MAIL_HOST") || getVal("MAIL_SERVICE"),
    );

    if (!transport && !hasSmtpCredentials && !hasSmtpHostOrService) {
      logger.warn(
        "veap:communication",
        "MAIL_TRANSPORT is not set and no SMTP credentials (MAIL_USERNAME/MAIL_PASSWORD) or host (MAIL_HOST) are configured. Defaulting to ConsoleMailService (emails will be logged to server console).",
      );
      return new ConsoleMailService((line) => logger.info("veap:mail", line));
    }

    // Default ("smtp" / unset with credentials/host): whatever register() wired - Nodemailer.
    return this.container.resolve<IMailer>(MAILER);
  }
}

export const MailServiceProvider = CommunicationServiceProvider;
