'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

export default function StudentLoginPage() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [kids, setKids] = useState<Child[]>([]);
  const [selectedKid, setSelectedKid] = useState<Child | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPublicKids();
  }, []);

  const loadPublicKids = async () => {
    try {
      // In a real app, we'd use a search or a shared family link.
      // For now, we'll list all kids (discovery mode).
      const records = await pb.collection('children').getFullList({
        sort: 'name'
      });
      setKids(records as unknown as Child[]);
    } catch (e) {
      console.error('Failed to load kids:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKid) return;

    if (pin === (selectedKid as any).pin) {
      localStorage.setItem('village_student_id', selectedKid.id);
      router.push('/student/dashboard');
    } else {
      setError('Wrong PIN. Try again!');
      setPin('');
    }
  };

  if (loading) return <div className="p-20 text-center">Finding your Village...</div>;

  return (
    <main className="min-h-screen bg-bg flex items-center justify-center p-8 animate-fade-in">
      <Card className="max-w-md w-full p-12 text-center">
        <h1 className="font-display text-4xl font-extrabold text-primary mb-2">Student Login</h1>
        <p className="text-text-muted mb-12 italic font-serif">Welcome back, explorer!</p>

        {!selectedKid ? (
          <div className="grid grid-cols-1 gap-4">
            <p className="text-sm font-bold text-text-muted uppercase tracking-widest mb-4">Who are you today?</p>
            {kids.map(kid => (
              <button
                key={kid.id}
                onClick={() => setSelectedKid(kid)}
                className="p-6 rounded-2xl bg-bg-alt border-2 border-transparent hover:border-primary hover:bg-white transition-all font-display text-xl font-bold text-primary flex items-center justify-center gap-4"
              >
                <span className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm">{kid.name.charAt(0)}</span>
                {kid.name}
              </button>
            ))}
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-8 animate-fade-in">
            <div>
              <p className="text-xl font-bold mb-2">Hi {selectedKid.name}!</p>
              <p className="text-sm text-text-muted">Enter your 4-digit PIN to enter the vault.</p>
            </div>

            <div className="flex justify-center gap-4">
              <Input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="text-center text-4xl tracking-[1em] font-display max-w-[200px]"
                autoFocus
              />
            </div>

            {error && <p className="text-red-500 font-bold animate-bounce">{error}</p>}

            <div className="flex gap-4">
              <Button variant="outline" className="flex-1" onClick={() => { setSelectedKid(null); setError(''); }}>Back</Button>
              <Button type="submit" className="flex-1" disabled={pin.length < 4}>Enter</Button>
            </div>
          </form>
        )}
      </Card>
    </main>
  );
}
