'use client';

import { useState } from 'react';
import { Download, Lock, ChevronDown, ChevronUp } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import Navigation from './Navigation';
import Footer from './Footer';

const IMAGE_RE = /^[A-Za-z0-9./:@_\-]+$/;

export default function PullClientPage() {
  const { t } = useI18n();
  const [ref, setRef] = useState<string>('docker.io/library/nginx:latest');
  const [format, setFormat] = useState<'docker-archive' | 'oci-archive'>('docker-archive');
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showAuth, setShowAuth] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate reference
    if (!ref.trim()) {
      setError(t('pull.errorMissingRef'));
      return;
    }

    if (!IMAGE_RE.test(ref.trim())) {
      setError(t('pull.errorInvalidRef'));
      return;
    }

    setError('');

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
        const statusCode = response.status;
        const errorMsg = errorText || `HTTP ${statusCode}`;
        console.error('Pull failed:', { statusCode, errorMsg, body: requestBody });
        setError(`Erreur (${statusCode}): ${errorMsg}`);
        return;
      }

      // Download the file from the response
      const blob = await response.blob();
      if (blob.size === 0) {
        setError('Erreur: Réponse vide du serveur');
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
    } catch (err) {
      setError(`Erreur réseau: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      <Navigation />

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
              <p className="text-xs text-gray-500 mt-1">{t('pull.examples')}</p>
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

      <Footer />
    </div>
  );
}
