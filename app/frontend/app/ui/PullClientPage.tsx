'use client';

import { useState } from 'react';
import { Download, Lock, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import Navigation from './Navigation';
import Footer from './Footer';

const IMAGE_RE = /^[A-Za-z0-9./:@_\-]+$/;

export default function PullClientPage() {
  const { t } = useI18n();
  const [refs, setRefs] = useState<string>('docker.io/library/nginx:latest\ndocker.io/library/alpine:latest');
  const [format, setFormat] = useState<'docker-archive' | 'oci-archive'>('docker-archive');
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showAuth, setShowAuth] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentImage, setCurrentImage] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // Parse image references from textarea
  const parseImages = (text: string): string[] => {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Parse and validate references
    const imageRefs = parseImages(refs);
    if (imageRefs.length === 0) {
      setError(t('pull.errorMissingRef'));
      return;
    }

    // Validate all references
    for (const ref of imageRefs) {
      if (!IMAGE_RE.test(ref.trim())) {
        setError(`Référence invalide: ${ref}`);
        return;
      }
    }

    setError('');
    setLoading(true);
    setProgress({ current: 0, total: imageRefs.length });

    try {
      // Download images sequentially
      for (let i = 0; i < imageRefs.length; i++) {
        const ref = imageRefs[i];
        setCurrentImage(ref);
        setProgress({ current: i + 1, total: imageRefs.length });

        // Build request body
        const requestBody: any = {
          ref: ref.trim(),
          format: format,
        };

        // Add authentication securely in POST body if provided
        if (username.trim() && password.trim()) {
          requestBody.username = username.trim();
          requestBody.password = password.trim();
        }

        console.log(`[${i + 1}/${imageRefs.length}] Pulling: ${ref}`);

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
            const statusCode = response.status;
            const errorMsg = errorText || `HTTP ${statusCode}`;
            console.error('Pull failed:', { statusCode, errorMsg, body: requestBody });
            setError(`Erreur sur ${ref} (${statusCode}): ${errorMsg}`);
            return;
          }

          // Download the file from the response
          const blob = await response.blob();
          if (blob.size === 0) {
            setError(`Erreur: Réponse vide pour ${ref}`);
            return;
          }

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

          console.log(`✓ Téléchargé: ${filename}`);

          // Small delay between downloads to ensure cleanup
          if (i < imageRefs.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        } catch (err) {
          setError(`Erreur réseau sur ${ref}: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
          return;
        }
      }

      // All downloads successful
      setCurrentImage('');
      setError('');
    } finally {
      setLoading(false);
    }
  };

  const imageCount = parseImages(refs).length;


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      <Navigation />

      <div className="flex-1 max-w-3xl w-full mx-auto p-6">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">{t('pull.title')}</h1>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700">
                {t('pull.imageRef')} ({imageCount} image{imageCount > 1 ? 's' : ''})
              </label>
              <textarea
                value={refs}
                onChange={(e) => setRefs(e.target.value)}
                placeholder="docker.io/library/nginx:latest&#10;docker.io/library/alpine:latest&#10;ghcr.io/org/app:1.2.3"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none transition font-mono text-sm"
                rows={6}
              />
              <p className="text-xs text-gray-500 mt-1">{t('pull.multipleImages')}</p>
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

            {loading && progress.total > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-800">
                    Progression: {progress.current}/{progress.total}
                  </span>
                  <span className="text-sm font-semibold text-indigo-600">
                    {Math.round((progress.current / progress.total) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
                {currentImage && (
                  <p className="text-sm text-blue-700 font-mono break-all">{currentImage}</p>
                )}
              </div>
            )}

            {error && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              <Download className="w-4 h-4" />
              {loading ? `Téléchargement ${progress.current}/${progress.total}...` : t('download')}
            </button>
          </form>
        </div>
        <div className="text-xs text-gray-500 mt-4">{t('pull.note')}</div>
      </div>

      <Footer />
    </div>
  );
}
