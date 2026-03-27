import SiteNav from '@/components/layout/SiteNav';
import SiteFooter from '@/components/layout/SiteFooter';

export const metadata = { title: 'Donate — Seattle Squash' };

export default function DonatePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteNav />

      <main className="flex-1 bg-zinc-50">
        <div className="bg-gradient-to-r from-[#1a2332] to-[#2271b1] text-white py-14">
          <div className="max-w-4xl mx-auto px-4">
            <h1 className="text-3xl font-bold text-white">Support Seattle Squash</h1>
            <p className="text-blue-200 mt-2">Your donations help grow squash in the Pacific Northwest.</p>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-10">
          <div className="bg-white rounded-xl border border-zinc-200 p-8 mb-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">💚</span>
            </div>
            <h2 className="text-xl font-semibold mb-3">Make a Difference</h2>
            <p className="text-zinc-700 leading-relaxed max-w-lg mx-auto mb-6">
              The Seattle Squash Racquets Association is a non-profit organization. Your tax-deductible donation directly supports junior programs, coaching, Howe Cup teams, and community squash events.
            </p>
            <a
              href="https://seattlesquash.com/donate"
              className="inline-block bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
            >
              Donate Now
            </a>
            <p className="text-zinc-500 text-xs mt-3">You&apos;ll be redirected to our secure donation page.</p>
          </div>

          <h2 className="text-lg font-semibold mb-4">Where Your Donation Goes</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-zinc-200 p-5 text-center">
              <span className="text-2xl">🎾</span>
              <h3 className="font-medium mt-2 mb-1">Junior Programs</h3>
              <p className="text-zinc-600 text-xs">Coaching, equipment, and court time for young players.</p>
            </div>
            <div className="bg-white rounded-xl border border-zinc-200 p-5 text-center">
              <span className="text-2xl">🏆</span>
              <h3 className="font-medium mt-2 mb-1">Howe Cup Teams</h3>
              <p className="text-zinc-600 text-xs">Travel and entry fees for national competition.</p>
            </div>
            <div className="bg-white rounded-xl border border-zinc-200 p-5 text-center">
              <span className="text-2xl">🤝</span>
              <h3 className="font-medium mt-2 mb-1">Community Events</h3>
              <p className="text-zinc-600 text-xs">Tournaments, clinics, and league operations.</p>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
