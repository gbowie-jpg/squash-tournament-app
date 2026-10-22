import { redirect } from 'next/navigation';

// Old placeholder page — the league now lives at /league.
export default function WinterLeaguePage() {
  redirect('/league');
}
