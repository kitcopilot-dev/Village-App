'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child, FieldTrip } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { LoadingScreen } from '@/components/ui/Spinner';
import { Toast } from '@/components/ui/Toast';
import { ClientOnly } from '@/components/ui/ClientOnly';

const SUBJECTS = [
  { value: 'science', label: 'Science', emoji: '🔬' },
  { value: 'history', label: 'History', emoji: '🏛️' },
  { value: 'nature', label: 'Nature & Environment', emoji: '🌿' },
  { value: 'art', label: 'Art & Culture', emoji: '🎨' },
  { value: 'math', label: 'Math', emoji: '🔢' },
  { value: 'geography', label: 'Geography', emoji: '🌍' },
  { value: 'civics', label: 'Civics & Government', emoji: '⚖️' },
  { value: 'technology', label: 'Technology', emoji: '💻' },
  { value: 'music', label: 'Music', emoji: '🎵' },
  { value: 'pe', label: 'Physical Education', emoji: '⚽' },
  { value: 'language', label: 'Foreign Language', emoji: '🗣️' },
  { value: 'life_skills', label: 'Life Skills', emoji: '🏠' },
  { value: 'agriculture', label: 'Agriculture', emoji: '🌾' },
  { value: 'astronomy', label: 'Astronomy', emoji: '🔭' },
  { value: 'marine', label: 'Marine Biology', emoji: '🐠' },
];

const TRIP_TYPES = [
  { value: 'museum', label: 'Museum', emoji: '🏛️' },
  { value: 'nature', label: 'Nature Walk/Hike', emoji: '🥾' },
  { value: 'zoo', label: 'Zoo/Aquarium', emoji: '🦁' },
  { value: 'farm', label: 'Farm Visit', emoji: '🐄' },
  { value: 'historic', label: 'Historic Site', emoji: '🏰' },
  { value: 'science_center', label: 'Science Center', emoji: '🔬' },
  { value: 'library', label: 'Library Visit', emoji: '📚' },
  { value: 'factory', label: 'Factory/Business Tour', emoji: '🏭' },
  { value: 'concert', label: 'Concert/Performance', emoji: '🎭' },
  { value: 'park', label: 'State/National Park', emoji: '🏞️' },
  { value: 'community', label: 'Community Service', emoji: '🤝' },
  { value: 'sports', label: 'Sports Event', emoji: '🏟️' },
  { value: 'other', label: 'Other', emoji: '📍' },
];

