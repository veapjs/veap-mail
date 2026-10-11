[![CI](https://github.com/veapjs/veap-mail/actions/workflows/CI.yml/badge.svg)](https://github.com/veapjs/veap-mail/actions/workflows/CI.yml)
[![Release](https://github.com/veapjs/veap-mail/actions/workflows/RELEASE.yml/badge.svg)](https://github.com/veapjs/veap-mail/actions/workflows/RELEASE.yml)
[![Version](https://img.shields.io/npm/v/@veap/mail?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/@veap/mail)

# @veap/mail

Modular email and notification transport abstraction with support for
Nodemailer, SMTP, Console logging, and custom mail drivers for Veap applications.

## Overview

`@veap/mail` provides a unified messaging interface decoupling application
logic from email delivery protocols. It supports zero-configuration development
environments with automatic console logging, robust SMTP / Nodemailer delivery
in production, and a custom driver port (`CUSTOM_MAILER`) for external email
services such as AWS SES, Postmark, or Resend.

## Features

- **Multiple mail transports**: Built-in support for Nodemailer (SMTP, Google
  App Passwords) and zero-config `ConsoleMailService` for local development.
- **Unified `sendMail` facade**: Simple, consistent API for sending plain text,
  HTML, and rich multipart emails.
- **Authentication notification helpers**: Out-of-the-box functions for
  `sendResetPassword` and `sendVerifyEmail` with customizable templates.
- **IoC-driven lifecycle**: `MailServiceProvider` handles automatic driver
  selection and credentials parsing during application boot.
- **Custom mailer support**: Extendable driver architecture via the
  `CUSTOM_MAILER` token.

## Installation

```bash
# Using bun
bun add @veap/mail @veap/kernel

# Using pnpm
pnpm add @veap/mail @veap/kernel

# Using npm
npm install @veap/mail @veap/kernel
```

## Configuration

`@veap/mail` detects transports automatically from environment variables:

| Environment Variable                     | Description                                          |
| ---------------------------------------- | ---------------------------------------------------- |
| `MAIL_TRANSPORT`                         | Delivery driver (`smtp`, `console`, or `custom`)     |
| `MAIL_SERVICE`                           | Well-known Nodemailer service (for example, `gmail`) |
| `MAIL_USERNAME` / `MAIL_PASSWORD`        | Standard SMTP credentials                            |
| `GOOGLE_SMTP_APP_USERNAME` / `_PASSWORD` | Alternative Google App password credentials          |
| `MAIL_FROM_ADDRESS`                      | Default sender email address                         |

When no credentials or `MAIL_TRANSPORT` are set, `@veap/mail` defaults safely
to `ConsoleMailService` so local development and tests run without network errors.

## Usage

### Register in Application Builder

Include `MailServiceProvider` in your application composition root:

```ts
import { Application } from "@veap/kernel";
import { MailServiceProvider } from "@veap/mail";

export const app = Application.configure().use(MailServiceProvider).create();
```

### Sending Emails

Send transactional messages from services or server actions:

```ts
import { sendMail } from "@veap/mail";

await sendMail({
  to: "user@example.com",
  subject: "Welcome to Our Platform",
  text: "Thank you for creating an account with us!",
  html: "<h1>Welcome!</h1><p>Thank you for creating an account with us!</p>",
});
```

### Registering a Custom Mailer

Implement the `IMailer` interface and bind it under `CUSTOM_MAILER`:

```ts
import { ServiceProvider } from "@veap/kernel";
import { CUSTOM_MAILER, type IMailer, type MailMessage } from "@veap/mail";

export class ResendMailService implements IMailer {
  async send(message: MailMessage): Promise<void> {
    // Send via third-party SDK (e.g., resend.emails.send)
  }
}

export class CustomMailServiceProvider extends ServiceProvider {
  register(): void {
    this.container.register({
      token: CUSTOM_MAILER,
      useClass: ResendMailService,
      singleton: true,
    });
  }
}
```

## Subpath Exports

| Export Path  | Content                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------- |
| `@veap/mail` | Mail facades (`sendMail`), providers, interfaces (`IMailer`, `MailMessage`), and context |

## Documentation

For full guides and transport configuration options, visit:

- **Official Website**: [https://veap.pl](https://veap.pl)
- **Documentation**: [https://veap.pl/docs](https://veap.pl/docs)
- **GitHub Repository**: [https://github.com/veapjs/veap-mail](https://github.com/veapjs/veap-mail)

## License

MIT
