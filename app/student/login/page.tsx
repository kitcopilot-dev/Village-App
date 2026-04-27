'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child, Course, Assignment, PortfolioItem } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';

export default function StudentLoginPage() {
  const router = useRouter();
  const pb = getPocketBase();
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [showPinEntry, setShowPinEntry] = useState(false);

  useEffect(() => {
    loadChildren();
  }, []);

  // Check URL for child ID (deep link from email)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const childId = params.get('child');
    if (childId && children.length > 0) {
      const child = children.find(c => c.id === childId);
      if (child) {
        setSelectedChild(child);
        setShowPinEntry(true);
      }
    }
  }, [children]);

  const loadChildren = async () => {
    try {
      // Load all children for the family to show name picker
      const records = await pb.collection('children').getFullList({
        sort: 'name'
      });
      setChildren(records as unknown as Child[]);
    } catch (e) {
      console.error('Failed to load children:', e);
    }
  };

  const handleNameSelect = (child: Child) => {
    setSelectedChild(child);
    setName(child.name);
    setShowPinEntry(true);
    setError('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChild) return;

    setLoading(true);
    setError('');

    try {
      // Verify PIN - either match against the child's PIN or check for no PIN setup
      const records = await pb.collection('children').getList(1, 1, {
        filter: `id = "${selectedChild.id}" AND (pin = "${pin}" OR (pin = "" OR pin = null))`,
      });

      if (records.totalItems === 0) {
        setError('Incorrect PIN. Please try again.');
        setLoading(false);
        return;
      }

      // Login successful - store child session
      localStorage.setItem('student_child_id', selectedChild.id);
      localStorage.setItem('student_name', selectedChild.name);
      router.push('/student/dashboard');
    } catch (e) {
      console.error('Login error:', e);
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    setShowPinEntry(false);
    setSelectedChild(null);
    setPin('');
    setError('');
  };

  // Step 1: Select your name
  if (!showPinEntry) {
    return (
      <div className="min-h-screen bg-[#FDFCF8] flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <div className="text-center mb-6">
            <h1 className="font-[family-display] text-2xl text-[#4B6344] mb-2">
              🏡 Village Student
            </h1>
            <p className="text-gray-600">Who's doing school today?</p>
          </div>

          <div className="space-y-2">
            {children.length === 0 ? (
              <p className="text-center text-gray-500 py-4">
                No kids found. Ask a parent to add you!
              </p>
            ) : (
              children.map((child) => (
                <button
                  key={child.id}
                  onClick={() => handleNameSelect(child)}
                  className="w-full p-4 text-left rounded-xl border-2 border-[#E8E4D9] hover:border-[#4B6344] hover:bg-[#F4F7F0] transition-all cursor-pointer"
                >
                  <span className="font-medium text-[#333]">{child.name}</span>
                  {child.age && (
                    <span className="text-gray-500 text-sm ml-2">Age {child.age}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </Card>
      </div>
    );
  }

  // Step 2: Enter PIN
  return (
    <div className="min-h-screen bg-[#FDFCF8] flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <button
          onClick={goBack}
          className="text-sm text-gray-500 hover:text-[#4B6344] mb-4"
        >
          ← Choose a different name
        </button>

        <div className="text-center mb-6">
          <h1 className="font-[family-display] text-2xl text-[#4B6344] mb-2">
            👋 Hey {selectedChild?.name}!
          </h1>
          <p className="text-gray-600">Enter your secret PIN number</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Enter your PIN"
            className="text-center text-2xl tracking-widest"
            maxLength={4}
            required
          />

          {error && (
            <p className="text-red-600 text-sm text-center">{error}</p>
          )}

          <Button
            type="submit"
            disabled={loading || pin.length === 0}
            className="w-full"
          >
            {loading ? 'Checking...' : "Let's Go! 🚀"}
          </Button>
        </form>

        <p className="text-center text-gray-500 text-sm mt-4">
          Ask a parent if you don't have a PIN yet!
        </p>
      </Card>
    </div>
  );
}