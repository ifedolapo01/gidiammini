/**
 * STOREFRONT layer — asking about this product.
 *
 * Collapsed behind a button until wanted. Most people reading the Q&A are
 * looking for an answer somebody already got; a three-field form open by
 * default pushes those answers down the page for everyone in order to serve
 * the few who need it.
 *
 * Three fields and no more. The email is the only one that needs explaining,
 * so it explains itself in a line under the input: it is how the answer gets
 * back to them, it is never shown next to the question, and it subscribes them
 * to nothing. Anything else here would be a field somebody abandons the form
 * over.
 */
'use client';

import { useState } from 'react';
import { Check, MessageCirclePlus } from 'lucide-react';
import { Button, FieldError, Input, Textarea, fieldErrorId } from '@/components/ui';
import { MAX_QUESTION_BODY } from '@/lib/commerce/questions';
import { useAskQuestion } from '../../hooks/useAskQuestion';

interface AskQuestionFormProps {
  productId: string;
}

export default function AskQuestionForm({ productId }: AskQuestionFormProps) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');

  const { ask, submitting, error, fieldErrors, done, message } = useAskQuestion();

  if (done) {
    return (
      <p className="mt-4 flex items-start gap-2 rounded-control bg-success-background p-3 text-body-sm text-success">
        <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{message}</span>
      </p>
    );
  }

  if (!open) {
    return (
      <Button variant="outline" className="mt-4" onClick={() => setOpen(true)}>
        <MessageCirclePlus className="h-4 w-4" aria-hidden="true" />
        Ask a question
      </Button>
    );
  }

  return (
    <form
      className="mt-4 space-y-3 rounded-surface border border-border bg-surface p-4"
      onSubmit={(event) => {
        event.preventDefault();
        ask({ productId, question, name, email, website });
      }}
    >
      <fieldset disabled={submitting} className="space-y-3">
        <div>
          <label
            htmlFor="question-body"
            className="mb-1 block text-body-sm font-medium text-text-primary"
          >
            What would you like to know?
          </label>
          <Textarea
            id="question-body"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={MAX_QUESTION_BODY}
            rows={3}
            required
            placeholder="Would this fit a chunky 6-month-old? Is the inside lined?"
            invalid={Boolean(fieldErrors.question)}
            aria-describedby={fieldErrors.question ? fieldErrorId('question') : undefined}
          />
          <FieldError id={fieldErrorId('question')}>{fieldErrors.question}</FieldError>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="question-name"
              className="mb-1 block text-body-sm font-medium text-text-primary"
            >
              Your name
            </label>
            <Input
              id="question-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              required
              autoComplete="given-name"
              invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? fieldErrorId('name') : undefined}
            />
            <FieldError id={fieldErrorId('name')}>{fieldErrors.name}</FieldError>
          </div>

          <div>
            <label
              htmlFor="question-email"
              className="mb-1 block text-body-sm font-medium text-text-primary"
            >
              Your email
            </label>
            <Input
              id="question-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? fieldErrorId('email') : undefined}
            />
            <FieldError id={fieldErrorId('email')}>{fieldErrors.email}</FieldError>
          </div>
        </div>

        <p className="text-caption-md text-text-secondary">
          We email you the answer — that is the only thing your address is used for.
          Your name appears with the question; your email never does.
        </p>
      </fieldset>

      {/* The honeypot the API checks. Hidden from people, not from scripts. */}
      <input
        type="text"
        name="website"
        value={website}
        onChange={(event) => setWebsite(event.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="sr-only"
      />

      {error && (
        <p role="alert" className="text-body-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={submitting}>
          Send question
        </Button>
        <Button type="button" variant="ghost" disabled={submitting} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
