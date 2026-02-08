'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { LegalGuide } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

// Helpful homeschool organizations by state (verified links only)
const stateResources: Record<string, Array<{name: string, url: string, description: string}>> = {
  'California': [
    { name: 'Homeschool Association of California', url: 'https://www.hsc.org/', description: 'Secular homeschool support' },
    { name: 'Christian Home Educators Association of California', url: 'https://www.cheaofca.org/', description: 'Christian homeschool support' }
  ],
  'Florida': [
    { name: 'Florida Parent Educators Association', url: 'https://fpea.com/', description: 'Largest FL homeschool org' }
  ],
  'Georgia': [
    { name: 'Georgia Home Education Association', url: 'https://ghea.org/', description: 'State homeschool support' }
  ],
  'Illinois': [
    { name: 'Illinois Christian Home Educators', url: 'https://www.iche.org/', description: 'Support and advocacy' }
  ],
  'North Carolina': [
    { name: 'North Carolinians for Home Education', url: 'https://www.nche.com/', description: 'State homeschool organization' }
  ],
  'Texas': [
    { name: 'Texas Home School Coalition', url: 'https://thsc.org/', description: 'Getting started guide & advocacy' },
    { name: 'THSC - How to Homeschool in Texas', url: 'https://thsc.org/homeschool-in-texas/', description: 'Step-by-step guide for new families' }
  ],
  'Virginia': [
    { name: 'Home Educators Association of Virginia', url: 'https://www.heav.org/', description: 'VA homeschool organization' }
  ]
};

