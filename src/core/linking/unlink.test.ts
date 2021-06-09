import { ethers } from "hardhat";
import TwitterAccount from "src/models/web2Accounts/twitter/TwitterAccount.model";
import { createTwitterAccountObject } from "src/utils/server/createNewTwitterAccount";
import {
  dropDatabaseAndDisconnect,
  clearDatabase,
  connect,
} from "src/utils/server/testDatabase";
import checkAndUpdateTokenStatus from "src/core/blockchain/ReputationBadge/checkAndUpdateTokenStatus";
import { createBackendAttestationMessage } from "../signing/createBackendAttestationMessage";
import unlinkAccounts from "./unlink";
import Token from "src/models/tokens/Token.model";
import createMockTokenObject from "src/mocks/createMockToken";
import { TokenStatus } from "src/models/tokens/Token.types";
import Web2Account from "src/models/web2Accounts/Web2Account.model";

jest.mock(
  "src/core/blockchain/ReputationBadge/checkAndUpdateTokenStatus",
  () => ({
    __esModule: true,
    default: jest.fn(),
  })
);

const createMockBackendAttestation = async ({
  providerAccountId,
  decimalId,
}: {
  providerAccountId: string;
  decimalId?: string;
}): Promise<{
  attestationMessage: string;
  backendAttestationSignature: string;
}> => {
  const [backendSigner] = await ethers.getSigners();

  const attestationMessage = createBackendAttestationMessage({
    providerAccountId,
    provider: "twitter",
    address: "0x",
    decimalId: decimalId || "573930924",
  });

  const backendAttestationSignature = await backendSigner.signMessage(
    attestationMessage
  );

  return { attestationMessage, backendAttestationSignature };
};

