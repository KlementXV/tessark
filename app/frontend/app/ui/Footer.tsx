'use client';

import { ExternalLink } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';

export default function Footer() {
  const { t } = useI18n();

  return (
    <footer className="mt-auto">
      <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
      <div className="backdrop-blur supports-[backdrop-filter]:bg-white/60 bg-white/80">
        <div className="max-w-6xl mx-auto px-6 py-6 text-center text-sm text-gray-700">
          <div className="text-gray-500">
            {t('footer.copyright', { year: new Date().getFullYear() })}
          </div>
          <div>
            <span className="text-gray-700">{t('footer.made')}</span>
            <span className="mx-1 text-pink-600 animate-pulse" aria-hidden="true">
              ♥️
            </span>
            <span className="text-gray-700">{t('footer.by')}</span>
            {' '}
            <a
              href="https://github.com/KlementXV"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              KlementXV
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
