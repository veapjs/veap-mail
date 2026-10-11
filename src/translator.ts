/**
 * Translation hook for mailables.
 *
 * Lives in the application layer because building localized messages is a
 * use-case concern; the intl implementation (infrastructure) is injected here
 * once by `CommunicationServiceProvider` - so mailables never import intl
 * directly and the package never imports its own entry points (ADR-006).
 */
export type Translator = (
  key: string,
  params?: Record<string, unknown>,
) => string;

let translatorFactory: (() => Promise<Translator>) | null = null;

/**
 * Helper to interpolate template placeholders like `{name}` or `{code}`.
 */
export function interpolateMailText(
  text: string,
  params?: Record<string, unknown>,
): string {
  if (!params) return text;
  return Object.entries(params).reduce(
    (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)),
    text,
  );
}

/**
 * Binds the translation factory. Invoked per message build, so the locale
 * always reflects the current request.
 */
export function setMailTranslatorFactory(
  factory: () => Promise<Translator>,
): void {
  translatorFactory = factory;
}

/**
 * Returns the bound translator, falling back to simple `{param}`
 * interpolation into the raw key when intl has not bound one yet
 * (unit tests, early boot).
 */
export async function getMailTranslator(): Promise<Translator> {
  if (translatorFactory) {
    const fn = await translatorFactory();
    return (key, params) => {
      const translated = fn(key, params);
      return interpolateMailText(translated, params);
    };
  }
  return (key, params) => interpolateMailText(key, params);
}
