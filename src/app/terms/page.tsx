import SiteNav from '@/components/layout/SiteNav';
import SiteFooter from '@/components/layout/SiteFooter';

export const metadata = { title: 'Terms & Conditions — Seattle Squash' };

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteNav />

      <main className="flex-1 bg-surface">
        <div className="bg-[#1a2332] text-white py-10">
          <div className="max-w-3xl mx-auto px-4">
            <h1 className="text-2xl font-bold text-white">Terms & Conditions</h1>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-10">
          <div className="bg-card rounded-xl border border-border p-8 prose prose-zinc max-w-none">
            <p className="text-foreground leading-relaxed mb-4">
              By accessing and using the Seattle Squash Tournament Companion app, you agree to the following terms.
            </p>
            <h2 className="text-lg font-semibold mt-6 mb-2">Use of Service</h2>
            <p className="text-foreground leading-relaxed mb-4">
              This application is provided by the Seattle Squash Racquets Association for tournament management, score tracking, and community coordination. You agree to use it for its intended purpose.
            </p>
            <h2 className="text-lg font-semibold mt-6 mb-2">Accounts</h2>
            <p className="text-foreground leading-relaxed mb-4">
              If you create an account, you are responsible for maintaining the confidentiality of your login credentials. Notify us immediately of any unauthorized use.
            </p>
            <h2 className="text-lg font-semibold mt-6 mb-2">Content</h2>
            <p className="text-foreground leading-relaxed mb-4">
              Tournament data, scores, and schedules are provided for informational purposes. While we strive for accuracy, results should be confirmed with tournament officials.
            </p>
            <h2 className="text-lg font-semibold mt-6 mb-2">Contact</h2>
            <p className="text-foreground leading-relaxed">
              Questions about these terms can be directed to{' '}
              <a href="mailto:president@seattlesquash.com" className="text-blue-600 hover:text-blue-700">president@seattlesquash.com</a>.
            </p>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
