'use client';

import { useState } from 'react';
import { Search, Lock, ChevronDown, ChevronUp, AlertCircle, Loader } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import Navigation from './Navigation';
import Footer from './Footer';

interface RegistryImage {
  name: string;
  tags: string[];
  expanded: boolean;
}

export default function RegistryExplorer() {
  const { t } = useI18n();
  const [registry, setRegistry] = useState('docker.io');
  const [images, setImages] = useState<RegistryImage[]>([]);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showAuth, setShowAuth] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchImages = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!registry.trim()) {
      setError(t('registry.errorMissingRegistry'));
      return;
    }

    setError('');
    setLoading(true);
    setImages([]);

    try {
      const params = new URLSearchParams({
        registry: registry.trim(),
      });

      if (username.trim() && password.trim()) {
        params.append('username', username.trim());
        params.append('password', password.trim());
      }

      const response = await fetch(`/api/registryList?${params}`, {
        method: 'GET',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const errorMsg = data.error || `HTTP ${response.status}`;
        setError(errorMsg);
        return;
      }

      const data = await response.json();
      const repos = data.repositories || [];

      // Initialize images array with empty tags (will be fetched on expand)
      const imageList: RegistryImage[] = repos.map((repo: string) => ({
        name: repo,
        tags: [],
        expanded: false,
      }));

      setImages(imageList);
    } catch (err) {
      setError(t('registry.errorFetchFailed'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTags = async (imageName: string, index: number) => {
    try {
      const params = new URLSearchParams({
        registry: registry.trim(),
        image: imageName,
      });

      if (username.trim() && password.trim()) {
        params.append('username', username.trim());
        params.append('password', password.trim());
      }

      const response = await fetch(`/api/registryTags?${params}`, {
        method: 'GET',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const errorMsg = data.error || `HTTP ${response.status}`;
        setError(errorMsg);
        return;
      }

      const data = await response.json();
      const tags = data.tags || [];

      // Update the image with fetched tags and toggle expanded state
      setImages((prevImages) => {
        const newImages = [...prevImages];
        newImages[index] = {
          ...newImages[index],
          tags,
          expanded: !newImages[index].expanded,
        };
        return newImages;
      });
    } catch (err) {
      setError(t('registry.errorFetchFailed'));
      console.error(err);
    }
  };

  const toggleImage = (index: number) => {
    if (images[index].tags.length === 0) {
      // Tags not fetched yet, fetch them
      fetchTags(images[index].name, index);
    } else {
      // Tags already fetched, just toggle
      setImages((prevImages) => {
        const newImages = [...prevImages];
        newImages[index].expanded = !newImages[index].expanded;
        return newImages;
      });
    }
  };

  const filteredImages = images.filter((img) =>
    img.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navigation />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-12">
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold text-excalidraw-slate mb-2">
              {t('registry.title')}
            </h1>
            <p className="text-gray-600 text-lg">
              {t('registry.description')}
            </p>
          </div>

          {/* Registry Input Form */}
          <form onSubmit={fetchImages} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-excalidraw-slate">
                {t('registry.registryUrl')}
              </label>
              <input
                type="text"
                value={registry}
                onChange={(e) => setRegistry(e.target.value)}
                placeholder={t('registry.registryPlaceholder')}
                className="w-full px-4 py-3 border-2 border-excalidraw-slate rounded-lg font-mono text-sm focus:outline-none focus:border-excalidraw-slate"
                disabled={loading}
              />
              <p className="text-xs text-gray-500">
                {t('registry.registryHelp')}
              </p>
            </div>

            {/* Authentication Toggle */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setShowAuth(!showAuth)}
                className="flex items-center gap-2 text-sm font-medium text-excalidraw-slate hover:opacity-70 transition"
              >
                <Lock className="w-4 h-4" />
                {t('registry.authentication')}
              </button>

              {showAuth && (
                <div className="space-y-3 pl-6 border-l-2 border-excalidraw-slate">
                  <div>
                    <label className="block text-sm font-medium text-excalidraw-slate mb-1">
                      {t('registry.username')}
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-excalidraw-slate"
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-excalidraw-slate mb-1">
                      {t('registry.password')}
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-excalidraw-slate"
                      disabled={loading}
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 bg-excalidraw-slate text-white rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader className="w-4 h-4 animate-spin" />
                  {t('registry.loading')}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Search className="w-4 h-4" />
                  {t('registry.search')}
                </span>
              )}
            </button>
          </form>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-900">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Search Bar */}
          {images.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-excalidraw-slate">
                {t('registry.filterImages')}
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('registry.searchPlaceholder')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-excalidraw-slate"
              />
            </div>
          )}

          {/* Images List */}
          {!loading && images.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-600">
                {t('registry.found')} {filteredImages.length} {t('registry.image', { count: filteredImages.length })}
              </p>

              <div className="space-y-2">
                {filteredImages.map((image, index) => (
                  <div
                    key={image.name}
                    className="border border-gray-200 rounded-lg overflow-hidden"
                  >
                    {/* Image Header */}
                    <button
                      onClick={() => toggleImage(images.indexOf(image))}
                      className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition flex items-center justify-between"
                    >
                      <span className="font-mono text-sm text-excalidraw-slate">
                        {image.name}
                      </span>
                      {image.expanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-600" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-600" />
                      )}
                    </button>

                    {/* Tags List */}
                    {image.expanded && (
                      <div className="border-t border-gray-200 bg-white">
                        {image.tags.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-gray-500">
                            {t('registry.noTags')}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 p-4">
                            {image.tags.map((tag) => (
                              <div
                                key={tag}
                                className="px-3 py-2 bg-gray-100 rounded text-sm font-mono text-gray-700 break-all"
                              >
                                {tag}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && images.length === 0 && !error && (
            <div className="text-center py-12">
              <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">
                {t('registry.empty')}
              </p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
