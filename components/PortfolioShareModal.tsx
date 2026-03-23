'use client';

import { useState, useEffect } from 'react';
import { getPocketBase } from '@/lib/pocketbase';
import { PortfolioShare, Child } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Toast } from '@/components/ui/Toast';

// Generate a secure random token
const generateToken = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let token = '';
  for (let i = 0; i < 24; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};

interface PortfolioShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  kids: Child[];
}

export function PortfolioShareModal({ isOpen, onClose, kids }: PortfolioShareModalProps) {
  const pb = getPocketBase();
  
  const [shares, setShares] = useState<PortfolioShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // New share form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [label, setLabel] = useState('');
  const [childId, setChildId] = useState('all');
  const [expiresIn, setExpiresIn] = useState('30'); // days
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadShares();
    }
  }, [isOpen]);

  const loadShares = async () => {
    setLoading(true);
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const records = await pb.collection('portfolio_shares').getFullList({
        filter: `user = "${userId}"`,
        sort: '-created'
      });

      setShares(records as unknown as PortfolioShare[]);
    } catch (e) {
      console.error('Failed to load shares:', e);
    } finally {
      setLoading(false);
    }
  };

  const createShare = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      const token = generateToken();
      const expiresAt = expiresIn === 'never' 
        ? null 
        : new Date(Date.now() + parseInt(expiresIn) * 24 * 60 * 60 * 1000).toISOString();

      await pb.collection('portfolio_shares').create({
        user: userId,
        child: childId === 'all' ? null : childId,
        token,
        label: label || null,
        expires_at: expiresAt,
        include_grades: false,
        include_attendance: false,
        view_count: 0,
        active: true
      });

      setToast({ message: 'Share link created!', type: 'success' });
      setShowCreateForm(false);
      setLabel('');
      setChildId('all');
      setExpiresIn('30');
      loadShares();
    } catch (e: any) {
      console.error('Create share error:', e);
      setToast({ message: 'Failed to create share link', type: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const toggleShare = async (share: PortfolioShare) => {
    try {
      await pb.collection('portfolio_shares').update(share.id, {
        active: !share.active
      });
      loadShares();
      setToast({ 
        message: share.active ? 'Link deactivated' : 'Link reactivated', 
        type: 'success' 
      });
    } catch (e) {
      setToast({ message: 'Failed to update link', type: 'error' });
    }
  };

  const deleteShare = async (share: PortfolioShare) => {
    if (!confirm('Delete this share link? Anyone with the link will no longer be able to access the portfolio.')) {
      return;
    }
    
    try {
      await pb.collection('portfolio_shares').delete(share.id);
      loadShares();
      setToast({ message: 'Link deleted', type: 'success' });
    } catch (e) {
      setToast({ message: 'Failed to delete link', type: 'error' });
    }
  };

  const copyLink = async (share: PortfolioShare) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${baseUrl}/share/${share.token}`;
    
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(share.id);
      setToast({ message: 'Link copied to clipboard!', type: 'success' });
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = link;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopiedId(share.id);
      setToast({ message: 'Link copied!', type: 'success' });
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const getChildName = (childId: string | undefined) => {
    if (!childId) return 'All Students';
    const kid = kids.find(k => k.id === childId);
    return kid?.name || 'Unknown';
  };

  const isExpired = (share: PortfolioShare) => {
    if (!share.expires_at) return false;
    return new Date(share.expires_at) < new Date();
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Share Portfolio"
        subtitle="Create links to share your portfolio with evaluators, family, or co-ops."
      >
        <div className="space-y-6">
          {/* Create New Share Button */}
          {!showCreateForm && (
            <Button 
              onClick={() => setShowCreateForm(true)} 
              className="w-full"
            >
              + Create Share Link
            </Button>
          )}

          {/* Create Form */}
          {showCreateForm && (
            <form onSubmit={createShare} className="bg-bg-alt rounded-2xl p-6 space-y-4">
              <h4 className="font-bold text-lg m-0">New Share Link</h4>
              
              <Input
                label="Label (optional)"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. For Grandma, Year-End Evaluator"
              />

              <Select
                label="Share"
                value={childId}
                onChange={(e) => setChildId(e.target.value)}
              >
                <option value="all">All Students' Work</option>
                {kids.map(kid => (
                  <option key={kid.id} value={kid.id}>{kid.name}'s Work Only</option>
                ))}
              </Select>

              <Select
                label="Link Expires"
                value={expiresIn}
                onChange={(e) => setExpiresIn(e.target.value)}
              >
                <option value="7">In 7 days</option>
                <option value="30">In 30 days</option>
                <option value="90">In 90 days</option>
                <option value="365">In 1 year</option>
                <option value="never">Never</option>
              </Select>

              <div className="flex gap-3 pt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Link'}
                </Button>
              </div>
            </form>
          )}

          {/* Existing Shares */}
          <div className="space-y-3">
            <h4 className="font-bold text-sm uppercase tracking-widest text-text-muted m-0">
              Your Share Links
            </h4>

            {loading ? (
              <div className="text-center py-8 text-text-muted">Loading...</div>
            ) : shares.length === 0 ? (
              <div className="text-center py-8 text-text-muted italic">
                No share links yet. Create one to share your portfolio!
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {shares.map(share => {
                  const expired = isExpired(share);
                  const inactive = !share.active || expired;

                  return (
                    <div 
                      key={share.id} 
                      className={`bg-bg-alt rounded-xl p-4 border-2 transition-colors ${
                        inactive 
                          ? 'border-border opacity-60' 
                          : 'border-primary/20 hover:border-primary/40'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold truncate">
                              {share.label || 'Untitled Link'}
                            </span>
                            {expired && (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-red-100 text-red-700">
                                Expired
                              </span>
                            )}
                            {!share.active && !expired && (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-gray-200 text-gray-600">
                                Paused
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-text-muted m-0">
                            {getChildName(share.child)} • 
                            {share.view_count || 0} view{share.view_count !== 1 ? 's' : ''} • 
                            {share.expires_at 
                              ? `Expires ${new Date(share.expires_at).toLocaleDateString()}`
                              : 'Never expires'
                            }
                          </p>
                        </div>

                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => copyLink(share)}
                            disabled={inactive}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                              copiedId === share.id
                                ? 'bg-green-500 text-white'
                                : inactive
                                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                : 'bg-primary text-white hover:bg-primary-dark'
                            }`}
                          >
                            {copiedId === share.id ? '✓ Copied' : '📋 Copy'}
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                        <button
                          onClick={() => toggleShare(share)}
                          className="text-xs font-semibold text-text-muted hover:text-primary transition-colors"
                        >
                          {share.active ? '⏸️ Pause' : '▶️ Reactivate'}
                        </button>
                        <span className="text-border">|</span>
                        <button
                          onClick={() => deleteShare(share)}
                          className="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
    </>
  );
}
