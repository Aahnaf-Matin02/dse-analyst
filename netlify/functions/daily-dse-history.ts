import { captureDailyDseSnapshot } from "../../server/services/dseSnapshotService";
import { defaultDseSyncService } from "../../server/services/dse/dseSyncService";

export const config = {
  schedule: "30 10 * * 0-4" // Bangla trading days: Sunday to Thursday after market sessions
};

export default async function handler(req: Request) {
  try {
    // 1. Run complete DSE universe and market data synchronization
    const syncResult = await defaultDseSyncService.syncAll();

    // 2. Capture EOD snapshot
    const result = await captureDailyDseSnapshot({
      snapshotType: "EOD",
      force: false
    });

    return new Response(JSON.stringify({
      sync: syncResult,
      snapshot: result
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({
      success: false,
      error: `Netlify trigger failed: ${err.message}`
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
