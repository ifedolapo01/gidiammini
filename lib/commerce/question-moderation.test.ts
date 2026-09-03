/**
 * The one rule in the Q&A feature that is a product decision rather than a
 * mechanism: a question cannot be published without an answer under it.
 *
 * Worth this much coverage because there are three ways to arrive at that
 * state — publish an unanswered question, clear the answer from a published
 * one, or publish and clear in the same request — and only a check against the
 * *resulting* row catches all three. Everything else here is the timestamp
 * bookkeeping that decides what the product page says about when it was
 * answered.
 */
import { describe, it, expect } from 'vitest';
import { planQuestionModeration, type ModeratedQuestionRow } from './question-moderation';

const ADMIN = 'owner@example.com';

const row = (over: Partial<ModeratedQuestionRow> = {}): ModeratedQuestionRow => ({
  status: 'pending',
  published_at: null,
  answer: null,
  ...over,
});

const answered = row({ answer: 'It runs generously.', status: 'pending' });

describe('publishing requires an answer', () => {
  it('refuses to publish a question nobody has answered', () => {
    const plan = planQuestionModeration({ status: 'published' }, row(), ADMIN);
    expect(plan.ok).toBe(false);
    expect((plan as any).error).toMatch(/answer before publishing/i);
  });

  it('refuses an answer that is only whitespace', () => {
    const plan = planQuestionModeration({ status: 'published', answer: '   ' }, row(), ADMIN);
    expect(plan.ok).toBe(false);
  });

  it('refuses to clear the answer from a question that is already published', () => {
    const published = row({ status: 'published', answer: 'Yes, it is lined.', published_at: 'x' });
    const plan = planQuestionModeration({ answer: '' }, published, ADMIN);
    expect(plan.ok).toBe(false);
  });

  it('allows answer and publish in one request, which is the normal path', () => {
    const plan = planQuestionModeration(
      { answer: 'It runs generously — size up.', status: 'published' },
      row(),
      ADMIN
    );
    expect(plan.ok).toBe(true);
    expect((plan as any).update).toMatchObject({
      answer: 'It runs generously — size up.',
      answered_by: ADMIN,
      status: 'published',
    });
  });

  it('allows an answer to be saved without publishing it', () => {
    const plan = planQuestionModeration({ answer: 'Checking with the supplier.' }, row(), ADMIN);
    expect(plan.ok).toBe(true);
    expect((plan as any).update).not.toHaveProperty('status');
  });

  it('allows clearing the answer while the question is not published', () => {
    const plan = planQuestionModeration({ answer: '' }, answered, ADMIN);
    expect(plan.ok).toBe(true);
    expect((plan as any).update.answer).toBeNull();
    expect((plan as any).update.answered_by).toBeNull();
  });
});

describe('what the page says about when it was answered', () => {
  it('stamps answered_at the first time an answer is written', () => {
    const plan = planQuestionModeration({ answer: 'Yes.' }, row(), ADMIN) as any;
    expect(plan.update.answered_at).toBeTypeOf('string');
  });

  it('leaves answered_at alone when an existing answer is edited', () => {
    // Fixing a typo should not move the date the page shows.
    const plan = planQuestionModeration({ answer: 'It runs generously!' }, answered, ADMIN) as any;
    expect(plan.update.answer).toBe('It runs generously!');
    expect(plan.update).not.toHaveProperty('answered_at');
  });

  it('stamps published_at once, so a restored question keeps its original date', () => {
    const first = planQuestionModeration({ status: 'published' }, answered, ADMIN) as any;
    expect(first.update.published_at).toBeTypeOf('string');

    const restored = planQuestionModeration(
      { status: 'published' },
      row({ status: 'pending', answer: 'Yes.', published_at: '2026-01-01T00:00:00.000Z' }),
      ADMIN
    ) as any;
    expect(restored.update).not.toHaveProperty('published_at');
  });

  it('clears the mail claim when the answer is replaced, so the new one is sent', () => {
    const plan = planQuestionModeration({ answer: '' }, answered, ADMIN) as any;
    expect(plan.update.answer_notified_at).toBeNull();
  });
});

describe('what the audit trail records, and who gets mailed', () => {
  it('calls a publish an approval and a rejection a rejection', () => {
    expect((planQuestionModeration({ status: 'published' }, answered, ADMIN) as any).action).toBe('approve');
    expect((planQuestionModeration({ status: 'rejected' }, answered, ADMIN) as any).action).toBe('reject');
    expect((planQuestionModeration({ answer: 'Yes.' }, row(), ADMIN) as any).action).toBe('update');
  });

  it('flags for notification only on the request that publishes', () => {
    const publishing = planQuestionModeration({ status: 'published' }, answered, ADMIN) as any;
    expect(publishing.publishes).toBe(true);

    // Re-saving something already published must not mail the asker again.
    const alreadyLive = row({ status: 'published', answer: 'Yes.', published_at: 'x' });
    const resave = planQuestionModeration({ answer: 'Yes, definitely.' }, alreadyLive, ADMIN) as any;
    expect(resave.publishes).toBe(false);
  });

  it('produces no update when the requested status is already the current one', () => {
    const plan = planQuestionModeration({ status: 'pending' }, row(), ADMIN) as any;
    expect(plan.update).toEqual({});
  });
});
