/**
 * Google Publisher Tag (GPT) rewarded-ad provider — SKELETON (Day 6, ADR-009).
 *
 * STATUS: not active. Requires:
 *   1. Google Ad Manager account approval (needs a live public site
 *      with content — pending Vercel production deployment + review).
 *   2. A rewarded ad unit path (looks like '/1234567/styleme-rewarded').
 *   3. NEXT_PUBLIC_AD_PROVIDER=gpt.
 *
 * When those land, the TODOs below become real code. The interface is
 * already final — WatchAdButton consumes `showRewardedAd()` and doesn't
 * care which provider fulfils it.
 *
 * GPT rewarded flow reference (for future implementation):
 *   googletag.defineOutOfPageSlot(AD_UNIT_PATH, googletag.enums.OutOfPageFormat.REWARDED)
 *   → 'rewardedSlotReady'   event → slot.makeRewardedVisible()
 *   → 'rewardedSlotGranted' event → resolve('granted')
 *   → 'rewardedSlotClosed'  event → resolve('dismissed') if not granted
 *
 * IMPORTANT: the granted event is CLIENT-side only. Server-side protection
 * comes entirely from the nonce contour (min watch time, daily cap,
 * atomic burn) — see apps/api/src/lib/ad-session.ts.
 */

export type AdShowResult = 'granted' | 'dismissed' | 'error';

// TODO(Day 6+, after Ad Manager approval): replace with the real ad unit path.
// const AD_UNIT_PATH = '/XXXXXXXX/styleme-rewarded';

export async function showGptRewardedAd(): Promise<AdShowResult> {
  // TODO(Day 6+): implement per the reference flow above:
  //   1. Lazy-load the GPT script (https://securepubads.g.doubleclick.net/tag/js/gpt.js)
  //   2. defineOutOfPageSlot with REWARDED format; bail with 'error' if the
  //      browser/environment doesn't support it (slot === null).
  //   3. Wire rewardedSlotReady / rewardedSlotGranted / rewardedSlotClosed.
  //   4. Resolve the promise from the event handlers; always destroySlots()
  //      in a finally.
  // eslint-disable-next-line no-console
  console.warn('[gpt-provider] GPT rewarded ads are not configured yet.');
  return 'error';
}
