import serverless from "serverless-http";
import { createApp } from "../../server/app";
import { ensureFreshDseData } from "../../server/services/serverlessFreshness";

const app = createApp();
const serverlessHandler = serverless(app);

export const handler: any = async (event: any, context: any) => {
  const originalPath = event.path || "";

  if (originalPath.startsWith("/.netlify/functions/api/")) {
    event.path = "/api/" + originalPath.replace("/.netlify/functions/api/", "");
  } else if (originalPath === "/.netlify/functions/api") {
    event.path = "/api";
  }

  await ensureFreshDseData();
  return serverlessHandler(event, context);
};
