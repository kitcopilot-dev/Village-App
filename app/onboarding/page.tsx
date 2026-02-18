'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { OnboardingProgress } from '@/components/OnboardingProgress';

type FaithPreference = 'none' | 'christian' | 'lds';

interface ChildData {
  first_name: string;
  nickname?: string;
  grade_level: string;
  birthdate?: string;
  interests: string[];
}

const GRADE_OPTIONS = [
  'Not in school yet (2-4)',
  'Pre-K',
  'Kindergarten',
  '1st Grade',
  '2nd Grade',
  '3rd Grade',
  '4th Grade',
  '5th Grade',
  '6th Grade',
  '7th Grade',
  '8th Grade',
  '9th Grade',
  '10th Grade',
  '11th Grade',
  '12th Grade',
];

const INTEREST_OPTIONS = [
  { id: 'art', label: '🎨 Art', emoji: '🎨' },
  { id: 'music', label: '🎵 Music', emoji: '🎵' },
  { id: 'stem', label: '🔬 STEM', emoji: '🔬' },
  { id: 'sports', label: '⚽ Sports', emoji: '⚽' },
  { id: 'nature', label: '🌿 Nature', emoji: '🌿' },
  { id: 'reading', label: '📚 Reading', emoji: '📚' },
  { id: 'handson', label: '🛠️ Hands-on', emoji: '🛠️' },
  { id: 'social', label: '👥 Social', emoji: '👥' },
];

const STEP_LABELS = [
  'Welcome',
  'Faith Preference',
  'Your Profile',
  'Add a Learner',
  'All Set!',
];

