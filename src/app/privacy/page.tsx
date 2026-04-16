import SiteNav from '@/components/layout/SiteNav';
import SiteFooter from '@/components/layout/SiteFooter';

export const metadata = { title: 'Privacy Policy — Seattle Squash' };

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteNav />

      <main className="flex-1 bg-surface">
        <div className="bg-[#1a2332] text-white py-10">
          <div className="max-w-3xl mx-auto px-4">
            <h1 className="text-2xl font-bold text-white">Privacy Policy</h1>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-10">
          <div className="bg-card rounded-xl border border-border p-8 prose prose-zinc max-w-none">
            <p className="text-foreground leading-relaxed mb-4">
              Seattle Squash Racquets Association respects your privacy. This policy explains how we collect and use information through our Tournament Companion app.
            </p>
            <h2 className="text-lg font-semibold mt-6 mb-2">Information We Collect</h2>
            <p className="text-foreground leading-relaxed mb-4">
              When you create an account or register for a tournament, we may collect your name, email address, phone number, and club affiliation. Tournament scores and match results are recorded as part of the service.
            </p>
            <h2 className="text-lg font-semibold mt-6 mb-2">How We Use It</h2>
            <p className="text-foreground leading-relaxed mb-4">
              Your information is used to manage tournament operations, display draws and scores, and communicate event updates. We do not sell your personal information to third parties.
            </p>
            <h2 className="text-lg font-semibold mt-6 mb-2">Data Storage</h2>
            <p className="text-foreground leading-relaxed mb-4">
              Data is stored securely using Supabase (hosted on AWS). Access is restricted to authorized administrators and tournament organizers.
            </p>
            <h2 className="text-lg font-semibold mt-6 mb-2">Your Rights</h2>
            <p className="text-foreground leading-relaxed mb-4">
              You may request to view, update, or delete your personal data at any time by contacting us.
            </p>
            <h2 className="text-lg font-semibold mt-6 mb-2">Contact</h2>
            <p className="text-foreground leading-relaxed">
              For privacy inquiries, email{' '}
              <a href="mailto:president@seattlesquash.com" className="text-blue-600 hover:text-blue-700">president@seattlesquash.com</a>.
            </p>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
