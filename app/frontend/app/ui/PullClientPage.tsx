'use client';

import { useState } from 'react';
import { Download, Package, ExternalLink, Lock, ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { usePathname } from 'next/navigation';

const IMAGE_RE = /^[A-Za-z0-9./:@_\-]+$/;

export default function PullClientPage() {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  const [refs, setRefs] = useState<string[]>(['docker.io/library/nginx:latest']);
  const [format, setFormat] = useState<'docker-archive' | 'oci-archive'>('docker-archive');
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showAuth, setShowAuth] = useState(false);
  const [loading, setLoading] = useState(false);

  const addImage = () => {
    setRefs([...refs, '']);
  };

  const removeImage = (index: number) => {
    if (refs.length > 1) {
      setRefs(refs.filter((_, i) => i !== index));
    }
  };

  const updateImage = (index: number, value: string) => {
    const newRefs = [...refs];
    newRefs[index] = value;
    setRefs(newRefs);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Filter out empty references
    const validRefs = refs.filter(r => r.trim() !== '');

    if (validRefs.length === 0) {
      setError('Au moins une référence d\'image est requise');
      return;
    }

    // Validate all references
    for (const ref of validRefs) {
      if (!IMAGE_RE.test(ref.trim())) {
        setError(`Référence invalide: ${ref}. Caractères autorisés: lettres, chiffres, ./:@_-`);
        return;
      }
    }

    // Check if multiple images - not supported with current formats
    if (validRefs.length > 1) {
      setError('Le téléchargement de plusieurs images dans un seul fichier .tar n\'est pas supporté. Veuillez télécharger les images une par une.');
      return;
    }

    setError('');

    // Build request body with refs parameter for multiple images
    const refsParam = validRefs.map(r => r.trim()).join(',');
    const requestBody: any = {
      refs: refsParam,
      format: format,
    };

    // Add authentication securely in POST body if provided
    if (username.trim() && password.trim()) {
      requestBody.username = username.trim();
      requestBody.password = password.trim();
    }

    setLoading(true);
    try {
      // Use POST with JSON body for secure credentials transmission
      const response = await fetch('/api/pull', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        setError(`Erreur: ${errorText || response.statusText}`);
        return;
      }

      // Download the file from the response
      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'images.tar';

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(`Erreur réseau: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    } finally {
      setLoading(false);
    }
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
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">{t('pull.imageRef')}</label>
                <button
                  type="button"
                  onClick={addImage}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter une image
                </button>
              </div>
              <div className="space-y-2">
                {refs.map((ref, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={ref}
                      onChange={(e) => updateImage(index, e.target.value)}
                      placeholder="docker.io/library/nginx:latest"
                      className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none transition"
                    />
                    {refs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="px-3 py-3 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                        aria-label="Supprimer cette image"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">Exemples: docker.io/library/nginx:latest • ghcr.io/org/app:1.2.3</p>
              {refs.length > 1 && (
                <p className="text-xs text-orange-600 mt-1">⚠️ Note: Le téléchargement de plusieurs images dans un seul .tar n'est pas supporté. Utilisez une seule image à la fois.</p>
              )}
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

            <div className="border-t pt-4">
              <button
                type="button"
                onClick={() => setShowAuth(!showAuth)}
                className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-indigo-600 transition"
              >
                <Lock className="w-4 h-4" />
                {t('pull.auth.toggle')}
                {showAuth ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showAuth && (
                <div className="mt-4 space-y-3 bg-gray-50 p-4 rounded-lg">
                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700">{t('pull.auth.username')}</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="username"
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700">{t('pull.auth.password')}</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none transition"
                    />
                  </div>
                  <p className="text-xs text-gray-500">{t('pull.auth.note')}</p>
                </div>
              )}
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              {loading ? 'Téléchargement...' : t('download')}
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
