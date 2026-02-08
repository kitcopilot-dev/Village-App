'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child, PortfolioItem } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { LoadingScreen } from '@/components/ui/Spinner';
import { Toast } from '@/components/ui/Toast';

const SUBJECTS = [
  'Language Arts',
  'Mathematics',
  'Science',
  'Social Studies',
  'Fine Arts',
  'Physical Education',
  'Electives'
];

export default function PortfolioPage() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [kids, setKids] = useState<Child[]>([]);
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [childId, setChildId] = useState('');
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Filters
  const [filterChild, setFilterChild] = useState('all');

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

      const [kidRecords, itemRecords] = await Promise.all([
        pb.collection('children').getFullList({
          filter: `user = "${userId}"`,
          sort: 'name'
        }),
        pb.collection('portfolio').getFullList({
          filter: `user = "${userId}"`,
          sort: '-date',
          expand: 'child'
        })
      ]);

      setKids(kidRecords as unknown as Child[]);
      setItems(itemRecords as unknown as PortfolioItem[]);
      
      if (kidRecords.length > 0 && !childId) {
        setChildId(kidRecords[0].id);
      }
    } catch (error) {
      console.error('Portfolio load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setImageFile(file);
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const formData = new FormData();
      formData.append('user', userId);
      formData.append('child', childId);
      formData.append('title', title);
      formData.append('subject', subject);
      formData.append('date', new Date(date).toISOString());
      formData.append('description', description);
      if (imageFile) {
        formData.append('image', imageFile);
      }

      await pb.collection('portfolio').create(formData);

      // Log activity
      try {
        await pb.collection('activity_logs').create({
          user: userId,
          child: childId,
          type: 'portfolio_add',
          title: `Added "${title}" to portfolio`,
          date: new Date().toISOString()
        });
      } catch (e) { /* ignore */ }

      setToast({ message: 'Work sample added!', type: 'success' });
      setIsModalOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Save error:', error);
      setToast({ message: 'Failed to save sample.', type: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this sample?')) return;
    try {
      await pb.collection('portfolio').delete(id);
      setToast({ message: 'Sample removed', type: 'success' });
      loadData();
    } catch (error) {
      setToast({ message: 'Failed to delete', type: 'error' });
    }
  };

  const resetForm = () => {
    setTitle('');
    setSubject(SUBJECTS[0]);
    setDate(new Date().toISOString().split('T')[0]);
    setDescription('');
    setImageFile(null);
    setImagePreview(null);
  };

  const filteredItems = items.filter(i => {
    if (filterChild !== 'all' && i.child !== filterChild) return false;
    return true;
  });

  // Group by subject
  const groupedItems = filteredItems.reduce((acc, item) => {
    const s = item.subject || 'Uncategorized';
    if (!acc[s]) acc[s] = [];
    acc[s].push(item);
    return acc;
  }, {} as Record<string, PortfolioItem[]>);

  if (loading) return <LoadingScreen message="Loading portfolio..." />;

  return (
    <>
      <Header showLogout onLogout={() => { pb.authStore.clear(); router.push('/'); }} />
      <main className="max-w-7xl mx-auto my-12 px-4 sm:px-8 pb-20 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6 mb-12">
          <div>
            <h2 className="font-display text-5xl font-extrabold tracking-tight mb-2">Subject Portfolios</h2>
            <p className="text-text-muted">A curated collection of your students&apos; best work samples.</p>
          </div>
          <div className="flex gap-4">
            <Button variant="ghost" onClick={() => router.push('/dashboard')}>📊 Dashboard</Button>
            <Button onClick={() => setIsModalOpen(true)}>+ Add Work Sample</Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-12 p-6 md:p-8">
          <div className="max-w-xs">
            <Select 
              label="Filter by Student" 
              value={filterChild} 
              onChange={(e) => setFilterChild(e.target.value)}
            >
              <option value="all">All Students</option>
              {kids.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
            </Select>
          </div>
        </Card>

        {/* Portfolio Content */}
        {filteredItems.length === 0 ? (
          <div className="text-center py-24 bg-bg-alt rounded-[3rem] border-2 border-dashed border-border">
            <p className="text-text-muted text-xl font-serif italic">Your portfolio is empty. Time to showcase some amazing work!</p>
            <Button size="lg" className="mt-8" onClick={() => setIsModalOpen(true)}>Add Your First Sample</Button>
          </div>
        ) : (
          <div className="space-y-16">
            {Object.entries(groupedItems)
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([subj, subjItems]) => (
              <div key={subj}>
                <div className="flex items-center gap-4 mb-8">
                  <h3 className="font-display text-3xl font-extrabold m-0 text-primary">{subj}</h3>
                  <div className="h-0.5 flex-1 bg-border/50"></div>
                  <span className="text-xs font-bold uppercase tracking-widest text-text-muted">{subjItems.length} Sample{subjItems.length !== 1 ? 's' : ''}</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                  {subjItems.map((item) => (
                    <Card key={item.id} className="p-0 overflow-hidden group border-border/50 hover:border-primary/30 shadow-sm">
                      <div className="relative aspect-[4/3] bg-bg-alt overflow-hidden">
                        {item.image ? (
                          <img 
                            src={pb.files.getUrl(item as any, item.image)} 
                            alt={item.title}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-6xl opacity-20">🎨</div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                           <button onClick={() => handleDelete(item.id)} className="w-12 h-12 rounded-full bg-white text-red-500 flex items-center justify-center hover:scale-110 transition-transform">🗑️</button>
                        </div>
                      </div>
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-display text-lg font-bold m-0 leading-tight">{item.title}</h4>
                        </div>
                        <p className="text-xs text-text-muted mb-4 uppercase font-bold tracking-wider">
                          🧒 {(item as any).expand?.child?.name || 'Unknown Student'}
                        </p>
                        {item.description && (
                          <p className="text-sm text-text-muted line-clamp-2 mb-4 italic">
                            &ldquo;{item.description}&rdquo;
                          </p>
                        )}
                        <p className="text-[10px] text-text-muted/60 m-0 font-bold uppercase tracking-widest">
                          {new Date(item.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add Sample Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Add Work Sample"
        subtitle="Capture a moment of learning to include in your portfolio."
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input label="Sample Title" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. My First Chemistry Experiment" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Student" value={childId} onChange={(e) => setChildId(e.target.value)} required>
              {kids.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
            </Select>
            <Select label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} required>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            <div className="mb-5">
              <label className="block text-[10px] sm:text-xs font-bold mb-1.5 sm:mb-2 uppercase tracking-wide text-primary">
                Photo / Document
              </label>
              <div className="flex flex-col gap-4">
                <input 
                  type="file" 
                  accept="image/*,.pdf" 
                  onChange={handleFileChange}
                  className="w-full text-xs text-text-muted file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-primary file:text-white"
                />
                {imagePreview && (
                  <div className="relative w-24 h-24 rounded-xl overflow-hidden border-2 border-border shadow-sm animate-fade-in">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </div>
          </div>
          <Textarea label="Notes (What was learned?)" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Learned about catalysts and exothermic reactions." />
          
          <div className="flex flex-col sm:flex-row justify-end gap-4 mt-8">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto order-2 sm:order-1">Cancel</Button>
            <Button type="submit" className="w-full sm:w-auto order-1 sm:order-2">Add to Portfolio</Button>
          </div>
        </form>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
