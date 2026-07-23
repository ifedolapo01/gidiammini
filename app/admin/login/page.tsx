/**
 * ADMIN layer — login page for the white-label Commerce Admin.
 * Composed from Core primitives; branding comes from adminConfig + tokens.
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { adminConfig } from '../config';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success) {
        router.push('/admin/dashboard');
        router.refresh();
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-tertiary px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="bg-surface p-8 rounded-surface border border-border shadow-elevation-3">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="flex items-center justify-center size-12 rounded-full bg-primary/10 mb-4">
              <Lock size={22} className="text-primary" aria-hidden="true" />
            </div>
            <h1 className="text-h4 font-bold text-text-primary">{adminConfig.brandName}</h1>
            <p className="text-body-sm text-text-secondary mt-1">Sign in to manage your store</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="admin-email" className="block text-body-sm font-medium mb-1 text-text-primary">
                Email
              </label>
              <Input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                autoComplete="email"
                autoFocus
                invalid={!!error}
                required
              />
            </div>

            <div>
              <label htmlFor="admin-password" className="block text-body-sm font-medium mb-1 text-text-primary">
                Password
              </label>
              <div className="relative">
                <Input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  invalid={!!error}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                >
                  {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="p-3 bg-destructive-background border border-destructive-border rounded-control">
                <p className="text-destructive text-body-sm font-medium">{error}</p>
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full font-semibold">
              {loading ? 'Logging in...' : 'Login to Dashboard'}
            </Button>
          </form>
        </div>

        <p className="flex items-center justify-center gap-1.5 mt-6 text-body-sm text-text-muted">
          <ShieldCheck size={14} aria-hidden="true" />
          Restricted access — authorized personnel only
        </p>
      </div>
    </div>
  );
}
