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
  const [editChildrenAges, setEditChildrenAges] = useState('');
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
      setEditChildrenAges(prof.children_ages || '');
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
        children_ages: editChildrenAges
      });
      
      // Update local state
      setProfile({
        ...profile!,
        family_name: editFamilyName,
        description: editDescription,
        location: editLocation,
        children_ages: editChildrenAges
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

  const useCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setEditLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        },
        (error) => {
          setMessage('✗ Could not get location: ' + error.message);
        }
      );
    } else {
      setMessage('✗ Geolocation not supported');
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
                  <strong className="text-primary">About:</strong>{' '}
                  <span className="text-text-muted">{profile.description || 'No description provided.'}</span>
                </p>
                <p className="mb-4">
                  <strong className="text-primary">Location:</strong>{' '}
                  <span className="text-text-muted">{profile.location || 'Not set'}</span>
                </p>
                <p className="mb-4">
                  <strong className="text-primary">Kids&apos; Ages:</strong>{' '}
                  <span className="text-text-muted">{profile.children_ages || 'None listed'}</span>
                </p>
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
              <div className="flex gap-4 mb-5">
                <Input
                  placeholder="Location"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  className="flex-1 mb-0"
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
              <Input
                placeholder="Children Ages (e.g., 5, 9, 13)"
                value={editChildrenAges}
                onChange={(e) => setEditChildrenAges(e.target.value)}
              />
              
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
