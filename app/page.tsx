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
  const [mounted, setMounted] = useState(false);
  const [pb, setPb] = useState<any>(null);
  
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [registerFamilyName, setRegisterFamilyName] = useState('');
  const [loginMessage, setLoginMessage] = useState('');
  const [registerMessage, setRegisterMessage] = useState('');

  useEffect(() => {
    setMounted(true);
    // Initialize PocketBase client-side only
    const pocketbase = getPocketBase();
    setPb(pocketbase);
    
    // Check if already logged in
    if (pocketbase.authStore.isValid) {
      router.push('/profile');
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pb) return;
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
    if (!pb) return;
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

  if (!mounted || !pb) {
    return (
      <>
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-8 pb-24 text-center pt-20">
          <p className="text-text-muted">Loading...</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-8 pb-24 animate-fade-in">
        {/* Hero Section */}
        <section className="pt-20 pb-16 md:pt-32 md:pb-24 text-center relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-3xl -z-10" />
          
          <h1 className="font-display text-4xl sm:text-6xl md:text-8xl font-extrabold tracking-tighter mb-8 leading-[0.9] break-words">
            Homeschooling is <span className="text-primary italic">Better</span> <br className="hidden md:block" /> Together.
          </h1>
          <p className="text-xl md:text-2xl text-text-muted max-w-2xl mx-auto mb-12 font-serif italic">
            Village is a handcrafted space for modern families to coordinate gatherings, track progress, and navigate homeschooling laws with confidence.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button size="lg" onClick={() => document.getElementById('join')?.scrollIntoView({ behavior: 'smooth' })}>
              Start Your Village
            </Button>
            <Button variant="ghost" size="lg" onClick={() => router.push('/student')}>
              Student Login
            </Button>
            <Button variant="outline" size="lg" onClick={navigateToLegalGuides}>
              Explore Legal Guides
            </Button>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="grid md:grid-cols-3 gap-8 mb-32">
          <Card className="p-10 border-primary/20 bg-primary/5">
            <div className="text-4xl mb-6">🏘️</div>
            <h3 className="font-display text-2xl font-bold mb-4">Community Focused</h3>
            <p className="text-text-muted leading-relaxed">
              Coordinate field trips, park days, and study groups with a local community that shares your values.
            </p>
          </Card>
          <Card className="p-10 border-secondary/20 bg-secondary/5">
            <div className="text-4xl mb-6">⚖️</div>
            <h3 className="font-display text-2xl font-bold mb-4">Legal Clarity</h3>
            <p className="text-text-muted leading-relaxed">
              Stay compliant with instant access to state-by-state homeschooling regulations and requirement checklists.
            </p>
          </Card>
          <Card className="p-10 border-accent/20 bg-accent/5">
            <div className="text-4xl mb-6">🎓</div>
            <h3 className="font-display text-2xl font-bold mb-4">Academic Records</h3>
            <p className="text-text-muted leading-relaxed">
              Generate professional transcripts and maintain portfolios of work samples for total academic peace of mind.
            </p>
          </Card>
        </section>

        {/* Auth Section */}
        <section id="join" className="pt-12">
          <Card className="p-8 md:p-16 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent-soft rounded-full opacity-30 -mr-20 -mt-20 blur-2xl" />
            
            <div className="grid lg:grid-cols-2 gap-20">
              {/* Register Form */}
              <div>
                <h3 className="font-display text-4xl font-extrabold mb-2">Join the community</h3>
                <p className="text-text-muted mb-8 font-serif italic">Create your family profile to get started.</p>
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
                    placeholder="Family Name (e.g. Smith)"
                    value={registerFamilyName}
                    onChange={(e) => setRegisterFamilyName(e.target.value)}
                    required
                  />
                  {registerMessage && (
                    <p className={`mb-4 px-4 py-2 rounded-lg text-sm ${registerMessage.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {registerMessage}
                    </p>
                  )}
                  <Button type="submit" className="w-full">Create Your Account</Button>
                </form>
              </div>

              {/* Login Form */}
              <div className="lg:border-l lg:border-border lg:pl-20">
                <h3 className="font-display text-4xl font-extrabold mb-2">Already a member?</h3>
                <p className="text-text-muted mb-8 font-serif italic">Welcome back to the village.</p>
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
                    <p className={`mb-4 px-4 py-2 rounded-lg text-sm ${loginMessage.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {loginMessage}
                    </p>
                  )}
                  <Button type="submit" className="w-full mb-8">Login</Button>
                </form>

                <div className="pt-8 border-t border-dashed border-border">
                  <p className="text-sm text-text-muted">
                    Not ready to join?{' '}
                    <button 
                      onClick={navigateToLegalGuides}
                      className="text-primary font-bold underline cursor-pointer bg-transparent border-none p-0"
                    >
                      View Free Legal Guides
                    </button>
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* Footer */}
        <footer className="mt-32 pt-12 border-t border-border flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="font-display text-xl font-extrabold text-primary uppercase tracking-tighter">
            Village<span className="text-secondary">.</span>
          </div>
          <div className="flex gap-8 text-sm font-bold text-text-muted">
            <span className="cursor-not-allowed opacity-50 text-[10px] uppercase tracking-widest">Privacy</span>
            <span className="cursor-not-allowed opacity-50 text-[10px] uppercase tracking-widest">Terms</span>
            <span className="cursor-not-allowed opacity-50 text-[10px] uppercase tracking-widest">Contact</span>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted/50 m-0">
            © {new Date().getFullYear()} Handcrafted for families.
          </p>
        </footer>
      </main>
    </>
  );
}
