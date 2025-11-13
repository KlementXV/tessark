'use client';

import { Package } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const { t, locale } = useI18n();
  const pathname = usePathname();

  const isPull = pathname?.startsWith(`/${locale}/pull`) ?? false;
  const isCharts = !isPull;

  const frPath = (() => {
    if (!pathname) return '/fr/';
    const parts = pathname.split('/');
    parts[1] = 'fr';
    return parts.join('/') || '/fr/';
  })();

  const enPath = (() => {
    if (!pathname) return '/en/';
    const parts = pathname.split('/');
    parts[1] = 'en';
    return parts.join('/') || '/en/';
  })();

  return (
    <nav className="bg-white shadow-lg border-b-4 border-indigo-600">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="w-8 h-8 text-indigo-600" />
            <span className="text-2xl font-bold text-gray-800">{t('nav.brand')}</span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href={`/${locale}/`}
              className={`text-gray-700 hover:text-indigo-600 transition font-medium ${
                isCharts ? 'text-indigo-700 font-semibold border-b-2 border-indigo-600' : ''
              }`}
              aria-current={isCharts ? 'page' : undefined}
            >
              {t('nav.charts')}
            </a>
            <a
              href={`/${locale}/pull`}
              className={`text-gray-700 hover:text-indigo-600 transition font-medium ${
                isPull ? 'text-indigo-700 font-semibold border-b-2 border-indigo-600' : ''
              }`}
              aria-current={isPull ? 'page' : undefined}
            >
              {t('nav.pull')}
            </a>
            <div className="flex items-center gap-2 ml-2">
              <a
                href={frPath}
                aria-label="Français"
                aria-current={locale === 'fr' ? 'true' : undefined}
                className={`text-xl leading-none ${
                  locale === 'fr' ? 'opacity-100' : 'opacity-60 hover:opacity-100'
                }`}
                title="Français"
              >
                🇫🇷
              </a>
              <a
                href={enPath}
                aria-label="English"
                aria-current={locale === 'en' ? 'true' : undefined}
                className={`text-xl leading-none ${
                  locale === 'en' ? 'opacity-100' : 'opacity-60 hover:opacity-100'
                }`}
                title="English"
              >
                🇬🇧
              </a>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
