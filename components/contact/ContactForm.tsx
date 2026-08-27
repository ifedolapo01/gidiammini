/** STOREFRONT layer — the public Contact Us form. */
'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button, Input, Textarea } from '@/components/ui';
import { useContactForm } from './hooks/useContactForm';

export default function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  /** Honeypot — must stay empty for a real submission. */
  const [website, setWebsite] = useState('');
  const { submitContactForm, submitting, error, submitted } = useContactForm();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await submitContactForm({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      message: message.trim(),
      website,
    });
    if (ok) {
      setName('');
      setEmail('');
      setPhone('');
      setMessage('');
      setWebsite('');
    }
  };

  if (submitted) {
    return (
      <div className="bg-success-background border border-success-border rounded-surface p-6 flex flex-col items-center text-center gap-2">
        <CheckCircle2 className="w-8 h-8 text-success" />
        <p className="font-bold text-body-md text-text-primary">Message sent</p>
        <p className="text-body-sm text-text-secondary">
          Thanks for reaching out — we&apos;ll get back to you as soon as possible.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-surface p-4 md:p-6 space-y-4">
      {/* Honeypot. Hidden from sight AND from assistive tech, and taken out of
          the tab order, so no real person can reach it — anything submitted in
          it came from a bot filling every input on the page. See
          isBotSubmission in app/api/contact/route.ts. */}
      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute h-0 w-0 overflow-hidden opacity-0"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-body-sm font-medium text-text-primary mb-1.5">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required />
        </div>
        <div>
          <label className="block text-body-sm font-medium text-text-primary mb-1.5">Email</label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
        </div>
      </div>
      <div>
        <label className="block text-body-sm font-medium text-text-primary mb-1.5">Phone (optional)</label>
        <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="080..." />
      </div>
      <div>
        <label className="block text-body-sm font-medium text-text-primary mb-1.5">Message</label>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          placeholder="How can we help?"
          required
        />
      </div>
      {error && <p className="text-body-sm text-destructive">{error}</p>}
      <Button type="submit" loading={submitting} className="w-full sm:w-auto font-semibold">
        Send Message
      </Button>
    </form>
  );
}
