'use client';

import { ExternalLink } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';

export default function Footer() {
  const { t } = useI18n();

  return (
    <footer className="mt-auto">
      <div className="h-2 border-t-2 border-excalidraw-slate" />
      <div className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-6 text-center text-sm text-excalidraw-slate">
          <div className="text-excalidraw-slate opacity-75">
            {t('footer.copyright', { year: new Date().getFullYear() })}
          </div>
          <div>
            <span className="text-excalidraw-slate">{t('footer.made')}</span>
            <span className="mx-1 animate-pulse" aria-hidden="true">
              ♥️
            </span>
            <span className="text-excalidraw-slate">{t('footer.by')}</span>
            {' '}
            <a
              href="https://github.com/KlementXV"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-excalidraw-slate border-b-2 border-excalidraw-slate hover:opacity-70 transition"
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
