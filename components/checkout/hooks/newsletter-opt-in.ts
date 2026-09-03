/**
 * STOREFRONT layer — the "keep me updated" tick-box on the checkout form.
 *
 * A marketing opt-in, deliberately separate from order creation: it runs after
 * the order already exists and must never affect whether the order succeeded.
 * Every failure is swallowed with a log — a customer who has paid should not
 * see an error because a mailing-list row didn't save.
 */

interface NewsletterOptIn {
  subscribeToNewsletter: boolean;
  firstName: string;
  lastName: string;
  email: string;
}

export async function submitNewsletterOptIn(formData: NewsletterOptIn): Promise<void> {
  if (!formData.subscribeToNewsletter) return;

  try {
    await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: formData.email,
        name: `${formData.firstName} ${formData.lastName}`.trim(),
      }),
    });
  } catch (error) {
    console.error('Subscription failed but order succeeded', error);
  }
}
