'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child, CurriculumItem } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { LoadingScreen } from '@/components/ui/Spinner';

const SUBJECTS = [
  'Math', 'Language Arts', 'Reading', 'Writing', 'Science', 'History',
  'Geography', 'Art', 'Music', 'PE', 'Foreign Language', 'Bible/Religion',
  'Life Skills', 'Technology', 'Social Studies', 'General'
];

const TYPES = [
  { value: 'textbook', label: '📚 Textbook', icon: '📚' },
  { value: 'workbook', label: '📝 Workbook', icon: '📝' },
  { value: 'online', label: '💻 Online Course', icon: '💻' },
  { value: 'video', label: '🎬 Video/DVD', icon: '🎬' },
  { value: 'kit', label: '🧪 Kit/Lab', icon: '🧪' },
  { value: 'game', label: '🎮 Game', icon: '🎮' },
  { value: 'manipulative', label: '🧩 Manipulative', icon: '🧩' },
  { value: 'other', label: '📦 Other', icon: '📦' }
];

const STATUSES = [
  { value: 'in_use', label: '📖 In Use', color: 'bg-green-100 text-green-800' },
  { value: 'completed', label: '✅ Completed', color: 'bg-blue-100 text-blue-800' },
  { value: 'planned', label: '📅 Planned', color: 'bg-purple-100 text-purple-800' },
  { value: 'wishlist', label: '⭐ Wishlist', color: 'bg-amber-100 text-amber-800' },
  { value: 'archived', label: '📁 Archived', color: 'bg-gray-100 text-gray-600' }
];

const GRADE_LEVELS = [
  'Pre-K', 'Kindergarten', '1st', '2nd', '3rd', '4th', '5th',
  '6th', '7th', '8th', '9th', '10th', '11th', '12th', 'All Ages'
];

