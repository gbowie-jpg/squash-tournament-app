import SiteNav from '@/components/layout/SiteNav';
import SiteFooter from '@/components/layout/SiteFooter';

export const metadata = { title: 'Contact — Seattle Squash' };

export default function ContactPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteNav />

      <main className="flex-1 bg-background">
        <div className="bg-gradient-to-r from-[#1a2332] to-[#2271b1] text-white py-14">
          <div className="max-w-4xl mx-auto px-4">
            <h1 className="text-3xl font-bold">Contact Us</h1>
            <p className="text-blue-200 mt-2">Get in touch with the Seattle Squash community.</p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-card rounded-xl border border-border p-8">
              <h2 className="text-xl font-semibold mb-6">Reach Out</h2>
              <div className="space-y-6">
                <div>
                  <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wider mb-1">Email</h3>
                  <a href="mailto:president@seattlesquash.com" className="text-blue-600 hover:text-blue-700 font-medium">
                    president@seattlesquash.com
                  </a>
                </div>
                <div>
                  <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wider mb-1">Mailing Address</h3>
                  <p className="text-foreground">
                    Seattle Squash Racquets Association<br />
                    P.O. Box 665<br />
                    Seattle, WA 98111
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wider mb-1">Social Media</h3>
                  <div className="flex gap-4 mt-2">
                    <a href="https://facebook.com/seattlesquash" className="text-muted-foreground hover:text-blue-600 transition-colors text-sm font-medium">Facebook</a>
                    <a href="https://instagram.com/seattlesquash" className="text-muted-foreground hover:text-pink-600 transition-colors text-sm font-medium">Instagram</a>
                    <a href="https://youtube.com/@seattlesquash" className="text-muted-foreground hover:text-red-600 transition-colors text-sm font-medium">YouTube</a>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-8">
              <h2 className="text-xl font-semibold mb-6">Common Questions</h2>
              <div className="space-y-5">
                <div>
                  <h3 className="font-medium mb-1">How do I join the Winter League?</h3>
                  <p className="text-muted-foreground text-sm">Contact your local club captain or email us. Teams are organized by club each fall.</p>
                </div>
                <div>
                  <h3 className="font-medium mb-1">How do I register for a tournament?</h3>
                  <p className="text-muted-foreground text-sm">Registration is handled through this site and ClubLocker. Check the Events page for upcoming tournaments.</p>
                </div>
                <div>
                  <h3 className="font-medium mb-1">I want to volunteer or referee.</h3>
                  <p className="text-muted-foreground text-sm">Visit the Volunteer/Referee signup page on any active tournament. We always need help!</p>
                </div>
                <div>
                  <h3 className="font-medium mb-1">How can I support SSRA?</h3>
                  <p className="text-muted-foreground text-sm">Donations help fund junior programs, Howe Cup teams, and community events. Visit our Donate page.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
