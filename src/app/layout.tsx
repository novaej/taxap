import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'taxap — IVA Automation',
  description: 'Calculate IVA declaration values in minutes, not days.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
