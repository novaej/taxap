import type { ReactNode } from 'react';
import { getLocale } from 'next-intl/server';
import './globals.css';

// The single <html>/<body> shell for the whole app, including src/app/api/*
// which must never be locale-prefixed. Per-locale text and NextIntlClientProvider
// live in src/app/[locale]/layout.tsx.
export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const locale = await getLocale();

  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
