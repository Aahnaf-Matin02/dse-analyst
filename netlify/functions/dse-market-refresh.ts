import { defaultDseSyncService } from "../../server/services/dse/dseSyncService";

export const config = {
  schedule: "*/30 4-9 * * 0-4" // Trading hours: 10:00 - 15:00 BST (04:00 - 09:00 UTC), Sunday to Thursday
};

export default async function handler(req: Request) {
  try {
    const syncResult = await defaultDseSyncService.syncAll();

    return new Response(JSON.stringify({
      success: syncResult.success,
      recordsDiscovered: syncResult.recordsDiscovered,
      recordsUpdated: syncResult.recordsUpdated,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({
      success: false,
      error: `Intraday refresh failed: ${err.message}`
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
