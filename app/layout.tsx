import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Syne, Fraunces } from 'next/font/google';
import './globals.css';

const syneFont = Syne({
  weight: ['700', '800'],
  variable: '--font-syne',
  subsets: ['latin'],
});

const plusJakartaSansFont = Plus_Jakarta_Sans({
  weight: ['400', '500', '600', '700'],
  variable: '--font-plus-jakarta-sans',
  subsets: ['latin'],
});

const frauncessFont = Fraunces({
  weight: ['400', '700'],
  variable: '--font-fraunces',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Village | Your Homeschool Community',
  description: 'A handcrafted space for homeschool families to coordinate, share resources, and grow together.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${syneFont.variable} ${plusJakartaSansFont.variable} ${frauncessFont.variable}`}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