export default function FieldTripsPage() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [kids, setKids] = useState<Child[]>([]);
  const [trips, setTrips] = useState<FieldTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<FieldTrip | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showDetails, setShowDetails] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [durationHours, setDurationHours] = useState('');
  const [selectedKids, setSelectedKids] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [tripType, setTripType] = useState('other');
  const [description, setDescription] = useState('');
  const [learningObjectives, setLearningObjectives] = useState('');
  const [highlights, setHighlights] = useState('');
  const [cost, setCost] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  // Filters
  const [filterChild, setFilterChild] = useState('all');
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterYear, setFilterYear] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

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

      const [kidRecords, tripRecords] = await Promise.all([
        pb.collection('children').getFullList({
          filter: `user = "${userId}"`,
          sort: 'name'
        }),
        pb.collection('field_trips').getFullList({
          filter: `user = "${userId}"`,
          sort: '-date'
        }).catch(() => [])
      ]);

      setKids(kidRecords as unknown as Child[]);
      setTrips(tripRecords as unknown as FieldTrip[]);
    } catch (error) {
      console.error('Field trips load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setImageFiles(prev => [...prev, ...files].slice(0, 10)); // Max 10 photos
    
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreviews(prev => [...prev, reader.result as string].slice(0, 10));
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const removeFile = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const toggleKidSelection = (kidId: string) => {
    setSelectedKids(prev => 
      prev.includes(kidId) 
        ? prev.filter(id => id !== kidId)
        : [...prev, kidId]
    );
  };

  const toggleSubjectSelection = (subject: string) => {
    setSelectedSubjects(prev => 
      prev.includes(subject) 
        ? prev.filter(s => s !== subject)
        : [...prev, subject]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedKids.length === 0) {
      setToast({ message: 'Please select at least one child who attended.', type: 'error' });
      return;
    }
    
    if (selectedSubjects.length === 0) {
      setToast({ message: 'Please select at least one subject covered.', type: 'error' });
      return;
    }
    
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const formData = new FormData();
      formData.append('user', userId);
      formData.append('title', title);
      formData.append('location', location);
      formData.append('date', new Date(date).toISOString());
      formData.append('trip_type', tripType);
      formData.append('description', description);
      formData.append('is_favorite', 'false');
      
      // Handle arrays
      selectedKids.forEach(kid => formData.append('children', kid));
      selectedSubjects.forEach(subj => formData.append('subjects', subj));
      
      if (durationHours) formData.append('duration_hours', durationHours);
      if (learningObjectives) formData.append('learning_objectives', learningObjectives);
      if (highlights) formData.append('highlights', highlights);
      if (cost) formData.append('cost', cost);
      
      imageFiles.forEach(file => {
        formData.append('photos', file);
      });

      if (editingTrip) {
        await pb.collection('field_trips').update(editingTrip.id, formData);
        setToast({ message: 'Field trip updated!', type: 'success' });
      } else {
        await pb.collection('field_trips').create(formData);
        setToast({ message: 'Field trip logged!', type: 'success' });
      }

      // Log activity
      try {
        await pb.collection('activity_logs').create({
          user: userId,
          child: selectedKids[0],
          type: 'field_trip',
          title: `Field trip: ${title}`,
          date: new Date().toISOString()
        });
      } catch (e) { /* ignore */ }

      setIsModalOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Save error:', error);
      setToast({ message: 'Failed to save field trip.', type: 'error' });
    }
  };

  const handleEdit = (trip: FieldTrip) => {
    setEditingTrip(trip);
    setTitle(trip.title);
    setLocation(trip.location);
    setDate(new Date(trip.date).toISOString().split('T')[0]);
    setDurationHours(trip.duration_hours?.toString() || '');
    setSelectedKids(trip.children || []);
    setSelectedSubjects(trip.subjects || []);
    setTripType((trip as any).trip_type || 'other');
    setDescription(trip.description);
    setLearningObjectives(trip.learning_objectives || '');
    setHighlights(trip.highlights || '');
    setCost(trip.cost?.toString() || '');
    setImageFiles([]);
    setImagePreviews([]);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this field trip?')) return;
    try {
      await pb.collection('field_trips').delete(id);
      setToast({ message: 'Field trip deleted', type: 'success' });
      loadData();
    } catch (error) {
      setToast({ message: 'Failed to delete', type: 'error' });
    }
  };

  const handleToggleFavorite = async (trip: FieldTrip) => {
    try {
      await pb.collection('field_trips').update(trip.id, {
        is_favorite: !trip.is_favorite
      });
      loadData();
    } catch (error) {
      setToast({ message: 'Failed to update', type: 'error' });
    }
  };

  const resetForm = () => {
    setEditingTrip(null);
    setTitle('');
    setLocation('');
    setDate(new Date().toISOString().split('T')[0]);
    setDurationHours('');
    setSelectedKids([]);
    setSelectedSubjects([]);
    setTripType('other');
    setDescription('');
    setLearningObjectives('');
    setHighlights('');
    setCost('');
    setImageFiles([]);
    setImagePreviews([]);
  };

  const getImageUrl = (trip: FieldTrip, fileName: string) => {
    return pb.files.getURL(trip as any, fileName);
  };

  // Get unique years for filter
  const years = [...new Set(trips.map(t => new Date(t.date).getFullYear()))].sort((a, b) => b - a);

  // Filter trips
  const filteredTrips = trips.filter(trip => {
    if (filterChild !== 'all' && !trip.children?.includes(filterChild)) return false;
    if (filterSubject !== 'all' && !trip.subjects?.includes(filterSubject)) return false;
    if (filterYear !== 'all' && new Date(trip.date).getFullYear().toString() !== filterYear) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return trip.title.toLowerCase().includes(query) || 
             trip.location.toLowerCase().includes(query) ||
             trip.description.toLowerCase().includes(query);
    }
    return true;
  });

  // Calculate stats
  const stats = {
    totalTrips: trips.length,
    totalHours: trips.reduce((sum, t) => sum + (t.duration_hours || 0), 0),
    totalCost: trips.reduce((sum, t) => sum + (t.cost || 0), 0),
    uniqueSubjects: [...new Set(trips.flatMap(t => t.subjects || []))].length,
    favorites: trips.filter(t => t.is_favorite).length,
    thisMonth: trips.filter(t => {
      const tripDate = new Date(t.date);
      const now = new Date();
      return tripDate.getMonth() === now.getMonth() && tripDate.getFullYear() === now.getFullYear();
    }).length
  };

  const getSubjectInfo = (value: string) => SUBJECTS.find(s => s.value === value) || { emoji: '📍', label: value };
  const getTripTypeInfo = (value: string) => TRIP_TYPES.find(t => t.value === value) || { emoji: '📍', label: value };

  if (loading) return <LoadingScreen message="Loading field trips..." />;

  return (
    <>
      <Header showLogout onLogout={() => { pb.authStore.clear(); router.push('/'); }} />
      <ClientOnly>
        <main className="max-w-7xl mx-auto my-12 px-4 sm:px-8 pb-20 animate-fade-in">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6 mb-8">
            <div>
              <h2 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight mb-2">
                🗺️ Field Trip Logger
              </h2>
              <p className="text-text-muted">Document your educational adventures for portfolios and memories.</p>
            </div>
            <div className="flex gap-4 flex-wrap">
              <Button variant="ghost" onClick={() => router.push('/dashboard')}>📊 Dashboard</Button>
              <Button onClick={() => { resetForm(); setIsModalOpen(true); }}>+ Log Field Trip</Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {[
              { label: 'Total Trips', value: stats.totalTrips, emoji: '🗺️', color: 'text-primary' },
              { label: 'This Month', value: stats.thisMonth, emoji: '📅', color: 'text-secondary' },
              { label: 'Hours Learning', value: stats.totalHours.toFixed(1), emoji: '⏱️', color: 'text-accent' },
              { label: 'Subjects Covered', value: stats.uniqueSubjects, emoji: '📚', color: 'text-primary' },
              { label: 'Favorites', value: stats.favorites, emoji: '⭐', color: 'text-secondary' },
              { label: 'Total Cost', value: `$${stats.totalCost.toFixed(0)}`, emoji: '💰', color: 'text-accent' },
            ].map((stat, i) => (
              <div key={i} className="bg-bg border-2 border-border rounded-2xl p-4 text-center transition-all hover:border-primary hover:bg-white">
                <div className="text-xl mb-1">{stat.emoji}</div>
                <div className={`font-display text-2xl font-extrabold ${stat.color}`}>{stat.value}</div>
                <div className="text-[10px] mt-1 text-text-muted font-semibold uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <Card className="mb-8 p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <Input 
                label="Search" 
                placeholder="Search trips..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Select label="Child" value={filterChild} onChange={(e) => setFilterChild(e.target.value)}>
                <option value="all">All Children</option>
                {kids.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
              </Select>
              <Select label="Subject" value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
                <option value="all">All Subjects</option>
                {SUBJECTS.map(s => <option key={s.value} value={s.value}>{s.emoji} {s.label}</option>)}
              </Select>
              <Select label="Year" value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
                <option value="all">All Years</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </Select>
              <div className="flex items-end gap-2">
                <button 
                  onClick={() => setViewMode('grid')}
                  className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all ${viewMode === 'grid' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'}`}
                >
                  ▦ Grid
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all ${viewMode === 'list' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'}`}
                >
                  ☰ List
                </button>
              </div>
            </div>
          </Card>

          {/* Content */}
          {filteredTrips.length === 0 ? (
            <div className="text-center py-24 bg-bg-alt rounded-[3rem] border-2 border-dashed border-border">
              <div className="text-6xl mb-4">🗺️</div>
              <p className="text-text-muted text-xl font-serif italic mb-2">
                {trips.length === 0 ? "No field trips logged yet." : "No trips match your filters."}
              </p>
              <p className="text-text-muted mb-8">
                {trips.length === 0 ? "Start documenting your educational adventures!" : "Try adjusting your search or filters."}
              </p>
              {trips.length === 0 && (
                <Button size="lg" onClick={() => { resetForm(); setIsModalOpen(true); }}>
                  Log Your First Field Trip
                </Button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTrips.map((trip) => {
                const photos = Array.isArray(trip.photos) ? trip.photos : [trip.photos].filter(Boolean);
                const tripTypeInfo = getTripTypeInfo((trip as any).trip_type || 'other');
                
                return (
                  <Card key={trip.id} className="p-0 overflow-hidden group border-border/50 hover:border-primary/30 shadow-sm relative">
                    {/* Favorite & Delete Buttons */}
                    <div className="absolute top-4 right-4 z-20 flex gap-2">
                      <button 
                        onClick={() => handleToggleFavorite(trip)}
                        className={`w-8 h-8 rounded-full shadow-md flex items-center justify-center transition-all ${trip.is_favorite ? 'bg-yellow-400 text-white' : 'bg-white/90 text-gray-400 hover:text-yellow-500'}`}
                      >
                        ⭐
                      </button>
                      <button 
                        onClick={() => handleDelete(trip.id)} 
                        className="w-8 h-8 rounded-full bg-white/90 shadow-md text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
                      >
                        🗑️
                      </button>
                    </div>

                    {/* Photo */}
                    <div 
                      className="relative aspect-video bg-gradient-to-br from-primary/10 to-secondary/10 overflow-hidden cursor-pointer" 
                      onClick={() => photos[0] && setZoomImage(getImageUrl(trip, photos[0]))}
                    >
                      {photos.length > 0 && photos[0] ? (
                        <>
                          <img 
                            src={getImageUrl(trip, photos[0])} 
                            alt={trip.title}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                          />
                          {photos.length > 1 && (
                            <div className="absolute bottom-3 right-3 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded-full backdrop-blur-sm">
                              +{photos.length - 1} more
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-6xl opacity-30">
                          {tripTypeInfo.emoji}
                        </div>
                      )}
                      <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-[10px] font-bold px-3 py-1 rounded-full text-primary">
                        {tripTypeInfo.emoji} {tripTypeInfo.label}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-5">
                      <h4 className="font-display text-lg font-bold m-0 mb-2 leading-tight">{trip.title}</h4>
                      <p className="text-xs text-text-muted mb-3 flex items-center gap-2">
                        <span>📍 {trip.location}</span>
                        {trip.duration_hours && <span>• ⏱️ {trip.duration_hours}h</span>}
                      </p>
                      
                      {/* Children */}
                      <div className="flex flex-wrap gap-1 mb-3">
                        {(trip.children || []).map(childId => {
                          const kid = kids.find(k => k.id === childId);
                          return kid ? (
                            <span key={childId} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                              {kid.name}
                            </span>
                          ) : null;
                        })}
                      </div>

                      {/* Subjects */}
                      <div className="flex flex-wrap gap-1 mb-3">
                        {(trip.subjects || []).slice(0, 4).map(subj => {
                          const info = getSubjectInfo(subj);
                          return (
                            <span key={subj} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/10 text-secondary font-bold">
                              {info.emoji} {info.label}
                            </span>
                          );
                        })}
                        {(trip.subjects || []).length > 4 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-border text-text-muted font-bold">
                            +{trip.subjects.length - 4}
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-text-muted line-clamp-2 mb-4">{trip.description}</p>

                      <div className="flex justify-between items-center">
                        <p className="text-[10px] text-text-muted/60 m-0 font-bold uppercase tracking-widest">
                          {new Date(trip.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setShowDetails(showDetails === trip.id ? null : trip.id)}
                            className="text-xs text-primary hover:underline font-bold"
                          >
                            {showDetails === trip.id ? 'Hide' : 'Details'}
                          </button>
                          <button 
                            onClick={() => handleEdit(trip)}
                            className="text-xs text-secondary hover:underline font-bold"
                          >
                            Edit
                          </button>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {showDetails === trip.id && (
                        <div className="mt-4 pt-4 border-t border-border space-y-3 animate-fade-in">
                          {trip.learning_objectives && (
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1">Learning Objectives</p>
                              <p className="text-sm text-text-muted">{trip.learning_objectives}</p>
                            </div>
                          )}
                          {trip.highlights && (
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1">Highlights</p>
                              <p className="text-sm text-text-muted">{trip.highlights}</p>
                            </div>
                          )}
                          {trip.cost && (
                            <div className="flex gap-4 text-sm">
                              <span className="text-text-muted">💰 Cost: <strong>${trip.cost}</strong></span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            // List View
            <div className="space-y-4">
              {filteredTrips.map((trip) => {
                const photos = Array.isArray(trip.photos) ? trip.photos : [trip.photos].filter(Boolean);
                const tripTypeInfo = getTripTypeInfo((trip as any).trip_type || 'other');
                
                return (
                  <Card key={trip.id} className="p-4 sm:p-6 hover:border-primary/30 transition-all">
                    <div className="flex flex-col sm:flex-row gap-4">
                      {/* Thumbnail */}
                      <div 
                        className="w-full sm:w-32 h-24 rounded-xl overflow-hidden bg-gradient-to-br from-primary/10 to-secondary/10 flex-shrink-0 cursor-pointer"
                        onClick={() => photos[0] && setZoomImage(getImageUrl(trip, photos[0]))}
                      >
                        {photos.length > 0 && photos[0] ? (
                          <img 
                            src={getImageUrl(trip, photos[0])} 
                            alt={trip.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-4xl opacity-30">
                            {tripTypeInfo.emoji}
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-display text-lg font-bold m-0">{trip.title}</h4>
                              {trip.is_favorite && <span className="text-yellow-500">⭐</span>}
                            </div>
                            <p className="text-sm text-text-muted">
                              📍 {trip.location} • 📅 {new Date(trip.date).toLocaleDateString()}
                              {trip.duration_hours && ` • ⏱️ ${trip.duration_hours}h`}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(trip)}>Edit</Button>
                            <Button variant="outline" size="sm" onClick={() => handleToggleFavorite(trip)}>
                              {trip.is_favorite ? '★' : '☆'}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleDelete(trip.id)}>🗑️</Button>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1 mb-2">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-bg-alt text-text-muted font-bold">
                            {tripTypeInfo.emoji} {tripTypeInfo.label}
                          </span>
                          {(trip.children || []).map(childId => {
                            const kid = kids.find(k => k.id === childId);
                            return kid ? (
                              <span key={childId} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                                {kid.name}
                              </span>
                            ) : null;
                          })}
                          {(trip.subjects || []).map(subj => {
                            const info = getSubjectInfo(subj);
                            return (
                              <span key={subj} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/10 text-secondary font-bold">
                                {info.emoji} {info.label}
                              </span>
                            );
                          })}
                        </div>

                        <p className="text-sm text-text-muted line-clamp-2">{trip.description}</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </main>
      </ClientOnly>

      {/* Add/Edit Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); resetForm(); }} 
        title={editingTrip ? "Edit Field Trip" : "Log Field Trip"}
        subtitle="Document an educational adventure for your portfolio."
      >
        <form onSubmit={handleSave} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          <Input 
            label="Trip Title" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
            required 
            placeholder="e.g. Visit to the Natural History Museum" 
          />
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input 
              label="Location" 
              value={location} 
              onChange={(e) => setLocation(e.target.value)} 
              required 
              placeholder="e.g. Houston, TX" 
            />
            <Select 
              label="Trip Type" 
              value={tripType} 
              onChange={(e) => setTripType(e.target.value)}
            >
              {TRIP_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input 
              label="Date" 
              type="date" 
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
              required 
            />
            <Input 
              label="Duration (hours)" 
              type="number" 
              step="0.5"
              min="0"
              value={durationHours} 
              onChange={(e) => setDurationHours(e.target.value)} 
              placeholder="e.g. 3" 
            />
            <Input 
              label="Cost ($)" 
              type="number" 
              step="0.01"
              min="0"
              value={cost} 
              onChange={(e) => setCost(e.target.value)} 
              placeholder="e.g. 25.00" 
            />
          </div>

          {/* Children Selection */}
          <div>
            <label className="block text-[10px] sm:text-xs font-bold mb-2 uppercase tracking-wide text-primary">
              Who Attended? *
            </label>
            <div className="flex flex-wrap gap-2">
              {kids.map(kid => (
                <button
                  key={kid.id}
                  type="button"
                  onClick={() => toggleKidSelection(kid.id)}
                  className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                    selectedKids.includes(kid.id)
                      ? 'bg-primary text-white'
                      : 'bg-bg-alt text-text-muted hover:bg-primary/20'
                  }`}
                >
                  {kid.name}
                </button>
              ))}
              {kids.length === 0 && (
                <p className="text-sm text-text-muted italic">No children added yet. Add children in Manage Kids.</p>
              )}
            </div>
          </div>

          {/* Subjects Selection */}
          <div>
            <label className="block text-[10px] sm:text-xs font-bold mb-2 uppercase tracking-wide text-primary">
              Subjects Covered *
            </label>
            <div className="flex flex-wrap gap-2">
              {SUBJECTS.map(subj => (
                <button
                  key={subj.value}
                  type="button"
                  onClick={() => toggleSubjectSelection(subj.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    selectedSubjects.includes(subj.value)
                      ? 'bg-secondary text-white'
                      : 'bg-bg-alt text-text-muted hover:bg-secondary/20'
                  }`}
                >
                  {subj.emoji} {subj.label}
                </button>
              ))}
            </div>
          </div>

          <Textarea 
            label="Description" 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
            required
            placeholder="What did you see and do?" 
            rows={3}
          />

          <Textarea 
            label="Learning Objectives (Optional)" 
            value={learningObjectives} 
            onChange={(e) => setLearningObjectives(e.target.value)} 
            placeholder="What educational goals were met?" 
            rows={2}
          />

          <Textarea 
            label="Highlights (Optional)" 
            value={highlights} 
            onChange={(e) => setHighlights(e.target.value)} 
            placeholder="What were the most memorable moments?" 
            rows={2}
          />

          {/* Photo Upload */}
          <div>
            <label className="block text-[10px] sm:text-xs font-bold mb-2 uppercase tracking-wide text-primary">
              Photos (up to 10)
            </label>
            <div className="flex flex-col gap-4">
              <input 
                type="file" 
                accept="image/*" 
                multiple
                onChange={handleFileChange}
                className="w-full text-xs text-text-muted file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-primary file:text-white file:cursor-pointer"
              />
              
              {imagePreviews.length > 0 && (
                <div className="grid grid-cols-5 gap-2">
                  {imagePreviews.map((prev, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border shadow-sm group">
                      <img src={prev} alt="" className="w-full h-full object-cover" />
                      <button 
                        type="button"
                        onClick={() => removeFile(i)}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row justify-end gap-4 mt-8 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={() => { setIsModalOpen(false); resetForm(); }} className="w-full sm:w-auto order-2 sm:order-1">
              Cancel
            </Button>
            <Button type="submit" className="w-full sm:w-auto order-1 sm:order-2">
              {editingTrip ? 'Update Trip' : 'Log Field Trip'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Lightbox / Zoom Modal */}
      {zoomImage && (
        <div 
          className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4 sm:p-20"
          onClick={() => setZoomImage(null)}
        >
          <button className="absolute top-8 right-8 text-white text-4xl hover:scale-110 transition-transform">✕</button>
          <img 
            src={zoomImage} 
            alt="Field Trip Photo" 
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
