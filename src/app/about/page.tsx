import SiteNav from '@/components/layout/SiteNav';
import SiteFooter from '@/components/layout/SiteFooter';
import Link from 'next/link';

export const metadata = { title: 'About — Seattle Squash' };

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteNav />

      <main className="flex-1 bg-background">
        <div className="bg-gradient-to-r from-[#1a2332] to-[#2271b1] text-white py-14">
          <div className="max-w-4xl mx-auto px-4">
            <h1 className="text-3xl font-bold">About Seattle Squash</h1>
            <p className="text-blue-200 mt-2">Over 70 years of squash in the Pacific Northwest.</p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-10">
          <div className="bg-card rounded-xl border border-border p-8 mb-8">
            <h2 className="text-xl font-semibold mb-4">Our Story</h2>
            <p className="text-foreground leading-relaxed mb-4">
              Welcome to Seattle Squash, also known as the Seattle Squash Racquets Association (SSRA). We are a non-profit corporation with an over 70-year legacy of growing and supporting squash in the Pacific Northwest.
            </p>
            <p className="text-foreground leading-relaxed mb-4">
              Our mission is to promote the sport of squash at all levels — from beginners picking up a racquet for the first time to competitive players representing our region at national events.
            </p>
            <p className="text-foreground leading-relaxed">
              Through tournaments, leagues, junior programs, and community events, we bring together players of all ages and abilities to share in the sport we love.
            </p>
          </div>

          <h2 className="text-xl font-semibold mb-4">What We Do</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="font-semibold text-lg mb-2">Tournaments</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                We organize and host major tournaments including the Washington State Open (October) and Seattle City Championships (April/May).
              </p>
            </div>
            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="font-semibold text-lg mb-2">Winter League</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Tuesday night inter-club matches from November through March, bringing together teams from across the region.
              </p>
            </div>
            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="font-semibold text-lg mb-2">Junior Development</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Supporting youth squash through coaching programs, the Junior Scholar Athlete Award, and pathway opportunities.
              </p>
            </div>
            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="font-semibold text-lg mb-2">Howe Cup</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Funding and supporting teams that represent Seattle at the national Howe Cup women&apos;s team championship.
              </p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h3 className="font-semibold text-blue-900 mb-2">Get Involved</h3>
            <p className="text-blue-800 text-sm mb-3">
              Whether you want to play, volunteer, or support squash in Seattle, we&apos;d love to hear from you.
            </p>
            <Link href="/contact" className="inline-block bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              Contact Us
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
