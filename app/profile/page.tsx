'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Profile } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Toast } from '@/components/ui/Toast';

export default function ProfilePage() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editFamilyName, setEditFamilyName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editTelegramId, setEditTelegramId] = useState('');
  const [editLat, setEditLat] = useState<number | undefined>(undefined);
  const [editLon, setEditLon] = useState<number | undefined>(undefined);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editFaithPreference, setEditFaithPreference] = useState<'none' | 'christian' | 'lds'>('none');
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }
    
    // When logged in via profiles collection, authStore.model IS the profile
    const prof = pb.authStore.model as unknown as Profile;
    setProfile(prof);
    
    if (prof) {
      setEditFamilyName(prof.family_name || '');
      setEditDescription(prof.description || '');
      setEditLocation(prof.location || '');
      setEditTelegramId(prof.telegram_id || '');
      setEditLat(prof.profile_latitude);
      setEditLon(prof.profile_longitude);
      setEditFaithPreference(prof.faith_preference || 'none');
    }
  }, [pb.authStore.isValid, router]);

  const handleLogout = () => {
    pb.authStore.clear();
    router.push('/');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    try {
      const profileId = pb.authStore.model?.id;
      if (!profileId) {
        setMessage('✗ Not authenticated');
        return;
      }

      // Update the profile directly (authStore.model IS the profile when logged in via profiles collection)
      await pb.collection('profiles').update(profileId, {
        family_name: editFamilyName,
        description: editDescription,
        location: editLocation,
        telegram_id: editTelegramId,
        profile_latitude: editLat,
        profile_longitude: editLon,
        faith_preference: editFaithPreference
      });
      
      // Update local state
      setProfile({
        ...profile!,
        family_name: editFamilyName,
        description: editDescription,
        location: editLocation,
        telegram_id: editTelegramId,
        profile_latitude: editLat,
        profile_longitude: editLon,
        faith_preference: editFaithPreference
      });
      
      setToast({ message: 'Profile updated!', type: 'success' });
      setIsEditing(false);
    } catch (error: any) {
      console.error('Profile save error:', error);
      // Extract detailed error from PocketBase
      const errorMsg = error?.data?.message || error?.message || 'Update failed';
      setToast({ message: errorMsg, type: 'error' });
    }
  };

  const fetchSuggestions = async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
      const data = await res.json();
      setSuggestions(data);
      setShowSuggestions(true);
    } catch (e) {
      console.error('Suggestions fetch error:', e);
    }
  };

  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEditLocation(val);
    fetchSuggestions(val);
  };

  const selectSuggestion = (s: any) => {
    setEditLocation(s.display_name);
    setEditLat(parseFloat(s.lat));
    setEditLon(parseFloat(s.lon));
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const useCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setEditLat(latitude);
          setEditLon(longitude);
          
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
            const data = await res.json();
            const city = data.address.city || data.address.town || data.address.village;
            const state = data.address.state;
            if (city && state) {
              setEditLocation(`${city}, ${state}`);
            } else {
              setEditLocation(data.display_name);
            }
          } catch (e) {
            setEditLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          }
        },
        (error) => {
          setToast({ message: 'Could not get location: ' + error.message, type: 'error' });
        }
      );
    } else {
      setToast({ message: 'Geolocation not supported', type: 'error' });
    }
  };

  return (
    <>
      <Header showLogout onLogout={handleLogout} />
      <main className="max-w-6xl mx-auto my-12 px-8 pb-20 animate-fade-in">
        {!isEditing && profile ? (
          <Card>
            <h2 className="font-display text-5xl font-extrabold tracking-tight mb-12">Your Profile</h2>
            
            <div className="flex gap-8 flex-wrap">
              <div className="flex-1 min-w-[300px]">
                <p className="mb-4">
                  <strong className="text-primary">Email:</strong>{' '}
                  <span className="text-text-muted">{pb.authStore.model?.email}</span>
                </p>
                <p className="mb-4">
                  <strong className="text-primary">Family:</strong>{' '}
                  <span className="font-serif text-2xl text-primary">{profile.family_name}</span>
                </p>
                <p className="mb-4">
                  <strong className="text-primary">Family Code:</strong>{' '}
                  <span className="font-mono text-2xl text-secondary font-bold tracking-widest">{profile.family_code || 'Not set'}</span>
                  <span className="block text-xs text-text-muted mt-1">Share this code with your students for login</span>
                </p>
                <p className="mb-4">
                  <strong className="text-primary">About:</strong>{' '}
                  <span className="text-text-muted">{profile.description || 'No description provided.'}</span>
                </p>
                <p className="mb-4">
                  <strong className="text-primary">Location:</strong>{' '}
                  <span className="text-text-muted">{profile.location || 'Not set'}</span>
                </p>
                <p className="mb-4">
                  <strong className="text-primary">Faith Preference:</strong>{' '}
                  <span className="text-text-muted">
                    {profile.faith_preference === 'lds' && '⛪ LDS (All Standard Works)'}
                    {profile.faith_preference === 'christian' && '✝️ Christian (Bible-based)'}
                    {(profile.faith_preference === 'none' || !profile.faith_preference) && '🌍 Secular (No faith content)'}
                  </span>
                </p>
                {profile.telegram_id && (
                  <p className="mb-4">
                    <strong className="text-primary">Telegram:</strong>{' '}
                    <span className="text-text-muted">Connected ({profile.telegram_id})</span>
                  </p>
                )}
              </div>

              <div className="flex-1 min-w-[280px] grid grid-cols-1 sm:grid-cols-2 gap-3 content-start">
                <Button onClick={() => setIsEditing(true)}>Edit Profile</Button>
                <Button variant="secondary" onClick={() => router.push('/events')}>View Events</Button>
                <Button onClick={() => router.push('/manage-kids')}>🧒 Manage Kids</Button>
                <Button variant="secondary" onClick={() => router.push('/dashboard')}>📚 Dashboard</Button>
                <Button variant="secondary" onClick={() => router.push('/legal-guides')}>⚖️ Legal Guides</Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card>
            <h2 className="font-display text-5xl font-extrabold tracking-tight mb-12">
              {profile ? 'Edit Profile' : 'Create Your Profile'}
            </h2>
            {!profile && (
              <p className="text-text-muted mb-8">
                Welcome! Let&apos;s set up your family profile so we can personalize your experience.
              </p>
            )}
            
            <form onSubmit={handleSaveProfile}>
              <Input
                placeholder="Family Name"
                value={editFamilyName}
                onChange={(e) => setEditFamilyName(e.target.value)}
                required
              />
              <Textarea
                placeholder="Description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
              <div className="relative mb-5">
                <div className="flex gap-4">
                  <Input
                    placeholder="Location (e.g., Chicago, IL)"
                    value={editLocation}
                    onChange={handleLocationChange}
                    className="flex-1 mb-0"
                    onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                  />
                  <Button 
                    type="button"
                    variant="ghost" 
                    onClick={useCurrentLocation}
                    className="whitespace-nowrap"
                  >
                    📍 Use Current
                  </Button>
                </div>
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border-2 border-border rounded-xl shadow-lg z-10 mt-1 max-h-48 overflow-y-auto overflow-x-hidden">
                    {suggestions.map((s, i) => (
                      <div 
                        key={i} 
                        className="px-4 py-2 hover:bg-bg-alt cursor-pointer text-sm border-b border-border last:border-0"
                        onClick={() => selectSuggestion(s)}
                      >
                        {s.display_name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="bg-bg-alt p-6 rounded-2xl mb-8 border border-border">
                <h4 className="font-display font-bold text-lg mb-2 text-primary">✨ Faith Preference</h4>
                <p className="text-xs text-text-muted mb-4">
                  Choose whether to include faith-based content in daily assignments and lessons.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditFaithPreference('none')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      editFaithPreference === 'none'
                        ? 'border-primary bg-primary/10 font-bold'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="text-2xl mb-1">🌍</div>
                    <div className="font-display font-bold text-sm">Secular</div>
                    <div className="text-xs text-text-muted mt-1">No faith content</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditFaithPreference('christian')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      editFaithPreference === 'christian'
                        ? 'border-primary bg-primary/10 font-bold'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="text-2xl mb-1">✝️</div>
                    <div className="font-display font-bold text-sm">Christian</div>
                    <div className="text-xs text-text-muted mt-1">Bible-based</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditFaithPreference('lds')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      editFaithPreference === 'lds'
                        ? 'border-primary bg-primary/10 font-bold'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="text-2xl mb-1">⛪</div>
                    <div className="font-display font-bold text-sm">LDS</div>
                    <div className="text-xs text-text-muted mt-1">All Standard Works</div>
                  </button>
                </div>
              </div>
              
              <div className="bg-bg-alt p-6 rounded-2xl mb-8 border border-border">
                <h4 className="font-display font-bold text-lg mb-2 text-primary">🤖 Village Assistant Bot</h4>
                <p className="text-xs text-text-muted mb-4 leading-relaxed">
                  Enter your Telegram ID below to allow the Village Assistant bot to recognize you. 
                  You can find your ID by messaging <a href="https://t.me/userinfobot" target="_blank" className="text-secondary underline">@userinfobot</a>.
                </p>
                <Input
                  placeholder="Your Telegram ID (e.g., 123456789)"
                  value={editTelegramId}
                  onChange={(e) => setEditTelegramId(e.target.value)}
                  className="mb-0"
                />
              </div>
              
              {message && (
                <p className={`mb-4 ${message.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>
                  {message}
                </p>
              )}

              <div className="flex gap-4">
                <Button type="submit">Save Changes</Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    if (profile) {
                      setIsEditing(false);
                    }
                    setMessage('');
                  }}
                >
                  {profile ? 'Cancel' : 'Back'}
                </Button>
              </div>
            </form>
          </Card>
        )}
      </main>

      {/* Toast Notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
