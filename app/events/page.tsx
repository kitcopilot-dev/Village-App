'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Event } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';

export default function EventsPage() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAge, setFilterAge] = useState('');

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [ageSuitability, setAgeSuitability] = useState('All Ages');
  const [maxCapacity, setMaxCapacity] = useState('');
  const [supplies, setSupplies] = useState('');

  const currentUserId = pb.authStore.model?.id;

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }
    loadEvents();
  }, []);

  useEffect(() => {
    filterEvents();
  }, [events, searchQuery, filterAge]);

  const loadEvents = async () => {
    try {
      const records = await pb.collection('events').getList(1, 50, {
        sort: 'date',
        expand: 'user'
      });
      
      setEvents(records.items as unknown as Event[]);
    } catch (error) {
      console.error('Events load error:', error);
    }
  };

  const filterEvents = () => {
    let filtered = [...events];

    if (searchQuery) {
      filtered = filtered.filter(e => 
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filterAge) {
      filtered = filtered.filter(e => 
        e.age_suitability === filterAge || e.age_suitability === 'All Ages'
      );
    }

    setFilteredEvents(filtered);
  };

  const handleLogout = () => {
    pb.authStore.clear();
    router.push('/');
  };

  const openCreateModal = () => {
    setIsEditing(false);
    setEditingId(null);
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (event: Event) => {
    setIsEditing(true);
    setEditingId(event.id);
    setTitle(event.title);
    setDescription(event.description);
    setDate(new Date(event.date).toISOString().split('T')[0]);
    setTime(event.time);
    setLocation(event.location);
    setAgeSuitability(event.age_suitability || 'All Ages');
    setMaxCapacity(event.max_capacity?.toString() || '');
    setSupplies(event.supplies || '');
    setIsModalOpen(true);
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('Are you sure you want to delete this gathering?')) return;
    try {
      await pb.collection('events').delete(id);
      loadEvents();
    } catch (error) {
      console.error('Delete event error:', error);
    }
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const data = {
        user: userId,
        title,
        description,
        date: new Date(date).toISOString(),
        time,
        location,
        age_suitability: ageSuitability,
        max_capacity: maxCapacity ? parseInt(maxCapacity) : undefined,
        supplies: supplies || undefined
      };

      if (isEditing && editingId) {
        await pb.collection('events').update(editingId, data);
      } else {
        await pb.collection('events').create(data);
      }

      setIsModalOpen(false);
      resetForm();
      loadEvents();
    } catch (error) {
      console.error('Save event error:', error);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDate('');
    setTime('');
    setLocation('');
    setAgeSuitability('All Ages');
    setMaxCapacity('');
    setSupplies('');
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  return (
    <>
      <Header showLogout onLogout={handleLogout} />
      <main className="max-w-7xl mx-auto my-12 px-8 animate-fade-in">
        <div className="flex justify-between items-center mb-12 flex-wrap gap-4">
          <h2 className="font-display text-5xl font-extrabold tracking-tight mb-0">Community Gatherings</h2>
          <div className="flex gap-4">
            <Button variant="ghost" onClick={() => router.push('/profile')}>← Back</Button>
            <Button onClick={openCreateModal}>+ New Gathering</Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-12">
          <div className="grid md:grid-cols-3 gap-6 items-end">
            <Input
              placeholder="What are you looking for?"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              label="Search"
            />
            <Select
              value={filterAge}
              onChange={(e) => setFilterAge(e.target.value)}
              label="Age Group"
            >
              <option value="">All Ages</option>
              <option value="0-5">0-5 (Preschool)</option>
              <option value="6-10">6-10 (Elementary)</option>
              <option value="11-14">11-14 (Middle School)</option>
              <option value="15-18">15-18 (High School)</option>
            </Select>
            <div className="flex gap-4">
              <Button variant="secondary" onClick={filterEvents} className="flex-1">Apply Filters</Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchQuery('');
                  setFilterAge('');
                }}
                className="flex-1"
              >
                Clear
              </Button>
            </div>
          </div>
        </Card>

        {/* Events Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredEvents.map((event, index) => (
            <Card 
              key={event.id} 
              hoverable
              className="animate-fade-in group relative"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-display text-2xl font-bold text-text m-0 leading-tight">
                  {event.title}
                </h3>
                {event.user === currentUserId && (
                  <div className="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEditModal(event)} className="text-text-muted hover:text-primary transition-colors">✏️</button>
                    <button onClick={() => handleDeleteEvent(event.id)} className="text-text-muted hover:text-red-500 transition-colors">🗑️</button>
                  </div>
                )}
              </div>
              <p className="font-serif italic text-secondary font-semibold mb-4">
                {formatDate(event.date)} at {event.time}
              </p>
              <p className="text-sm text-text-muted mb-4">{event.description}</p>
              <div className="text-sm text-text-muted space-y-2">
                <p>📍 {event.location}</p>
                <p>👥 {event.age_suitability}</p>
                {event.max_capacity && <p>🎟️ Max {event.max_capacity} participants</p>}
                {event.supplies && <p className="mt-2 pt-2 border-t border-border/50 italic text-xs">🎒 {event.supplies}</p>}
              </div>
            </Card>
          ))}
        </div>

        {filteredEvents.length === 0 && (
          <Card className="text-center py-12">
            <p className="text-text-muted text-lg">No events found. Create one to get started!</p>
          </Card>
        )}
      </main>

      {/* Event Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          resetForm();
        }}
        title={isEditing ? "Edit Gathering" : "Plan a Gathering"}
        subtitle={isEditing ? "Update the details for this event." : "Create an event for your homeschool community."}
      >
        <form onSubmit={handleSaveEvent}>
          <Input
            placeholder="Event Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            label="Title"
          />
          <Textarea
            placeholder="What's the plan?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            label="Description"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              label="Date"
            />
            <Input
              placeholder="Time (e.g., 10:00 AM)"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
              label="Time"
            />
          </div>
          <Input
            placeholder="Location (Address or Link)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
            label="Location"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Select value={ageSuitability} onChange={(e) => setAgeSuitability(e.target.value)} label="Age Group">
              <option>All Ages</option>
              <option value="0-5">0-5 (Preschool)</option>
              <option value="6-10">6-10 (Elementary)</option>
              <option value="11-14">11-14 (Middle School)</option>
              <option value="15-18">15-18 (High School)</option>
            </Select>
            <Input
              type="number"
              placeholder="Max Capacity (optional)"
              value={maxCapacity}
              onChange={(e) => setMaxCapacity(e.target.value)}
              label="Capacity"
            />
          </div>
          <Input
            placeholder="e.g. Watercolors, notebook, water bottle..."
            value={supplies}
            onChange={(e) => setSupplies(e.target.value)}
            label="Supply List (Optional)"
          />
          <div className="flex flex-col sm:flex-row justify-end gap-6 mt-12">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setIsModalOpen(false);
                resetForm();
              }}
              className="w-full sm:w-auto order-2 sm:order-1"
            >
              Cancel
            </Button>
            <Button type="submit" className="w-full sm:w-auto order-1 sm:order-2">
              {isEditing ? "Save Changes" : "Share with Village"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
