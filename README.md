# 🌿 ShobdoNet — Bengali Lexical Search

<div align="center">

**A powerful, real-time Bengali word search engine built on the UKC Bengali WordNet.**

[![Live Demo](https://img.shields.io/badge/🌐%20Live%20Demo-shobdonet.netlify.app-4a7c3f?style=for-the-badge)](https://shobdonet.netlify.app/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Netlify](https://img.shields.io/badge/Deployed_on-Netlify-00C7B7?style=for-the-badge&logo=netlify)](https://shobdonet.netlify.app/)

</div>

---

## 🔗 Live Site

> **[https://shobdonet.netlify.app/](https://shobdonet.netlify.app/)**

---

## 📖 About

**ShobdoNet** (শব্দনেট) is a client-side Bengali lexical search application. It allows users to search any Bengali word and instantly explore all associated **synsets**, **definitions**, **Part of Speech**, **Sense IDs**, **ILI codes**, and **lexical relations** — all sourced directly from the UKC Bengali WordNet (`ben.xml`).

> No database. No backend. No API calls. Pure XML + Next.js.

---

## ✨ Features

| Feature | Details |
|---|---|
| ⚡ **Real-time Search** | 350ms debounced search across all `writtenForm` entries |
| 📚 **Full Synset Details** | Synset ID, Sense ID, ILI, Part of Speech, Definition, Relations |
| 🔗 **Lexical Relations** | Hypernym, Hyponym, Meronym, Holonym, Antonym, and more |
| 🎨 **3 Theme Modes** | Light ☀️ · Forest 🌿 · Dark 🌑 — all olive-green palette |
| 📄 **Smart Pagination** | Default 15 rows · options 20 / 30 / 50 · First / Prev / Next / Last |
| ↺ **Pagination Reset** | One-click reset back to default page size |
| 💀 **Skeleton Loading** | Animated shimmer cards while XML parses |
| 📱 **Fully Responsive** | Works on mobile, tablet, and desktop |
| 🌾 **Zero Backend** | Reads directly from `ben.xml` in `/public` — deploy anywhere |

---

## 📁 Project Structure

```
shobdonet/
├── public/
│   └── ben.xml                  ← Bengali WordNet XML (place here)
├── src/
│   └── app/
│       ├── layout.tsx           ← Root layout + metadata
│       ├── loading.tsx          ← Next.js loading UI
│       └── page.tsx             ← Main page (all logic + UI)
├── package.json
├── next.config.mjs
├── tsconfig.json
└── README.md
```

---

## 🚀 Getting Started Locally

### Prerequisites

- Node.js **18+**
- npm or yarn

### 1. Clone or download the project

```bash
git clone https://github.com/YOUR_USERNAME/shobdonet.git
cd shobdonet
```

### 2. Place `ben.xml` in `/public`

```bash
cp /path/to/ben.xml public/ben.xml
```

> ⚠️ **Critical** — The app fetches `/ben.xml` as a static asset at runtime. Without this file, search will not work.

### 3. Install dependencies

```bash
npm install
```

### 4. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Build for production

```bash
npm run build
npm start
```

---

## ☁️ Deployment

### Netlify (Current Host)

The project is live at **[https://shobdonet.netlify.app/](https://shobdonet.netlify.app/)**.

#### Deploy via Netlify Dashboard

1. Push your project to **GitHub** (make sure `public/ben.xml` is committed).
2. Go to [netlify.com](https://netlify.com) → **Add new site** → **Import an existing project**.
3. Connect your GitHub repo.
4. Set build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `.next`
5. Install the Netlify Next.js plugin (if not already):
   ```bash
   npm install @netlify/plugin-nextjs
   ```
6. Add `netlify.toml` to project root:
   ```toml
   [build]
     command = "npm run build"
     publish = ".next"

   [[plugins]]
     package = "@netlify/plugin-nextjs"
   ```
7. Click **Deploy Site**.

#### Deploy via Netlify CLI

```bash
npm install -g netlify-cli
netlify login
netlify init
npm run build
netlify deploy --prod
```

---

### Vercel (Alternative)

```bash
npm install -g vercel
vercel
```

Or push to GitHub and import at [vercel.com](https://vercel.com) — Next.js is auto-detected.

> ⚠️ Make sure `public/ben.xml` is committed to your repo before deploying to either platform.

---

## ⚙️ Configuration

All configurable constants are at the top of `src/app/page.tsx`:

```ts
// Pagination defaults — change these freely
const DEFAULT_PAGE_SIZE = 15;
const PAGE_SIZE_OPTIONS = [15, 20, 30, 50];

// Default theme on load: "light" | "dark" | "forest"
const [theme, setTheme] = useState<ThemeMode>("light");
```

---

## 🎨 Theme System

All three themes are derived from the base olive color `rgb(87, 97, 57)`:

| Mode | Background | Accent | Feel |
|---|---|---|---|
| ☀️ **Light** | `#f4f3ec` warm parchment | `#576139` deep olive | Editorial, readable |
| 🌿 **Forest** | `#192210` deep green | `#a8c870` bright sage | Lush, immersive |
| 🌑 **Dark** | `#0f110c` near-black | `#8fa85a` muted olive | Moody, focused |

---

## 🗂️ Data Source

The lexical data comes from the **UKC Bengali Lexicon v1.0** (`ben.xml`):

- **Source:** IndoWordNet by IIT Mumbai + Wiktionary + CogNet
- **Language:** Bengali (`ben`)
- **License:** [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)
- **Publisher:** KnowDive — University of Trento
- **Contact:** gabor.bella@unitn.it

> This project uses the dataset for educational/research purposes under the CC BY-NC-SA 4.0 license.

---

## 🛠️ Tech Stack

- **Framework:** [Next.js 14](https://nextjs.org/) (App Router)
- **Language:** TypeScript 5
- **Styling:** Inline CSS-in-JS (no external CSS framework)
- **Fonts:** Cinzel · Noto Sans Bengali · JetBrains Mono (Google Fonts)
- **XML Parsing:** Browser-native `DOMParser`
- **Hosting:** [Netlify](https://netlify.com)

---

## 📜 License

This project's **code** is open source. The **data** (`ben.xml`) is licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) by the University of Trento / KnowDive group.

---

<div align="center">
  Made with 🌿 for the Bengali language community
</div>