export default function CurriculumPage() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [items, setItems] = useState<CurriculumItem[]>([]);
  const [kids, setKids] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<CurriculumItem | null>(null);
  
  // Filters
  const [filterChild, setFilterChild] = useState('all');
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    publisher: '',
    subject: 'General',
    type: 'textbook' as CurriculumItem['type'],
    status: 'planned' as CurriculumItem['status'],
    cost: '',
    purchase_date: '',
    start_date: '',
    end_date: '',
    grade_level: '',
    rating: 0,
    notes: '',
    link: '',
    child: '',
    is_favorite: false
  });

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const [itemRecords, childRecords] = await Promise.all([
        pb.collection('curriculum_items').getFullList({
          filter: `user = "${userId}"`,
          sort: '-created'
        }).catch(() => []),
        pb.collection('children').getFullList({
          filter: `user = "${userId}"`,
          sort: 'name'
        })
      ]);

      setItems(itemRecords as unknown as CurriculumItem[]);
      setKids(childRecords as unknown as Child[]);
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      publisher: '',
      subject: 'General',
      type: 'textbook',
      status: 'planned',
      cost: '',
      purchase_date: '',
      start_date: '',
      end_date: '',
      grade_level: '',
      rating: 0,
      notes: '',
      link: '',
      child: '',
      is_favorite: false
    });
    setEditingItem(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const data = {
        user: userId,
        name: formData.name,
        publisher: formData.publisher || null,
        subject: formData.subject,
        type: formData.type,
        status: formData.status,
        cost: formData.cost ? parseFloat(formData.cost) : null,
        purchase_date: formData.purchase_date || null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        grade_level: formData.grade_level || null,
        rating: formData.rating || null,
        notes: formData.notes || null,
        link: formData.link || null,
        child: formData.child || null,
        is_favorite: formData.is_favorite
      };

      if (editingItem) {
        await pb.collection('curriculum_items').update(editingItem.id, data);
      } else {
        await pb.collection('curriculum_items').create(data);
      }

      setShowModal(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Save error:', error);
    }
  };

  const handleEdit = (item: CurriculumItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      publisher: item.publisher || '',
      subject: item.subject,
      type: item.type,
      status: item.status,
      cost: item.cost?.toString() || '',
      purchase_date: item.purchase_date || '',
      start_date: item.start_date || '',
      end_date: item.end_date || '',
      grade_level: item.grade_level || '',
      rating: item.rating || 0,
      notes: item.notes || '',
      link: item.link || '',
      child: item.child || '',
      is_favorite: item.is_favorite
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this curriculum item?')) return;
    try {
      await pb.collection('curriculum_items').delete(id);
      loadData();
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const toggleFavorite = async (item: CurriculumItem) => {
    try {
      await pb.collection('curriculum_items').update(item.id, {
        is_favorite: !item.is_favorite
      });
      loadData();
    } catch (error) {
      console.error('Toggle favorite error:', error);
    }
  };

  const updateStatus = async (item: CurriculumItem, newStatus: CurriculumItem['status']) => {
    try {
      await pb.collection('curriculum_items').update(item.id, {
        status: newStatus
      });
      loadData();
    } catch (error) {
      console.error('Update status error:', error);
    }
  };

  // Filter items
  const filteredItems = items.filter(item => {
    if (filterChild !== 'all' && item.child !== filterChild && !(filterChild === 'family' && !item.child)) return false;
    if (filterSubject !== 'all' && item.subject !== filterSubject) return false;
    if (filterStatus !== 'all' && item.status !== filterStatus) return false;
    if (filterType !== 'all' && item.type !== filterType) return false;
    if (showFavoritesOnly && !item.is_favorite) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!item.name.toLowerCase().includes(query) && 
          !item.publisher?.toLowerCase().includes(query) &&
          !item.notes?.toLowerCase().includes(query)) return false;
    }
    return true;
  });

  // Calculate stats
  const totalItems = items.length;
  const inUseCount = items.filter(i => i.status === 'in_use').length;
  const completedCount = items.filter(i => i.status === 'completed').length;
  const totalSpent = items.reduce((sum, i) => sum + (i.cost || 0), 0);
  const wishlistTotal = items.filter(i => i.status === 'wishlist').reduce((sum, i) => sum + (i.cost || 0), 0);

  // Group by subject for overview
  const subjectCounts = SUBJECTS.reduce((acc, subject) => {
    acc[subject] = items.filter(i => i.subject === subject).length;
    return acc;
  }, {} as Record<string, number>);

  const getTypeIcon = (type: CurriculumItem['type']) => {
    return TYPES.find(t => t.value === type)?.icon || '📦';
  };

  const getStatusBadge = (status: CurriculumItem['status']) => {
    const statusInfo = STATUSES.find(s => s.value === status);
    return statusInfo || { label: status, color: 'bg-gray-100 text-gray-600' };
  };

  const getChildName = (childId?: string) => {
    if (!childId) return 'Family';
    const kid = kids.find(k => k.id === childId);
    return kid?.name || 'Unknown';
  };

  const renderStars = (rating: number, interactive: boolean = false) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type={interactive ? 'button' : undefined}
            onClick={interactive ? () => setFormData(prev => ({ ...prev, rating: star })) : undefined}
            className={`${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform`}
          >
            <span className={star <= rating ? 'text-amber-400' : 'text-gray-300'}>
              ★
            </span>
          </button>
        ))}
      </div>
    );
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#FDFCF8] pt-20 pb-32 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-display font-bold text-[#4B6344]">
                📚 Curriculum Library
              </h1>
              <p className="text-gray-600 mt-1">
                Track your homeschool curriculum, books, and resources
              </p>
            </div>
            <Button onClick={() => { resetForm(); setShowModal(true); }}>
              + Add Item
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-[#4B6344]">{totalItems}</div>
              <div className="text-sm text-gray-600">Total Items</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{inUseCount}</div>
              <div className="text-sm text-gray-600">In Use</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{completedCount}</div>
              <div className="text-sm text-gray-600">Completed</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-[#D97757]">${totalSpent.toFixed(0)}</div>
              <div className="text-sm text-gray-600">Invested</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-600">${wishlistTotal.toFixed(0)}</div>
              <div className="text-sm text-gray-600">Wishlist</div>
            </Card>
          </div>

          {/* Subject Overview */}
          <Card className="p-4 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Coverage by Subject</h3>
            <div className="flex flex-wrap gap-2">
              {SUBJECTS.filter(s => subjectCounts[s] > 0).map(subject => (
                <button
                  key={subject}
                  onClick={() => setFilterSubject(filterSubject === subject ? 'all' : subject)}
                  className={`px-3 py-1 rounded-full text-sm transition-all ${
                    filterSubject === subject 
                      ? 'bg-[#4B6344] text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {subject} ({subjectCounts[subject]})
                </button>
              ))}
            </div>
          </Card>

          {/* Filters */}
          <Card className="p-4 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Select
                value={filterChild}
                onChange={(e) => setFilterChild(e.target.value)}
              >
                <option value="all">All Children</option>
                <option value="family">Family-wide</option>
                {kids.map(kid => (
                  <option key={kid.id} value={kid.id}>{kid.name}</option>
                ))}
              </Select>
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">All Statuses</option>
                {STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </Select>
              <Select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">All Types</option>
                {TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </Select>
              <Select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
              >
                <option value="all">All Subjects</option>
                {SUBJECTS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
              <button
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className={`px-4 py-2 rounded-lg border transition-all ${
                  showFavoritesOnly 
                    ? 'bg-amber-100 border-amber-300 text-amber-700' 
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {showFavoritesOnly ? '⭐ Favorites' : '☆ Favorites'}
              </button>
            </div>
          </Card>

          {/* Items List */}
          {filteredItems.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="text-6xl mb-4">📚</div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                {items.length === 0 ? 'No curriculum yet' : 'No items match your filters'}
              </h3>
              <p className="text-gray-500 mb-4">
                {items.length === 0 
                  ? 'Start building your homeschool library by adding your first item!'
                  : 'Try adjusting your filters to see more items.'}
              </p>
              {items.length === 0 && (
                <Button onClick={() => { resetForm(); setShowModal(true); }}>
                  + Add Your First Item
                </Button>
              )}
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredItems.map(item => {
                const statusBadge = getStatusBadge(item.status);
                return (
                  <Card key={item.id} className="p-4 hover:shadow-md transition-shadow">
                    <div className="flex flex-col sm:flex-row gap-4">
                      {/* Type Icon */}
                      <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-2xl">
                        {getTypeIcon(item.type)}
                      </div>
                      
                      {/* Main Content */}
                      <div className="flex-grow min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-gray-900 truncate">
                                {item.name}
                              </h3>
                              <button
                                onClick={() => toggleFavorite(item)}
                                className="text-lg hover:scale-110 transition-transform"
                              >
                                {item.is_favorite ? '⭐' : '☆'}
                              </button>
                            </div>
                            {item.publisher && (
                              <p className="text-sm text-gray-500">{item.publisher}</p>
                            )}
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${statusBadge.color}`}>
                            {statusBadge.label}
                          </span>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2 mt-2 text-sm">
                          <span className="px-2 py-0.5 bg-[#4B6344]/10 text-[#4B6344] rounded">
                            {item.subject}
                          </span>
                          <span className="text-gray-500">
                            {getChildName(item.child)}
                          </span>
                          {item.grade_level && (
                            <span className="text-gray-400">• {item.grade_level}</span>
                          )}
                          {item.cost && (
                            <span className="text-[#D97757] font-medium">
                              ${item.cost.toFixed(2)}
                            </span>
                          )}
                          {item.rating && item.rating > 0 && (
                            <span className="text-amber-400">
                              {'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}
                            </span>
                          )}
                        </div>
                        
                        {item.notes && (
                          <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                            {item.notes}
                          </p>
                        )}
                        
                        {item.link && (
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-2"
                          >
                            🔗 View Resource
                          </a>
                        )}
                      </div>
                      
                      {/* Actions */}
                      <div className="flex sm:flex-col gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleEdit(item)}
                          className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                          ✏️ Edit
                        </button>
                        <select
                          value={item.status}
                          onChange={(e) => updateStatus(item, e.target.value as CurriculumItem['status'])}
                          className="px-2 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors border-0 cursor-pointer"
                        >
                          {STATUSES.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); resetForm(); }}
        title={editingItem ? 'Edit Curriculum Item' : 'Add Curriculum Item'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Name *"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Saxon Math 5/4"
              required
            />
            <Input
              label="Publisher"
              value={formData.publisher}
              onChange={(e) => setFormData(prev => ({ ...prev, publisher: e.target.value }))}
              placeholder="e.g., Saxon Publishers"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="Subject *"
              value={formData.subject}
              onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
            >
              {SUBJECTS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
            <Select
              label="Type"
              value={formData.type}
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as CurriculumItem['type'] }))}
            >
              {TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
            <Select
              label="Status"
              value={formData.status}
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as CurriculumItem['status'] }))}
            >
              {STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="For Child"
              value={formData.child}
              onChange={(e) => setFormData(prev => ({ ...prev, child: e.target.value }))}
            >
              <option value="">Family-wide</option>
              {kids.map(kid => (
                <option key={kid.id} value={kid.id}>{kid.name}</option>
              ))}
            </Select>
            <Select
              label="Grade Level"
              value={formData.grade_level}
              onChange={(e) => setFormData(prev => ({ ...prev, grade_level: e.target.value }))}
            >
              <option value="">Select grade...</option>
              {GRADE_LEVELS.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </Select>
            <Input
              label="Cost ($)"
              type="number"
              step="0.01"
              min="0"
              value={formData.cost}
              onChange={(e) => setFormData(prev => ({ ...prev, cost: e.target.value }))}
              placeholder="0.00"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Purchase Date"
              type="date"
              value={formData.purchase_date}
              onChange={(e) => setFormData(prev => ({ ...prev, purchase_date: e.target.value }))}
            />
            <Input
              label="Start Date"
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
            />
            <Input
              label="End Date"
              type="date"
              value={formData.end_date}
              onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
            />
          </div>

          <Input
            label="Link"
            type="url"
            value={formData.link}
            onChange={(e) => setFormData(prev => ({ ...prev, link: e.target.value }))}
            placeholder="https://..."
          />

          <Textarea
            label="Notes"
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Add any notes about this curriculum..."
            rows={3}
          />

          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
              {renderStars(formData.rating, true)}
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_favorite}
                onChange={(e) => setFormData(prev => ({ ...prev, is_favorite: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-[#4B6344] focus:ring-[#4B6344]"
              />
              <span className="text-sm text-gray-700">⭐ Mark as Favorite</span>
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1">
              {editingItem ? 'Save Changes' : 'Add Item'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => { setShowModal(false); resetForm(); }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
