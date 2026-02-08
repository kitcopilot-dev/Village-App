'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Profile } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingScreen } from '@/components/ui/Spinner';

// Leaflet types are tricky with dynamic imports, so we use 'any' for the library instances
let L: any;

export default function MapPage() {
  const router = useRouter();
  const pb = getPocketBase();
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [libLoaded, setLibLoaded] = useState(false);

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }

    // Dynamic import Leaflet and its CSS
    const loadLeaflet = async () => {
      // Add CSS to head
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      // Import JS
      const leaflet = await import('leaflet');
      L = leaflet.default || leaflet;
      setLibLoaded(true);
    };

    loadLeaflet();
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      // Fetch all profiles that have location data
      const records = await pb.collection('profiles').getFullList({
        filter: 'profile_latitude != 0 && profile_longitude != 0',
      });
      setProfiles(records as unknown as Profile[]);
    } catch (error) {
      console.error('Map load error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (libLoaded && !loading && profiles.length >= 0 && mapContainerRef.current && !mapRef.current) {
      // Initialize map
      const initialView: [number, number] = [39.8283, -98.5795]; // Center of USA
      const zoom = 4;

      mapRef.current = L.map(mapContainerRef.current).setView(initialView, zoom);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors'
      }).addTo(mapRef.current);

      // Add markers
      const markers: any[] = [];
      profiles.forEach(p => {
        if (p.profile_latitude && p.profile_longitude) {
          const marker = L.marker([p.profile_latitude, p.profile_longitude])
            .addTo(mapRef.current)
            .bindPopup(`
              <div style=\"padding: 10px;\">
                <strong style=\"display: block; font-size: 14px; margin-bottom: 4px;\">${p.family_name}</strong>
                <span style=\"color: #5C615A; font-size: 12px;\">📍 ${p.location}</span>
                ${p.children_ages ? `<p style=\"margin-top: 8px; font-size: 11px;\">👥 Kids ages: ${p.children_ages}</p>` : ''}
              </div>
            `);
          markers.push(marker);
        }
      });

      // Fit bounds if we have markers
      if (markers.length > 0) {
        const group = L.featureGroup(markers);
        mapRef.current.fitBounds(group.getBounds().pad(0.1));
      }
    }
  }, [libLoaded, loading, profiles]);

  if (loading) return <LoadingScreen message="Searching the Village map..." />;

  return (
    <>
      <Header showLogout onLogout={() => { pb.authStore.clear(); router.push('/'); }} />
      <main className="max-w-7xl mx-auto my-12 px-4 sm:px-8 pb-24 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6 mb-12">
          <div>
            <h2 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight mb-2">Village Near Me</h2>
            <p className="text-text-muted text-sm sm:text-base font-serif italic">Connect with homeschooling families in your community.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => router.push('/profile')}>Manage Location</Button>
            <Button variant="ghost" onClick={() => router.push('/dashboard')}>← Dashboard</Button>
          </div>
        </div>

        <Card className="p-2 sm:p-4 h-[600px] relative overflow-hidden bg-bg-alt">
          <div 
            ref={mapContainerRef} 
            className="w-full h-full rounded-[1.5rem] overflow-hidden border border-border"
          />
          
          <div className="absolute bottom-8 left-8 right-8 z-[400] md:max-w-xs">
            <Card className="p-4 bg-white/90 backdrop-blur shadow-xl border-primary/20">
              <h4 className="font-display text-sm font-bold text-primary mb-2 uppercase tracking-widest">Privacy Note</h4>
              <p className="text-[10px] text-text-muted leading-relaxed">
                Markers show approximate locations based on your profile details. Exact addresses are never shared.
              </p>
            </Card>
          </div>
        </Card>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1">
            <h3 className="font-serif italic text-2xl text-primary mb-4">Village Directory</h3>
            <p className="text-sm text-text-muted leading-relaxed">
              Find families nearby to coordinate study groups, park days, or shared resources.
            </p>
          </div>
          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {profiles.slice(0, 4).map(p => (
              <div key={p.id} className="bg-white p-6 rounded-2xl border border-border shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-display text-primary font-bold">
                  {p.family_name.charAt(0)}
                </div>
                <div>
                  <h4 className="m-0 font-bold text-sm">{p.family_name}</h4>
                  <p className="text-xs text-text-muted m-0">📍 {p.location}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <style jsx global>{`
        .leaflet-container {
          font-family: inherit;
          z-index: 1;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 1rem;
          padding: 0;
          box-shadow: 0 10px 30px -10px rgba(75, 99, 68, 0.2);
          border: 1px solid #E0E4DC;
        }
        .leaflet-popup-content {
          margin: 0;
        }
        .leaflet-popup-tip {
          background: white;
        }
      `}</style>
    </>
  );
}
