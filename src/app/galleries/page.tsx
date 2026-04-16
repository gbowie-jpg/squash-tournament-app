import SiteNav from '@/components/layout/SiteNav';
import SiteFooter from '@/components/layout/SiteFooter';

export const metadata = { title: 'Galleries — Seattle Squash' };

export default function GalleriesPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteNav />

      <main className="flex-1 bg-surface">
        <div className="bg-gradient-to-r from-[#1a2332] to-[#2271b1] text-white py-14">
          <div className="max-w-4xl mx-auto px-4">
            <h1 className="text-3xl font-bold text-white">Galleries</h1>
            <p className="text-blue-200 mt-2">Photos and memories from Seattle Squash events.</p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-10">
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-surface rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">📸</span>
            </div>
            <h2 className="text-xl font-semibold mb-2">Photo Gallery Coming Soon</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              We&apos;re building a photo gallery to showcase highlights from tournaments, league nights, and community events. Check back soon!
            </p>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
