/**
 * STOREFRONT layer — the form for one item on the order.
 *
 * Only the rating is required. Title, review text and photos are all optional
 * and say so, because the alternative — a form that refuses to submit without
 * an essay — is a form the shop gets no reviews from. A bare five stars from
 * somebody who really bought the thing is worth more than a paragraph from
 * nobody.
 *
 * Once it has been submitted (or was submitted on an earlier visit) the form
 * is replaced by a short acknowledgement rather than disappearing: the item is
 * still part of the order, and a card that vanishes reads as a mistake.
 */
'use client';

import { useState } from 'react';
import { Check, ShieldCheck } from 'lucide-react';
import ProductImage from '@/components/commerce/ProductImage';
import RatingInput from '@/components/commerce/RatingInput';
import { Button, FieldError, Input, Textarea, fieldErrorId } from '@/components/ui';
import { MAX_REVIEW_BODY, MAX_REVIEW_TITLE } from '@/lib/commerce/reviews';
import type { ReviewableItem } from '@/lib/commerce/review-claim';
import ReviewPhotoPicker from './ReviewPhotoPicker';
import { useReviewSubmit } from '../hooks/useReviewSubmit';

interface ReviewItemFormProps {
  token: string;
  item: ReviewableItem;
  /** From the order, editable — see the name field below. */
  defaultAuthorName: string;
}

export default function ReviewItemForm({ token, item, defaultAuthorName }: ReviewItemFormProps) {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [authorName, setAuthorName] = useState(defaultAuthorName);
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);
  // The honeypot's value. Sent with the review, because a hidden input nobody
  // reads is decoration rather than a check.
  const [website, setWebsite] = useState('');

  const { submit, submitting, error, fieldErrors, done, message } = useReviewSubmit(token);

  const settled = done || item.reviewed;

  return (
    <li className="rounded-surface border border-border bg-surface p-4 md:p-6">
      <div className="flex items-start gap-3">
        <ProductImage
          src={item.image}
          alt=""
          sizes="64px"
          className="h-16 w-16 shrink-0 rounded-control"
        />
        <div className="min-w-0">
          <h2 className="text-body-lg font-semibold text-text-primary">{item.productName}</h2>
          <p className="text-caption-md text-text-secondary">{item.variantLabel}</p>
        </div>
      </div>

      {settled ? (
        <p className="mt-4 flex items-start gap-2 rounded-control bg-success-background p-3 text-body-sm text-success">
          <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {done
              ? message
              : "You've already reviewed this one — thank you. It appears on the product page once we've read it."}
          </span>
        </p>
      ) : (
        <form
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit({ productId: item.productId, rating, title, body, authorName, photoPaths, website });
          }}
        >
          <fieldset disabled={submitting} className="space-y-4">
            <div>
              <p className="text-body-sm font-medium text-text-primary">
                How was it? <span className="text-destructive">*</span>
              </p>
              <RatingInput
                name={`rating-${item.productId}`}
                value={rating}
                onChange={setRating}
                invalid={Boolean(fieldErrors.rating)}
              />
              <FieldError id={fieldErrorId('rating')}>{fieldErrors.rating}</FieldError>
            </div>

            <div>
              <label
                htmlFor={`title-${item.productId}`}
                className="mb-1 block text-body-sm font-medium text-text-primary"
              >
                Sum it up <span className="text-text-secondary">(optional)</span>
              </label>
              <Input
                id={`title-${item.productId}`}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={MAX_REVIEW_TITLE}
                placeholder="Softer than I expected"
                invalid={Boolean(fieldErrors.title)}
                aria-describedby={fieldErrors.title ? fieldErrorId('title') : undefined}
              />
              <FieldError id={fieldErrorId('title')}>{fieldErrors.title}</FieldError>
            </div>

            <div>
              <label
                htmlFor={`body-${item.productId}`}
                className="mb-1 block text-body-sm font-medium text-text-primary"
              >
                Tell other parents more <span className="text-text-secondary">(optional)</span>
              </label>
              <Textarea
                id={`body-${item.productId}`}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                maxLength={MAX_REVIEW_BODY}
                rows={4}
                placeholder="The fit, the fabric, how it washed, whether the size was right…"
                invalid={Boolean(fieldErrors.body)}
                aria-describedby={fieldErrors.body ? fieldErrorId('body') : undefined}
              />
              <FieldError id={fieldErrorId('body')}>{fieldErrors.body}</FieldError>
            </div>

            <div>
              <p className="mb-1 text-body-sm font-medium text-text-primary">Photos</p>
              <ReviewPhotoPicker
                token={token}
                paths={photoPaths}
                onChange={setPhotoPaths}
                disabled={submitting}
              />
            </div>

            <div>
              <label
                htmlFor={`name-${item.productId}`}
                className="mb-1 block text-body-sm font-medium text-text-primary"
              >
                Shown as
              </label>
              <Input
                id={`name-${item.productId}`}
                value={authorName}
                onChange={(event) => setAuthorName(event.target.value)}
                maxLength={80}
                invalid={Boolean(fieldErrors.authorName)}
                aria-describedby={fieldErrors.authorName ? fieldErrorId('authorName') : undefined}
                className="max-w-xs"
              />
              <FieldError id={fieldErrorId('authorName')}>{fieldErrors.authorName}</FieldError>
              <p className="mt-1 text-caption-md text-text-secondary">
                Change it to a first name or initials if you would rather. Your email
                is never shown.
              </p>
            </div>
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

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" loading={submitting}>
              Post review
            </Button>
            <span className="inline-flex items-center gap-1.5 text-caption-md text-text-secondary">
              <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden="true" />
              Published as a verified purchase, once we have read it
            </span>
          </div>
        </form>
      )}
    </li>
  );
}
