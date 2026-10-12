import { FogEntry, PeerState, RegionId, TerritoryConfig } from './types.js';

export const FOG_DISCLAIMER =
  'Fog means no recent information from this region. It does not mean nothing is happening there.';

/**
 * Computes Fog of Information entries for the map based on viewing region's reachability state.
 */
export function computeFog(
  viewingRegion: RegionId,
  peers: PeerState[],
  territories: TerritoryConfig[],
  now: number,
  fogThresholdMs = 5000,
  fogMaxRampMs = 30000
): FogEntry[] {
  const peerMap = new Map(peers.map(p => [p.region, p]));
  const fogEntries: FogEntry[] = [];

  for (const t of territories) {
    if (t.region === viewingRegion) {
      // Local territory is never in fog
      continue;
    }

    const peer = peerMap.get(t.region);
    const reachable = peer ? peer.reachable : false;
    const lastContactAt = peer ? peer.lastContactAt : 0;
    const lastKnownSeq = peer ? peer.lastKnownSeq : 0;

    const timeSinceContact = now - lastContactAt;

    if (!reachable || timeSinceContact > fogThresholdMs) {
      // Unreachable! Calculate ramped intensity from 0.3 to 0.85
      const elapsedSinceThreshold = Math.max(0, timeSinceContact - fogThresholdMs);
      const rampRatio = Math.min(1.0, elapsedSinceThreshold / fogMaxRampMs);
      const intensity = 0.3 + rampRatio * 0.55;

      const minsAgo = Math.floor(timeSinceContact / 60000);
      const secsAgo = Math.floor((timeSinceContact % 60000) / 1000);
      const timeStr = minsAgo > 0 ? `${minsAgo}m ${secsAgo}s` : `${secsAgo}s`;

      fogEntries.push({
        region: t.region,
        unreachable: true,
        lastContactAt,
        lastKnownSeq,
        fogIntensity: intensity,
        hatchPattern: true,
        legendText: `Fog: ${t.region} unreachable · last heard ${timeStr} ago · last known seq ${lastKnownSeq}`
      });
    }
  }

  return fogEntries;
}
