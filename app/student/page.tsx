'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

// Picture PIN images for young kids (ages 6-8)
const PIN_PICTURES = [
  { id: 'star', emoji: '⭐', label: 'Star' },
  { id: 'heart', emoji: '❤️', label: 'Heart' },
  { id: 'sun', emoji: '☀️', label: 'Sun' },
  { id: 'moon', emoji: '🌙', label: 'Moon' },
  { id: 'flower', emoji: '🌸', label: 'Flower' },
  { id: 'rainbow', emoji: '🌈', label: 'Rainbow' },
  { id: 'apple', emoji: '🍎', label: 'Apple' },
  { id: 'rocket', emoji: '🚀', label: 'Rocket' },
  { id: 'fish', emoji: '🐟', label: 'Fish' },
  { id: 'butterfly', emoji: '🦋', label: 'Butterfly' },
  { id: 'cat', emoji: '🐱', label: 'Cat' },
  { id: 'dog', emoji: '🐶', label: 'Dog' },
];

function getAgeGroup(age: number): 'young' | 'tween' | 'teen' {
  if (age <= 8) return 'young';
  if (age <= 12) return 'tween';
  return 'teen';
}

function getGradeNumber(grade: string): number {
  if (!grade) return 5;
  const match = grade.match(/(\d+)/);
  if (match) return parseInt(match[1]);
  if (grade.toLowerCase().includes('k')) return 0;
  if (grade.toLowerCase().includes('pre')) return -1;
  return 5;
}

function estimateAge(grade: string): number {
  const gradeNum = getGradeNumber(grade);
  return gradeNum + 5; // K = 5yo, 1st = 6yo, etc.
}

