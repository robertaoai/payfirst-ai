# Agentic Layer — payfirst-ai

## Risk Levels & Actions

### Low — Auto (no approval)
| Action | Trigger | Tool |
|---|---|---|
| Insert `page_visit` row | Page load | `db.insert(page_visits)` |
| Insert `purchase_intent` row | CTA click | `db.insert(purchase_intents)` |
| Log `summarize_started` / `summarize_done` | User triggers summarizer | `db.insert(activities)` |

### Medium — Light Approval
| Action | Trigger | Tool |
|---|---|---|
| Send buyer confirmation email | Webhook payment success | `email.send(template='purchase_confirm')` — reviewed before enabling |

### High — Always Approval
| Action | Trigger | Tool |
|---|---|---|
| Issue refund | Manual admin action | Human initiates in Stripe/LemonSqueezy dashboard |

### Critical — Human Only
| Action | Notes |
|---|---|
| Delete purchase record | Never automated |
| Issue legal notice or GDPR erasure | Human only, logged manually |

## Named Tools (v1)
- `db.insert(table, payload)` — Supabase client insert
- `db.select(table, filter)` — Supabase client select
- `webhook.verify(provider, signature, payload)` — validates payment webhook

## Audit Log Fields (activities table)
`id, user_id, purchase_id, action, detail (jsonb), created_at`

## v1 vs Later
- **v1:** only low-risk auto-inserts + webhook handler
- **Later:** email send (medium), model recommendation agent (low)
