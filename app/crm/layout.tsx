import '../globals.css';
import { IBM_Plex_Sans, Sora } from 'next/font/google';

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-display'
});

const plex = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-body'
});

export const metadata = {
  title: 'SersweAI CRM',
  description: 'Solo outreach CRM'
};

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${sora.variable} ${plex.variable}`}>{children}</div>;
}