export default function StudentLoginPage() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [kids, setKids] = useState<Child[]>([]);
  const [selectedKid, setSelectedKid] = useState<Child | null>(null);
  const [familyCode, setFamilyCode] = useState('');
  const [pin, setPin] = useState('');
  const [picturePin, setPicturePin] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showKids, setShowKids] = useState(false);
  const [usePicturePin, setUsePicturePin] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);

  // Check for lockout
  useEffect(() => {
    if (lockedUntil) {
      const timer = setInterval(() => {
        if (Date.now() >= lockedUntil) {
          setLockedUntil(null);
          setFailedAttempts(0);
        }
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [lockedUntil]);

  const loadFamilyKids = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!familyCode.trim()) {
      setError('Please enter your family code');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const records = await pb.collection('children').getFullList({
        filter: `family_code = "${familyCode.toUpperCase()}"`,
        sort: 'name'
      });
      
      if (records.length === 0) {
        setError("Hmm, we couldn't find that code. Try again or ask your parent!");
        setLoading(false);
        return;
      }
      
      setKids(records as unknown as Child[]);
      setShowKids(true);
    } catch (e: any) {
      console.error('Failed to load kids:', e);
      setError('Something went wrong. Please try again!');
    } finally {
      setLoading(false);
    }
  };

  const handleKidSelect = (kid: Child) => {
    setSelectedKid(kid);
    setPin('');
    setPicturePin([]);
    setError('');
    
    // Check if this kid uses picture PIN
    const kidAge = kid.age || estimateAge(kid.grade || '');
    const ageGroup = getAgeGroup(kidAge);
    const hasPicturePin = (kid as any).picture_pin && (kid as any).picture_pin.length > 0;
    
    // Young kids (6-8) with picture PINs use picture mode by default
    if (ageGroup === 'young' && hasPicturePin) {
      setUsePicturePin(true);
    } else {
      setUsePicturePin(false);
    }
  };

  const handlePictureSelect = (pictureId: string) => {
    if (picturePin.length >= 4) return;
    
    const newPicturePin = [...picturePin, pictureId];
    setPicturePin(newPicturePin);
    
    if (newPicturePin.length === 4) {
      // Auto-submit when 4 pictures selected
      setTimeout(() => validatePicturePin(newPicturePin), 300);
    }
  };

  const validatePicturePin = (pinArray: string[]) => {
    if (!selectedKid) return;
    
    if (lockedUntil && Date.now() < lockedUntil) {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
      setError(`Too many tries! Wait ${remaining} seconds.`);
      return;
    }
    
    const kidPicturePin = (selectedKid as any).picture_pin || [];
    const isValid = JSON.stringify(pinArray) === JSON.stringify(kidPicturePin);
    
    if (isValid) {
      localStorage.setItem('village_student_id', selectedKid.id);
      router.push('/student/dashboard');
    } else {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      setPicturePin([]);
      
      if (newAttempts >= 5) {
        setLockedUntil(Date.now() + 60000); // Lock for 1 minute
        setError('Too many tries! Ask your parent for help.');
      } else {
        setError(`Oops! That's not quite right. Try again! (${5 - newAttempts} tries left)`);
      }
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKid) return;
    
    if (lockedUntil && Date.now() < lockedUntil) {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
      setError(`Too many tries! Wait ${remaining} seconds.`);
      return;
    }

    const isValid = pin === (selectedKid as any).pin;
    
    if (isValid) {
      localStorage.setItem('village_student_id', selectedKid.id);
      router.push('/student/dashboard');
    } else {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      setPin('');
      
      if (newAttempts >= 5) {
        setLockedUntil(Date.now() + 60000);
        setError('Too many tries! Ask your parent for help.');
      } else {
        setError(`Oops! That's not quite right. (${5 - newAttempts} tries left)`);
      }
    }
  };

  const handleBack = () => {
    setSelectedKid(null);
    setShowKids(false);
    setKids([]);
    setFamilyCode('');
    setError('');
    setPin('');
    setPicturePin([]);
    setFailedAttempts(0);
    setLockedUntil(null);
  };

  const handleBackToKids = () => {
    setSelectedKid(null);
    setError('');
    setPin('');
    setPicturePin([]);
    setFailedAttempts(0);
    setLockedUntil(null);
  };

  // Get age group for styling
  const ageGroup = selectedKid ? getAgeGroup(selectedKid.age || estimateAge(selectedKid.grade || '')) : 'tween';

  return (
    <main className={`min-h-screen bg-bg flex items-center justify-center p-4 sm:p-8 animate-fade-in ${ageGroup === 'young' ? 'text-xl' : ''}`}>
      <Card className={`max-w-md w-full ${ageGroup === 'young' ? 'p-6 sm:p-10' : 'p-8 sm:p-12'} text-center`}>
        
        {/* Welcome Screen */}
        {!showKids && !selectedKid && (
          <div className="animate-fade-in">
            <div className="text-6xl mb-6">🎒</div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-primary mb-2">
              Student Login
            </h1>
            <p className="text-text-muted mb-8 italic font-serif">
              Ready to learn something amazing?
            </p>

            <form onSubmit={loadFamilyKids} className="space-y-6">
              <div>
                <p className="text-sm font-bold text-text-muted uppercase tracking-widest mb-4">
                  Enter Your Family Code
                </p>
                <Input
                  type="text"
                  value={familyCode}
                  onChange={(e) => setFamilyCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SMITH-1234"
                  maxLength={12}
                  className="text-center text-xl sm:text-2xl tracking-widest font-display uppercase"
                  autoFocus
                />
                <p className="text-xs text-text-muted mt-3">
                  Ask your parent if you don't know it!
                </p>
              </div>

              {error && (
                <div className="p-4 bg-red-50 rounded-2xl border-2 border-red-200">
                  <p className="text-red-600 font-bold">{error}</p>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full text-lg py-4" 
                disabled={loading || familyCode.length < 6}
              >
                {loading ? 'Finding your family...' : 'Find My Family →'}
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t border-border">
              <Button variant="ghost" onClick={() => router.push('/')}>
                I'm a parent
              </Button>
            </div>
          </div>
        )}

        {/* Select Student */}
        {showKids && !selectedKid && (
          <div className="animate-fade-in">
            <div className="text-5xl mb-4">👋</div>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-primary mb-2">
              Who's learning today?
            </h2>
            <p className="text-text-muted mb-8 text-sm">Tap your picture!</p>

            <div className="grid gap-4">
              {kids.map((kid, idx) => {
                const kidAge = kid.age || estimateAge(kid.grade || '');
                const isYoung = getAgeGroup(kidAge) === 'young';
                const colors = [
                  'bg-primary/10 hover:bg-primary/20 hover:border-primary',
                  'bg-secondary/10 hover:bg-secondary/20 hover:border-secondary',
                  'bg-accent/10 hover:bg-accent/20 hover:border-accent',
                ];
                const colorClass = colors[idx % colors.length];
                
                return (
                  <button
                    key={kid.id}
                    onClick={() => handleKidSelect(kid)}
                    className={`${isYoung ? 'p-6 sm:p-8' : 'p-5 sm:p-6'} rounded-2xl ${colorClass} border-2 border-transparent transition-all font-display font-bold text-primary flex items-center gap-4 group`}
                  >
                    <span className={`${isYoung ? 'w-16 h-16 text-2xl' : 'w-12 h-12 text-lg'} rounded-full bg-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform`}>
                      {kid.name.charAt(0)}
                    </span>
                    <div className="text-left">
                      <span className={`${isYoung ? 'text-2xl' : 'text-xl'} block`}>{kid.name}</span>
                      {kid.grade && <span className="text-sm text-text-muted font-normal">{kid.grade}</span>}
                    </div>
                  </button>
                );
              })}
            </div>

            <Button variant="ghost" onClick={handleBack} className="mt-8">
              ← Use Different Code
            </Button>
          </div>
        )}

        {/* Enter PIN */}
        {selectedKid && (
          <div className="animate-fade-in">
            <div className="text-5xl mb-4">
              {ageGroup === 'young' ? '🌟' : ageGroup === 'tween' ? '🎯' : '👋'}
            </div>
            <h2 className={`font-display ${ageGroup === 'young' ? 'text-3xl' : 'text-2xl'} font-extrabold text-primary mb-1`}>
              Hi, {selectedKid.name}!
            </h2>
            
            {/* Picture PIN for young kids */}
            {usePicturePin ? (
              <div className="mt-6">
                <p className={`text-text-muted mb-4 ${ageGroup === 'young' ? 'text-lg' : 'text-sm'}`}>
                  Tap your 4 secret pictures!
                </p>

                {/* Selected pictures indicator */}
                <div className="flex justify-center gap-3 mb-6">
                  {[0, 1, 2, 3].map(i => (
                    <div 
                      key={i}
                      className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl transition-all ${
                        picturePin[i] 
                          ? 'bg-primary/10 border-primary' 
                          : 'bg-bg-alt border-border'
                      }`}
                    >
                      {picturePin[i] && PIN_PICTURES.find(p => p.id === picturePin[i])?.emoji}
                    </div>
                  ))}
                </div>

                {/* Picture grid */}
                <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-6">
                  {PIN_PICTURES.map(pic => (
                    <button
                      key={pic.id}
                      onClick={() => handlePictureSelect(pic.id)}
                      disabled={picturePin.length >= 4 || !!lockedUntil}
                      className="aspect-square rounded-xl bg-bg-alt hover:bg-primary/10 border-2 border-transparent hover:border-primary transition-all text-3xl sm:text-4xl flex items-center justify-center disabled:opacity-50 active:scale-95"
                      title={pic.label}
                    >
                      {pic.emoji}
                    </button>
                  ))}
                </div>

                {picturePin.length > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setPicturePin([])}
                    className="mb-4"
                  >
                    Start Over
                  </Button>
                )}

                {/* Switch to number PIN */}
                <p className="text-xs text-text-muted">
                  <button 
                    onClick={() => setUsePicturePin(false)}
                    className="underline hover:text-primary"
                  >
                    Use number PIN instead
                  </button>
                </p>
              </div>
            ) : (
              /* Number PIN */
              <form onSubmit={handlePinSubmit} className="mt-6">
                <p className={`text-text-muted mb-4 ${ageGroup === 'young' ? 'text-lg' : 'text-sm'}`}>
                  Enter your secret PIN
                </p>

                {/* PIN display */}
                <div className="flex justify-center gap-3 mb-6">
                  {[0, 1, 2, 3].map(i => (
                    <div 
                      key={i}
                      className={`${ageGroup === 'young' ? 'w-14 h-14 text-2xl' : 'w-12 h-12 text-xl'} rounded-xl border-2 flex items-center justify-center font-display font-bold transition-all ${
                        pin[i] 
                          ? 'bg-primary text-white border-primary' 
                          : 'bg-bg-alt border-border'
                      }`}
                    >
                      {pin[i] ? '●' : ''}
                    </div>
                  ))}
                </div>

                {/* Number keypad */}
                <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto mb-6">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((num, i) => {
                    if (num === null) return <div key={i} />;
                    if (num === 'del') {
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setPin(pin.slice(0, -1))}
                          disabled={!!lockedUntil}
                          className={`${ageGroup === 'young' ? 'h-16' : 'h-14'} rounded-xl bg-bg-alt hover:bg-red-100 border-2 border-transparent hover:border-red-300 transition-all text-lg font-bold disabled:opacity-50 active:scale-95`}
                        >
                          ←
                        </button>
                      );
                    }
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => pin.length < 4 && setPin(pin + num)}
                        disabled={pin.length >= 4 || !!lockedUntil}
                        className={`${ageGroup === 'young' ? 'h-16 text-2xl' : 'h-14 text-xl'} rounded-xl bg-bg-alt hover:bg-primary/10 border-2 border-transparent hover:border-primary transition-all font-display font-bold disabled:opacity-50 active:scale-95`}
                      >
                        {num}
                      </button>
                    );
                  })}
                </div>

                <Button 
                  type="submit" 
                  className="w-full py-4 text-lg" 
                  disabled={pin.length < 4 || !!lockedUntil}
                >
                  {lockedUntil ? `Wait ${Math.ceil((lockedUntil - Date.now()) / 1000)}s...` : 'Enter Vault →'}
                </Button>

                {/* Switch to picture PIN if available */}
                {(selectedKid as any).picture_pin?.length > 0 && (
                  <p className="text-xs text-text-muted mt-4">
                    <button 
                      onClick={() => setUsePicturePin(true)}
                      className="underline hover:text-primary"
                    >
                      Use picture PIN instead
                    </button>
                  </p>
                )}
              </form>
            )}

            {error && (
              <div className="mt-4 p-4 bg-red-50 rounded-2xl border-2 border-red-200">
                <p className="text-red-600 font-bold">{error}</p>
              </div>
            )}

            <Button variant="ghost" onClick={handleBackToKids} className="mt-6">
              ← Not {selectedKid.name}?
            </Button>
          </div>
        )}
      </Card>
    </main>
  );
}
