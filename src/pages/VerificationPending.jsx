import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Mail, Loader2 } from 'lucide-react';
import { firebaseApi } from '@/api/firebaseClient';
import AuthLayout from '@/components/AuthLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function VerificationPending() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get('email') || '');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const resend = async (event) => {
    event.preventDefault();
    setError(''); setStatus(''); setLoading(true);
    try {
      const result = await firebaseApi.auth.resendEmailVerification(email, password);
      setStatus(result.alreadyVerified ? 'Your email is already verified. You can log in now.' : 'A new verification link has been sent to your email.');
      setPassword('');
    } catch (err) {
      setError(`${err?.code ? `${err.code}: ` : ''}${err?.message || 'Unable to resend the verification email.'}`);
    } finally { setLoading(false); }
  };

  return <AuthLayout icon={Mail} title="Verify your email" subtitle="One more step before you can sign in" footer={<Link to="/login" className="text-primary font-medium hover:underline">Back to Login</Link>}>
    <p className="mb-6 whitespace-pre-line rounded-xl bg-primary/10 p-4 text-sm text-foreground">Your account has been created successfully.{"\n"}A verification link has been sent to your email.{"\n"}Please verify your email before signing in.</p>
    {status && <p className="mb-4 rounded-lg bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-300">{status}</p>}
    {error && <p className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    <form className="space-y-4" onSubmit={resend}>
      <div className="space-y-2"><Label htmlFor="verification-email">Email Address</Label><Input id="verification-email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required /></div>
      <div className="space-y-2"><Label htmlFor="verification-password">Password</Label><Input id="verification-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></div>
      <Button className="w-full" type="submit" disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Resend Verification Email</Button>
    </form>
  </AuthLayout>;
}
