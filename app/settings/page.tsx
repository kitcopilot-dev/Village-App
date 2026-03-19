'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Profile, Child, Course, Attendance, Assignment, PortfolioItem, SchoolYear, SchoolBreak, Event } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { LoadingScreen } from '@/components/ui/Spinner';
import { ClientOnly } from '@/components/ui/ClientOnly';

type Tab = 'account' | 'notifications' | 'data' | 'appearance' | 'about';

interface NotificationSettings {
  emailDigest: boolean;
  weeklyReport: boolean;
  eventReminders: boolean;
  assignmentDue: boolean;
}

interface AppearanceSettings {
  theme: 'light' | 'dark' | 'system';
  compactMode: boolean;
}

interface ExportData {
  exportedAt: string;
  version: string;
  profile: Profile | null;
  children: Child[];
  courses: Course[];
  attendance: Attendance[];
  assignments: Assignment[];
  portfolio: PortfolioItem[];
  schoolYears: SchoolYear[];
  schoolBreaks: SchoolBreak[];
  events: Event[];
}

export default function SettingsPage() {
  const router = useRouter();
  const pb = getPocketBase();
  
  const [activeTab, setActiveTab] = useState<Tab>('account');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Account
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  // Notifications
  const [notifications, setNotifications] = useState<NotificationSettings>({
    emailDigest: true,
    weeklyReport: true,
    eventReminders: true,
    assignmentDue: true,
  });
  
  // Appearance
  const [appearance, setAppearance] = useState<AppearanceSettings>({
    theme: 'light',
    compactMode: false,
  });
  
  // Data
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  
  // Profile info
  const [profile, setProfile] = useState<Profile | null>(null);
  const [childCount, setChildCount] = useState(0);
  const [courseCount, setCourseCount] = useState(0);

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const userId = pb.authStore.model?.id;
      const userEmail = pb.authStore.model?.email;
      if (!userId) return;

      setEmail(userEmail || '');

      // Load profile
      try {
        const profiles = await pb.collection('profiles').getFullList({
          filter: `user = "${userId}"`,
          limit: 1
        });
        if (profiles.length > 0) {
          setProfile(profiles[0] as unknown as Profile);
        }
      } catch (e) {
        console.warn('Could not load profile');
      }

      // Load children count
      try {
        const children = await pb.collection('children').getFullList({
          filter: `user = "${userId}"`
        });
        setChildCount(children.length);
      } catch (e) {
        console.warn('Could not load children');
      }

      // Load course count
      try {
        const courses = await pb.collection('courses').getFullList({
          filter: `child.user = "${userId}"`
        });
        setCourseCount(courses.length);
      } catch (e) {
        console.warn('Could not load courses');
      }

      // Load saved settings from localStorage
      const savedNotifications = localStorage.getItem('village_notifications');
      if (savedNotifications) {
        setNotifications(JSON.parse(savedNotifications));
      }

      const savedAppearance = localStorage.getItem('village_appearance');
      if (savedAppearance) {
        setAppearance(JSON.parse(savedAppearance));
      }
    } catch (error) {
      console.error('Settings load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    pb.authStore.clear();
    router.push('/');
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  // Account actions
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showMessage('error', 'Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      showMessage('error', 'Password must be at least 8 characters');
      return;
    }

    setSaving(true);
    try {
      await pb.collection('users').update(pb.authStore.model!.id, {
        oldPassword: currentPassword,
        password: newPassword,
        passwordConfirm: confirmPassword,
      });
      showMessage('success', 'Password updated successfully');
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      showMessage('error', error.message || 'Failed to update password');
    } finally {
      setSaving(false);
    }
  };

  // Notification actions
  const saveNotifications = (updates: Partial<NotificationSettings>) => {
    const newSettings = { ...notifications, ...updates };
    setNotifications(newSettings);
    localStorage.setItem('village_notifications', JSON.stringify(newSettings));
    showMessage('success', 'Notification preferences saved');
  };

  // Appearance actions
  const saveAppearance = (updates: Partial<AppearanceSettings>) => {
    const newSettings = { ...appearance, ...updates };
    setAppearance(newSettings);
    localStorage.setItem('village_appearance', JSON.stringify(newSettings));
    
    // Apply theme
    if (updates.theme) {
      document.documentElement.classList.remove('light', 'dark');
      if (updates.theme !== 'system') {
        document.documentElement.classList.add(updates.theme);
      }
    }
    
    showMessage('success', 'Appearance settings saved');
  };

  // Data export
  const handleExportData = async () => {
    setExporting(true);
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) throw new Error('Not authenticated');

      const exportData: ExportData = {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        profile: null,
        children: [],
        courses: [],
        attendance: [],
        assignments: [],
        portfolio: [],
        schoolYears: [],
        schoolBreaks: [],
        events: [],
      };

      // Gather all data
      try {
        const profiles = await pb.collection('profiles').getFullList({
          filter: `user = "${userId}"`
        });
        exportData.profile = profiles[0] as unknown as Profile || null;
      } catch (e) { /* skip */ }

      try {
        exportData.children = await pb.collection('children').getFullList({
          filter: `user = "${userId}"`
        }) as unknown as Child[];
      } catch (e) { /* skip */ }

      try {
        exportData.courses = await pb.collection('courses').getFullList({
          filter: `child.user = "${userId}"`
        }) as unknown as Course[];
      } catch (e) { /* skip */ }

      try {
        exportData.attendance = await pb.collection('attendance').getFullList({
          filter: `user = "${userId}"`
        }) as unknown as Attendance[];
      } catch (e) { /* skip */ }

      try {
        exportData.assignments = await pb.collection('assignments').getFullList({
          filter: `user = "${userId}"`
        }) as unknown as Assignment[];
      } catch (e) { /* skip */ }

      try {
        exportData.portfolio = await pb.collection('portfolio_items').getFullList({
          filter: `child.user = "${userId}"`
        }) as unknown as PortfolioItem[];
      } catch (e) { /* skip */ }

      try {
        exportData.schoolYears = await pb.collection('school_years').getFullList({
          filter: `user = "${userId}"`
        }) as unknown as SchoolYear[];
      } catch (e) { /* skip */ }

      try {
        exportData.schoolBreaks = await pb.collection('school_breaks').getFullList({
          filter: `school_year.user = "${userId}"`
        }) as unknown as SchoolBreak[];
      } catch (e) { /* skip */ }

      try {
        exportData.events = await pb.collection('events').getFullList({
          filter: `creator = "${userId}"`
        }) as unknown as Event[];
      } catch (e) { /* skip */ }

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `village-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showMessage('success', 'Data exported successfully');
    } catch (error: any) {
      showMessage('error', error.message || 'Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  // Data import
  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data: ExportData = JSON.parse(text);
      
      if (!data.version || !data.exportedAt) {
        throw new Error('Invalid backup file format');
      }

      // For now, just validate - actual import would need careful handling
      showMessage('success', `Backup validated: ${data.children?.length || 0} children, ${data.courses?.length || 0} courses. Contact support to restore.`);
    } catch (error: any) {
      showMessage('error', 'Invalid backup file');
    }
    
    // Reset file input
    e.target.value = '';
  };

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'account', label: 'Account', icon: '👤' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'data', label: 'Data & Privacy', icon: '📦' },
    { id: 'appearance', label: 'Appearance', icon: '🎨' },
    { id: 'about', label: 'About', icon: 'ℹ️' },
  ];

  if (loading) {
    return (
      <>
        <Header showLogout onLogout={handleLogout} />
        <LoadingScreen />
      </>
    );
  }

  return (
    <>
      <Header showLogout onLogout={handleLogout} />
      <ClientOnly>
        <main className="max-w-5xl mx-auto my-12 px-4 sm:px-8 pb-20 animate-fade-in">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
            <div>
              <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight mb-2">Settings</h1>
              <p className="text-text-muted">Manage your account, preferences, and data</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
              ← Back to Dashboard
            </Button>
          </div>

          {/* Message Banner */}
          {message && (
            <div className={`mb-6 p-4 rounded-xl font-semibold animate-fade-in ${
              message.type === 'success' 
                ? 'bg-green-100 text-green-800 border-2 border-green-200' 
                : 'bg-red-100 text-red-800 border-2 border-red-200'
            }`}>
              {message.type === 'success' ? '✅' : '❌'} {message.text}
            </div>
          )}

          <div className="grid md:grid-cols-[240px_1fr] gap-8">
            {/* Sidebar */}
            <div className="space-y-2">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl font-semibold transition-all flex items-center gap-3 ${
                    activeTab === tab.id
                      ? 'bg-primary text-white'
                      : 'hover:bg-bg-alt text-text'
                  }`}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="space-y-6">
              {/* Account Tab */}
              {activeTab === 'account' && (
                <div className="space-y-6 animate-fade-in">
                  <Card>
                    <h2 className="font-display text-2xl font-bold mb-6">Account Information</h2>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-bold text-text-muted uppercase tracking-widest block mb-2">Email</label>
                        <p className="text-lg font-semibold">{email}</p>
                      </div>
                      
                      <div>
                        <label className="text-sm font-bold text-text-muted uppercase tracking-widest block mb-2">Family Name</label>
                        <p className="text-lg font-semibold">{profile?.family_name || 'Not set'}</p>
                      </div>

                      <div>
                        <label className="text-sm font-bold text-text-muted uppercase tracking-widest block mb-2">Family Code</label>
                        <p className="text-lg font-semibold font-mono">{profile?.family_code || 'Not set'}</p>
                        <p className="text-xs text-text-muted mt-1">Students use this code to log in</p>
                      </div>
                      
                      <div className="pt-4 border-t border-border flex flex-wrap gap-3">
                        <Button variant="outline" onClick={() => router.push('/profile')}>
                          Edit Profile
                        </Button>
                        <Button variant="outline" onClick={() => setShowPasswordModal(true)}>
                          Change Password
                        </Button>
                      </div>
                    </div>
                  </Card>

                  <Card>
                    <h2 className="font-display text-2xl font-bold mb-4">Quick Stats</h2>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="p-4 bg-bg-alt rounded-xl">
                        <div className="text-3xl font-bold text-primary">{childCount}</div>
                        <div className="text-sm text-text-muted">Children</div>
                      </div>
                      <div className="p-4 bg-bg-alt rounded-xl">
                        <div className="text-3xl font-bold text-secondary">{courseCount}</div>
                        <div className="text-sm text-text-muted">Courses</div>
                      </div>
                      <div className="p-4 bg-bg-alt rounded-xl">
                        <div className="text-3xl font-bold text-accent">∞</div>
                        <div className="text-sm text-text-muted">Memories</div>
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {/* Notifications Tab */}
              {activeTab === 'notifications' && (
                <div className="space-y-6 animate-fade-in">
                  <Card>
                    <h2 className="font-display text-2xl font-bold mb-6">Email Notifications</h2>
                    
                    <div className="space-y-4">
                      {[
                        { key: 'emailDigest', label: 'Daily Digest', desc: 'Summary of daily activities and progress' },
                        { key: 'weeklyReport', label: 'Weekly Report', desc: 'End-of-week progress summary' },
                        { key: 'eventReminders', label: 'Event Reminders', desc: 'Reminders for upcoming community events' },
                        { key: 'assignmentDue', label: 'Assignment Due Dates', desc: 'Notifications when assignments are due soon' },
                      ].map(item => (
                        <div key={item.key} className="flex items-center justify-between p-4 bg-bg-alt rounded-xl">
                          <div>
                            <div className="font-semibold">{item.label}</div>
                            <div className="text-sm text-text-muted">{item.desc}</div>
                          </div>
                          <button
                            onClick={() => saveNotifications({ [item.key]: !notifications[item.key as keyof NotificationSettings] })}
                            className={`w-14 h-8 rounded-full transition-all relative ${
                              notifications[item.key as keyof NotificationSettings]
                                ? 'bg-primary'
                                : 'bg-border'
                            }`}
                          >
                            <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${
                              notifications[item.key as keyof NotificationSettings]
                                ? 'left-7'
                                : 'left-1'
                            }`} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card className="border-2 border-dashed border-border bg-bg-alt/50">
                    <div className="text-center py-4">
                      <span className="text-4xl mb-4 block">📧</span>
                      <p className="font-semibold">Email integration coming soon!</p>
                      <p className="text-sm text-text-muted">
                        Settings are saved locally. Full email notifications will be available in a future update.
                      </p>
                    </div>
                  </Card>
                </div>
              )}

              {/* Data Tab */}
              {activeTab === 'data' && (
                <div className="space-y-6 animate-fade-in">
                  <Card>
                    <h2 className="font-display text-2xl font-bold mb-6">Export Your Data</h2>
                    <p className="text-text-muted mb-6">
                      Download all your family's data including children, courses, attendance, assignments, 
                      portfolio items, and more. The export is a JSON file you can keep as a backup.
                    </p>
                    
                    <Button onClick={handleExportData} disabled={exporting}>
                      {exporting ? '⏳ Exporting...' : '📥 Download Backup'}
                    </Button>
                  </Card>

                  <Card>
                    <h2 className="font-display text-2xl font-bold mb-6">Import Data</h2>
                    <p className="text-text-muted mb-6">
                      Restore from a previous backup. Select a Village backup JSON file to validate.
                    </p>
                    
                    <label className="inline-block">
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImportData}
                        className="hidden"
                      />
                      <span className="cursor-pointer inline-flex items-center gap-2 px-6 py-3 bg-bg-alt border-2 border-border rounded-xl font-semibold hover:border-primary transition-colors">
                        📤 Select Backup File
                      </span>
                    </label>
                  </Card>

                  <Card className="border-2 border-red-200 bg-red-50">
                    <h2 className="font-display text-2xl font-bold mb-4 text-red-700">Danger Zone</h2>
                    <p className="text-text-muted mb-6">
                      Permanently delete your account and all associated data. This action cannot be undone.
                    </p>
                    
                    <Button 
                      variant="outline" 
                      onClick={() => setShowDeleteModal(true)}
                      className="border-red-300 text-red-700 hover:bg-red-100"
                    >
                      🗑️ Delete Account
                    </Button>
                  </Card>
                </div>
              )}

              {/* Appearance Tab */}
              {activeTab === 'appearance' && (
                <div className="space-y-6 animate-fade-in">
                  <Card>
                    <h2 className="font-display text-2xl font-bold mb-6">Theme</h2>
                    
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { value: 'light', label: 'Light', icon: '☀️' },
                        { value: 'dark', label: 'Dark', icon: '🌙' },
                        { value: 'system', label: 'System', icon: '💻' },
                      ].map(theme => (
                        <button
                          key={theme.value}
                          onClick={() => saveAppearance({ theme: theme.value as AppearanceSettings['theme'] })}
                          className={`p-6 rounded-xl border-2 transition-all text-center ${
                            appearance.theme === theme.value
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <div className="text-3xl mb-2">{theme.icon}</div>
                          <div className="font-semibold">{theme.label}</div>
                        </button>
                      ))}
                    </div>
                  </Card>

                  <Card>
                    <h2 className="font-display text-2xl font-bold mb-6">Display</h2>
                    
                    <div className="flex items-center justify-between p-4 bg-bg-alt rounded-xl">
                      <div>
                        <div className="font-semibold">Compact Mode</div>
                        <div className="text-sm text-text-muted">Reduce spacing for more content on screen</div>
                      </div>
                      <button
                        onClick={() => saveAppearance({ compactMode: !appearance.compactMode })}
                        className={`w-14 h-8 rounded-full transition-all relative ${
                          appearance.compactMode
                            ? 'bg-primary'
                            : 'bg-border'
                        }`}
                      >
                        <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${
                          appearance.compactMode
                            ? 'left-7'
                            : 'left-1'
                        }`} />
                      </button>
                    </div>
                  </Card>

                  <Card className="border-2 border-dashed border-border bg-bg-alt/50">
                    <div className="text-center py-4">
                      <span className="text-4xl mb-4 block">🎨</span>
                      <p className="font-semibold">Dark mode coming soon!</p>
                      <p className="text-sm text-text-muted">
                        Settings are saved. Full theme support will be available in a future update.
                      </p>
                    </div>
                  </Card>
                </div>
              )}

              {/* About Tab */}
              {activeTab === 'about' && (
                <div className="space-y-6 animate-fade-in">
                  <Card className="text-center">
                    <div className="text-6xl mb-4">🏡</div>
                    <h2 className="font-display text-3xl font-bold mb-2">Village Homeschool</h2>
                    <p className="text-text-muted mb-6">Version 2.0.0</p>
                    
                    <div className="inline-block text-left bg-bg-alt rounded-xl p-6 mb-6">
                      <p className="font-serif italic text-lg text-primary mb-2">
                        "It takes a village to raise a child."
                      </p>
                      <p className="text-sm text-text-muted">
                        — African Proverb
                      </p>
                    </div>

                    <p className="text-text-muted max-w-md mx-auto">
                      Village Homeschool helps families organize their homeschool journey, 
                      track progress, and connect with their local homeschool community.
                    </p>
                  </Card>

                  <Card>
                    <h2 className="font-display text-2xl font-bold mb-4">Quick Links</h2>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Manage Children', path: '/manage-kids', icon: '👶' },
                        { label: 'Calendar', path: '/calendar', icon: '📅' },
                        { label: 'Legal Guides', path: '/legal-guides', icon: '⚖️' },
                        { label: 'Community Events', path: '/events', icon: '🎉' },
                      ].map(link => (
                        <button
                          key={link.path}
                          onClick={() => router.push(link.path)}
                          className="flex items-center gap-3 p-4 bg-bg-alt rounded-xl hover:bg-border transition-colors text-left"
                        >
                          <span className="text-2xl">{link.icon}</span>
                          <span className="font-semibold">{link.label}</span>
                        </button>
                      ))}
                    </div>
                  </Card>

                  <Card>
                    <h2 className="font-display text-2xl font-bold mb-4">Need Help?</h2>
                    <p className="text-text-muted mb-4">
                      Have questions or feedback? We'd love to hear from you.
                    </p>
                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => window.open('mailto:support@villagehomeschool.app')}>
                        📧 Contact Support
                      </Button>
                      <Button variant="ghost" onClick={() => window.open('https://docs.villagehomeschool.app')}>
                        📖 Documentation
                      </Button>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </main>
      </ClientOnly>

      {/* Password Change Modal */}
      <Modal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} title="Change Password">
        <form onSubmit={handleChangePassword} className="space-y-4">
          <Input
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
          />
          <Input
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <div className="flex gap-3 pt-4">
            <Button variant="outline" type="button" onClick={() => setShowPasswordModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Update Password'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Account Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Account">
        <div className="space-y-4">
          <p className="text-text-muted">
            This will permanently delete your account and all associated data including:
          </p>
          <ul className="list-disc list-inside text-sm text-text-muted space-y-1">
            <li>Your profile and settings</li>
            <li>All children and their courses</li>
            <li>Attendance records</li>
            <li>Assignments and grades</li>
            <li>Portfolio items</li>
            <li>Events you created</li>
          </ul>
          <p className="font-bold text-red-700">This action cannot be undone.</p>
          
          <Input
            label={`Type "DELETE" to confirm`}
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="DELETE"
          />
          
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={() => { setShowDeleteModal(false); setDeleteConfirm(''); }}>
              Cancel
            </Button>
            <Button 
              disabled={deleteConfirm !== 'DELETE'}
              onClick={() => showMessage('error', 'Account deletion requires admin approval. Contact support.')}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete My Account
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
