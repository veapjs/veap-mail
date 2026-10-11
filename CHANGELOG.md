# @veap/mail

## 0.1.1

### Patch Changes

- Audit and modernization of `@veap/mail`:
  - Native Node.js ESM compliance: added explicit `.js` extensions across all internal imports and exports to prevent `ERR_MODULE_NOT_FOUND` resolution errors in standard Node.js module loaders.
  - IoC & Port Tokens: strongly typed `MAILER` as `Token<IMailer>` from `@veap/kernel` and added `MAIL_SERVICE` alias for unified dependency injection.
  - Template interpolation bug fix: fixed issue where default translation factory dropped placeholder parameters (e.g. `{code}`, `{recoveryCode}`) after `CommunicationServiceProvider.boot()`.
  - Flexible SMTP & Transport configuration: added support for standard SMTP server properties (`MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`, `MAIL_IGNORE_TLS`, `MAIL_FROM_NAME`) in `NodemailerMailService` and robust fallback to `process.env` when `ConfigService` is not registered in IoC container.
  - Module Augmentation & Composition: added `ApplicationBuilder.prototype.withMail()` and `ApplicationBuilder.prototype.withCommunication()`, and augmented `VeapConfig` with `mail?: MailConfig`.
  - Test coverage expanded: added integration test coverage for bootstrap lifecycle, parameter interpolation, custom transports, and `ApplicationBuilder` fluent configuration.
- Updated dependencies []:
  - @veap/kernel@0.1.1

## 0.1.0

### Minor Changes

- Initial public scaffold of the Veap mail.
