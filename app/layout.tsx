import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SersweAI | AI Automation Agency — San Diego',
  description: 'Custom AI automation for small businesses. Lead capture, workflow automation, content creation, and more. Save 150+ hours per year.',
  keywords: [
    'AI automation agency',
    'AI automation San Diego',
    'business automation',
    'workflow automation',
    'lead generation automation',
    'AI for small business',
    'automated lead capture',
    'AI content creation',
    'CRM automation',
    'email automation',
    'AI agency San Diego',
    'small business AI',
    'marketing automation',
    'AI workflow builder',
    'SersweAI',
  ],
  metadataBase: new URL('https://sersweai.com'),
  alternates: {
    canonical: 'https://sersweai.com',
  },
  openGraph: {
    title: 'SersweAI | AI Automation Agency',
    description: 'Intelligent systems that work 24/7 so you don\'t have to. Custom automation for lead gen, workflows, and content.',
    url: 'https://sersweai.com',
    siteName: 'SersweAI',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
