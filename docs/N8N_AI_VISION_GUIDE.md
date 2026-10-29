# DealerData — N8N AI Vision Specials Workflow Guide

This guide details how to configure your external **N8N Workflow** to automatically pull staged promotional flyer images, parse them with a Vision LLM (OpenAI GPT-4o, Claude 3.5 Sonnet, or Gemini Flash), and post the structured offers back into DealerData.

---

## 1. API Endpoints

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/api/specials/staging` | Fetches pending visual flyer specials waiting for AI extraction | `x-api-key` or `Bearer` |
| `POST` | `/api/specials/ai-callback` | Receives parsed AI special offers and promotes them to live tables | `x-api-key` or `Bearer` |
| `GET` | `/api/specials/ai-callback` | Endpoint health check & schema documentation | Public |

### Authentication
Include either of these headers in all N8N HTTP Request nodes:
- `x-api-key: dealerdata_n8n_secret_2026`
- OR `Authorization: Bearer dealerdata_n8n_secret_2026`

*(The secret can be customized in `.env` using `N8N_WEBHOOK_SECRET`)*

---

## 2. N8N Workflow Architecture

```
┌─────────────────────────────────┐
│     Schedule Trigger (Cron)     │ Every 1-2 hours or when notified
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  HTTP Request: Fetch Pending    │ GET /api/specials/staging?limit=10
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  Loop / Item Splitter           │ Iterate through each staged flyer item
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  Vision AI Node (OpenAI/Claude) │ Pass `item.imageUrl` to Vision model
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  HTTP Request: AI Callback      │ POST /api/specials/ai-callback
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  DealerData Automatic Actions:  │ 1. Updates staging row status to 'approved'
│                                 │ 2. Propagates AI extraction to matching image_hash
│                                 │ 3. Inserts live into competitor_vehicle_specials
│                                 │ 4. Creates dashboard notification
└─────────────────────────────────┘
```

---

## 3. Step-by-Step Node Configuration in N8N

### Node 1: Fetch Pending Specials
- **Type**: HTTP Request
- **Method**: `GET`
- **URL**: `http://localhost:3000/api/specials/staging?status=pending&limit=10`
- **Headers**:
  - `x-api-key`: `dealerdata_n8n_secret_2026`
- **Output**: Returns an array `items` with flyer metadata, including:
  - `id`: Staging record ID (e.g. `stg_norm_reeves_ford_...`)
  - `imageUrl`: Public high-res image URL of the flyer
  - `imageHash`: SHA-256 hash of the image
  - `domain`: Dealership domain

---

### Node 2: Vision AI Prompt (OpenAI / Claude / Gemini)
- **Type**: OpenAI Chat Model / Anthropic Chat Model
- **Input Image**: `{{ $json.imageUrl }}`
- **System Prompt**:
```text
You are an expert automotive digital merchandising analyst.
Extract all vehicle special lease and finance offers from this dealership promotional flyer image.

Return ONLY a valid JSON object matching this exact schema:
{
  "is_special": true,
  "year": 2026,
  "make": "Ford",
  "model": "Explorer",
  "trim": "XLT",
  "special_type": "lease",
  "monthly_payment": 389,
  "term_months": 36,
  "down_payment": 2999,
  "apr": null,
  "msrp": 42500,
  "offer_details": null,
  "title": "2026 Ford Explorer XLT Lease Special",
  "disclaimer": "Full legal disclaimer text...",
  "expiration_date": "2026-10-31"
}

STRICT QUALIFICATION & DISCARD RULES:
1. is_special: A flyer is a valid special ONLY if it contains actionable numeric offer terms: such as a monthly payment ($/mo), APR rate (%), bonus cash/rebate/discount amount ($), lease/finance term (number of months), or down payment ($).
2. If the flyer is general branding, an event announcement (e.g. "Sales Event"), dealership award/review, lifetime warranty/service pitch, or contains NO numbers/financial offer terms (no monthly payment, no APR %, no cash/discount amount, no term, no down payment), you MUST set "is_special": false, and set all numeric fields (monthly_payment, term_months, down_payment, apr, msrp) to null.
3. special_type must be: 'lease', 'finance', 'cash', or 'service'.
4. All numbers must be clean integers or floats (no '$', '%', or commas).
5. If a field is not present in the flyer, return null.
6. expiration_date must be in YYYY-MM-DD format if visible, else null.
```

---

### Node 3: Post AI Extractions Back
- **Type**: HTTP Request
- **Method**: `POST`
- **URL**: `http://localhost:3000/api/specials/ai-callback`
- **Headers**:
  - `Content-Type`: `application/json`
  - `x-api-key`: `dealerdata_n8n_secret_2026`
- **Body Parameters (JSON)**:
```json
{
  "staging_id": "={{ $('Fetch Pending Specials').item.json.id }}",
  "image_hash": "={{ $('Fetch Pending Specials').item.json.imageHash }}",
  "auto_approve": true,
  "raw_text": "={{ $json.raw_ocr_text }}",
  "extracted_data": "={{ $json.parsed_special }}"
}
```

---

## 4. What DealerData Does Automatically on Callback

When `POST /api/specials/ai-callback` is called:

1. **Updates Staging**:
   - Stores `extracted_json` inside `specials_staging`.
   - Transitions `status` from `pending` to `approved`.
2. **Global AI Deduplication (`image_hash`)**:
   - If other dealerships or stores tracked the same flyer image, DealerData detects identical `image_hash` values and **automatically approves all of them with the same extraction**, eliminating 100% of duplicate AI token costs.
3. **Live Special Promotion**:
   - Creates a live entry in `competitor_vehicle_specials` linked to the store, matching Year, Make, Model, Monthly Payment, Down Payment, Term, and Image URL.
   - Instantly renders the special on `/competitor-analysis?view=new_specials` and the Specials Entry tool.
4. **Dashboard Notification**:
   - Emits an in-app notification to the notifications tray alerting managers of the newly parsed competitor offer.
