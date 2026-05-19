import RulesAIChat from '@/components/RulesAIChat';

export default function TournamentAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <RulesAIChat />
    </>
  );
}
