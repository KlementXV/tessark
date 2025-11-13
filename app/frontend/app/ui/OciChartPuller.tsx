'use client';

import { useState } from 'react';
import { Download, AlertCircle, Loader2, Package, Lock, ChevronDown, ChevronUp } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import Navigation from './Navigation';
import Footer from './Footer';

type DownloadState = {
  loading: boolean;
  error: string;
};

export default function OciChartPuller() {
  const { t } = useI18n();
  const [reference, setReference] = useState('');
  const [version, setVersion] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showAuth, setShowAuth] = useState(false);
  const [state, setState] = useState<DownloadState>({ loading: false, error: '' });

  const handlePullChart = async () => {
    if (!reference.trim()) {
      setState({ loading: false, error: t('oci.errorInvalidRef') || 'Please enter a chart reference' });
      return;
    }

    setState({ loading: true, error: '' });

    try {
      const payload = {
        ref: reference.trim(),
        ...(version.trim() && { version: version.trim() }),
        ...(username.trim() && { username: username.trim() }),
        ...(password.trim() && { password: password.trim() }),
      };

      const res = await fetch('/api/pullChart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let errorMsg = `HTTP ${res.status}`;
        try {
          const text = await res.text();
          errorMsg = text || errorMsg;
        } catch {}
        throw new Error(errorMsg);
      }

      // Get the filename from Content-Disposition header
      const contentDisposition = res.headers.get('content-disposition');
      let filename = 'chart.tgz';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="([^"]+)"/);
        if (match) filename = match[1];
      }

      // Download the file
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setState({ loading: false, error: '' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setState({ loading: false, error: message });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !state.loading) {
      handlePullChart();
    }
  };

  return (
    <div className="min-h-screen excalidraw-bg flex flex-col">
      <Navigation />

      <div className="flex-1 max-w-6xl mx-auto p-6 w-full">
        <div className="excalidraw-card p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Package className="w-8 h-8 text-excalidraw-slate" />
            <h1 className="text-3xl font-bold text-excalidraw-slate">
              {t('oci.title') || 'Pull OCI Chart'}
            </h1>
          </div>

          <p className="text-excalidraw-slate mb-6">
            {t('oci.description') || 'Download Helm charts stored as OCI artifacts in container registries.'}
          </p>

          <div className="space-y-4">
            {/* Chart Reference Input */}
            <div>
              <label className="block text-sm font-semibold text-excalidraw-slate mb-2">
                {t('oci.chartRef') || 'Chart Reference'}
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="ghcr.io/prometheus-community/charts/kube-prometheus-stack"
                className="sketchy-input w-full"
              />
              <p className="text-xs text-excalidraw-slate opacity-70 mt-2">
                {t('oci.chartRefHelp') || 'Example: ghcr.io/prometheus-community/charts/kube-prometheus-stack'}
              </p>
            </div>

            {/* Version Input */}
            <div>
              <label className="block text-sm font-semibold text-excalidraw-slate mb-2">
                {t('oci.version') || 'Version'} ({t('oci.optional') || 'Optional'})
              </label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="79.5.0"
                className="sketchy-input w-full"
              />
              <p className="text-xs text-excalidraw-slate opacity-70 mt-2">
                {t('oci.versionHelp') || 'If not specified, the latest version will be pulled'}
              </p>
            </div>

            {/* Authentication Section - Collapsible */}
            <div className="collapsible-section">
              <button
                type="button"
                onClick={() => setShowAuth(!showAuth)}
                className="collapsible-toggle"
              >
                <Lock className="w-4 h-4" />
                {t('oci.authentication') || 'Authentication'} ({t('oci.optional') || 'Optional'})
                {showAuth ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showAuth && (
                <div className="collapsible-content accent-section-blue border-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-excalidraw-slate mb-2">
                        {t('oci.username') || 'Username'}
                      </label>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={t('oci.username') || 'Username'}
                        className="sketchy-input w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-excalidraw-slate mb-2">
                        {t('oci.password') || 'Password'}
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={t('oci.password') || 'Password'}
                        className="sketchy-input w-full"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-excalidraw-slate opacity-70 mt-2">
                    {t('oci.authNote') || 'Your credentials are sent securely and not stored'}
                  </p>
                </div>
              )}
            </div>

            {/* Error Message */}
            {state.error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded border-2 border-red-300">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{state.error}</span>
              </div>
            )}

            {/* Download Button */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={handlePullChart}
                disabled={state.loading || !reference.trim()}
                className="accent-button accent-button-orange disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {state.loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t('oci.pulling') || 'Pulling...'}
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    {t('oci.pull') || 'Pull Chart'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Information Card */}
        <div className="excalidraw-card p-8">
          <h2 className="text-2xl font-bold text-excalidraw-slate mb-4">
            {t('oci.howItWorks') || 'How it Works'}
          </h2>
          <div className="space-y-3 text-excalidraw-slate text-sm opacity-85">
            <p>
              {t('oci.help1') ||
                '1. Enter the full OCI reference to your chart (e.g., ghcr.io/prometheus-community/charts/kube-prometheus-stack)'}
            </p>
            <p>
              {t('oci.help2') || '2. Optionally specify a version tag or leave empty for the latest'}
            </p>
            <p>
              {t('oci.help3') || '3. If the registry requires authentication, provide your credentials'}
            </p>
            <p>
              {t('oci.help4') || '4. Click "Pull Chart" to download the chart as a .tgz file'}
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
