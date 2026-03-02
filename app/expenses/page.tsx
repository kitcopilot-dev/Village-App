'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getPocketBase } from '@/lib/pocketbase';
import { Child, Expense, ExpenseBudget } from '@/lib/types';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Toast } from '@/components/ui/Toast';
import { ClientOnly } from '@/components/ui/ClientOnly';

const CATEGORIES = [
  { value: 'curriculum', label: 'Curriculum', emoji: '📚', color: 'bg-blue-500' },
  { value: 'supplies', label: 'Supplies', emoji: '✏️', color: 'bg-yellow-500' },
  { value: 'field_trip', label: 'Field Trips', emoji: '🚌', color: 'bg-green-500' },
  { value: 'technology', label: 'Technology', emoji: '💻', color: 'bg-purple-500' },
  { value: 'coop', label: 'Co-op / Classes', emoji: '👥', color: 'bg-pink-500' },
  { value: 'testing', label: 'Testing', emoji: '📝', color: 'bg-orange-500' },
  { value: 'membership', label: 'Memberships', emoji: '🎫', color: 'bg-teal-500' },
  { value: 'other', label: 'Other', emoji: '📦', color: 'bg-gray-500' },
];

const getCategoryInfo = (cat: string) => CATEGORIES.find(c => c.value === cat) || CATEGORIES[7];

