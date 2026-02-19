'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';

// Same picture options as the student login
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

interface PicturePinSetupProps {
  childName: string;
  currentPicturePin?: string[];
  currentNumericPin?: string;
  onSave: (picturePin: string[], numericPin: string) => Promise<void>;
  onCancel: () => void;
}

export function PicturePinSetup({ 
  childName, 
  currentPicturePin = [], 
  currentNumericPin = '',
  onSave, 
  onCancel 
}: PicturePinSetupProps) {
  const [step, setStep] = useState<'choose' | 'picture' | 'numeric'>('choose');
  const [picturePin, setPicturePin] = useState<string[]>(currentPicturePin);
  const [numericPin, setNumericPin] = useState(currentNumericPin);
  const [confirmNumericPin, setConfirmNumericPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handlePictureSelect = (pictureId: string) => {
    if (picturePin.length >= 4) return;
    setPicturePin([...picturePin, pictureId]);
  };

  const handleSavePicturePin = async () => {
    if (picturePin.length !== 4) {
      setError('Please select exactly 4 pictures');
      return;
    }
    
    setSaving(true);
    setError('');
    try {
      await onSave(picturePin, numericPin);
    } catch (e: any) {
      setError(e.message || 'Failed to save PIN');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNumericPin = async () => {
    if (numericPin.length !== 4) {
      setError('PIN must be exactly 4 digits');
      return;
    }
    if (numericPin !== confirmNumericPin) {
      setError('PINs do not match');
      return;
    }
    
    setSaving(true);
    setError('');
    try {
      await onSave([], numericPin);
    } catch (e: any) {
      setError(e.message || 'Failed to save PIN');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={true} title={`Set Up Login PIN for ${childName}`} onClose={onCancel}>
      <div className="space-y-6">
        {/* Step: Choose PIN type */}
        {step === 'choose' && (
          <div className="animate-fade-in">
            <p className="text-text-muted text-sm mb-6 text-center">
              How should {childName} log in?
            </p>
            
            <div className="grid gap-4">
              <button
                onClick={() => setStep('picture')}
                className="p-6 rounded-2xl bg-bg-alt hover:bg-primary/10 border-2 border-transparent hover:border-primary transition-all text-left group"
              >
                <div className="flex items-center gap-4">
                  <span className="text-4xl">🖼️</span>
                  <div>
                    <h4 className="font-display font-bold text-lg mb-1">Picture PIN</h4>
                    <p className="text-sm text-text-muted">
                      Tap 4 pictures in order. Great for ages 6-8!
                    </p>
                  </div>
                </div>
              </button>
              
              <button
                onClick={() => setStep('numeric')}
                className="p-6 rounded-2xl bg-bg-alt hover:bg-primary/10 border-2 border-transparent hover:border-primary transition-all text-left group"
              >
                <div className="flex items-center gap-4">
                  <span className="text-4xl">🔢</span>
                  <div>
                    <h4 className="font-display font-bold text-lg mb-1">Number PIN</h4>
                    <p className="text-sm text-text-muted">
                      Enter a 4-digit code. Good for ages 9+.
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {(currentPicturePin.length > 0 || currentNumericPin) && (
              <p className="text-xs text-text-muted text-center mt-6">
                Current: {currentPicturePin.length > 0 ? 'Picture PIN' : 'Number PIN'} is set
              </p>
            )}
          </div>
        )}

        {/* Step: Picture PIN setup */}
        {step === 'picture' && (
          <div className="animate-fade-in">
            <p className="text-text-muted text-sm mb-4 text-center">
              Select 4 pictures that {childName} will remember
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
            <div className="grid grid-cols-4 gap-2 mb-4">
              {PIN_PICTURES.map(pic => (
                <button
                  key={pic.id}
                  onClick={() => handlePictureSelect(pic.id)}
                  disabled={picturePin.length >= 4}
                  className="aspect-square rounded-xl bg-bg-alt hover:bg-primary/10 border-2 border-transparent hover:border-primary transition-all text-3xl flex items-center justify-center disabled:opacity-50 active:scale-95"
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
                className="w-full mb-4"
              >
                Clear & Start Over
              </Button>
            )}

            {error && (
              <p className="text-red-500 text-sm text-center mb-4">{error}</p>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('choose')} className="flex-1">
                ← Back
              </Button>
              <Button 
                onClick={handleSavePicturePin} 
                disabled={picturePin.length !== 4 || saving}
                className="flex-1"
              >
                {saving ? 'Saving...' : 'Save Picture PIN'}
              </Button>
            </div>
            
            <p className="text-xs text-text-muted text-center mt-4">
              💡 Tip: Let {childName} help choose the pictures so they remember them!
            </p>
          </div>
        )}

        {/* Step: Numeric PIN setup */}
        {step === 'numeric' && (
          <div className="animate-fade-in">
            <p className="text-text-muted text-sm mb-6 text-center">
              Choose a 4-digit PIN for {childName}
            </p>
            
            <div className="space-y-4 max-w-[200px] mx-auto">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-text-muted block mb-2">
                  Enter PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={numericPin}
                  onChange={(e) => setNumericPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center text-2xl tracking-[0.5em] font-display p-4 rounded-xl border-2 border-border focus:border-primary focus:outline-none"
                  placeholder="····"
                />
              </div>
              
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-text-muted block mb-2">
                  Confirm PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={confirmNumericPin}
                  onChange={(e) => setConfirmNumericPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center text-2xl tracking-[0.5em] font-display p-4 rounded-xl border-2 border-border focus:border-primary focus:outline-none"
                  placeholder="····"
                />
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-sm text-center mt-4">{error}</p>
            )}

            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={() => setStep('choose')} className="flex-1">
                ← Back
              </Button>
              <Button 
                onClick={handleSaveNumericPin} 
                disabled={numericPin.length !== 4 || saving}
                className="flex-1"
              >
                {saving ? 'Saving...' : 'Save Number PIN'}
              </Button>
            </div>
            
            <p className="text-xs text-text-muted text-center mt-4">
              💡 Tip: Use a number {childName} can easily remember (not their birthday!)
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
