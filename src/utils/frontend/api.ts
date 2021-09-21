import { Web2Providers } from "src/models/web2Accounts/Web2Account.types"

async function sendRequest(url: string, body?: any, method = body ? "POST" : "GET"): Promise<any | null> {
    const response = await fetch(url, {
        method,
        body: JSON.stringify(body)
    })

    if (response.status !== 200 && response.status !== 201) {
        const error = await response.text()

        console.error(error || `HTTP method ${method} failed`)

        return null
    }

    try {
        const { data } = await response.json()

        return data
    } catch {
        return undefined
    }
}

export function getMyReputation({ web2Provider }: { web2Provider: Web2Providers }): Promise<any | null> {
    return sendRequest(`/api/reputation/${web2Provider}`)
}

export function getReputation({
    web2Provider,
    username
}: {
    web2Provider: Web2Providers
    username: string
}): Promise<any | null> {
    return sendRequest(`/api/reputation/${web2Provider}/${username}`)
}

export function getMyTokens({ ownerAddress }: { ownerAddress: string }): Promise<any | null> {
    return sendRequest(`/api/tokens/?owner=${ownerAddress}`)
}

export function getGroup({ groupId }: { groupId: string }): Promise<any | null> {
    return sendRequest(`/api/groups/${groupId}`)
}

export async function checkLink(): Promise<boolean | null> {
    return sendRequest("/api/linking/check")
}

export async function checkGroup(): Promise<boolean | null> {
    return sendRequest(`/api/groups/check`)
}

export async function checkIdentityCommitment({
    groupId,
    identityCommitment
}: {
    groupId: string
    identityCommitment: string
}): Promise<boolean | null> {
    return sendRequest(`/api/groups/${groupId}/${identityCommitment}/check`)
}

export function mintToken({ tokenId }: { tokenId: string }): Promise<any | null> {
    return sendRequest("/api/tokens/mint", { tokenId })
}

export function addIdentityCommitment({
    groupId,
    identityCommitment,
    web2AccountId
}: {
    groupId: string
    identityCommitment: string
    web2AccountId: string
}): Promise<any | null> {
    return sendRequest(`/api/groups/${groupId}/${identityCommitment}`, {
        web2AccountId
    })
}

export function unlinkAccounts({ decryptedAttestation }: { decryptedAttestation: string }): Promise<any | null> {
    return sendRequest("/api/linking/unlink", { decryptedAttestation })
}

export function linkAccounts({
    chainId,
    address,
    web2AccountId,
    userSignature,
    userPublicKey
}: {
    chainId: number
    address: string
    web2AccountId: string
    userSignature: string
    userPublicKey: string
}): Promise<any | null> {
    return sendRequest(
        "/api/linking/link",
        {
            chainId,
            address,
            web2AccountId,
            userSignature,
            userPublicKey
        },
        "PUT"
    )
}
