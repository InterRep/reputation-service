import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import { withSentry } from "@sentry/nextjs";
import { getSession } from "next-auth/client";
import Web2Account from "src/models/web2Accounts/Web2Account.model";
import { dbConnect } from "src/utils/server/database";
import logger from "src/utils/server/logger";

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse
): Promise<{ isLinkedToAddress: boolean } | void | { error: string }> => {
  await dbConnect();

  if (req.method !== "GET") {
    return res.status(405).end();
  }
  try {
    const session = await getSession({ req });
    if (!session) {
      return res.status(401).end();
    }

    const web2Account = await Web2Account.findById(session.web2AccountId);

    if (!web2Account) {
      return res.status(500).send({ error: "Can't find web 2 account" });
    }

    return res
      .status(200)
      .send({ isLinkedToAddress: web2Account.isLinkedToAddress });
  } catch (err) {
    logger.error(err);
    return res
      .status(500)
      .send({ error: "Error while verifying if web 2 account is linked" });
  }
};

export default withSentry(handler as NextApiHandler);
