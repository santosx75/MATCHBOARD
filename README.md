# Matchboard

Find the job offers that best match your CV. Upload a CV (PDF, DOCX or TXT), check the skills we found,
pick a target role and a city, and get offers from several job boards ranked by match score.

- Black & white, responsive, Apple-style glass cards (hover lifts and highlights, click selects).
- Contract filter: Permanent (CDI), Fixed-term (CDD), Internship (Stage), Apprenticeship (Alternance),
  Temp (Intérim), Freelance, Part-time, Extras / Gigs, Seasonal / Summer, Student job, VIE, Volunteer.
- Distance slider from 1 to 200 km around your city (or your current location).
- The CV is read in the browser; it is never uploaded.

## Run it

Needs Node.js 18 or newer. No `npm install` needed (no dependencies).

```bash
node server.js
```

Then open http://localhost:3000. Run the tests with `npm test`.

## Job sources

| Source | Key | What it adds |
|---|---|---|
| Arbeitnow | none | European offers (many in Germany), with remote flag |
| Remotive | none | Remote jobs |
| Himalayas | none | Remote jobs |
| Adzuna | free | Big aggregator for France (lots of offers also seen on Indeed and company sites), with GPS coordinates |
| France Travail | free | Every offer published in France: CDI, CDD, intérim, saisonnier, alternance |
| Jooble | free | Aggregator covering many job boards |

Copy `.env.example` to `.env` and paste the keys you get. For a school in France, **France Travail + Adzuna**
make the biggest difference.

LinkedIn, Indeed and Welcome to the Jungle have no public API (and forbid scraping). The "Search every big platform"
section links to them and to the France Travail website, with the role, city, distance and contract already
filled in.

## How the score works (0–100)

1. **Skills (45%)**: share of the skills the offer asks for that are in your profile (about 150 skills,
   in English, French and German). Skills almost everyone lists (languages, Excel, soft skills) count less.
2. **Job title (25%)**: how well the offer title fits your target role — same words, or the same job family
   (15 families in `public/js/roles.js`: marketing, data, software, sales, finance, consulting, HR, hospitality…).
   Generic words like "analyst" or "manager" count less than field words like "finance".
3. **Text match (18%)**: TF-IDF similarity between your CV and the full offer.
4. **Experience (12%)**: years asked in the offer vs years found in your CV.

Two multipliers then apply: a big experience gap lowers the whole score (senior roles sink for students), and so
does a title outside your field. With **Only offers matching my role** (on by default) those offers are hidden.

The target role is pre-filled from the CV as a job title ("Data analyst"), never as a degree ("MSc student"),
with up to 3 one-click suggestions. Remote offers restricted to other countries (e.g. "US only") are hidden.

**Measuring quality:** with the server running, `npm run eval` searches 5 roles and counts how many of the top 10
titles really belong to the role (`REALISTIC=1 npm run eval` uses the CV-guessed role and a 50 km radius around Paris).

## Project layout

```
server.js            web server + /api/search (aggregates sources, caches 20 min) + /api/geocode
lib/sources.js       one connector per job board, all returning the same job shape
lib/geo.js           geocoding (Open-Meteo, free) to place offers on the map
public/index.html    the page
public/styles.css    design (tokens for light and dark mode)
public/js/app.js     UI logic
public/js/cv.js      CV reading (pdf.js, mammoth) and experience estimate
public/js/skills.js  skills dictionary
public/js/contracts.js  contract type detection
public/js/match.js   scoring
public/js/crowd.js   landing crowd animation (port of Skiper UI "Skiper39")
public/js/roles.js   job families: role suggestions + "does this title fit the role"
public/js/scrollfx.js  boxes and section titles tilt in on scroll (port of Aceternity ContainerScroll)
react/components/ui/ original React version of Skiper39, for a future Next.js + shadcn version
```

## About the crowd animation (Skiper39)

The landing page uses the Skiper UI **Skiper39 / CrowdCanvas** component. This project is plain HTML/CSS/JS, so
it runs as a straight port in `public/js/crowd.js` (same GSAP logic; it also pauses when off screen, respects
"reduce motion" and inverts colours in dark mode). Attribution to Skiper UI, the original CodePen and Open Peeps
is kept in the code (`crowd.js` header and an HTML comment in the footer), as the free licence requires.

### Moving to React + shadcn later

The original component is kept in `react/components/ui/skiper39.tsx`. It needs a project with **shadcn's
structure, Tailwind CSS and TypeScript**:

```bash
npx create-next-app@latest matchboard-next --typescript --tailwind --eslint --app
cd matchboard-next
npx shadcn@latest init
npm install gsap
```

Then copy `react/components/ui/skiper39.tsx` to `components/ui/skiper39.tsx` and use it as in `demo.tsx`.

Why `components/ui`: the shadcn CLI installs every UI primitive there and the `@/components/ui/...` import
alias in `components.json` points to it. Keeping third-party UI blocks in the same folder means imports like
`@/components/ui/skiper39` work out of the box, and app-specific components (in `components/`) stay apart
from reusable building blocks.
