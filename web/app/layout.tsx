import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'METAMORPH',
  description: 'Transformation-maximizing AI interface',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
