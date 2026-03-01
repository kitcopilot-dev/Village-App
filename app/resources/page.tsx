'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Resource, Child } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ClientOnly } from '@/components/ui/ClientOnly';

const RESOURCE_TYPES = [
  { value: 'website', label: '🌐 Website', emoji: '🌐' },
  { value: 'book', label: '📖 Book', emoji: '📖' },
  { value: 'video', label: '🎬 Video/Course', emoji: '🎬' },
  { value: 'printable', label: '📄 Printable', emoji: '📄' },
  { value: 'supply', label: '🛒 Supply', emoji: '🛒' },
  { value: 'app', label: '📱 App/Software', emoji: '📱' },
  { value: 'other', label: '📦 Other', emoji: '📦' },
] as const;

const SUBJECTS = [
  'Math',
  'Science',
  'Reading',
  'Writing',
  'History',
  'Geography',
  'Art',
  'Music',
  'PE/Health',
  'Foreign Language',
  'Life Skills',
  'Technology',
  'Religion',
  'General',
];

const QUICK_TAGS = ['free', 'paid', 'curriculum', 'supplement', 'hands-on', 'printable', 'online', 'outdoor'];

export default function ResourcesPage() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [resources, setResources] = useState<Resource[]>([]);
  const [kids, setKids] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  
  // Filters
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [filterChild, setFilterChild] = useState<string>('all');
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    url: '',
    type: 'website' as Resource['type'],
    subject: '',
    tags: [] as string[],
    rating: 0,
    notes: '',
    cost: '',
    child: '',
    is_favorite: false,
  });

  const loadResources = useCallback(async () => {
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;
      
      const records = await pb.collection('resources').getFullList({
        filter: `user = "${userId}"`,
        sort: '-created',
      });
      setResources(records as unknown as Resource[]);
    } catch (error) {
      console.error('Failed to load resources:', error);
    }
  }, [pb]);

  const loadKids = useCallback(async () => {
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;
      
      const records = await pb.collection('children').getFullList({
        filter: `user = "${userId}"`,
        sort: 'name',
      });
      setKids(records as unknown as Child[]);
    } catch (error) {
      console.error('Failed to load children:', error);
    }
  }, [pb]);

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }
    
    Promise.all([loadResources(), loadKids()]).finally(() => setLoading(false));
  }, [pb.authStore.isValid, router, loadResources, loadKids]);

  const handleLogout = () => {
    pb.authStore.clear();
    router.push('/');
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      url: '',
      type: 'website',
      subject: '',
      tags: [],
      rating: 0,
      notes: '',
      cost: '',
      child: '',
      is_favorite: false,
    });
    setEditingResource(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const userId = pb.authStore.model?.id;
      const payload = {
        user: userId,
        title: formData.title,
        description: formData.description || undefined,
        url: formData.url || undefined,
        type: formData.type,
        subject: formData.subject || undefined,
        tags: formData.tags.length > 0 ? formData.tags : undefined,
        rating: formData.rating || undefined,
        notes: formData.notes || undefined,
        cost: formData.cost ? parseFloat(formData.cost) : undefined,
        child: formData.child || undefined,
        is_favorite: formData.is_favorite,
        archived: false,
      };
      
      if (editingResource) {
        await pb.collection('resources').update(editingResource.id, payload);
      } else {
        await pb.collection('resources').create(payload);
      }
      
      await loadResources();
      resetForm();
    } catch (error) {
      console.error('Failed to save resource:', error);
      alert('Failed to save resource. Please try again.');
    }
  };

  const handleEdit = (resource: Resource) => {
    setFormData({
      title: resource.title,
      description: resource.description || '',
      url: resource.url || '',
      type: resource.type,
      subject: resource.subject || '',
      tags: resource.tags || [],
      rating: resource.rating || 0,
      notes: resource.notes || '',
      cost: resource.cost?.toString() || '',
      child: resource.child || '',
      is_favorite: resource.is_favorite || false,
    });
    setEditingResource(resource);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this resource?')) return;
    
    try {
      await pb.collection('resources').delete(id);
      await loadResources();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const handleArchive = async (id: string, archived: boolean) => {
    try {
      await pb.collection('resources').update(id, { archived });
      await loadResources();
    } catch (error) {
      console.error('Failed to archive:', error);
    }
  };

  const handleToggleFavorite = async (resource: Resource) => {
    try {
      await pb.collection('resources').update(resource.id, { 
        is_favorite: !resource.is_favorite 
      });
      await loadResources();
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const toggleTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  // Filtered resources
  const filteredResources = resources.filter(r => {
    if (r.archived && !showArchived) return false;
    if (!r.archived && showArchived) return false;
    if (filterType !== 'all' && r.type !== filterType) return false;
    if (filterSubject !== 'all' && r.subject !== filterSubject) return false;
    if (filterChild !== 'all' && r.child !== filterChild) return false;
    if (filterFavorites && !r.is_favorite) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesTitle = r.title.toLowerCase().includes(q);
      const matchesDesc = r.description?.toLowerCase().includes(q);
      const matchesTags = r.tags?.some(t => t.toLowerCase().includes(q));
      const matchesNotes = r.notes?.toLowerCase().includes(q);
      if (!matchesTitle && !matchesDesc && !matchesTags && !matchesNotes) return false;
    }
    return true;
  });

  // Group by subject for display
  const groupedBySubject = filteredResources.reduce((acc, r) => {
    const subject = r.subject || 'Uncategorized';
    if (!acc[subject]) acc[subject] = [];
    acc[subject].push(r);
    return acc;
  }, {} as Record<string, Resource[]>);

  // Stats
  const stats = {
    total: resources.filter(r => !r.archived).length,
    favorites: resources.filter(r => r.is_favorite && !r.archived).length,
    websites: resources.filter(r => r.type === 'website' && !r.archived).length,
    books: resources.filter(r => r.type === 'book' && !r.archived).length,
    free: resources.filter(r => r.tags?.includes('free') && !r.archived).length,
  };

  if (loading) {
    return (
      <>
        <Header showLogout onLogout={handleLogout} />
        <main className="max-w-7xl mx-auto my-12 px-8">
          <p className="text-center text-text-muted">Loading resources...</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Header showLogout onLogout={handleLogout} />
      <ClientOnly>
        <main className="max-w-7xl mx-auto my-12 px-8 pb-20 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
            <div>
              <h2 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight mb-2">
                📚 Resource Library
              </h2>
              <p className="text-text-muted">
                Organize your curriculum materials, books, websites, and supplies
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" size="sm" onClick={() => router.push('/dashboard')}>
                ← Dashboard
              </Button>
              <Button onClick={() => { resetForm(); setShowForm(true); }}>
                + Add Resource
              </Button>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
            {[
              { label: 'Total', value: stats.total, emoji: '📦' },
              { label: 'Favorites', value: stats.favorites, emoji: '⭐' },
              { label: 'Websites', value: stats.websites, emoji: '🌐' },
              { label: 'Books', value: stats.books, emoji: '📖' },
              { label: 'Free', value: stats.free, emoji: '🆓' },
            ].map((stat, i) => (
              <div 
                key={i} 
                className="bg-bg border-2 border-border rounded-xl p-4 text-center hover:border-primary transition-colors"
              >
                <div className="text-xl mb-1">{stat.emoji}</div>
                <div className="font-display text-2xl font-bold text-primary">{stat.value}</div>
                <div className="text-xs text-text-muted">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Add/Edit Form Modal */}
          {showForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <h3 className="font-display text-2xl font-bold mb-6">
                  {editingResource ? 'Edit Resource' : 'Add New Resource'}
                </h3>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold mb-1">Title *</label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full px-4 py-2 border-2 border-border rounded-lg focus:border-primary outline-none"
                        placeholder="e.g., Khan Academy Math"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Type *</label>
                      <select
                        value={formData.type}
                        onChange={e => setFormData(prev => ({ ...prev, type: e.target.value as Resource['type'] }))}
                        className="w-full px-4 py-2 border-2 border-border rounded-lg focus:border-primary outline-none bg-white"
                        required
                      >
                        {RESOURCE_TYPES.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1">URL (optional)</label>
                    <input
                      type="url"
                      value={formData.url}
                      onChange={e => setFormData(prev => ({ ...prev, url: e.target.value }))}
                      className="w-full px-4 py-2 border-2 border-border rounded-lg focus:border-primary outline-none"
                      placeholder="https://..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-4 py-2 border-2 border-border rounded-lg focus:border-primary outline-none resize-none"
                      rows={2}
                      placeholder="Brief description of this resource..."
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold mb-1">Subject</label>
                      <select
                        value={formData.subject}
                        onChange={e => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                        className="w-full px-4 py-2 border-2 border-border rounded-lg focus:border-primary outline-none bg-white"
                      >
                        <option value="">Select subject...</option>
                        {SUBJECTS.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">For Child (optional)</label>
                      <select
                        value={formData.child}
                        onChange={e => setFormData(prev => ({ ...prev, child: e.target.value }))}
                        className="w-full px-4 py-2 border-2 border-border rounded-lg focus:border-primary outline-none bg-white"
                      >
                        <option value="">All children / Family</option>
                        {kids.map(k => (
                          <option key={k.id} value={k.id}>{k.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold mb-1">Cost ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.cost}
                        onChange={e => setFormData(prev => ({ ...prev, cost: e.target.value }))}
                        className="w-full px-4 py-2 border-2 border-border rounded-lg focus:border-primary outline-none"
                        placeholder="0.00 for free"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Rating</label>
                      <div className="flex gap-1 pt-2">
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setFormData(prev => ({ 
                              ...prev, 
                              rating: prev.rating === star ? 0 : star 
                            }))}
                            className={`text-2xl transition-transform hover:scale-110 ${
                              star <= formData.rating ? 'text-yellow-400' : 'text-gray-300'
                            }`}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2">Quick Tags</label>
                    <div className="flex flex-wrap gap-2">
                      {QUICK_TAGS.map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                            formData.tags.includes(tag)
                              ? 'bg-primary text-white'
                              : 'bg-bg-alt text-text-muted hover:bg-border'
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1">Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      className="w-full px-4 py-2 border-2 border-border rounded-lg focus:border-primary outline-none resize-none"
                      rows={3}
                      placeholder="Personal notes, tips, where to buy, etc..."
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="favorite"
                      checked={formData.is_favorite}
                      onChange={e => setFormData(prev => ({ ...prev, is_favorite: e.target.checked }))}
                      className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                    />
                    <label htmlFor="favorite" className="text-sm font-medium">
                      ⭐ Mark as favorite
                    </label>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button type="submit" className="flex-1">
                      {editingResource ? 'Save Changes' : 'Add Resource'}
                    </Button>
                    <Button type="button" variant="outline" onClick={resetForm}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          )}

          {/* Filters */}
          <Card className="mb-8">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="🔍 Search resources..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-border rounded-lg focus:border-primary outline-none"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={filterType}
                  onChange={e => setFilterType(e.target.value)}
                  className="px-3 py-2 border-2 border-border rounded-lg focus:border-primary outline-none bg-white text-sm"
                >
                  <option value="all">All Types</option>
                  {RESOURCE_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <select
                  value={filterSubject}
                  onChange={e => setFilterSubject(e.target.value)}
                  className="px-3 py-2 border-2 border-border rounded-lg focus:border-primary outline-none bg-white text-sm"
                >
                  <option value="all">All Subjects</option>
                  {SUBJECTS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {kids.length > 0 && (
                  <select
                    value={filterChild}
                    onChange={e => setFilterChild(e.target.value)}
                    className="px-3 py-2 border-2 border-border rounded-lg focus:border-primary outline-none bg-white text-sm"
                  >
                    <option value="all">All Children</option>
                    {kids.map(k => (
                      <option key={k.id} value={k.id}>{k.name}</option>
                    ))}
                  </select>
                )}
                <button
                  onClick={() => setFilterFavorites(!filterFavorites)}
                  className={`px-3 py-2 border-2 rounded-lg text-sm font-medium transition-colors ${
                    filterFavorites
                      ? 'bg-yellow-100 border-yellow-400 text-yellow-700'
                      : 'border-border hover:border-primary'
                  }`}
                >
                  ⭐ Favorites
                </button>
                <button
                  onClick={() => setShowArchived(!showArchived)}
                  className={`px-3 py-2 border-2 rounded-lg text-sm font-medium transition-colors ${
                    showArchived
                      ? 'bg-gray-100 border-gray-400 text-gray-700'
                      : 'border-border hover:border-primary'
                  }`}
                >
                  📁 {showArchived ? 'Archived' : 'Active'}
                </button>
              </div>
            </div>
          </Card>

          {/* Resource List */}
          {Object.keys(groupedBySubject).length === 0 ? (
            <Card className="text-center py-16">
              <div className="text-6xl mb-4">📚</div>
              <h3 className="font-display text-2xl font-bold mb-2">No Resources Yet</h3>
              <p className="text-text-muted mb-6">
                Start building your curriculum resource library!<br />
                Add websites, books, videos, supplies, and more.
              </p>
              <Button onClick={() => { resetForm(); setShowForm(true); }}>
                Add Your First Resource
              </Button>
            </Card>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedBySubject)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([subject, items]) => (
                  <div key={subject}>
                    <h3 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
                      <span className="bg-primary/10 text-primary px-3 py-1 rounded-lg">
                        {subject}
                      </span>
                      <span className="text-sm font-normal text-text-muted">
                        ({items.length} resource{items.length !== 1 ? 's' : ''})
                      </span>
                    </h3>
                    
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {items.map(resource => {
                        const typeInfo = RESOURCE_TYPES.find(t => t.value === resource.type);
                        const childName = kids.find(k => k.id === resource.child)?.name;
                        
                        return (
                          <Card 
                            key={resource.id} 
                            className={`relative group transition-all hover:border-primary ${
                              resource.is_favorite ? 'border-yellow-400 bg-yellow-50/50' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xl">{typeInfo?.emoji}</span>
                                <h4 className="font-semibold m-0 line-clamp-1">{resource.title}</h4>
                              </div>
                              <button
                                onClick={() => handleToggleFavorite(resource)}
                                className={`text-lg transition-transform hover:scale-110 ${
                                  resource.is_favorite ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-400'
                                }`}
                              >
                                {resource.is_favorite ? '★' : '☆'}
                              </button>
                            </div>
                            
                            {resource.description && (
                              <p className="text-sm text-text-muted mb-2 line-clamp-2">
                                {resource.description}
                              </p>
                            )}
                            
                            <div className="flex flex-wrap gap-1 mb-3">
                              <span className="px-2 py-0.5 bg-bg-alt rounded text-xs font-medium">
                                {typeInfo?.label}
                              </span>
                              {childName && (
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                  {childName}
                                </span>
                              )}
                              {resource.tags?.map(tag => (
                                <span 
                                  key={tag} 
                                  className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs"
                                >
                                  {tag}
                                </span>
                              ))}
                              {resource.cost !== undefined && resource.cost > 0 && (
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                                  ${resource.cost.toFixed(2)}
                                </span>
                              )}
                              {(resource.cost === undefined || resource.cost === 0) && resource.tags?.includes('free') === false && (
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                                  Free
                                </span>
                              )}
                            </div>
                            
                            {resource.rating && resource.rating > 0 && (
                              <div className="text-yellow-400 text-sm mb-2">
                                {'★'.repeat(resource.rating)}
                                {'☆'.repeat(5 - resource.rating)}
                              </div>
                            )}
                            
                            {resource.notes && (
                              <p className="text-xs text-text-muted bg-bg-alt p-2 rounded mb-3 line-clamp-2">
                                💡 {resource.notes}
                              </p>
                            )}
                            
                            <div className="flex gap-2 mt-auto pt-2 border-t border-border">
                              {resource.url && (
                                <a
                                  href={resource.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 text-center text-sm font-medium text-primary hover:text-primary-dark py-1 px-2 rounded bg-primary/5 hover:bg-primary/10 transition-colors"
                                >
                                  Open ↗
                                </a>
                              )}
                              <button
                                onClick={() => handleEdit(resource)}
                                className="text-sm font-medium text-text-muted hover:text-text py-1 px-2 rounded hover:bg-bg-alt transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleArchive(resource.id, !resource.archived)}
                                className="text-sm font-medium text-text-muted hover:text-text py-1 px-2 rounded hover:bg-bg-alt transition-colors"
                              >
                                {resource.archived ? 'Restore' : 'Archive'}
                              </button>
                              <button
                                onClick={() => handleDelete(resource.id)}
                                className="text-sm font-medium text-red-500 hover:text-red-700 py-1 px-2 rounded hover:bg-red-50 transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Quick Tips */}
          <Card className="mt-12 bg-gradient-to-br from-primary/5 to-secondary/5">
            <h3 className="font-display text-xl font-bold mb-4">💡 Resource Library Tips</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div>
                <strong className="text-primary">🏷️ Use Tags</strong>
                <p className="text-text-muted m-0">Tag resources as &quot;free&quot;, &quot;paid&quot;, &quot;hands-on&quot;, etc. for quick filtering.</p>
              </div>
              <div>
                <strong className="text-primary">⭐ Favorite the Best</strong>
                <p className="text-text-muted m-0">Star your go-to resources for quick access during lesson time.</p>
              </div>
              <div>
                <strong className="text-primary">📝 Add Notes</strong>
                <p className="text-text-muted m-0">Include login info, tips, or where to find physical items.</p>
              </div>
              <div>
                <strong className="text-primary">👶 Assign to Child</strong>
                <p className="text-text-muted m-0">Link grade-specific resources to individual children.</p>
              </div>
              <div>
                <strong className="text-primary">📁 Archive Don&apos;t Delete</strong>
                <p className="text-text-muted m-0">Archive completed curriculum to keep history without clutter.</p>
              </div>
              <div>
                <strong className="text-primary">💰 Track Costs</strong>
                <p className="text-text-muted m-0">Log what you paid to track homeschool expenses.</p>
              </div>
            </div>
          </Card>
        </main>
      </ClientOnly>
    </>
  );
}
