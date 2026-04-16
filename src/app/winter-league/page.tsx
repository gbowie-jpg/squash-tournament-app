import SiteNav from '@/components/layout/SiteNav';
import SiteFooter from '@/components/layout/SiteFooter';

export const metadata = { title: 'Winter League — Seattle Squash' };

export default function WinterLeaguePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteNav />

      <main className="flex-1 bg-background">
        <div className="bg-gradient-to-r from-[#1a2332] to-[#2271b1] text-white py-14">
          <div className="max-w-4xl mx-auto px-4">
            <h1 className="text-3xl font-bold">Winter League</h1>
            <p className="text-blue-200 mt-2">Tuesday night league matches, November through March.</p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-10">
          <div className="bg-card rounded-xl border border-border p-8 mb-8">
            <h2 className="text-xl font-semibold mb-4">About the Winter League</h2>
            <p className="text-foreground leading-relaxed mb-4">
              The SSRA Winter League is a long-standing tradition bringing together squash players from clubs across the Seattle area for competitive Tuesday night matches from November through March.
            </p>
            <p className="text-foreground leading-relaxed mb-4">
              Teams are organized by club and skill level. Players compete in a round-robin format over the season, with standings updated weekly.
            </p>
            <p className="text-foreground leading-relaxed">
              The league is a great way to meet new players, get regular competitive matches, and represent your club.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-card rounded-xl border border-border p-6 text-center">
              <p className="text-3xl font-bold text-blue-600">Nov-Mar</p>
              <p className="text-muted-foreground text-sm mt-2">Season</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-6 text-center">
              <p className="text-3xl font-bold text-blue-600">Tuesdays</p>
              <p className="text-muted-foreground text-sm mt-2">Match Night</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-6 text-center">
              <p className="text-3xl font-bold text-blue-600">6+ Clubs</p>
              <p className="text-muted-foreground text-sm mt-2">Participating</p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h3 className="font-semibold text-blue-900 mb-2">Interested in joining?</h3>
            <p className="text-blue-800 text-sm">
              Contact your club captain or reach out to us at{' '}
              <a href="mailto:president@seattlesquash.com" className="underline font-medium">president@seattlesquash.com</a>
              {' '}to get on a team for next season.
            </p>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
