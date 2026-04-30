import { createAdminClient } from '@/lib/supabase/admin';
import SiteNav from '@/components/layout/SiteNav';
import SiteFooter from '@/components/layout/SiteFooter';
import ScholarshipForm from './ScholarshipForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Scholarship — Seattle Squash',
  description: 'Apply for the 2026 Seattle Squash Scholarship Award. Up to $500 available for eligible junior players.',
};

export default async function ScholarshipPage() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'scholarship_open')
    .single();

  const isOpen = data?.value === 'true';

  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface)]">
      <SiteNav />

      {/* Hero */}
      <div className="bg-gradient-to-r from-[#0f172a] to-[#1e3a5f] text-white py-14">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">🏆</span>
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${
                isOpen
                  ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                  : 'bg-white/10 text-white/60 border border-white/20'
              }`}
            >
              {isOpen ? 'Applications Open' : 'Applications Closed'}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">2026 Scholarship Award</h1>
          <p className="text-blue-200 mt-2 text-lg">Seattle Squash Racquets Association</p>
        </div>
      </div>

      <main className="flex-1">
        {/* Eligibility info — always visible */}
        <div className="max-w-2xl mx-auto px-4 pt-10">
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h2 className="font-semibold text-foreground text-lg">About the Scholarship</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Seattle Squash Scholarship Award is open to all students enrolled in middle or high school
              during the <strong className="text-foreground">2025–26 academic year</strong> who are actively
              playing squash in the <strong className="text-foreground">U15, U17, or U19</strong> divisions.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-[var(--surface)] rounded-lg px-4 py-3 text-center">
                <p className="text-2xl font-bold text-foreground">$500</p>
                <p className="text-xs text-muted-foreground mt-0.5">Max Reimbursement</p>
              </div>
              <div className="bg-[var(--surface)] rounded-lg px-4 py-3 text-center">
                <p className="text-lg font-bold text-foreground">U15 · U17 · U19</p>
                <p className="text-xs text-muted-foreground mt-0.5">Eligible Divisions</p>
              </div>
              <div className="bg-[var(--surface)] rounded-lg px-4 py-3 text-center">
                <p className="text-lg font-bold text-foreground">Middle & High</p>
                <p className="text-xs text-muted-foreground mt-0.5">School Level</p>
              </div>
            </div>
            <div className="bg-[var(--surface)] rounded-lg px-4 py-3 text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground text-xs uppercase tracking-wide mb-2">Funds may be used for</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Tournament entry fees &amp; registration</li>
                <li>Squash-related travel and accommodation</li>
                <li>Coaching, clinics, and squash activities</li>
                <li>Equipment and school/education expenses</li>
              </ul>
            </div>
          </div>
        </div>

        {isOpen ? (
          <>
            <div className="max-w-2xl mx-auto px-4 pt-6">
              <div className="border-l-4 border-blue-500 pl-4 py-1">
                <p className="text-sm text-muted-foreground">
                  Complete all fields below and submit your application. You will receive a confirmation email.
                  Please also email your academic transcript to{' '}
                  <a href="mailto:president@seattlesquash.com" className="text-blue-600 dark:text-blue-400 hover:underline">
                    president@seattlesquash.com
                  </a>{' '}
                  to complete your application.
                </p>
              </div>
            </div>
            <ScholarshipForm />
          </>
        ) : (
          <div className="max-w-2xl mx-auto px-4 pt-6 pb-16">
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <div className="w-14 h-14 bg-[var(--surface)] rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                📅
              </div>
              <h2 className="text-xl font-semibold mb-2">Applications Not Yet Open</h2>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-md mx-auto mb-6">
                The 2026 Seattle Squash Scholarship application window is not currently open.
                Check back here when applications open, or contact us for more information.
              </p>
              <a
                href="mailto:president@seattlesquash.com"
                className="inline-flex items-center gap-2 bg-[#0f172a] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Contact President@SeattleSquash.com
              </a>
            </div>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