describe("unlink", () => {
  beforeAll(async () => {
    await connect();
  });

  afterAll(async () => await dropDatabaseAndDisconnect());

  afterEach(async () => {
    await clearDatabase();
  });

  it("should return an error if the web 2 account is not found", async () => {
    const result = await unlinkAccounts({
      web2AccountIdFromSession: "608c4a10c994a377e232df7f",
      decryptedAttestation: "attestation",
    });

    expect(result).toEqual({
      success: false,
      error: "Unable to find web2Account",
    });
  });

  it("should return an error is the account is not linked", async () => {
    const web2Account = await TwitterAccount.create(
      createTwitterAccountObject({
        isLinkedToAddress: false,
        user: { id: "id", username: "username" },
        providerAccountId: "twitter",
      })
    );

    const result = await unlinkAccounts({
      web2AccountIdFromSession: web2Account.id,
      decryptedAttestation: "attestation",
    });

    expect(result).toEqual({
      success: false,
      error: "Web 2 account is not linked",
    });
  });

  it("should return an error if the attestation has no message field", async () => {
    const web2Account = await TwitterAccount.create(
      createTwitterAccountObject({
        isLinkedToAddress: true,
        user: { id: "id", username: "username" },
        providerAccountId: "twitter",
      })
    );

    const result = await unlinkAccounts({
      web2AccountIdFromSession: web2Account.id,
      decryptedAttestation: JSON.stringify({ salt: "0xef4", message: "" }),
    });

    expect(result).toEqual({
      success: false,
      error: "Invalid attestation provided",
    });
  });

  it("should return an error if the message was not signed by the backend", async () => {
    const web2Account = await TwitterAccount.create(
      createTwitterAccountObject({
        isLinkedToAddress: true,
        user: { id: "id", username: "username" },
        providerAccountId: "twitter",
      })
    );

    const [, otherSigner] = await ethers.getSigners();

    const attestationMessage = "attestationMessage";

    const backendAttestationSignature = await otherSigner.signMessage(
      attestationMessage
    );
    const result = await unlinkAccounts({
      web2AccountIdFromSession: web2Account.id,
      decryptedAttestation: JSON.stringify({
        salt: "0x4fe",
        message: JSON.stringify({
          attestationMessage,
          backendAttestationSignature,
        }),
      }),
    });

    expect(result).toEqual({
      success: false,
      error: "Attestation signature invalid",
    });
  });

  it("should return an error if the web 2 account in the attestation does not match the one provided", async () => {
    const web2Account1 = await TwitterAccount.create(
      createTwitterAccountObject({
        isLinkedToAddress: true,
        user: { id: "id1", username: "username1" },
        providerAccountId: "id1",
      })
    );

    const web2Account2 = await TwitterAccount.create(
      createTwitterAccountObject({
        isLinkedToAddress: true,
        user: { id: "id2", username: "username2" },
        providerAccountId: "id2",
      })
    );

    const {
      attestationMessage,
      backendAttestationSignature,
    } = await createMockBackendAttestation({
      providerAccountId: web2Account1.providerAccountId,
    });

    const result = await unlinkAccounts({
      web2AccountIdFromSession: web2Account2.id,
      decryptedAttestation: JSON.stringify({
        salt: "0x4fe",
        message: JSON.stringify({
          attestationMessage,
          backendAttestationSignature,
        }),
      }),
    });

    expect(result).toEqual({
      success: false,
      error: "Web 2 accounts don't match",
    });
  });

  it("should return an error if the token in the attestation can't be found", async () => {
    const web2Account = await TwitterAccount.create(
      createTwitterAccountObject({
        isLinkedToAddress: true,
        user: { id: "id3", username: "username3" },
        providerAccountId: "id3",
      })
    );

    const {
      attestationMessage,
      backendAttestationSignature,
    } = await createMockBackendAttestation({
      providerAccountId: web2Account.providerAccountId,
    });

    const result = await unlinkAccounts({
      web2AccountIdFromSession: web2Account.id,
      decryptedAttestation: JSON.stringify({
        salt: "0x4fe",
        message: JSON.stringify({
          attestationMessage,
          backendAttestationSignature,
        }),
      }),
    });

    expect(result).toEqual({
      success: false,
      error: "Can't find token with decimalId 573930924",
    });
  });

  it("should not proceed with a token that is not burned", async () => {
    const token = await Token.create(createMockTokenObject());

    if (!token.decimalId) throw new Error("Token creation failed");

    // @ts-ignore: mocked above
    checkAndUpdateTokenStatus.mockImplementationOnce(async ([token]) => {
      token.status = "MINTED";
      await token.save();
    });

    const web2Account = await TwitterAccount.create(
      createTwitterAccountObject({
        isLinkedToAddress: true,
        user: { id: "id3", username: "username3" },
        providerAccountId: "id3",
      })
    );

    const {
      attestationMessage,
      backendAttestationSignature,
    } = await createMockBackendAttestation({
      providerAccountId: web2Account.providerAccountId,
      decimalId: token.decimalId,
    });

    const result = await unlinkAccounts({
      web2AccountIdFromSession: web2Account.id,
      decryptedAttestation: JSON.stringify({
        salt: "0x4fe",
        message: JSON.stringify({
          attestationMessage,
          backendAttestationSignature,
        }),
      }),
    });

    expect(result).toEqual({
      success: false,
      error:
        "The on-chain token associated with the web 2 account you are connected with needs to be burned first.",
    });
  });

  it("should update web 2 account and mark token as REVOKED", async () => {
    const token = await Token.create(createMockTokenObject());

    if (!token.decimalId) throw new Error("Token creation failed");

    // @ts-ignore: mocked above
    checkAndUpdateTokenStatus.mockImplementationOnce(async ([token]) => {
      token.status = "BURNED";
      await token.save();
    });

    const web2Account = await TwitterAccount.create(
      createTwitterAccountObject({
        isLinkedToAddress: true,
        user: { id: "id3", username: "username3" },
        providerAccountId: "id3",
      })
    );

    const {
      attestationMessage,
      backendAttestationSignature,
    } = await createMockBackendAttestation({
      providerAccountId: web2Account.providerAccountId,
      decimalId: token.decimalId,
    });

    const result = await unlinkAccounts({
      web2AccountIdFromSession: web2Account.id,
      decryptedAttestation: JSON.stringify({
        salt: "0x4fe",
        message: JSON.stringify({
          attestationMessage,
          backendAttestationSignature,
        }),
      }),
    });

    const savedToken = await Token.findById(token.id);
    const savedWeb2Account = await Web2Account.findById(web2Account.id);

    expect(result).toEqual({
      success: true,
      message: "Accounts were successfully un-linked",
    });
    expect(savedToken?.status).toEqual(TokenStatus.REVOKED);
    expect(savedWeb2Account?.isLinkedToAddress).toEqual(false);
  });
});
