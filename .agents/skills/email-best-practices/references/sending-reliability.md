# Sending Reliability

Ensuring emails are sent exactly once and handling failures gracefully.

## Idempotency

Prevent duplicate emails when retrying failed requests.

### The Problem

Network issues, timeouts, or server errors can leave you uncertain if an email was sent. Retrying without idempotency risks sending duplicates.

### Solution: Idempotency Keys

Send a unique key with each request. If the same key is sent again, the server returns the original response instead of sending another email.

```typescript
// Generate deterministic key based on the business event
const idempotencyKey = `password-reset-${userId}-${resetRequestId}`;

await resend.emails.send({
  from: 'noreply@example.com',
  to: user.email,
  subject: 'Reset your password',
  html: emailHtml,
}, {
  headers: {
    'Idempotency-Key': idempotencyKey
  }
});
```

### Key Generation Strategies

| Strategy | Example | Use When |
|----------|---------|----------|
| Event-based | `order-confirm-${orderId}` | One email per event (recommended) |
| Request-scoped | `reset-${userId}-${resetRequestId}` | Retries within same request |
| UUID | `crypto.randomUUID()` | No natural key (generate once, reuse on retry) |

**Best practice:** Use deterministic keys based on the business event. If you retry the same logical send, the same key must be generated. Avoid `Date.now()` or random values generated fresh on each attempt.

**Key expiration:** Idempotency keys are typically cached for 24 hours. Retries within this window return the original response. After expiration, the same key triggers a new send—so complete your retry logic well within 24 hours.

## Retry Logic

Handle transient failures with exponential backoff.

### When to Retry

| Error Type | Retry? | Notes |
|------------|--------|-------|
| 5xx (server error) | ✅ Yes | Transient, likely to resolve |
| 429 (rate limit) | ✅ Yes | Wait for rate limit window |
| 4xx (client error) | ❌ No | Fix the request first |
| Network timeout | ✅ Yes | Transient |
| DNS failure | ✅ Yes | May be transient |

### Exponential Backoff

```typescript
async function sendWithRetry(emailData, idempotencyKey, maxAttempts = 3) {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new RangeError('maxAttempts must be a positive integer');
  }
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let result;
    try {
      result = await resend.emails.send(emailData, { idempotencyKey });
    } catch (error) {
      // Transport failures can reject; API failures normally return error.
      if (!isRetryable(error) || attempt === maxAttempts - 1) {
        throw error;
      }
      await backoff(attempt);
      continue;
    }
    if (!result.error) return result.data;
    if (!isRetryable(result.error) || attempt === maxAttempts - 1) {
      throw result.error;
    }
    await backoff(attempt);
  }
}

function isRetryable(error) {
  const code = error?.code ?? error?.cause?.code;
  return (error?.statusCode >= 500 && error.statusCode < 600) ||
         error?.statusCode === 429 ||
         ['ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN'].includes(code);
}

function backoff(attempt) {
  const delay = Math.min(1000 * 2 ** attempt, 30000);
  return new Promise(resolve => setTimeout(resolve, delay + Math.random() * 1000));
}
```

Three total attempts remain the default, with 1s and 2s waits plus jitter.
Reuse the same business-event idempotency key on every attempt. Honor any
documented rate-limit retry delay when available; do not invent an SDK field.

## Error Handling

### Common Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| 400 | Bad request | Fix payload (invalid email, missing field) |
| 401 | Unauthorized | Check API key |
| 403 | Forbidden | Check permissions, domain verification |
| 404 | Not found | Check endpoint URL |
| 422 | Validation error | Fix request data |
| 429 | Rate limited | Back off, retry after delay |
| 500 | Server error | Retry with backoff |
| 503 | Service unavailable | Retry with backoff |

### Error Handling Pattern

```typescript
const { data, error } = await resend.emails.send(emailData, { idempotencyKey });

if (error) {
  if (error.statusCode === 429) {
    await queueForRetry(emailData);
  } else if (error.statusCode >= 500) {
    await queueForRetry(emailData);
  } else {
    await logFailure(error, emailData);
    await alertOnCriticalEmail(emailData); // For password resets, etc.
  }
} else {
  await logSuccess(data.id, emailData);
}
```

The SDK returns API failures through `error`; `try/catch` alone misses those
failures. Transport failures may still reject. Handle those at the caller or
use the retry helper above. Preserve the original idempotency key in queued jobs.

## Queuing for Reliability

For critical emails, use a queue to ensure delivery even if the initial send fails.

**Benefits:**
- Survives application restarts
- Automatic retry handling
- Rate limit management
- Audit trail

**Simple pattern:**
1. Write email to queue/database with "pending" status
2. Process queue, attempt send
3. On success: mark "sent", store message ID
4. On retryable failure: increment retry count, schedule retry
5. On permanent failure: mark "failed", alert

## Timeouts

Set appropriate timeouts to avoid hanging requests.

Use the timeout/abort mechanism documented for the installed SDK or its HTTP
transport. Do not assume `resend.emails.send` forwards a `signal` option.
For a direct `fetch` request, pass `signal: AbortSignal.timeout(10000)` in its
request options; `AbortSignal.timeout` is a static method, not a constructor.
A `Promise.race` timeout alone does not cancel the underlying send. After an
ambiguous timeout, retry only with the original idempotency key.

**Recommended:** 10-30 seconds for email API calls.

## Related

- [Webhooks & Events](./webhooks-events.md) - Process delivery confirmations and failures
- [List Management](./list-management.md) - Handle bounces and suppress invalid addresses
