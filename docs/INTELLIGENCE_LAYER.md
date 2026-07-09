# Intelligence Layer — payfirst-ai

## v1 — Rule-Based Signals (no LLM needed)

### Inputs (messy)
- Visitor hardware: raw GPU adapter string, `navigator.gpu` availability
- Visitor behaviour: time on page, CTA clicks, payment completion

### Auto-Structured Schema
```json
{
  "session_id": "abc123",
  "webgpu_available": true,
  "vram_gb": 8,
  "hardware_tier": "medium",
  "converted": true,
  "price_paid_cents": 2900
}
```

### Scoring Rules (rule-based, v1)
| Signal | Rule | Score |
|---|---|---|
| WebGPU available | boolean true | +2 |
| VRAM ≥ 6 GB | numeric check | +2 |
| VRAM 1–5 GB | numeric check | +1 |
| CTA clicked | purchase_intent exists | +1 |
| Payment completed | purchase exists | +5 |

**hardware_tier** = 'low' (<2 GB), 'medium' (2–8 GB), 'high' (>8 GB) — derived at read time.

### What Gets Ranked
- Which hardware tier is most common among buyers (informs model choice for Sprint 3)
- Conversion rate: visits → intents → purchases

## Later (after first payment)
- AI field: `summary_quality_score` (value, source='llm_self_eval', confidence 0–1, review_status='unreviewed')
- Model auto-selection based on detected VRAM tier
- Usage pattern analysis: which document types are summarized most
