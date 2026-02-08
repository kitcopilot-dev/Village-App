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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
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

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      await pb.collection('events').create({
        user: userId,
        title,
        description,
        date,
        time,
        location,
        age_suitability: ageSuitability,
        max_capacity: maxCapacity ? parseInt(maxCapacity) : undefined
      });

      setIsCreateModalOpen(false);
      resetForm();
      loadEvents();
    } catch (error) {
      console.error('Create event error:', error);
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
            <Button onClick={() => setIsCreateModalOpen(true)}>+ New Gathering</Button>
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
              className="animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <h3 className="font-display text-2xl font-bold text-text mt-0 mb-3 leading-tight">
                {event.title}
              </h3>
              <p className="font-serif italic text-secondary font-semibold mb-4">
                {formatDate(event.date)} at {event.time}
              </p>
              <p className="text-sm text-text-muted mb-4">{event.description}</p>
              <div className="text-sm text-text-muted space-y-2">
                <p>📍 {event.location}</p>
                <p>👥 {event.age_suitability}</p>
                {event.max_capacity && <p>🎟️ Max {event.max_capacity} participants</p>}
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

      {/* Create Event Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          resetForm();
        }}
        title="Plan a Gathering"
        subtitle="Create an event for your homeschool community."
      >
        <form onSubmit={handleCreateEvent}>
          <Input
            placeholder="Event Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <Textarea
            placeholder="What's the plan?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-6">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            <Input
              placeholder="Time (e.g., 10:00 AM)"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
            />
          </div>
          <Input
            placeholder="Location (Address or Link)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-6">
            <Select value={ageSuitability} onChange={(e) => setAgeSuitability(e.target.value)}>
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
            />
          </div>
          <div className="flex justify-end gap-6 mt-12">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setIsCreateModalOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button type="submit">Share with Village</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