export default function LegalGuidesPage() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [guides, setGuides] = useState<LegalGuide[]>([]);
  const [filteredGuides, setFilteredGuides] = useState<LegalGuide[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [selectedGuide, setSelectedGuide] = useState<LegalGuide | null>(null);
  const [userState, setUserState] = useState<string | null>(null);

  const isLoggedIn = pb.authStore.isValid;

  useEffect(() => {
    loadGuides();
    if (isLoggedIn) {
      loadUserProfile();
    }
  }, []);

  useEffect(() => {
    filterGuides();
  }, [guides, searchQuery, filterLevel]);

  const loadGuides = async () => {
    try {
      const records = await pb.collection('state_laws').getFullList({
        sort: 'state_name'
      });
      
      // Map to expected format, parsing JSON key_requirements
      const mapped = records.map(r => {
        let reqs: any = {};
        try {
          if (r.key_requirements && typeof r.key_requirements === 'string') {
            reqs = JSON.parse(r.key_requirements);
          }
        } catch (e) {
          reqs = {};
        }
        
        return {
          id: r.id,
          state: r.state_name,
          regulation_level: r.regulation_level,
          requirements: r.summary || 'No summary available.',
          notification_requirements: reqs.notification,
          testing_requirements: reqs.testing,
          record_keeping: reqs.record_keeping,
          teacher_quals: reqs.teacher_quals,
          days_required: reqs.days_required,
          resources: r.official_link
        };
      });
      
      setGuides(mapped as unknown as LegalGuide[]);
    } catch (error) {
      console.error('Legal guides load error:', error);
    }
  };

  const loadUserProfile = async () => {
    try {
      // When logged in via profiles collection, authStore.model IS the profile
      const profile = pb.authStore.model;
      if (!profile?.location) return;

      // Extract state from location string (e.g., "McAllen, TX" or "Mission, Texas")
      const location = profile.location as string;
      
      // Common state abbreviations and full names
      const stateMap: Record<string, string> = {
        'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
        'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
        'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
        'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
        'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
        'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
        'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
        'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
        'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
        'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
      };

      // Try to find state abbreviation (e.g., "TX")
      for (const [abbr, fullName] of Object.entries(stateMap)) {
        if (location.includes(abbr) || location.toLowerCase().includes(fullName.toLowerCase())) {
          setUserState(fullName);
          return;
        }
      }
    } catch (error) {
      console.error('Profile load error:', error);
    }
  };

  const filterGuides = () => {
    let filtered = [...guides];

    if (searchQuery) {
      filtered = filtered.filter(g => 
        g.state.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filterLevel) {
      filtered = filtered.filter(g => g.regulation_level === filterLevel);
    }

    setFilteredGuides(filtered);
  };

  const handleLogout = () => {
    pb.authStore.clear();
    router.push('/');
  };

  const getLevelBadge = (level: string) => {
    const colors = {
      Low: 'bg-green-100 text-green-700 border-green-300',
      Moderate: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      High: 'bg-red-100 text-red-700 border-red-300'
    };
    
    const icons = {
      Low: '🟢',
      Moderate: '🟡',
      High: '🔴'
    };

    return (
      <span className={`px-4 py-1 rounded-full text-xs font-bold border ${colors[level as keyof typeof colors] || ''}`}>
        {icons[level as keyof typeof icons]} {level}
      </span>
    );
  };

  const levelCounts = {
    Low: guides.filter(g => g.regulation_level === 'Low').length,
    Moderate: guides.filter(g => g.regulation_level === 'Moderate').length,
    High: guides.filter(g => g.regulation_level === 'High').length
  };

  if (selectedGuide) {
    return (
      <>
        <Header showLogout={isLoggedIn} onLogout={handleLogout} />
        <main className="max-w-4xl mx-auto my-12 px-8 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
            <h2 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight mb-0">
              {selectedGuide.state}
            </h2>
            <Button variant="ghost" onClick={() => setSelectedGuide(null)}>← All States</Button>
          </div>

          <Card>
            <div className="mb-8">
              {getLevelBadge(selectedGuide.regulation_level)}
            </div>

            <div className="space-y-8">
              <div>
                <h3 className="font-serif italic text-2xl text-primary mb-3">Overview</h3>
                <p className="text-text-muted whitespace-pre-wrap">{selectedGuide.requirements}</p>
              </div>

              {/* Key Requirements Grid */}
              <div>
                <h3 className="font-serif italic text-2xl text-primary mb-4">Key Requirements</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  {selectedGuide.notification_requirements && (
                    <div className="bg-bg-alt p-4 rounded-xl">
                      <p className="text-sm font-bold text-primary mb-1">📋 Notification</p>
                      <p className="text-text-muted text-sm m-0">{selectedGuide.notification_requirements}</p>
                    </div>
                  )}
                  {selectedGuide.testing_requirements && (
                    <div className="bg-bg-alt p-4 rounded-xl">
                      <p className="text-sm font-bold text-primary mb-1">📝 Testing</p>
                      <p className="text-text-muted text-sm m-0">{selectedGuide.testing_requirements}</p>
                    </div>
                  )}
                  {selectedGuide.record_keeping && (
                    <div className="bg-bg-alt p-4 rounded-xl">
                      <p className="text-sm font-bold text-primary mb-1">📁 Record Keeping</p>
                      <p className="text-text-muted text-sm m-0">{selectedGuide.record_keeping}</p>
                    </div>
                  )}
                  {(selectedGuide as any).teacher_quals && (
                    <div className="bg-bg-alt p-4 rounded-xl">
                      <p className="text-sm font-bold text-primary mb-1">👨‍🏫 Teacher Qualifications</p>
                      <p className="text-text-muted text-sm m-0">{(selectedGuide as any).teacher_quals}</p>
                    </div>
                  )}
                  {(selectedGuide as any).days_required && (
                    <div className="bg-bg-alt p-4 rounded-xl">
                      <p className="text-sm font-bold text-primary mb-1">📅 Days Required</p>
                      <p className="text-text-muted text-sm m-0">{(selectedGuide as any).days_required}</p>
                    </div>
                  )}
                </div>
              </div>

              {selectedGuide.resources && (
                <div>
                  <h3 className="font-serif italic text-2xl text-primary mb-3">Official Resources</h3>
                  <a 
                    href={selectedGuide.resources} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-full font-bold hover:bg-primary-dark transition-colors"
                  >
                    <span>🔗</span>
                    Visit State Website
                    <span className="text-sm opacity-75">↗</span>
                  </a>
                </div>
              )}

              {/* Helpful Organizations */}
              {stateResources[selectedGuide.state] && (
                <div>
                  <h3 className="font-serif italic text-2xl text-primary mb-4">Helpful Organizations</h3>
                  <div className="space-y-3">
                    {stateResources[selectedGuide.state].map((org, i) => (
                      <a
                        key={i}
                        href={org.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block bg-bg-alt hover:bg-border p-4 rounded-xl transition-colors group"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="font-bold text-primary group-hover:text-primary-dark m-0 mb-1">{org.name}</p>
                            <p className="text-sm text-text-muted m-0">{org.description}</p>
                          </div>
                          <span className="text-primary text-xl">↗</span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <Header showLogout={isLoggedIn} onLogout={handleLogout} />
      <main className="max-w-7xl mx-auto my-12 px-8 animate-fade-in">
        <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
          <h2 className="font-display text-5xl font-extrabold tracking-tight mb-0">Legal Guides</h2>
          {isLoggedIn && (
            <Button variant="ghost" onClick={() => router.push('/profile')}>← Back</Button>
          )}
        </div>

        {/* Disclaimer */}
        <div className="bg-yellow-50 border-l-4 border-accent p-6 rounded-[0.75rem] mb-12">
          <p className="text-sm text-yellow-800 m-0">
            <strong>⚖️ Disclaimer:</strong> This information is for educational purposes only and does not constitute legal advice. 
            Homeschool laws are subject to change. Always consult with your state&apos;s regulatory authorities or a qualified legal professional 
            before beginning your homeschool journey.
          </p>
        </div>

        {/* Stats */}
        <div className="flex gap-6 mb-12 flex-wrap">
          <div className="bg-green-50 px-6 py-4 rounded-full border border-green-200 flex items-center gap-3">
            <span className="text-2xl">🟢</span>
            <span className="font-bold text-green-800">{levelCounts.Low}</span>
            <span className="text-sm text-green-700">Low Regulation</span>
          </div>
          <div className="bg-yellow-50 px-6 py-4 rounded-full border border-yellow-200 flex items-center gap-3">
            <span className="text-2xl">🟡</span>
            <span className="font-bold text-yellow-800">{levelCounts.Moderate}</span>
            <span className="text-sm text-yellow-700">Moderate</span>
          </div>
          <div className="bg-red-50 px-6 py-4 rounded-full border border-red-200 flex items-center gap-3">
            <span className="text-2xl">🔴</span>
            <span className="font-bold text-red-800">{levelCounts.High}</span>
            <span className="text-sm text-red-700">High Regulation</span>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-12">
          <div className="grid md:grid-cols-3 gap-6 items-end">
            <Input
              placeholder="e.g. Texas, California…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              label="Search States"
            />
            <Select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              label="Regulation Level"
            >
              <option value="">All Levels</option>
              <option value="Low">🟢 Low</option>
              <option value="Moderate">🟡 Moderate</option>
              <option value="High">🔴 High</option>
            </Select>
          </div>
        </Card>

        {/* User's State Banner */}
        {userState && (
          <div className="bg-primary/10 border-2 border-primary p-4 rounded-[1.25rem] mb-8 flex items-center gap-4">
            <span className="text-2xl">📍</span>
            <div>
              <p className="font-bold text-primary m-0">Your State: {userState}</p>
              <p className="text-sm text-text-muted m-0">Based on your profile location</p>
            </div>
            <Button 
              variant="outline" 
              className="ml-auto"
              onClick={() => {
                const stateGuide = guides.find(g => g.state === userState);
                if (stateGuide) setSelectedGuide(stateGuide);
              }}
            >
              View {userState} Laws →
            </Button>
          </div>
        )}

        {/* States Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGuides.map((guide, index) => (
            <div
              key={guide.id}
              className={`bg-card rounded-[1.25rem] p-7 border-2 transition-all cursor-pointer animate-fade-in ${
                guide.state === userState 
                  ? 'border-primary ring-2 ring-primary/20' 
                  : 'border-border hover:border-secondary'
              }`}
              style={{ animationDelay: `${index * 0.05}s` }}
              onClick={() => setSelectedGuide(guide)}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  {guide.state === userState && <span className="text-lg">📍</span>}
                  <h3 className="font-display text-xl font-bold m-0">{guide.state}</h3>
                </div>
                {getLevelBadge(guide.regulation_level)}
              </div>
              <p className="text-sm text-text-muted line-clamp-3">{guide.requirements}</p>
              <button className="text-primary font-bold text-sm mt-4 hover:underline">
                View Details →
              </button>
            </div>
          ))}
        </div>

        {filteredGuides.length === 0 && (
          <Card className="text-center py-12">
            <p className="text-text-muted text-lg">No states found matching your search.</p>
          </Card>
        )}
      </main>
    </>
  );
}