export default function ExpensesPage() {
  const router = useRouter();
  const pb = getPocketBase();

  const [kids, setKids] = useState<Child[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<ExpenseBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Modal states
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Expense | null>(null);

  // Filter states
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterChild, setFilterChild] = useState('all');
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [viewMode, setViewMode] = useState<'month' | 'year' | 'all'>('month');

  // Expense form states
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('curriculum');
  const [expChild, setExpChild] = useState('');
  const [expVendor, setExpVendor] = useState('');
  const [expDescription, setExpDescription] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [expReceiptUrl, setExpReceiptUrl] = useState('');
  const [expTaxDeductible, setExpTaxDeductible] = useState(true);

  // Budget form states
  const [budgetCategory, setBudgetCategory] = useState('curriculum');
  const [budgetMonthly, setBudgetMonthly] = useState('');
  const [budgetYearly, setBudgetYearly] = useState('');

  useEffect(() => {
    if (!pb.authStore.isValid) {
      router.push('/');
      return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) return;

      // Load children
      const kidRecords = await pb.collection('children').getFullList({
        filter: `user = "${userId}"`,
        sort: 'name',
      });
      setKids(kidRecords as unknown as Child[]);

      // Load expenses
      try {
        const expenseRecords = await pb.collection('expenses').getFullList({
          filter: `user = "${userId}"`,
          sort: '-date',
        });
        setExpenses(expenseRecords as unknown as Expense[]);
      } catch (e) {
        console.warn('Expenses collection not found, starting fresh');
        setExpenses([]);
      }

      // Load budgets
      try {
        const budgetRecords = await pb.collection('expense_budgets').getFullList({
          filter: `user = "${userId}"`,
        });
        setBudgets(budgetRecords as unknown as ExpenseBudget[]);
      } catch (e) {
        console.warn('Budgets collection not found');
        setBudgets([]);
      }
    } catch (error) {
      console.error('Load error:', error);
      setToast({ message: 'Failed to load data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    pb.authStore.clear();
    router.push('/');
  };

  // Filter expenses based on current filters
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      // Category filter
      if (filterCategory !== 'all' && exp.category !== filterCategory) return false;
      
      // Child filter
      if (filterChild !== 'all') {
        if (filterChild === 'family' && exp.child) return false;
        if (filterChild !== 'family' && exp.child !== filterChild) return false;
      }
      
      // Date filter
      if (viewMode === 'month') {
        const expMonth = exp.date.substring(0, 7);
        if (expMonth !== filterMonth) return false;
      } else if (viewMode === 'year') {
        const expYear = exp.date.substring(0, 4);
        const filterYear = filterMonth.substring(0, 4);
        if (expYear !== filterYear) return false;
      }
      
      return true;
    });
  }, [expenses, filterCategory, filterChild, filterMonth, viewMode]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const taxDeductible = filteredExpenses
      .filter(exp => exp.is_tax_deductible)
      .reduce((sum, exp) => sum + exp.amount, 0);
    
    const byCategory: Record<string, number> = {};
    filteredExpenses.forEach(exp => {
      byCategory[exp.category] = (byCategory[exp.category] || 0) + exp.amount;
    });

    const byChild: Record<string, number> = { family: 0 };
    kids.forEach(kid => { byChild[kid.id] = 0; });
    filteredExpenses.forEach(exp => {
      if (exp.child) {
        byChild[exp.child] = (byChild[exp.child] || 0) + exp.amount;
      } else {
        byChild.family += exp.amount;
      }
    });

    return { total, taxDeductible, byCategory, byChild };
  }, [filteredExpenses, kids]);

  // Calculate yearly totals for budget comparison
  const yearlyTotals = useMemo(() => {
    const year = filterMonth.substring(0, 4);
    const yearExpenses = expenses.filter(exp => exp.date.startsWith(year));
    const totals: Record<string, number> = {};
    yearExpenses.forEach(exp => {
      totals[exp.category] = (totals[exp.category] || 0) + exp.amount;
    });
    return totals;
  }, [expenses, filterMonth]);

  const resetExpenseForm = () => {
    setExpAmount('');
    setExpCategory('curriculum');
    setExpChild('');
    setExpVendor('');
    setExpDescription('');
    setExpDate(new Date().toISOString().split('T')[0]);
    setExpReceiptUrl('');
    setExpTaxDeductible(true);
    setEditingExpense(null);
  };

  const openEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setExpAmount(expense.amount.toString());
    setExpCategory(expense.category);
    setExpChild(expense.child || '');
    setExpVendor(expense.vendor || '');
    setExpDescription(expense.description || '');
    setExpDate(expense.date);
    setExpReceiptUrl(expense.receipt_url || '');
    setExpTaxDeductible(expense.is_tax_deductible);
    setIsExpenseModalOpen(true);
  };

  const handleSaveExpense = async () => {
    const amount = parseFloat(expAmount);
    if (isNaN(amount) || amount <= 0) {
      setToast({ message: 'Please enter a valid amount', type: 'error' });
      return;
    }

    try {
      const userId = pb.authStore.model?.id;
      const data = {
        user: userId,
        amount,
        category: expCategory,
        child: expChild || null,
        vendor: expVendor || null,
        description: expDescription || null,
        date: expDate,
        receipt_url: expReceiptUrl || null,
        is_tax_deductible: expTaxDeductible,
      };

      if (editingExpense) {
        await pb.collection('expenses').update(editingExpense.id, data);
        setToast({ message: 'Expense updated!', type: 'success' });
      } else {
        await pb.collection('expenses').create(data);
        setToast({ message: 'Expense added!', type: 'success' });
      }

      await loadData();
      setIsExpenseModalOpen(false);
      resetExpenseForm();
    } catch (error) {
      console.error('Save error:', error);
      setToast({ message: 'Failed to save expense', type: 'error' });
    }
  };

  const handleDeleteExpense = async () => {
    if (!deleteConfirm) return;
    
    try {
      await pb.collection('expenses').delete(deleteConfirm.id);
      setToast({ message: 'Expense deleted', type: 'success' });
      await loadData();
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Delete error:', error);
      setToast({ message: 'Failed to delete expense', type: 'error' });
    }
  };

  const handleSaveBudget = async () => {
    try {
      const userId = pb.authStore.model?.id;
      const existing = budgets.find(b => b.category === budgetCategory);
      
      const data = {
        user: userId,
        category: budgetCategory,
        monthly_limit: budgetMonthly ? parseFloat(budgetMonthly) : null,
        yearly_limit: budgetYearly ? parseFloat(budgetYearly) : null,
      };

      if (existing) {
        await pb.collection('expense_budgets').update(existing.id, data);
      } else {
        await pb.collection('expense_budgets').create(data);
      }

      setToast({ message: 'Budget saved!', type: 'success' });
      await loadData();
      setIsBudgetModalOpen(false);
      setBudgetCategory('curriculum');
      setBudgetMonthly('');
      setBudgetYearly('');
    } catch (error) {
      console.error('Budget save error:', error);
      setToast({ message: 'Failed to save budget', type: 'error' });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getChildName = (childId?: string) => {
    if (!childId) return 'Family';
    const kid = kids.find(k => k.id === childId);
    return kid?.name || 'Unknown';
  };

  if (loading) {
    return (
      <>
        <Header showLogout onLogout={handleLogout} />
        <main className="max-w-7xl mx-auto my-12 px-8">
          <p className="text-center text-text-muted">Loading expenses...</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Header showLogout onLogout={handleLogout} />
      <ClientOnly>
        <main className="max-w-7xl mx-auto my-12 px-8 pb-20 animate-fade-in">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
            <div>
              <h2 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight mb-2">
                💰 Expense Tracker
              </h2>
              <p className="text-text-muted">Track your homeschool spending and stay on budget</p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <Button onClick={() => { resetExpenseForm(); setIsExpenseModalOpen(true); }}>
                + Add Expense
              </Button>
              <Button variant="outline" onClick={() => setIsBudgetModalOpen(true)}>
                📊 Set Budget
              </Button>
              <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
                ← Dashboard
              </Button>
            </div>
          </div>

          {/* Filters */}
          <Card className="mb-8">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[140px]">
                <label className="block text-sm font-semibold mb-2">View Period</label>
                <div className="flex gap-2">
                  {(['month', 'year', 'all'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                        viewMode === mode 
                          ? 'bg-primary text-white' 
                          : 'bg-bg-alt hover:bg-border'
                      }`}
                    >
                      {mode === 'month' ? 'Month' : mode === 'year' ? 'Year' : 'All Time'}
                    </button>
                  ))}
                </div>
              </div>
              
              {viewMode !== 'all' && (
                <div className="min-w-[160px]">
                  <label className="block text-sm font-semibold mb-2">
                    {viewMode === 'month' ? 'Month' : 'Year'}
                  </label>
                  <Input
                    type={viewMode === 'month' ? 'month' : 'number'}
                    value={viewMode === 'year' ? filterMonth.substring(0, 4) : filterMonth}
                    onChange={(e) => setFilterMonth(
                      viewMode === 'year' ? `${e.target.value}-01` : e.target.value
                    )}
                    min={viewMode === 'year' ? '2020' : undefined}
                    max={viewMode === 'year' ? '2030' : undefined}
                  />
                </div>
              )}

              <div className="min-w-[140px]">
                <label className="block text-sm font-semibold mb-2">Category</label>
                <Select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                >
                  <option value="all">All Categories</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.emoji} {cat.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="min-w-[140px]">
                <label className="block text-sm font-semibold mb-2">Student</label>
                <Select
                  value={filterChild}
                  onChange={(e) => setFilterChild(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="family">👨‍👩‍👧‍👦 Family (Shared)</option>
                  {kids.map(kid => (
                    <option key={kid.id} value={kid.id}>{kid.name}</option>
                  ))}
                </Select>
              </div>
            </div>
          </Card>

          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-8">
            <div className="bg-bg border-2 border-border rounded-[1.25rem] p-4 sm:p-6 text-center transition-all hover:border-primary hover:bg-white">
              <div className="text-2xl mb-2">💵</div>
              <div className="font-display text-2xl sm:text-3xl font-extrabold text-primary">
                {formatCurrency(stats.total)}
              </div>
              <div className="text-xs sm:text-sm mt-1 text-text-muted font-semibold">
                {viewMode === 'month' ? 'This Month' : viewMode === 'year' ? 'This Year' : 'All Time'}
              </div>
            </div>
            
            <div className="bg-bg border-2 border-border rounded-[1.25rem] p-4 sm:p-6 text-center transition-all hover:border-secondary hover:bg-white">
              <div className="text-2xl mb-2">🧾</div>
              <div className="font-display text-2xl sm:text-3xl font-extrabold text-secondary">
                {formatCurrency(stats.taxDeductible)}
              </div>
              <div className="text-xs sm:text-sm mt-1 text-text-muted font-semibold">Tax Deductible</div>
            </div>
            
            <div className="bg-bg border-2 border-border rounded-[1.25rem] p-4 sm:p-6 text-center transition-all hover:border-accent hover:bg-white">
              <div className="text-2xl mb-2">📋</div>
              <div className="font-display text-2xl sm:text-3xl font-extrabold text-accent">
                {filteredExpenses.length}
              </div>
              <div className="text-xs sm:text-sm mt-1 text-text-muted font-semibold">Transactions</div>
            </div>
            
            <div className="bg-bg border-2 border-border rounded-[1.25rem] p-4 sm:p-6 text-center transition-all hover:border-primary hover:bg-white">
              <div className="text-2xl mb-2">📊</div>
              <div className="font-display text-2xl sm:text-3xl font-extrabold text-primary">
                {filteredExpenses.length > 0 
                  ? formatCurrency(stats.total / filteredExpenses.length)
                  : '$0'}
              </div>
              <div className="text-xs sm:text-sm mt-1 text-text-muted font-semibold">Avg per Item</div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            {/* Category Breakdown */}
            <Card>
              <h3 className="font-serif italic text-2xl text-primary mb-6">Spending by Category</h3>
              <div className="space-y-4">
                {CATEGORIES.map(cat => {
                  const amount = stats.byCategory[cat.value] || 0;
                  const percentage = stats.total > 0 ? (amount / stats.total) * 100 : 0;
                  const budget = budgets.find(b => b.category === cat.value);
                  const yearlyAmount = yearlyTotals[cat.value] || 0;
                  const budgetPercent = budget?.yearly_limit 
                    ? (yearlyAmount / budget.yearly_limit) * 100 
                    : null;

                  return (
                    <div key={cat.value}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold text-sm flex items-center gap-2">
                          <span>{cat.emoji}</span>
                          <span>{cat.label}</span>
                        </span>
                        <div className="text-right">
                          <span className="font-bold">{formatCurrency(amount)}</span>
                          {budget?.yearly_limit && (
                            <span className="text-xs text-text-muted ml-2">
                              ({formatCurrency(yearlyAmount)} / {formatCurrency(budget.yearly_limit)})
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="w-full bg-bg-alt rounded-full h-3 overflow-hidden">
                        <div 
                          className={`${cat.color} h-3 rounded-full transition-all`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                      {budgetPercent !== null && budgetPercent > 80 && (
                        <p className={`text-xs mt-1 ${budgetPercent > 100 ? 'text-red-600' : 'text-orange-600'}`}>
                          {budgetPercent > 100 ? '⚠️ Over budget!' : '⚡ Approaching budget limit'}
                        </p>
                      )}
                    </div>
                  );
                })}
                {Object.keys(stats.byCategory).length === 0 && (
                  <p className="text-text-muted text-center py-4">No expenses yet</p>
                )}
              </div>
            </Card>

            {/* Spending by Child */}
            <Card>
              <h3 className="font-serif italic text-2xl text-primary mb-6">Spending by Student</h3>
              <div className="space-y-4">
                {stats.byChild.family > 0 && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-sm flex items-center gap-2">
                        <span>👨‍👩‍👧‍👦</span>
                        <span>Family (Shared)</span>
                      </span>
                      <span className="font-bold">{formatCurrency(stats.byChild.family)}</span>
                    </div>
                    <div className="w-full bg-bg-alt rounded-full h-3 overflow-hidden">
                      <div 
                        className="bg-primary h-3 rounded-full transition-all"
                        style={{ width: `${stats.total > 0 ? (stats.byChild.family / stats.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                )}
                {kids.map((kid, idx) => {
                  const amount = stats.byChild[kid.id] || 0;
                  if (amount === 0) return null;
                  const colors = ['bg-secondary', 'bg-accent', 'bg-purple-500', 'bg-pink-500', 'bg-teal-500'];
                  return (
                    <div key={kid.id}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold text-sm">{kid.name}</span>
                        <span className="font-bold">{formatCurrency(amount)}</span>
                      </div>
                      <div className="w-full bg-bg-alt rounded-full h-3 overflow-hidden">
                        <div 
                          className={`${colors[idx % colors.length]} h-3 rounded-full transition-all`}
                          style={{ width: `${stats.total > 0 ? (amount / stats.total) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {Object.values(stats.byChild).every(v => v === 0) && (
                  <p className="text-text-muted text-center py-4">No expenses yet</p>
                )}
              </div>
            </Card>
          </div>

          {/* Recent Expenses */}
          <Card>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-serif italic text-2xl text-primary">Recent Expenses</h3>
              <span className="text-sm text-text-muted">
                {filteredExpenses.length} expense{filteredExpenses.length !== 1 ? 's' : ''}
              </span>
            </div>
            
            {filteredExpenses.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">💸</div>
                <p className="text-text-muted mb-4">No expenses found for this period</p>
                <Button onClick={() => { resetExpenseForm(); setIsExpenseModalOpen(true); }}>
                  Add Your First Expense
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredExpenses.slice(0, 20).map(expense => {
                  const cat = getCategoryInfo(expense.category);
                  return (
                    <div 
                      key={expense.id} 
                      className="flex items-center justify-between p-4 bg-bg-alt rounded-xl hover:bg-border transition-colors cursor-pointer group"
                      onClick={() => openEditExpense(expense)}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl ${cat.color} flex items-center justify-center text-white text-xl`}>
                          {cat.emoji}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold m-0">
                              {expense.vendor || expense.description || cat.label}
                            </p>
                            {expense.is_tax_deductible && (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                Tax Ded.
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-text-muted m-0">
                            {getChildName(expense.child)} • {new Date(expense.date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-display font-bold text-xl text-primary m-0">
                            {formatCurrency(expense.amount)}
                          </p>
                          <p className="text-xs text-text-muted m-0">{cat.label}</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(expense); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 p-2"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })}
                {filteredExpenses.length > 20 && (
                  <p className="text-center text-text-muted text-sm py-2">
                    Showing 20 of {filteredExpenses.length} expenses
                  </p>
                )}
              </div>
            )}
          </Card>

          {/* Quick Tips */}
          <Card className="mt-8 bg-gradient-to-br from-primary/5 to-secondary/5">
            <h3 className="font-serif italic text-xl text-primary mb-4">💡 Expense Tracking Tips</h3>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="flex gap-2">
                <span>📋</span>
                <p className="m-0">Keep receipts organized for tax season - note the receipt URL or file name</p>
              </div>
              <div className="flex gap-2">
                <span>👥</span>
                <p className="m-0">Mark shared curriculum as "Family" to track per-child spending accurately</p>
              </div>
              <div className="flex gap-2">
                <span>🧾</span>
                <p className="m-0">Tag tax-deductible expenses to easily total them at year end</p>
              </div>
              <div className="flex gap-2">
                <span>📊</span>
                <p className="m-0">Set yearly budgets per category to track spending vs. goals</p>
              </div>
            </div>
          </Card>
        </main>
      </ClientOnly>

      {/* Add/Edit Expense Modal */}
      <Modal
        isOpen={isExpenseModalOpen}
        onClose={() => { setIsExpenseModalOpen(false); resetExpenseForm(); }}
        title={editingExpense ? 'Edit Expense' : 'Add Expense'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Amount ($)"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={expAmount}
              onChange={(e) => setExpAmount(e.target.value)}
              required
            />
            <Input
              label="Date"
              type="date"
              value={expDate}
              onChange={(e) => setExpDate(e.target.value)}
              required
            />
          </div>

          <Select
            label="Category"
            value={expCategory}
            onChange={(e) => setExpCategory(e.target.value)}
          >
            {CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>
                {cat.emoji} {cat.label}
              </option>
            ))}
          </Select>

          <Select
            label="For Student (optional)"
            value={expChild}
            onChange={(e) => setExpChild(e.target.value)}
          >
            <option value="">👨‍👩‍👧‍👦 Family (Shared)</option>
            {kids.map(kid => (
              <option key={kid.id} value={kid.id}>{kid.name}</option>
            ))}
          </Select>

          <Input
            label="Vendor / Store"
            placeholder="Amazon, Homeschool Buyer's Co-op..."
            value={expVendor}
            onChange={(e) => setExpVendor(e.target.value)}
          />

          <Textarea
            label="Description"
            placeholder="What did you buy?"
            value={expDescription}
            onChange={(e) => setExpDescription(e.target.value)}
            rows={2}
          />

          <Input
            label="Receipt URL / Reference (optional)"
            placeholder="Link to receipt or file name"
            value={expReceiptUrl}
            onChange={(e) => setExpReceiptUrl(e.target.value)}
          />

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={expTaxDeductible}
              onChange={(e) => setExpTaxDeductible(e.target.checked)}
              className="w-5 h-5 rounded border-2 border-border"
            />
            <span className="font-semibold">🧾 Tax Deductible</span>
          </label>

          <div className="flex gap-3 pt-4">
            <Button onClick={handleSaveExpense} className="flex-1">
              {editingExpense ? 'Update Expense' : 'Add Expense'}
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => { setIsExpenseModalOpen(false); resetExpenseForm(); }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Budget Modal */}
      <Modal
        isOpen={isBudgetModalOpen}
        onClose={() => setIsBudgetModalOpen(false)}
        title="Set Category Budget"
      >
        <div className="space-y-4">
          <Select
            label="Category"
            value={budgetCategory}
            onChange={(e) => {
              setBudgetCategory(e.target.value);
              const existing = budgets.find(b => b.category === e.target.value);
              setBudgetMonthly(existing?.monthly_limit?.toString() || '');
              setBudgetYearly(existing?.yearly_limit?.toString() || '');
            }}
          >
            {CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>
                {cat.emoji} {cat.label}
              </option>
            ))}
          </Select>

          <Input
            label="Monthly Budget ($)"
            type="number"
            step="0.01"
            min="0"
            placeholder="Optional"
            value={budgetMonthly}
            onChange={(e) => setBudgetMonthly(e.target.value)}
          />

          <Input
            label="Yearly Budget ($)"
            type="number"
            step="0.01"
            min="0"
            placeholder="Optional"
            value={budgetYearly}
            onChange={(e) => setBudgetYearly(e.target.value)}
          />

          <div className="flex gap-3 pt-4">
            <Button onClick={handleSaveBudget} className="flex-1">
              Save Budget
            </Button>
            <Button variant="ghost" onClick={() => setIsBudgetModalOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Expense?"
      >
        <p className="text-text-muted mb-6">
          Are you sure you want to delete this expense? This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleDeleteExpense} className="flex-1 !border-red-500 !text-red-500 hover:!bg-red-50">
            Yes, Delete
          </Button>
          <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>
            Cancel
          </Button>
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
