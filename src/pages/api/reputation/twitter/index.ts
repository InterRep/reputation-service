import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import { withSentry } from "@sentry/nextjs";
import TwitterAccountController from "src/controllers/TwitterAccountController";
import { dbConnect } from "src/utils/server/database";

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  await dbConnect();

  if (req.method === "GET") {
    return TwitterAccountController.getTwitterReputation(req, res);
  } else {
    res.status(405).end();
  }
};

export default withSentry(handler as NextApiHandler);
