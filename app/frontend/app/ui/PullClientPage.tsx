'use client';

import { useState } from 'react';
import { Download, Package, ExternalLink } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { usePathname } from 'next/navigation';

const IMAGE_RE = /^[A-Za-z0-9./:@_\-]+$/;

export default function PullClientPage() {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  const [ref, setRef] = useState('docker.io/library/nginx:latest');
  const [format, setFormat] = useState<'docker-archive' | 'oci-archive'>('docker-archive');
  const [error, setError] = useState('');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ref.trim() || !IMAGE_RE.test(ref)) {
      setError('Référence invalide. Caractères autorisés: lettres, chiffres, ./:@_-');
      return;
    }
    setError('');
    const url = `/api/pull?ref=${encodeURIComponent(ref.trim())}&format=${encodeURIComponent(format)}`;
    window.location.href = url;
  };

  const otherLocale = locale === 'fr' ? 'en' : 'fr';
  const altPath = (() => {
    if (!pathname) return `/${otherLocale}/pull`;
    const parts = pathname.split('/');
    parts[1] = otherLocale;
    return parts.join('/') || `/${otherLocale}/pull`;
  })();

  const isPull = pathname?.startsWith(`/${locale}/pull`) ?? false;
  const isCharts = !isPull;

  const frPath = (() => {
    if (!pathname) return '/fr/pull';
    const parts = pathname.split('/');
    parts[1] = 'fr';
    return parts.join('/') || '/fr/pull';
  })();
  const enPath = (() => {
    if (!pathname) return '/en/pull';
    const parts = pathname.split('/');
    parts[1] = 'en';
    return parts.join('/') || '/en/pull';
  })();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
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
                className={`text-gray-700 hover:text-indigo-600 transition font-medium ${isCharts ? 'text-indigo-700 font-semibold border-b-2 border-indigo-600' : ''}`}
                aria-current={isCharts ? 'page' : undefined}
              >
                {t('nav.charts')}
              </a>
              <a
                href={`/${locale}/pull`}
                className={`text-gray-700 hover:text-indigo-600 transition font-medium ${isPull ? 'text-indigo-700 font-semibold border-b-2 border-indigo-600' : ''}`}
                aria-current={isPull ? 'page' : undefined}
              >
                {t('nav.pull')}
              </a>
              <div className="flex items-center gap-2 ml-2">
                <a
                  href={frPath}
                  aria-label="Français"
                  aria-current={locale === 'fr' ? 'true' : undefined}
                  className={`text-xl leading-none ${locale === 'fr' ? 'opacity-100' : 'opacity-60 hover:opacity-100'}`}
                  title="Français"
                >
                  🇫🇷
                </a>
                <a
                  href={enPath}
                  aria-label="English"
                  aria-current={locale === 'en' ? 'true' : undefined}
                  className={`text-xl leading-none ${locale === 'en' ? 'opacity-100' : 'opacity-60 hover:opacity-100'}`}
                  title="English"
                >
                  🇬🇧
                </a>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex-1 max-w-3xl w-full mx-auto p-6">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">{t('pull.title')}</h1>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700">{t('pull.imageRef')}</label>
              <input
                type="text"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder="docker.io/library/nginx:latest"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none transition"
              />
              <p className="text-xs text-gray-500 mt-1">Exemples: docker.io/library/nginx:latest • ghcr.io/org/app:1.2.3</p>
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700">{t('pull.format')}</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as any)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none transition bg-white"
              >
                <option value="docker-archive">{t('pull.formatDocker')}</option>
                <option value="oci-archive">{t('pull.formatOci')}</option>
              </select>
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <button type="submit" className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition inline-flex items-center gap-2">
              <Download className="w-4 h-4" />
              {t('download')}
            </button>
          </form>
        </div>
        <div className="text-xs text-gray-500 mt-4">{t('pull.note')}</div>
      </div>

      <footer className="mt-auto">
        <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
        <div className="backdrop-blur supports-[backdrop-filter]:bg-white/60 bg-white/80">
          <div className="max-w-6xl mx-auto px-6 py-6 text-center text-sm text-gray-700">
            <div className="text-gray-500">{t('footer.copyright', { year: new Date().getFullYear() })}</div>
            <div>
              <span className="text-gray-700">{t('footer.made')}</span>
              <span className="mx-1 text-pink-600 animate-pulse" aria-hidden="true">♥️</span>
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
    </div>
  );
}
