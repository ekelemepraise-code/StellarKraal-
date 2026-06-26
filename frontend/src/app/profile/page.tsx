'use client';
import { useState } from 'react';
import { useWallet } from '@/hooks/useWallet';

export function buildReferralUrl(walletAddress: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}/register?ref=${walletAddress}`;
}

export default function ProfilePage() {
  const { address } = useWallet();
  const [copied, setCopied] = useState(false);

  async function copyInviteLink() {
    if (!address) return;
    const url = buildReferralUrl(address);
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-brown mb-6">Profile</h1>

      <section
        aria-labelledby="referral-heading"
        className="rounded-2xl border border-brown-200 p-6 space-y-3"
      >
        <h2 id="referral-heading" className="text-lg font-semibold text-brown-700">
          Refer a Friend
        </h2>
        <p className="text-sm text-brown-500">
          Share your invite link and earn rewards when your referrals register.
        </p>
        {address ? (
          <>
            <p className="text-xs font-mono break-all text-brown-600 bg-cream-200 rounded-lg px-3 py-2">
              {buildReferralUrl(address)}
            </p>
            <button
              type="button"
              onClick={copyInviteLink}
              className="rounded-xl bg-brown-600 px-5 py-2.5 text-sm font-semibold text-cream-50 hover:bg-brown-700 transition focus:outline-none focus:ring-2 focus:ring-brown-600 focus:ring-offset-2"
            >
              {copied ? 'Copied!' : 'Copy Invite Link'}
            </button>
          </>
        ) : (
          <p className="text-sm text-brown-400">Connect your wallet to get your invite link.</p>
        )}
      </section>
    </main>
  );
}
