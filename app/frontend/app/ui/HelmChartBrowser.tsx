'use client';

import { useMemo, useState } from 'react';
import yaml from 'js-yaml';
import { Search, Download, Package, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { usePathname } from 'next/navigation';

type ChartVersion = {
  version?: string;
  appVersion?: string | number;
  description?: string;
  urls?: string[];
  created?: string;
};

type IndexYaml = {
  entries?: Record<string, ChartVersion[]>;
  packages?: Record<string, ChartVersion[]>;
  charts?: Record<string, ChartVersion[]>;
};

function normalizeBaseUrl(u: string) {
  if (!u) return '';
  try {
    const url = new URL(u);
    return url.toString().replace(/\/$/, '');
  } catch {
    return u.replace(/\/$/, '');
  }
}

function resolveUrl(resourceUrl: string, base?: string) {
  if (!resourceUrl) return '';
  try {
    return new URL(resourceUrl, base || (typeof window !== 'undefined' ? window.location.href : undefined)).toString();
  } catch {
    return resourceUrl;
  }
}

export default function HelmChartBrowser() {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  const [repoUrl, setRepoUrl] = useState('');
  const [indexData, setIndexData] = useState<IndexYaml | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const base = useMemo(() => normalizeBaseUrl(repoUrl || ''), [repoUrl]);

  const fetchCharts = async () => {
    if (!repoUrl.trim()) {
      setError(t('home.errorInvalidUrl'));
      return;
    }

    setLoading(true);
    setError('');
    setIndexData(null);

    try {
      const res = await fetch(`/api/fetchIndex?url=${encodeURIComponent(repoUrl.trim())}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('fetch failed');
      const text = await res.text();
      const parsed = yaml.load(text) as IndexYaml;
      setIndexData(parsed ?? {});
    } catch (err) {
      console.error(err);
      setError("Erreur lors de la récupération des charts. Vérifiez l'URL du repository.");
    } finally {
      setLoading(false);
    }
  };

  const entries: Record<string, ChartVersion[]> = useMemo(() => {
    if (!indexData) return {};
    return (indexData.entries || (indexData as any).packages || (indexData as any).charts || {}) as Record<string, ChartVersion[]>;
  }, [indexData]);

  const charts = useMemo(() => Object.keys(entries).sort((a, b) => a.localeCompare(b)), [entries]);

  const extractRepoName = (url: string) => {
    const parts = url.replace(/\/$/, '').split('/');
    return parts[parts.length - 1] || 'Repository';
  };

  const downloadChart = (chartName: string, v: ChartVersion) => {
    let url = '';
    if (v.urls && v.urls.length) {
      url = resolveUrl(v.urls[0], base);
    } else if (chartName && v.version) {
      url = `${base}/${chartName}-${v.version}.tgz`;
    }
    if (url) window.open(url, '_blank');
  };

  const toggleExpanded = (name: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const otherLocale = locale === 'fr' ? 'en' : 'fr';
  const altPath = (() => {
    if (!pathname) return `/${otherLocale}/`;
    const parts = pathname.split('/');
    parts[1] = otherLocale;
    return parts.join('/') || `/${otherLocale}/`;
  })();

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

      <div className="flex-1 max-w-6xl mx-auto p-6 w-full">
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Search className="w-8 h-8 text-indigo-600" />
            <h1 className="text-3xl font-bold text-gray-800">{t('home.title')}</h1>
          </div>

          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchCharts()}
                placeholder={t('home.placeholder')}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none transition"
              />
            </div>
            <button
              onClick={fetchCharts}
              disabled={loading}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition flex items-center gap-2 font-medium"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t('home.loading')}
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  {t('home.search')}
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-lg">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {charts.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              {t('charts.availableIn')} {extractRepoName(base)}
              <span className="ml-3 text-sm font-normal text-gray-500">
                ({charts.length} {t('charts.countSuffix')})
              </span>
            </h2>

            <div className="space-y-4">
              {charts.map((name) => {
                const versions = (entries[name] || []).slice().sort((a, b) => {
                  // basic semver-ish desc sort
                  const av = String(a.version || '0');
                  const bv = String(b.version || '0');
                  return av === bv ? 0 : av < bv ? 1 : -1;
                });
                const isOpen = expanded.has(name);
                const visibleVersions = isOpen ? versions : versions.slice(0, 3);
                return (
                  <div key={name} className="border-2 border-gray-200 rounded-lg p-5 hover:border-indigo-300 transition">
                    <h3 className="text-xl font-bold text-gray-800 mb-3">{name}</h3>
                    <div className="space-y-2">
                      {visibleVersions.map((v, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <span className="font-semibold text-indigo-600">v{v.version}</span>
                              {v.appVersion && (
                                <span className="text-sm text-gray-600">{t('charts.app')}: {String(v.appVersion)}</span>
                              )}
                            </div>
                            {v.description && (
                              <p className="text-sm text-gray-600">{v.description}</p>
                            )}
                          </div>
                          <button
                            onClick={() => downloadChart(name, v)}
                            className="ml-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-2 whitespace-nowrap"
                          >
                            <Download className="w-4 h-4" />
                            {t('download')}
                          </button>
                        </div>
                      ))}
                    </div>
                    {versions.length > 3 && (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(name)}
                          className="text-sm font-medium text-indigo-600 hover:underline"
                          aria-expanded={isOpen}
                          aria-controls={`versions-${name}`}
                        >
                          {isOpen ? t('charts.less') : t('charts.more', { n: versions.length - 3 })}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!loading && charts.length === 0 && !error && (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">{t('empty.prompt')}</p>
            <p className="text-gray-400 text-sm mt-2">{t('empty.example')}</p>
          </div>
        )}
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
