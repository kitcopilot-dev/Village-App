'use client';

import { useState, useEffect, use } from 'react';
import PocketBase from 'pocketbase';
import { PortfolioItem, PortfolioShare, Child } from '@/lib/types';

// Public page - no auth required, creates its own PocketBase instance
const createPublicPB = () => {
  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090');
  return pb;
};

interface ShareData {
  share: PortfolioShare;
  children: Child[];
  items: PortfolioItem[];
  familyName?: string;
}

export default function PublicPortfolioPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [selectedChild, setSelectedChild] = useState<string>('all');

  useEffect(() => {
    loadShareData();
  }, [token]);

  const loadShareData = async () => {
    const pb = createPublicPB();
    
    try {
      // Find the share record by token
      const shares = await pb.collection('portfolio_shares').getList(1, 1, {
        filter: `token = "${token}" && active = true`
      });

      if (shares.items.length === 0) {
        setError('This portfolio link is invalid or has expired.');
        setLoading(false);
        return;
      }

      const share = shares.items[0] as unknown as PortfolioShare;

      // Check expiration
      if (share.expires_at && new Date(share.expires_at) < new Date()) {
        setError('This portfolio link has expired. Please request a new link from the family.');
        setLoading(false);
        return;
      }

      // Increment view count
      try {
        await pb.collection('portfolio_shares').update(share.id, {
          view_count: (share.view_count || 0) + 1,
          last_viewed: new Date().toISOString()
        });
      } catch (e) {
        // Ignore view count errors
      }

      // Load children
      let childFilter = `user = "${share.user}"`;
      if (share.child) {
        childFilter = `id = "${share.child}"`;
      }
      
      const children = await pb.collection('children').getFullList({
        filter: childFilter,
        sort: 'name'
      });

      // Load portfolio items
      const childIds = children.map(c => c.id);
      const itemFilter = childIds.map(id => `child = "${id}"`).join(' || ');
      
      const items = await pb.collection('portfolio').getFullList({
        filter: itemFilter || 'id = ""',
        sort: '-date'
      });

      // Try to get family name from profile
      let familyName: string | undefined;
      try {
        const profiles = await pb.collection('profiles').getList(1, 1, {
          filter: `user = "${share.user}"`
        });
        if (profiles.items.length > 0) {
          familyName = (profiles.items[0] as any).family_name;
        }
      } catch (e) {
        // Ignore profile errors
      }

      setData({
        share,
        children: children as unknown as Child[],
        items: items as unknown as PortfolioItem[],
        familyName
      });
    } catch (e: any) {
      console.error('Share load error:', e);
      setError('Unable to load portfolio. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const getImageUrl = (item: PortfolioItem, fileName: string) => {
    const pb = createPublicPB();
    return pb.files.getURL(item as any, fileName);
  };

  const filteredItems = data?.items.filter(item => {
    if (selectedChild === 'all') return true;
    return item.child === selectedChild;
  }) || [];

  // Group by subject
  const groupedItems = filteredItems.reduce((acc, item) => {
    const s = item.subject || 'Uncategorized';
    if (!acc[s]) acc[s] = [];
    acc[s].push(item);
    return acc;
  }, {} as Record<string, PortfolioItem[]>);

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-amber-800 font-serif italic text-lg">Loading portfolio...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="text-6xl mb-6">🔒</div>
          <h1 className="text-3xl font-bold text-red-800 mb-4">Portfolio Unavailable</h1>
          <p className="text-red-700 mb-8">{error}</p>
          <a 
            href="/" 
            className="inline-block px-6 py-3 bg-amber-600 text-white rounded-full font-bold hover:bg-amber-700 transition-colors"
          >
            Go to Village Home
          </a>
        </div>
      </main>
    );
  }

  if (!data) return null;

  const { share, children, familyName } = data;
  const displayName = familyName || 'Family Portfolio';
  const childName = share.child ? children.find(c => c.id === share.child)?.name : null;

  return (
    <>
      <main className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 print:bg-white">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-sm border-b border-amber-200 sticky top-0 z-10 print:static print:border-none">
          <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-amber-900 m-0">
                {childName ? `${childName}'s Portfolio` : `${displayName} Portfolio`}
              </h1>
              {share.label && (
                <p className="text-sm text-amber-600 m-0 italic">Shared: {share.label}</p>
              )}
            </div>
            <div className="flex items-center gap-4 print:hidden">
              <button 
                onClick={() => window.print()} 
                className="px-4 py-2 bg-amber-100 text-amber-800 rounded-lg font-semibold hover:bg-amber-200 transition-colors"
              >
                🖨️ Print
              </button>
              <div className="text-3xl">🏠</div>
            </div>
          </div>
        </header>

        {/* Filter Bar */}
        {children.length > 1 && !share.child && (
          <div className="max-w-6xl mx-auto px-6 py-4 print:hidden">
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setSelectedChild('all')}
                className={`px-4 py-2 rounded-full font-semibold transition-colors ${
                  selectedChild === 'all' 
                    ? 'bg-amber-600 text-white' 
                    : 'bg-white text-amber-800 hover:bg-amber-100'
                }`}
              >
                All Students
              </button>
              {children.map(child => (
                <button
                  key={child.id}
                  onClick={() => setSelectedChild(child.id)}
                  className={`px-4 py-2 rounded-full font-semibold transition-colors ${
                    selectedChild === child.id 
                      ? 'bg-amber-600 text-white' 
                      : 'bg-white text-amber-800 hover:bg-amber-100'
                  }`}
                >
                  {child.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Portfolio Content */}
        <div className="max-w-6xl mx-auto px-6 py-8">
          {filteredItems.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-amber-300">
              <div className="text-6xl mb-4">📚</div>
              <p className="text-amber-800 text-xl font-serif italic">
                No work samples to display yet.
              </p>
            </div>
          ) : (
            <div className="space-y-12">
              {Object.entries(groupedItems)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([subject, subjItems]) => (
                  <section key={subject} className="print:break-inside-avoid">
                    <div className="flex items-center gap-4 mb-6">
                      <h2 className="text-2xl font-bold text-amber-900 m-0">{subject}</h2>
                      <div className="h-0.5 flex-1 bg-amber-200" />
                      <span className="text-xs font-bold uppercase tracking-widest text-amber-600">
                        {subjItems.length} Sample{subjItems.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {subjItems.map(item => {
                        const images = Array.isArray(item.image) ? item.image : [item.image].filter(Boolean);
                        const child = children.find(c => c.id === item.child);
                        
                        return (
                          <article 
                            key={item.id} 
                            className="bg-white rounded-2xl overflow-hidden shadow-sm border border-amber-100 hover:shadow-lg hover:border-amber-300 transition-all print:shadow-none print:border print:break-inside-avoid"
                          >
                            {/* Image */}
                            <div 
                              className="aspect-[4/3] bg-amber-50 overflow-hidden cursor-pointer relative"
                              onClick={() => images[0] && setZoomImage(getImageUrl(item, images[0]))}
                            >
                              {images.length > 0 ? (
                                <>
                                  <img 
                                    src={getImageUrl(item, images[0])} 
                                    alt={item.title}
                                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                                  />
                                  {images.length > 1 && (
                                    <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                                      +{images.length - 1} more
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-5xl opacity-30">
                                  🎨
                                </div>
                              )}
                            </div>

                            {/* Content */}
                            <div className="p-5">
                              <h3 className="font-bold text-lg text-amber-900 m-0 mb-1">{item.title}</h3>
                              {child && !share.child && (
                                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-3">
                                  by {child.name}
                                </p>
                              )}
                              {item.description && (
                                <p className="text-sm text-amber-800/80 italic mb-3 line-clamp-3">
                                  "{item.description}"
                                </p>
                              )}
                              <p className="text-xs text-amber-600 m-0">
                                {new Date(item.date).toLocaleDateString('en-US', { 
                                  month: 'long', 
                                  day: 'numeric', 
                                  year: 'numeric' 
                                })}
                              </p>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
            </div>
          )}

          {/* Footer */}
          <footer className="mt-16 pt-8 border-t border-amber-200 text-center print:mt-8">
            <p className="text-amber-600 text-sm">
              Shared via <span className="font-bold">Village Homeschool</span> • 
              {share.expires_at && (
                <span className="ml-2">
                  Link expires {new Date(share.expires_at).toLocaleDateString()}
                </span>
              )}
            </p>
            <p className="text-amber-400 text-xs mt-2">
              Views: {(share.view_count || 0) + 1}
            </p>
          </footer>
        </div>
      </main>

      {/* Lightbox */}
      {zoomImage && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-8 print:hidden"
          onClick={() => setZoomImage(null)}
        >
          <button 
            className="absolute top-6 right-6 text-white text-4xl hover:scale-110 transition-transform"
            onClick={() => setZoomImage(null)}
          >
            ✕
          </button>
          <img 
            src={zoomImage} 
            alt="Zoomed work sample" 
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
