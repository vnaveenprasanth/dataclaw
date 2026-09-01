# DATAClaw — Reconciliation Dashboard

A production-grade web application that ingests order and payment CSV exports, deterministically reconciles them, and surfaces every discrepancy through an interactive dashboard with AI-powered explanations.

---

## Architecture

```
frontend/          React + Vite + shadcn/ui + Clerk
backend/           Flask + SQLAlchemy + PostgreSQL (Supabase)
deploy/            Nginx + Gunicorn (EC2 t2.small)
```

**Authentication**: Clerk 
**Database**: Supabase PostgreSQL — no `users` table; Clerk owns identity  
**LLM**: Gemini 2.5-flash (primary) → Gemini 2.0-flash → GPT-4o-mini (fallback)

---

## Reconciliation Logic

The engine runs deterministically — same input always produces the same output. It detects **10 discrepancy types**:

| Type | Severity | Logic |
|------|----------|-------|
| `AMOUNT_MISMATCH` | HIGH/MED/LOW | `|order.net_amount - payment.amount| > $0.02` |
| `CURRENCY_MISMATCH` | HIGH | Order and payment currencies differ |
| `DUPLICATE_PAYMENT` | HIGH | >1 charge-type payment for same order |
| `PHANTOM_PAYMENT` | MEDIUM | Payment references an order_id not in orders |
| `MISSING_PAYMENT` | HIGH | Order has no corresponding payment |
| `FAILED_PAYMENT` | HIGH | Payment status is `failed` or `pending` |
| `CANCELLED_ORDER_CHARGED` | HIGH | Order status=`cancelled` but charge exists |
| `PARTIAL_REFUND` | MEDIUM | Refund amount < original charge |
| `DUPLICATE_ORDER` | LOW | Same order_id appears >1 time in orders CSV |
| `DATA_QUALITY` | LOW | Missing required fields (e.g. `customer_email`) |

**Matching key**: `orders.order_id` ↔ `payments.order_reference` (both normalised to uppercase + stripped whitespace)  
**Amount tolerance**: ±$0.02 (covers float rounding in payment processors)  
**Risk amount**: The actual dollar value at risk for each discrepancy

---

## Local Development

### Prerequisites
- Python 3.11+, Node 18+
- Supabase project (free tier)
- Clerk account (free tier)
- Gemini API key

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
cp .env.example .env           # fill in DATABASE_URL, CLERK_PEM_PUBLIC_KEY, GEMINI_API_KEY
flask db upgrade               # run migrations
python run.py
```

Backend runs at `http://localhost:5000`

### Frontend

```bash
cd frontend
cp .env.example .env           # add VITE_CLERK_PUBLISHABLE_KEY
npm install
npm run dev
```

Frontend runs at `http://localhost:5173` — API calls proxy to Flask via Vite dev proxy.

### Run tests

```bash
cd backend
pytest tests/ -v
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | Supabase PostgreSQL connection string |
| `CLERK_PEM_PUBLIC_KEY` | ✅ | PEM public key from Clerk Dashboard → API Keys |
| `CLERK_PERMITTED_ORIGINS` | ✅ | Comma-separated allowed frontend origins |
| `GEMINI_API_KEY` | ✅ | Google AI Studio API key |
| `SECRET_KEY` | ✅ | Flask secret key (generate with `python -c "import secrets; print(secrets.token_hex(32))"`) |
| `OPENAI_API_KEY` | ⬜ | Optional fallback if Gemini is rate-limited |
| `LLM_FALLBACK_ENABLED` | ⬜ | `true`/`false` — enable OpenAI fallback (default: `true`) |

### Frontend (`frontend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_CLERK_PUBLISHABLE_KEY` | ✅ | Clerk publishable key (starts with `pk_test_` or `pk_live_`) |
| `VITE_API_URL` | ⬜ | Backend API URL in production (default: `/api` via Vite proxy) |

---

## Deployment (EC2 t2.micro)

```bash
# 1. Install dependencies
sudo apt update && sudo apt install -y nginx python3-pip python3-venv nodejs npm

# 2. Clone and setup backend
cd /var/www/dataclaw/backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
flask db upgrade

# 3. Build frontend
cd /var/www/dataclaw/frontend
npm install && npm run build

# 4. Configure Nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/dataclaw
sudo ln -s /etc/nginx/sites-available/dataclaw /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 5. Setup Gunicorn service
sudo cp deploy/dataclaw.service /etc/systemd/system/
sudo mkdir -p /var/log/dataclaw
sudo systemctl enable dataclaw && sudo systemctl start dataclaw
```

---

## Design Decisions

**Why Clerk?** Eliminates custom auth implementation (password hashing, JWT rotation, session management, email verification). The spec allows "a reputable auth provider" — Clerk handles all of this at zero cost for our scale.

**Why Supabase?** Free tier is permanent (unlike RDS 12-month limit). 5-minute setup vs 30+ minutes of VPC/security group configuration on RDS. Connection pooling included.

**Why Gemini 2.5-flash primary?** 1M token context window handles any dataset size. Native Pydantic `response_schema` gives type-safe structured output without manual JSON parsing. Pricing comparable to GPT-4o-mini.

**Why ±$0.02 tolerance?** Payment processors (Stripe, PayPal) apply float rounding that can introduce sub-cent differences. Flagging these would generate noise with no actionable outcome. Any difference above 2 cents is reproducible and genuinely warrants investigation.

**Why Decimal arithmetic in the engine?** Python floats are binary floating point — `0.1 + 0.2 ≠ 0.3`. All financial comparisons use `Decimal` to avoid false positives.
