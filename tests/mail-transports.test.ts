import { beforeEach, describe, expect, it } from "vitest";

import type { MailMessage } from "../src/mail-message.js";
import type { IMailer } from "../src/mailer.js";
import { ConsoleMailService } from "../src/providers/console.provider.js";
import { NodemailerMailService } from "../src/providers/nodemailer.provider.js";

/**
 * Transports - the swappable delivery services behind the IMailer port.
 *
 * The contract under test is deliberately narrow: a transport receives a
 * fully-built `MailMessage` and delivers it. No semantics, no i18n, no
 * template knowledge. Content is the mailables' business (see
 * `application/communication/mail.test.ts`).
 */

/** Deterministic translator: interpolates {params} into the raw key. */
export const interpolatingTranslator = () =>
  Promise.resolve((key: string, params?: Record<string, unknown>) =>
    params
      ? Object.entries(params).reduce(
          (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)),
          key,
        )
      : key,
  );

const fakeConfig = (over: Record<string, string | undefined> = {}) => ({
  getService: () => over.service ?? "gmail",
  getHost: () => over.host,
  getPort: () => over.port,
  getSecure: () => (over.secure ? over.secure === "true" : undefined),
  getUsername: () => over.username,
  getPassword: () => over.password,
  getFromAddress: () => over.from,
  getFromName: () => over.fromName,
});

describe("NodemailerMailService (DTO mapping, pure delivery)", () => {
  it("maps MailMessage onto SendMailOptions with a default sender", () => {
    const service = new NodemailerMailService(
      fakeConfig({ from: "Veap <noreply@veap.dev>" }),
    );

    const options = service.toSendMailOptions({
      to: "user@example.com",
      subject: "Hello",
      text: "Hi there",
    });

    expect(options.to).toBe("user@example.com");
    expect(options.subject).toBe("Hello");
    expect(options.text).toBe("Hi there");
    expect(options.from).toBe("Veap <noreply@veap.dev>");
  });

  it("lets an explicit sender override the default", () => {
    const service = new NodemailerMailService(
      fakeConfig({ from: "default@veap.dev" }),
    );

    const options = service.toSendMailOptions({
      to: "user@example.com",
      subject: "Hello",
      text: "Hi",
      from: { name: "Support", address: "support@veap.dev" },
    });

    expect(options.from).toEqual({
      name: "Support",
      address: "support@veap.dev",
    });
  });

  it("falls back to a from-address derived from the username", () => {
    const service = new NodemailerMailService(
      fakeConfig({ username: "bot@veap.dev" }),
    );
    expect(service.defaultFrom).toBe("Veap <bot@veap.dev>");
  });

  it("formats from-address with custom fromName", () => {
    const service = new NodemailerMailService(
      fakeConfig({
        from: "info@mycorp.com",
        fromName: "MyCorp Support",
      }),
    );
    expect(service.defaultFrom).toBe("MyCorp Support <info@mycorp.com>");
  });

  it("initializes transport with host and port (SMTP/Mailpit)", () => {
    const service = new NodemailerMailService(
      fakeConfig({
        host: "mailpit",
        port: "1025",
        from: "noreply@app.local",
      }),
    );
    expect(service.defaultFrom).toBe("noreply@app.local");
  });

  it("passes structured recipients, attachments and priority through", () => {
    const service = new NodemailerMailService(fakeConfig());

    const options = service.toSendMailOptions({
      to: [{ address: "a@x.dev" }, { name: "B", address: "b@x.dev" }],
      cc: "c@x.dev",
      subject: "S",
      text: "T",
      priority: "high",
      attachments: [
        {
          filename: "r.pdf",
          path: "/tmp/r.pdf",
          contentType: "application/pdf",
        },
      ],
    });

    expect(options.to).toHaveLength(2);
    expect(options.cc).toBe("c@x.dev");
    expect(options.priority).toBe("high");
    expect(options.attachments).toHaveLength(1);
  });
});

describe("ConsoleMailService (second transport, proving swappability)", () => {
  let lines: string[];
  let service: IMailer;

  beforeEach(() => {
    lines = [];
    service = new ConsoleMailService((line) => lines.push(line));
  });

  it("prints a MailMessage instead of dialling SMTP", async () => {
    await service.sendMail({
      to: ["dev@veap.dev", { name: "Ops", address: "ops@veap.dev" }],
      subject: "Verify Email",
      text: "Code: 123456",
    });

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("MAIL:console");
    expect(lines[0]).toContain("dev@veap.dev");
    expect(lines[0]).toContain("ops@veap.dev");
    expect(lines[0]).toContain("Code: 123456");
  });

  it("is assignable to the IMailer port (type-level contract)", () => {
    const port: IMailer = service;
    expect(port.sendMail).toBeTypeOf("function");
  });
});
