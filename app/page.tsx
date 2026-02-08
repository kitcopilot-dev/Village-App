'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

export default function Home() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [registerFamilyName, setRegisterFamilyName] = useState('');
  const [loginMessage, setLoginMessage] = useState('');
  const [registerMessage, setRegisterMessage] = useState('');

  useEffect(() => {
    // Check if already logged in
    if (pb.authStore.isValid) {
      router.push('/profile');
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginMessage('');
    
    try {
      await pb.collection('profiles').authWithPassword(loginEmail, loginPassword);
      setLoginMessage('✓ Login successful!');
      router.push('/profile');
    } catch (error: any) {
      setLoginMessage('✗ ' + (error?.message || 'Login failed'));
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterMessage('');

    if (registerPassword !== registerConfirmPassword) {
      setRegisterMessage('✗ Passwords do not match');
      return;
    }

    try {
      // Create account directly in profiles (it's an auth collection)
      await pb.collection('profiles').create({
        email: registerEmail,
        password: registerPassword,
        passwordConfirm: registerConfirmPassword,
        family_name: registerFamilyName + " Family",
        description: '',
        location: '',
        children_ages: ''
      });

      // Auto-login via profiles
      await pb.collection('profiles').authWithPassword(registerEmail, registerPassword);
      
      setRegisterMessage('✓ Account created! Redirecting...');
      setTimeout(() => router.push('/profile'), 1000);
    } catch (error: any) {
      const errorMsg = error?.data?.message || error?.message || 'Registration failed';
      setRegisterMessage('✗ ' + errorMsg);
      console.error('Registration error details:', JSON.stringify(error.response?.data || error.data || error));
    }
  };

  const navigateToLegalGuides = () => {
    router.push('/legal-guides');
  };

  return (
    <>
      <Header />
      <main className="max-w-6xl mx-auto my-12 px-8 animate-fade-in">
        <Card>
          <div className="absolute top-0 right-0 w-36 h-36 bg-accent-soft rounded-full opacity-50" 
               style={{ clipPath: 'circle(50% at 100% 0)' }} />
          
          <h2 className="font-display text-5xl font-extrabold tracking-tight mb-8 leading-tight">
            Welcome to the Village
          </h2>
          <p className="text-xl text-text-muted mb-12">
            A handcrafted space for families to coordinate, share resources, and grow together.
          </p>

          <div className="grid md:grid-cols-2 gap-16">
            {/* Register Form */}
            <div>
              <h3 className="font-serif italic text-2xl text-primary mb-6">Join the community</h3>
              <form onSubmit={handleRegister}>
                <Input
                  type="email"
                  placeholder="Email"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  required
                />
                <Input
                  type="password"
                  placeholder="Password"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  required
                />
                <Input
                  type="password"
                  placeholder="Confirm Password"
                  value={registerConfirmPassword}
                  onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                  required
                />
                <Input
                  type="text"
                  placeholder="Family Name"
                  value={registerFamilyName}
                  onChange={(e) => setRegisterFamilyName(e.target.value)}
                  required
                />
                {registerMessage && (
                  <p className={`mb-4 ${registerMessage.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>
                    {registerMessage}
                  </p>
                )}
                <Button type="submit" className="w-full">Create Account</Button>
              </form>
            </div>

            {/* Login Form */}
            <div>
              <h3 className="font-serif italic text-2xl text-primary mb-6">Already a member?</h3>
              <form onSubmit={handleLogin}>
                <Input
                  type="email"
                  placeholder="Email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                />
                <Input
                  type="password"
                  placeholder="Password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
                {loginMessage && (
                  <p className={`mb-4 ${loginMessage.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>
                    {loginMessage}
                  </p>
                )}
                <Button type="submit" className="w-full mb-8">Login</Button>
              </form>

              <div className="border-t border-border pt-8">
                <p className="text-sm text-text-muted">
                  Just exploring?{' '}
                  <button 
                    onClick={navigateToLegalGuides}
                    className="text-primary font-semibold underline cursor-pointer bg-transparent border-none"
                  >
                    View State Legal Guides
                  </button>
                </p>
              </div>
            </div>
          </div>
        </Card>
      </main>
    </>
  );
}
