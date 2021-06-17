import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import { withSentry } from "@sentry/nextjs";
import TokenController from "src/controllers/TokenController";
import { ITokenDocument } from "src/models/tokens/Token.types";
import { dbConnect } from "src/utils/server/database";

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse
): Promise<{ tokens: Partial<ITokenDocument[]> } | void> => {
  await dbConnect();

  if (req.method !== "GET") {
    return res.status(405).end();
  } else {
    return TokenController.getTokenByContractAndId(req, res);
  }
};

export default withSentry(handler as NextApiHandler);
