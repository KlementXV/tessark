import type { ReactNode } from 'react';
import { I18nProvider } from '../i18n/I18nProvider';
import { isLocale, type Locale } from '../../i18n/config';
import '../globals.css';

export async function generateStaticParams() {
  return [{ locale: 'fr' }, { locale: 'en' }];
}

async function getMessages(locale: Locale) {
  const msgs = await import(`../../messages/${locale}.json`);
  return msgs.default;
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: { locale: string } }) {
  const l = isLocale(params.locale) ? (params.locale as Locale) : 'fr';
  const messages = await getMessages(l);
  return (
    <html lang={l}>
      <body>
        <I18nProvider locale={l} messages={messages}>{children}</I18nProvider>
      </body>
    </html>
  );
}

