import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next"
import { withSentry } from "@sentry/nextjs"
import { dbConnect } from "src/utils/backend/database"
import logger from "src/utils/backend/logger"
import { getGroups } from "src/core/groups"

const handler = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    await dbConnect()

    if (req.method !== "GET") {
        return res.status(405).end()
    }

    try {
        const groups = await getGroups()

        return res.status(200).send({ data: groups })
    } catch (error) {
        logger.error(error)

        return res.status(500).end()
    }
}

export default withSentry(handler as NextApiHandler)
