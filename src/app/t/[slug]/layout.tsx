import { SponsorSplashGate } from '@/components/sponsors/SponsorSplashGate';

export default function TournamentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  return (
    <>
      <SponsorSplashGate params={params} />
      {children}
    </>
  );
}
