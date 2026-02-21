import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ShobdoNet – Bengali Lexical Search",
  description:
    "Search the Bengali WordNet. Explore synsets, definitions, part-of-speech, and lexical relations for any Bengali word.",
  keywords: ["Bengali", "WordNet", "Bangla", "lexicon", "synset", "ShobdoNet"],
  openGraph: {
    title: "ShobdoNet – Bengali Lexical Search",
    description: "Search through thousands of Bengali words and their synset relationships.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%2300e5ff'/><text y='.9em' font-size='80' font-family='serif' fill='white'>শ</text></svg>" />
      </head>
      <body style={{ margin: 0, padding: 0, minHeight: "100vh" }}>{children}</body>
    </html>
  );
}