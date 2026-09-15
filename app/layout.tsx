import type { Metadata } from 'next';
import './globals.css';
import './tan-workspace.css';

export const metadata: Metadata = {
  title: 'The Ball Handlers | Game Planner',
  description: 'A local-first basketball roster and lineup planner.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
