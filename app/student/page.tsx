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
  const [familyCode, setFamilyCode] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showKids, setShowKids] = useState(false);

  const loadFamilyKids = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!familyCode.trim()) {
      setError('Please enter your family code');
      return;
    }

    setLoading(true);
    setError('');
    try {
      // Query kids with matching family code
      const records = await pb.collection('children').getFullList({
        filter: `family_code = "${familyCode.toUpperCase()}"`,
        sort: 'name'
      });
      
      if (records.length === 0) {
        setError('No students found with that family code. Check your code and try again.');
        setLoading(false);
        return;
      }
      
      setKids(records as unknown as Child[]);
      setShowKids(true);
    } catch (e: any) {
      console.error('Failed to load kids:', e);
      setError('Could not load students. Please try again.');
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

  const handleBack = () => {
    setSelectedKid(null);
    setShowKids(false);
    setKids([]);
    setFamilyCode('');
    setError('');
    setPin('');
  };

  return (
    <main className="min-h-screen bg-bg flex items-center justify-center p-8 animate-fade-in">
      <Card className="max-w-md w-full p-12 text-center">
        <h1 className="font-display text-4xl font-extrabold text-primary mb-2">Student Login</h1>
        <p className="text-text-muted mb-12 italic font-serif">Welcome back, explorer!</p>

        {!showKids && !selectedKid && (
          <form onSubmit={loadFamilyKids} className="space-y-8 animate-fade-in">
            <div>
              <p className="text-sm font-bold text-text-muted uppercase tracking-widest mb-4">Enter Your Family Code</p>
              <Input
                type="text"
                value={familyCode}
                onChange={(e) => setFamilyCode(e.target.value.toUpperCase())}
                placeholder="e.g. SMITH2024"
                maxLength={12}
                className="text-center text-2xl tracking-widest font-display uppercase"
                autoFocus
              />
              <p className="text-xs text-text-muted mt-2">Ask your parent for your family code</p>
            </div>

            {error && <p className="text-red-500 font-bold animate-bounce">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading || familyCode.length < 6}>
              {loading ? 'Looking for your family...' : 'Continue'}
            </Button>
          </form>
        )}

        {showKids && !selectedKid && (
          <div className="grid grid-cols-1 gap-4 animate-fade-in">
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
            <Button variant="ghost" onClick={handleBack} className="mt-4">Use Different Code</Button>
          </div>
        )}

        {selectedKid && (
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
              <Button variant="outline" className="flex-1" onClick={handleBack}>Back</Button>
              <Button type="submit" className="flex-1" disabled={pin.length < 4}>Enter</Button>
            </div>
          </form>
        )}
      </Card>
    </main>
  );
}
