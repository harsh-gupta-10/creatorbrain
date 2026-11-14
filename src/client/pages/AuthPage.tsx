import React, { useEffect, useState } from 'react';
import { Check, Eye, EyeOff } from 'lucide-react';
import { api } from '../lib/api';
import { navigate, linkProps } from '../lib/router';
import { Logo, Spinner, ErrorNote, ICON, SkipLink } from '../components/ui';
import type { Creator } from '../../shared/types';

interface Props {
  mode: 'login' | 'signup';
  session: { loading: boolean; creator: Creator | null; isSample: boolean };
  onAuthed: () => Promise<unknown>;
}

const slugify = (v: string) =>
  v
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '')
    .slice(0, 30);

export const AuthPage: React.FC<Props> = ({ mode, session, onAuthed }) => {
  const isSignup = mode === 'signup';
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [handleTouched, setHandleTouched] = useState(false);
  const [handleState, setHandleState] = useState<'idle' | 'checking' | 'ok' | 'taken'>('idle');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = `${isSignup ? 'Create your account' : 'Sign in'} · CreatorBrain`;
    setError('');
  }, [isSignup]);

  // Signed-in real accounts skip this page
  useEffect(() => {
    if (!session.loading && session.creator && !session.isSample) {
      navigate(session.creator.onboarding_status === 'ready' ? '/app' : '/onboarding', { replace: true });
    }
  }, [session]);

  useEffect(() => {
    if (!handleTouched) setHandle(slugify(name.replace(/\s+/g, '')));
  }, [name, handleTouched]);

  useEffect(() => {
    if (!isSignup || handle.length < 3) {
      setHandleState('idle');
      return;
    }
    setHandleState('checking');
    const t = setTimeout(async () => {
      try {
        const { available } = await api.auth.handleAvailable(handle);
        setHandleState(available ? 'ok' : 'taken');
      } catch {
        setHandleState('idle');
      }
    }, 350);
    return () => clearTimeout(t);
  }, [handle, isSignup]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (isSignup && handleState === 'taken') {
      setError('That handle is taken');
      return;
    }
    setSubmitting(true);
    try {
      if (isSignup) {
        await api.auth.signup({ name, handle, email, password });
        await onAuthed();
        navigate('/onboarding', { replace: true });
      } else {
        const res = await api.auth.login({ email, password });
        await onAuthed();
        navigate(res.creator.onboarding_status === 'ready' || !res.creator.onboarding_status ? '/app' : '/onboarding', {
          replace: true,
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-page flex flex-col">
      <SkipLink />
      <header className="h-16 px-6 md:px-8 flex items-center">
        <a {...linkProps('/')} aria-label="CreatorBrain home">
          <Logo />
        </a>
      </header>

      <main id="main" tabIndex={-1} className="outline-none flex-1 flex items-start md:items-center justify-center px-4 pb-16 pt-8 md:pt-0">
        <div className="w-full max-w-[400px]">
          <h1 className="text-[28px] leading-[36px] font-medium tracking-[-0.01em]">
            {isSignup ? 'Create your account' : 'Sign in'}
          </h1>
          <p className="mt-2 text-fg-2">
            {isSignup
              ? 'Next we will ask about your channel and how you earn, then study your recent uploads'
              : 'Welcome back. Your Brain kept studying while you were away'}
          </p>

          <form onSubmit={submit} className="mt-8 flex flex-col gap-4" noValidate>
            {isSignup && (
              <>
                <div>
                  <label htmlFor="name" className="field-label">
                    Your name
                  </label>
                  <input
                    id="name"
                    className="input"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="handle" className="field-label">
                    Handle
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden="true">@</span>
                    <input
                      id="handle"
                      className="input pl-7 pr-9"
                      autoComplete="username"
                      value={handle}
                      onChange={(e) => {
                        setHandleTouched(true);
                        setHandle(slugify(e.target.value));
                      }}
                      aria-describedby="handle-hint"
                      aria-invalid={handleState === 'taken' || undefined}
                      required
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden="true">
                      {handleState === 'checking' && <Spinner size={14} />}
                      {handleState === 'ok' && <Check {...ICON} className="text-positive" />}
                    </span>
                  </div>
                  <p id="handle-hint" aria-live="polite" className={`field-hint ${handleState === 'taken' ? 'text-negative' : ''}`}>
                    {handleState === 'taken' ? 'That handle is taken' : `Your public page: ${window.location.host}/@${handle || 'handle'}`}
                    {handleState === 'ok' && <span className="sr-only"> (available)</span>}
                  </p>
                </div>
              </>
            )}

            <div>
              <label htmlFor="email" className="field-label">
                Email
              </label>
              <input
                id="email"
                type="email"
                className="input"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="field-label">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="input pr-10"
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={isSignup ? 8 : undefined}
                  aria-describedby={isSignup ? 'password-hint' : undefined}
                  required
                />
                <button
                  type="button"
                  className="absolute right-1 top-1/2 -translate-y-1/2 btn btn-ghost btn-sm px-2 h-7"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label="Show password"
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff {...ICON} /> : <Eye {...ICON} />}
                </button>
              </div>
              {isSignup && <p id="password-hint" className="field-hint">At least 8 characters</p>}
            </div>

            {error && <ErrorNote>{error}</ErrorNote>}

            <button type="submit" className="btn btn-primary btn-lg w-full mt-2" disabled={submitting} aria-busy={submitting}>
              {submitting && <Spinner size={14} />}
              {isSignup ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-[13px] text-fg-2">
            {isSignup ? (
              <>
                Already have an account?{' '}
                <a {...linkProps('/login')} className="text-accent-ink underline underline-offset-2 decoration-accent-ink/40 hover:decoration-accent-ink">
                  Sign in
                </a>
              </>
            ) : (
              <>
                New to CreatorBrain?{' '}
                <a {...linkProps('/signup')} className="text-accent-ink underline underline-offset-2 decoration-accent-ink/40 hover:decoration-accent-ink">
                  Create an account
                </a>
              </>
            )}
          </p>
        </div>
      </main>
    </div>
  );
};
