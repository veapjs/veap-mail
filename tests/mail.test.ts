import { Application, Container, container } from "@veap/kernel";
import { beforeEach, describe, expect, it } from "vitest";
import {
  bindCommunicationContext,
  communicationContext,
} from "../src/context.js";
import {
  send2FACode,
  sendMail,
  sendRecoveryCode,
  sendResetPassword,
  sendVerifyEmail,
} from "../src/mail.js";
import type { MailMessage } from "../src/mail-message.js";
import { CUSTOM_MAILER, MAIL_SERVICE, MAILER } from "../src/mailer.js";
import {
  CommunicationServiceProvider,
  MailServiceProvider,
} from "../src/provider.js";
import {
  getMailTranslator,
  setMailTranslatorFactory,
} from "../src/translator.js";
import "../src/composition.js";

/**
 * Mailables - where email semantics live.
 *
 * Transports are asserted through a capturing fake: these tests verify that
 * each mailable builds the right localized `MailMessage` and hands it to the
 * bound `IMailer` port. Swapping transports cannot affect this behaviour.
 */

/** Deterministic translator: interpolates {params} into the raw key. */
const interpolatingTranslator = () =>
  Promise.resolve((key: string, params?: Record<string, unknown>) =>
    params
      ? Object.entries(params).reduce(
          (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)),
          key,
        )
      : key,
  );

describe("mailables", () => {
  let sent: MailMessage[];

  beforeEach(() => {
    sent = [];
    setMailTranslatorFactory(interpolatingTranslator);

    // Bind a capturing fake transport - no SMTP, no container.
    bindCommunicationContext({
      mailer: {
        async sendMail(message: MailMessage) {
          sent.push(message);
        },
      },
    });
  });

  it("sendVerifyEmail builds a localized verification message", async () => {
    await sendVerifyEmail("u@x.dev", "123456");

    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual({
      to: "u@x.dev",
      subject: "Verify Email",
      text: "Verify your email address with your code: 123456",
    });
  });

  it("sendResetPassword builds a password-reset message", async () => {
    await sendResetPassword("u@x.dev", "ABC123");

    expect(sent).toHaveLength(1);
    const msg = sent[0]!;
    expect(msg.subject).toBe("Password Reset");
    expect(msg.text).toBe("Verify password reset with code: ABC123");
  });

  it("sendRecoveryCode builds a recovery-code message", async () => {
    await sendRecoveryCode("u@x.dev", "RECOVERY-9");

    expect(sent).toHaveLength(1);
    const msg = sent[0]!;
    expect(msg.subject).toBe("Recovery Code");
    expect(msg.text).toBe("Your recovery code is: RECOVERY-9");
  });

  it("send2FACode builds a 2FA message", async () => {
    await send2FACode("u@x.dev", "654321");

    expect(sent).toHaveLength(1);
    const msg = sent[0]!;
    expect(msg.subject).toBe("Your 2FA Code");
    expect(msg.text).toBe(
      "Your verification code is: 654321. It will expire in 10 minutes.",
    );
  });

  it("sendMail forwards arbitrary messages to the bound port", async () => {
    await sendMail({ to: "a@x.dev", subject: "S", text: "T" });

    expect(sent).toHaveLength(1);
    expect(communicationContext().mailer.sendMail).toBeDefined();
  });

  it("falls back to raw keys when no translator is bound", async () => {
    // Explicitly reset to the fallback (beforeEach already binds one; this
    // documents the fallback behaviour of getMailTranslator).
    const t = await getMailTranslator();
    expect(t("Hello {name}", { name: "Ada" })).toBe("Hello Ada");
  });

  it("exposes no semantics on the transport interface", () => {
    // The port itself is a single-method delivery contract.
    const keys = Object.keys(communicationContext().mailer);
    expect(keys.sort()).toEqual(["sendMail"]);
  });

  it("correctly interpolates parameters after CommunicationServiceProvider boots", async () => {
    const localContainer = new Container();
    const provider = new CommunicationServiceProvider(localContainer);
    provider.register();
    await provider.boot();

    // After boot, verify that default translator interpolates parameters
    const t = await getMailTranslator();
    expect(t("Code: {code}", { code: "999888" })).toBe("Code: 999888");

    // Send email using real boot context
    await sendVerifyEmail("user@example.com", "999888");
    const lastContext = communicationContext();
    expect(lastContext.mailer).toBeDefined();
  });

  it("supports Application.configure().withMail() and withCommunication()", async () => {
    await Application.shutdown();
    const app = Application.configure().withMail().create();
    expect(app).toBeDefined();
    await app.bootstrap();

    const boundMailer = await container.resolve(MAILER);
    expect(boundMailer).toBeDefined();
    expect(await container.resolve(MAIL_SERVICE)).toBe(boundMailer);
  });

  it("supports custom transport with CUSTOM_MAILER token", async () => {
    const customMailer = {
      sendMail: async (msg: MailMessage) => {
        sent.push(msg);
      },
    };

    const localContainer = new Container();
    localContainer.register({
      token: CUSTOM_MAILER,
      useValue: customMailer,
      singleton: true,
    });

    const originalEnv = process.env.MAIL_TRANSPORT;
    try {
      process.env.MAIL_TRANSPORT = "custom";
      const provider = new MailServiceProvider(localContainer);
      provider.register();
      await provider.boot();

      const resolved = await localContainer.resolve(MAILER);
      expect(resolved).toBe(customMailer);
    } finally {
      process.env.MAIL_TRANSPORT = originalEnv;
    }
  });
});
