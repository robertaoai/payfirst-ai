# Data Model — payfirst-ai

## page_visits
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| user_id | uuid nullable | for future auth scoping |
| session_id | text | client-generated, anonymous |
| referrer | text | HTTP referrer or UTM |
| webgpu_available | boolean | detected client-side |
| vram_gb | numeric | estimated from GPU adapter |
| created_at | timestamptz | now() |

## purchase_intents
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid nullable | |
| session_id | text | links to page_visit |
| price_cents | integer | default 2900 |
| cta_label | text | button copy at time of click |
| created_at | timestamptz | |

## purchases
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid nullable | filled at lock-down sprint |
| buyer_email | text | from payment provider |
| amount_cents | integer | |
| currency | text | default 'usd' |
| payment_provider | text | 'stripe' or 'lemon_squeezy' |
| payment_provider_id | text | idempotency key |
| status | text | 'completed' / 'refunded' |
| access_token | text | random token for /app gate |
| created_at | timestamptz | |

## activities
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid nullable | |
| purchase_id | uuid nullable | FK to purchases |
| action | text | e.g. 'summarize_started', 'summarize_done' |
| detail | jsonb | word count, model name, duration_ms — NO document content |
| created_at | timestamptz | |

## RLS
All tables: open v1 policies (select + all using true). Replaced with `auth.uid() = user_id` at the lock-down sprint.