export default function OnboardingPage() {
  const router = useRouter();
  const [pb, setPb] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // Form data
  const [faithPreference, setFaithPreference] = useState<FaithPreference | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [location, setLocation] = useState('');
  const [familyCode, setFamilyCode] = useState('');
  const [children, setChildren] = useState<ChildData[]>([]);
  const [currentChild, setCurrentChild] = useState<ChildData>({
    first_name: '',
    nickname: '',
    grade_level: '',
    birthdate: '',
    interests: [],
  });

  useEffect(() => {
    setMounted(true);
    const pocketbase = getPocketBase();
    setPb(pocketbase);

    // Redirect if not logged in
    if (!pocketbase.authStore.isValid) {
      router.push('/');
      return;
    }

    // Check if already completed onboarding
    const profile = pocketbase.authStore.model as any;
    if (profile?.profile_complete) {
      router.push('/dashboard');
      return;
    }

    // Pre-fill existing data if any
    if (profile) {
      if (profile.faith_preference) setFaithPreference(profile.faith_preference);
      if (profile.family_code) setFamilyCode(profile.family_code);
      
      // Extract first/last name from family_name if it exists
      if (profile.family_name) {
        const name = profile.family_name.replace(' Family', '');
        setLastName(name);
      }
    }
  }, [router]);

  const generateFamilyCode = () => {
    const name = lastName.toUpperCase().slice(0, 5) || 'FAMILY';
    const num = Math.floor(1000 + Math.random() * 9000);
    return `${name}-${num}`;
  };

  const handleNextStep = () => {
    setError('');
    setCurrentStep((prev) => Math.min(prev + 1, STEP_LABELS.length - 1));
  };

  const handlePrevStep = () => {
    setError('');
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleAddChild = () => {
    if (!currentChild.first_name.trim() || !currentChild.grade_level) {
      setError('Please enter the child\'s name and grade level');
      return;
    }
    
    setChildren([...children, currentChild]);
    setCurrentChild({
      first_name: '',
      nickname: '',
      grade_level: '',
      birthdate: '',
      interests: [],
    });
    setError('');
  };

  const toggleInterest = (interestId: string) => {
    setCurrentChild((prev) => ({
      ...prev,
      interests: prev.interests.includes(interestId)
        ? prev.interests.filter((i) => i !== interestId)
        : [...prev.interests, interestId],
    }));
  };

  const handleCompleteOnboarding = async () => {
    if (!pb) return;
    setIsSubmitting(true);
    setError('');

    try {
      const profileId = pb.authStore.model?.id;
      if (!profileId) throw new Error('Not authenticated');

      // Generate family code if not set
      const finalFamilyCode = familyCode || generateFamilyCode();

      // Update profile
      const profileUpdate: any = {
        family_name: `${firstName} ${lastName}`.trim() || `${lastName} Family`,
        faith_preference: faithPreference || 'none',
        profile_complete: true,
        family_code: finalFamilyCode,
      };
      
      if (location.trim()) {
        profileUpdate.location = location;
      }

      await pb.collection('profiles').update(profileId, profileUpdate);

      // Create children records
      for (const child of children) {
        await pb.collection('children').create({
          profile: profileId,
          first_name: child.first_name,
          nickname: child.nickname || '',
          grade_level: child.grade_level,
          birthdate: child.birthdate || null,
          interests: child.interests,
          family_code: finalFamilyCode,
        });
      }

      // Also add the current child if it has data
      if (currentChild.first_name.trim() && currentChild.grade_level) {
        await pb.collection('children').create({
          profile: profileId,
          first_name: currentChild.first_name,
          nickname: currentChild.nickname || '',
          grade_level: currentChild.grade_level,
          birthdate: currentChild.birthdate || null,
          interests: currentChild.interests,
          family_code: finalFamilyCode,
        });
        setChildren([...children, currentChild]);
      }

      // Update local state with new family code
      setFamilyCode(finalFamilyCode);

      // Refresh auth state
      const updatedProfile = await pb.collection('profiles').getOne(profileId);
      pb.authStore.save(pb.authStore.token, updatedProfile);

      // Move to success step
      handleNextStep();
    } catch (err: any) {
      setError(err?.message || 'Failed to save profile');
      console.error('Onboarding error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="animate-pulse text-text-muted">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-primary">
            🏡 Village
          </h1>
        </div>

        {/* Progress - hide on welcome and success */}
        {currentStep > 0 && currentStep < STEP_LABELS.length - 1 && (
          <OnboardingProgress
            currentStep={currentStep - 1}
            totalSteps={STEP_LABELS.length - 2}
            stepLabels={STEP_LABELS.slice(1, -1)}
          />
        )}

        {/* Step Content */}
        <Card className="animate-fade-in">
          {/* Step 0: Welcome */}
          {currentStep === 0 && (
            <div className="text-center py-8">
              <div className="text-6xl mb-6">🌱</div>
              <h2 className="font-display text-3xl font-bold text-text mb-4">
                Welcome to Village
              </h2>
              <p className="text-text-muted text-lg mb-8 max-w-sm mx-auto">
                Your homeschool community starts here. Let&apos;s set up your family in just a few minutes.
              </p>
              <Button size="lg" onClick={handleNextStep}>
                Get Started →
              </Button>
              <p className="text-sm text-text-muted mt-6">
                Takes about 3 minutes
              </p>
            </div>
          )}

          {/* Step 1: Faith Preference */}
          {currentStep === 1 && (
            <div className="py-4">
              <h2 className="font-display text-2xl font-bold text-text mb-2 text-center">
                Help us personalize Village
              </h2>
              <p className="text-text-muted text-center mb-6">
                Choose the content style that fits your family best.
              </p>

              <div className="space-y-3 mb-6">
                {/* Secular */}
                <button
                  onClick={() => setFaithPreference('none')}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all
                    ${faithPreference === 'none'
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-border hover:border-primary-light'
                    }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">🌍</span>
                    <div>
                      <h3 className="font-semibold text-text">Secular</h3>
                      <p className="text-sm text-text-muted">
                        Academic content without religious elements
                      </p>
                    </div>
                  </div>
                </button>

                {/* Christian */}
                <button
                  onClick={() => setFaithPreference('christian')}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all
                    ${faithPreference === 'christian'
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-border hover:border-primary-light'
                    }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">✝️</span>
                    <div>
                      <h3 className="font-semibold text-text">Christian</h3>
                      <p className="text-sm text-text-muted">
                        Faith-integrated curriculum and community
                      </p>
                    </div>
                  </div>
                </button>

                {/* LDS */}
                <button
                  onClick={() => setFaithPreference('lds')}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all
                    ${faithPreference === 'lds'
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-border hover:border-primary-light'
                    }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">🏛️</span>
                    <div>
                      <h3 className="font-semibold text-text">Latter-day Saint</h3>
                      <p className="text-sm text-text-muted">
                        LDS-aligned content and values
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              <details className="text-sm text-text-muted mb-6">
                <summary className="cursor-pointer hover:text-primary">
                  Why do we ask this?
                </summary>
                <p className="mt-2 p-3 bg-bg-alt rounded-lg">
                  Village believes every family should feel at home. Your selection customizes
                  curriculum recommendations, community events, and lesson content. You can
                  change this anytime in Settings.
                </p>
              </details>

              {error && (
                <p className="text-secondary text-sm mb-4 text-center">{error}</p>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={handlePrevStep} className="flex-1">
                  ← Back
                </Button>
                <Button
                  onClick={() => {
                    if (!faithPreference) {
                      setError('Please select a preference to continue');
                      return;
                    }
                    handleNextStep();
                  }}
                  className="flex-1"
                  disabled={!faithPreference}
                >
                  Continue →
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Profile Setup */}
          {currentStep === 2 && (
            <div className="py-4">
              <h2 className="font-display text-2xl font-bold text-text mb-2 text-center">
                Tell us about you
              </h2>
              <p className="text-text-muted text-center mb-6">
                Just the basics — you can add more later.
              </p>

              <form onSubmit={(e) => { e.preventDefault(); handleNextStep(); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Sarah"
                    required
                  />
                  <Input
                    label="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Smith"
                    required
                  />
                </div>

                <div>
                  <Input
                    label="Your location (optional)"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Denver, CO"
                  />
                  <p className="text-xs text-text-muted mt-1">
                    Helps you find nearby families and co-ops
                  </p>
                </div>

                {error && (
                  <p className="text-secondary text-sm text-center">{error}</p>
                )}

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" type="button" onClick={handlePrevStep} className="flex-1">
                    ← Back
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={!firstName.trim() || !lastName.trim()}
                  >
                    Continue →
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Step 3: Add First Child */}
          {currentStep === 3 && (
            <div className="py-4">
              <div className="text-center mb-6">
                <span className="text-5xl">📚</span>
                <h2 className="font-display text-2xl font-bold text-text mt-4 mb-2">
                  Let&apos;s add your first learner!
                </h2>
                <p className="text-text-muted">
                  You can add more children anytime.
                </p>
              </div>

              {/* Show already added children */}
              {children.length > 0 && (
                <div className="mb-6 space-y-2">
                  <p className="text-sm font-medium text-text-muted">Added:</p>
                  {children.map((child, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20"
                    >
                      <span className="text-2xl">🎉</span>
                      <div>
                        <p className="font-medium text-text">{child.first_name}</p>
                        <p className="text-sm text-text-muted">{child.grade_level}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-4">
                <Input
                  label="Child's first name"
                  value={currentChild.first_name}
                  onChange={(e) => setCurrentChild({ ...currentChild, first_name: e.target.value })}
                  placeholder="Emma"
                />

                <Input
                  label="Goes by (optional)"
                  value={currentChild.nickname}
                  onChange={(e) => setCurrentChild({ ...currentChild, nickname: e.target.value })}
                  placeholder="If different from first name"
                />

                <div>
                  <label className="block text-sm font-medium text-text mb-2">
                    Grade level
                  </label>
                  <select
                    value={currentChild.grade_level}
                    onChange={(e) => setCurrentChild({ ...currentChild, grade_level: e.target.value })}
                    className="w-full p-3 rounded-xl border border-border bg-white text-text
                      focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="">Select grade...</option>
                    {GRADE_OPTIONS.map((grade) => (
                      <option key={grade} value={grade}>{grade}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text mb-2">
                    Learning interests (optional)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {INTEREST_OPTIONS.map((interest) => (
                      <button
                        key={interest.id}
                        type="button"
                        onClick={() => toggleInterest(interest.id)}
                        className={`px-3 py-2 rounded-full text-sm font-medium transition-all
                          ${currentChild.interests.includes(interest.id)
                            ? 'bg-primary text-white'
                            : 'bg-bg-alt text-text-muted hover:bg-primary/10'
                          }`}
                      >
                        {interest.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {error && (
                <p className="text-secondary text-sm mt-4 text-center">{error}</p>
              )}

              <div className="flex flex-col gap-3 mt-6">
                {children.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={handleAddChild}
                    disabled={!currentChild.first_name.trim()}
                  >
                    + Add Another Child
                  </Button>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" onClick={handlePrevStep} className="flex-1">
                    ← Back
                  </Button>
                  <Button
                    onClick={handleCompleteOnboarding}
                    className="flex-1"
                    disabled={isSubmitting || (children.length === 0 && !currentChild.first_name.trim())}
                  >
                    {isSubmitting ? 'Saving...' : children.length > 0 || currentChild.first_name.trim()
                      ? `Add ${currentChild.first_name || children[children.length - 1]?.first_name || 'Child'} →`
                      : 'Add Child →'
                    }
                  </Button>
                </div>

                {children.length > 0 && !currentChild.first_name.trim() && (
                  <Button
                    variant="ghost"
                    onClick={handleCompleteOnboarding}
                    disabled={isSubmitting}
                  >
                    Done adding kids →
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Success */}
          {currentStep === 4 && (
            <div className="py-8 text-center">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="font-display text-3xl font-bold text-text mb-4">
                Your Village is ready!
              </h2>
              <p className="text-text-muted mb-8">
                Here&apos;s your family at a glance
              </p>

              {/* Family summary */}
              <div className="bg-bg-alt rounded-xl p-4 mb-6 text-left">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-2xl">
                    👨‍👩‍👧
                  </div>
                  <div>
                    <p className="font-semibold text-text">{firstName} {lastName}</p>
                    {location && <p className="text-sm text-text-muted">{location}</p>}
                  </div>
                </div>

                {children.length > 0 && (
                  <div className="space-y-2">
                    {children.map((child, index) => (
                      <div key={index} className="flex items-center gap-3 p-2 bg-white rounded-lg">
                        <span className="text-xl">🧒</span>
                        <div>
                          <p className="font-medium text-text">{child.first_name}</p>
                          <p className="text-xs text-text-muted">{child.grade_level}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Family Code */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-8">
                <p className="text-sm text-text-muted mb-1">Your Family Code</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="font-mono text-2xl font-bold text-primary tracking-wider">
                    {familyCode}
                  </span>
                  <button
                    onClick={() => navigator.clipboard.writeText(familyCode)}
                    className="text-primary hover:text-primary-dark transition-colors"
                    title="Copy to clipboard"
                  >
                    📋
                  </button>
                </div>
                <p className="text-xs text-text-muted mt-2">
                  Kids use this code to log in on their own devices
                </p>
              </div>

              <Button size="lg" onClick={() => router.push('/dashboard')}>
                Explore Your Dashboard →
              </Button>

              {/* Quick links */}
              <div className="grid grid-cols-2 gap-3 mt-6">
                <button
                  onClick={() => router.push('/manage-kids')}
                  className="p-4 rounded-xl bg-bg-alt hover:bg-border/50 transition-colors text-left"
                >
                  <span className="text-xl mb-1 block">📱</span>
                  <p className="font-medium text-sm text-text">Set up logins</p>
                  <p className="text-xs text-text-muted">For student devices</p>
                </button>
                <button
                  onClick={() => router.push('/map')}
                  className="p-4 rounded-xl bg-bg-alt hover:bg-border/50 transition-colors text-left"
                >
                  <span className="text-xl mb-1 block">🗺️</span>
                  <p className="font-medium text-sm text-text">Find families</p>
                  <p className="text-xs text-text-muted">Connect nearby</p>
                </button>
              </div>
            </div>
          )}
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-text-muted mt-8">
          Need help?{' '}
          <a href="mailto:support@village.app" className="text-primary hover:underline">
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}
