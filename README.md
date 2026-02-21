# ShobdoNet — Bengali Lexical Search

A powerful, real-time Bengali word search app built with Next.js 14, searching directly from the `ben.xml` WordNet file — no database, no backend.

---

## 📁 Project Structure

```
shobdonet/
├── public/
│   └── ben.xml
├── src/
│   └── app/
│       ├── layout.tsx
│       ├── loading.tsx
│       └── page.tsx
├── package.json
├── next.config.mjs
└── tsconfig.json
```

---

## 🚀 How to Run Locally

### 1. Create the Next.js project structure

```bash
mkdir shobdonet
cd shobdonet
```

Copy all the provided files into the structure above.

### 2. Place ben.xml in /public

```bash
# Copy your ben.xml into the public folder
cp /path/to/ben.xml public/ben.xml
```

> ⚠️ This is critical — the app fetches `/ben.xml` at runtime from the public directory.

### 3. Install dependencies

```bash
npm install
```

### 4. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🏗️ Build for Production

```bash
npm run build
npm start
```

---

## ☁️ Deploy to Vercel (Recommended)

### Option A: Vercel CLI

```bash
npm install -g vercel
vercel
```

Follow the prompts. Vercel auto-detects Next.js.

> ⚠️ **Important**: `ben.xml` must be in the `public/` folder and committed to your Git repo. Vercel serves the `public/` folder as static assets.

### Option B: Vercel Dashboard

1. Push your project to GitHub (include `public/ben.xml`).
2. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub.
3. Vercel auto-detects Next.js — click **Deploy**.

---

## ☁️ Deploy to Netlify

### Option A: Netlify CLI

```bash
npm install -g netlify-cli
npm run build
netlify deploy --dir=.next --prod
```

### Option B: Netlify Dashboard (Recommended for Next.js)

1. Push your project to GitHub (include `public/ben.xml`).
2. Go to [netlify.com](https://netlify.com) → New Site → Import from Git.
3. Set build command: `npm run build`
4. Set publish directory: `.next`
5. Add environment variable (if needed): none required.
6. Click **Deploy Site**.

> For Netlify with Next.js 14, install the Netlify Next.js plugin:
> ```bash
> npm install @netlify/plugin-nextjs
> ```
> Create `netlify.toml`:
> ```toml
> [build]
>   command = "npm run build"
>   publish = ".next"
> 
> [[plugins]]
>   package = "@netlify/plugin-nextjs"
> ```

---

## ⚙️ Customization

In `page.tsx`, you can easily change these constants at the top:

```ts
const DEFAULT_PAGE_SIZE = 15;          // Default rows per page
const PAGE_SIZE_OPTIONS = [15, 20, 30, 50];  // Dropdown options
```

---

## 🎨 Features

- ⚡ Real-time search with 350ms debounce
- 🌙 Dark / ☀️ Light mode toggle
- 📖 Synset cards with definitions, relations, ILI
- 🔢 Dynamic pagination (choose 15/20/30/50 rows)
- ↺ Reset pagination to default
- ◀ ▶ Previous/Next with disabled states
- 🎆 Particle canvas background
- 💀 Skeleton loading animation
- 📱 Fully responsive design