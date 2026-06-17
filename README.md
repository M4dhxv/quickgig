# GigGrab Worker

Voice-first job matching for frontline workers. Upload your CV → AI extracts your profile → get matched to live jobs across 90+ employers in 17+ countries.

**Stack:** React + Vite + TypeScript · Supabase (auth, DB, storage, edge functions) · Claude Haiku (CV parsing) · Deepgram (TTS/STT)

**Live:** [quickgig.vercel.app](https://quickgig.vercel.app)

---

## Flow

`/` Upload CV → `/analyse` AI parses CV → `/verify` Email/SMS OTP → `/results` → `/dashboard` Job matches + Sarah chat

---

## Job Sources

| Source | Companies / Coverage | Markets | Live jobs | Key needed |
|---|---|---|---|---|
| **Adzuna** | Millions of listings, all sectors | US · UK · CA · AU · NZ · DE · FR · NL · ZA · SG · BE · AT · IT · PL · BR · MX · IN (17 countries) | ~10M+ total, ~85/search | Set (`ADZUNA_APP_ID`, `ADZUNA_APP_KEY`) |
| **Reed.co.uk** | UK's largest job board, all sectors | UK | ~270k | Set (`REED_API_KEY`) |
| **Workday — US Retail** | Walmart · Target · Home Depot · Lowe's · CVS Health · Walgreens · Kroger · Dollar General · Dollar Tree | US | ~400k+ | Free (public) |
| **Workday — US Food** | Wendy's · Burger King / Popeyes / Tim Hortons (RBI) · Papa Johns · Panera Bread · Chipotle · McDonald's US | US | ~80k+ | Free |
| **Workday — US Hospitality** | Hyatt · IHG · Wyndham · Choice Hotels · Hilton (global) · Marriott (global) | US + Global | ~60k+ | Free |
| **Workday — US Logistics** | FedEx · DHL US · Uber | US | ~30k+ | Free |
| **Workday — UK** | Tesco · Asda · Morrisons · McDonald's UK · Costa Coffee · Whitbread · DHL UK | UK | ~70k+ | Free |
| **Workday — Canada** | Loblaws · Canadian Tire · Tim Hortons (via RBI) | CA | ~20k+ | Free |
| **Workday — Australia** | Woolworths · Coles · Bunnings (Wesfarmers) | AU | ~25k+ | Free |
| **Amazon.jobs** | Amazon warehouses, delivery, ops — all geographies | US · UK · CA · AU · DE · FR · IN · JP · SG · MX | ~100k+, ~60/search | Free |
| **Greenhouse — Food & Bev** | Shake Shack · Sweetgreen · Wingstop · Jack in the Box · Dairy Queen · Chick-fil-A · Freshii · Pret · Leon · Nando's · Greggs · TGI Fridays UK | US + UK | ~1,500 | Free |
| **Greenhouse — FM & Cleaning** | Compass Group · Aramark · Sodexo · Mitie · ISS · Initial Facilities | Global + UK | ~2,000 | Free |
| **Greenhouse — Security** | G4S · Securitas · Allied Universal | Global + US | ~1,200 | Free |
| **Greenhouse — Logistics** | Deliveroo · GoPuff · Getir · Ocado · Yodel · Wincanton · XPO Logistics · CEVA · Kuehne+Nagel | Global | ~1,500 | Free |
| **Greenhouse — Staffing** | Adecco USA · ManpowerGroup · Robert Half · Five Guys · TJX · Gap Inc. | US | ~2,000 | Free |
| **Lever — Delivery** | Deliveroo · GoPuff · Stuart · Gophr · Lalamove | UK + US | ~400 | Free |
| **Lever — Staffing** | Manpower · Adecco · Randstad · Hays · Kelly Services · Spherion | Global | ~2,500 | Free |
| **Lever — Gig / BPO** | Instawork · Shiftgig · Wonolo · Concentrix · TaskUs · Teleperformance | US + Global | ~1,500 | Free |

**Totals:** 6 sources · 90+ direct employers · 17+ countries · ~2M+ live jobs available

---

## Supabase secrets required

```
ANTHROPIC_API_KEY      Claude Haiku (CV parsing + Sarah chat)
ADZUNA_APP_ID          Adzuna job board
ADZUNA_APP_KEY         Adzuna job board
DEEPGRAM_API_KEY       TTS voice for Sarah
TWILIO_ACCOUNT_SID     SMS OTP
TWILIO_AUTH_TOKEN      SMS OTP
TWILIO_PHONE_NUMBER    SMS OTP sender
REED_API_KEY           Reed.co.uk job board (UK)
```

## Edge functions

| Function | Purpose |
|---|---|
| `parse-cv` | Claude Haiku extracts structured profile from uploaded PDF |
| `ask-sarah` | Sarah AI chat, profile-aware |
| `aggregate-jobs` | Multi-source job aggregator (Adzuna + Amazon + Workday + GH + Lever + Reed) |
| `search-jobs` | Adzuna-only fallback |
| `tts` | Deepgram TTS proxy |
| `deepgram-token` | Returns Deepgram key for STT |

## Dev

```bash
npm install
npm run dev          # port 5174
npx vite build       # type check
```

Deploy edge functions:
```bash
SUPABASE_ACCESS_TOKEN=... npx supabase functions deploy <name> --no-verify-jwt
```
