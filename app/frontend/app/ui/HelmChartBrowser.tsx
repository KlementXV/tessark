'use client';

import { useMemo, useState } from 'react';
import yaml from 'js-yaml';
import { Search, Download, AlertCircle, Loader2, Package } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import Navigation from './Navigation';
import Footer from './Footer';

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
  const { t } = useI18n();
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
      setError(t('home.errorFetchFailed'));
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

  return (
    <div className="min-h-screen excalidraw-bg flex flex-col">
      <Navigation />

      <div className="flex-1 max-w-6xl mx-auto p-6 w-full">
        <div className="excalidraw-card p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Search className="w-8 h-8 text-excalidraw-slate" />
            <h1 className="text-3xl font-bold text-excalidraw-slate">{t('home.title')}</h1>
          </div>

          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchCharts()}
                placeholder={t('home.placeholder')}
                className="sketchy-input w-full"
              />
            </div>
            <button
              onClick={fetchCharts}
              disabled={loading}
              className="sketchy-button bg-white text-excalidraw-slate disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
            <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded border-2 border-red-300">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {charts.length > 0 && (
          <div className="excalidraw-card p-8">
            <h2 className="text-2xl font-bold text-excalidraw-slate mb-6">
              {t('charts.availableIn')} {extractRepoName(base)}
              <span className="ml-3 text-sm font-normal text-excalidraw-slate opacity-70">
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
                  <div key={name} className="border-2 border-excalidraw-slate rounded p-5 hover:shadow-sketchy-lg transition">
                    <h3 className="text-xl font-bold text-excalidraw-slate mb-3">{name}</h3>
                    <div className="space-y-2">
                      {visibleVersions.map((v, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-excalidraw-slate-light p-3 rounded">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <span className="font-semibold text-excalidraw-slate">v{v.version}</span>
                              {v.appVersion && (
                                <span className="text-sm text-excalidraw-slate opacity-75">{t('charts.app')}: {String(v.appVersion)}</span>
                              )}
                            </div>
                            {v.description && (
                              <p className="text-sm text-excalidraw-slate opacity-75">{v.description}</p>
                            )}
                          </div>
                          <button
                            onClick={() => downloadChart(name, v)}
                            className="sketchy-button ml-4 bg-white text-excalidraw-slate hover:opacity-80 flex items-center gap-2 whitespace-nowrap"
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
                          className="text-sm font-medium text-excalidraw-slate border-b border-excalidraw-slate hover:opacity-70"
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
          <div className="excalidraw-card p-12 text-center">
            <Package className="w-16 h-16 text-excalidraw-slate opacity-30 mx-auto mb-4" />
            <p className="text-excalidraw-slate text-lg">{t('empty.prompt')}</p>
            <p className="text-excalidraw-slate text-sm mt-2 opacity-70">{t('empty.example')}</p>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
