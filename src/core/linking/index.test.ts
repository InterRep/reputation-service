import { describe, expect, beforeAll, afterAll } from "@jest/globals";
import { ContractTransaction } from "@ethersproject/contracts";
import linkAccounts from "src/core/linking";
import Web2Account from "src/models/web2Accounts/Web2Account.model";
import {
  BasicReputation,
  IWeb2AccountDocument,
} from "src/models/web2Accounts/Web2Account.types";
import {
  connect,
  dropDatabaseAndDisconnect,
} from "src/utils/server/testDatabase";
import { getDefaultNetworkId } from "src/utils/crypto/getDefaultNetwork";
import { checkIfUserSignatureIsValid } from "../signing/checkIfUserSignatureIsValid";
import { createTwitterAccountObject } from "src/utils/server/createNewTwitterAccount";
import { encryptMessageWithSalt } from "src/utils/crypto/encryption";
import Token from "src/models/tokens/Token.model";

const addy = "0x622c62E3be972ABdF172DA466d425Df4C93470E4";
const getParams = (override?: Record<string, unknown>) => ({
  chainId: getDefaultNetworkId(),
  address: addy,
  userSignature: "signature",
  web2AccountId: "608a89a5346f2f9008feef8e",
  userPublicKey: "pubKey",
  ...override,
});

jest.mock("hardhat", () => {
  const actualHardhat = jest.requireActual("hardhat");
  return {
    ...actualHardhat,
    ethers: {
      ...actualHardhat.ethers,
      provider: {
        getNetwork: jest.fn(() => ({ chainId: 31337, name: "hardhat" })),
      },
      utils: {
        id: jest.fn(
          () =>
            `0x03dd40b36474bf4559c4d733be6f5ec1e61bcb562d1c7f04629ee3af7ee569f9`
        ),
        verifyMessage: jest.fn(),
      },
    },
  };
});

jest.mock("src/core/signing/checkIfUserSignatureIsValid", () => ({
  checkIfUserSignatureIsValid: jest.fn(),
}));

jest.mock("../blockchain/ReputationBadge/mintNewToken", () => ({
  __esModule: true,
  default: jest.fn(
    (): Partial<ContractTransaction> => ({
      hash: "hash",
      blockNumber: 5,
      chainId: 31337,
      timestamp: 1234,
    })
  ),
}));

jest.mock("src/utils/crypto/encryption", () => ({
  encryptMessageWithSalt: jest.fn(() => "encryptedMessage"),
}));

const checkIfUserSignatureIsValidMocked = checkIfUserSignatureIsValid as jest.MockedFunction<
  typeof checkIfUserSignatureIsValid
>;

describe("linkAccounts", () => {
  checkIfUserSignatureIsValidMocked.mockImplementation(() => true);
  beforeAll(async () => {
    await connect();
  });

  afterAll(async () => await dropDatabaseAndDisconnect());

  // afterEach(async () => {
  //   await clearDatabase();
  // });

  it("should throw if the address is invalid", () => {
    const badAddy = "0x123";
    expect(linkAccounts(getParams({ address: badAddy }))).rejects.toThrow(
      `Invalid address ${badAddy}`
    );
  });

  describe("signature", () => {
    it("should throw if the signature is invalid", () => {
      checkIfUserSignatureIsValidMocked.mockImplementationOnce(() => false);
      expect(linkAccounts(getParams({}))).rejects.toThrow();
    });
  });

  describe("web 2 account", () => {
    let web2Account: IWeb2AccountDocument;
    beforeAll(async () => {
      web2Account = await Web2Account.create(
        createTwitterAccountObject({
          providerAccountId: "1",
          user: { id: "1", username: "user name" },
          isLinkedToAddress: true,
          basicReputation: undefined,
        })
      );
    });

    it("should throw if it fails retrieving the web 2 account", () => {
      expect(
        linkAccounts(getParams({ web2AccountId: "thisIdIsInvalid" }))
      ).rejects.toThrow(`Error retrieving web 2 account`);
    });

    it("should throw if there is no web 2 account for that id", () => {
      expect(linkAccounts(getParams())).rejects.toThrow(
        `Web 2 account not found`
      );
    });

    it("should throw if the account is already linked", async () => {
      expect(
        linkAccounts(getParams({ web2AccountId: web2Account.id }))
      ).rejects.toThrow(`Web 2 account already linked`);
    });

    it("should throw if the account's reputation is not defined", async () => {
      expect(
        linkAccounts(getParams({ web2AccountId: web2Account.id }))
      ).rejects.toThrow(`Insufficient account's reputation`);
    });

    describe("link", () => {
      let web2AccountNotLinked: IWeb2AccountDocument;
      beforeAll(async () => {
        web2AccountNotLinked = await Web2Account.create(
          createTwitterAccountObject({
            providerAccountId: "2",
            user: { id: "2", username: "new name" },
            isLinkedToAddress: false,
            basicReputation: BasicReputation.UNCLEAR,
          })
        );
      });

      it("should throw if the account's reputation is not CONFIRMED", async () => {
        expect(
          linkAccounts({
            web2AccountId: web2AccountNotLinked.id,
            chainId: getDefaultNetworkId(),
            address: addy,
            userSignature: "signature",
            userPublicKey: "pubKey",
          })
        ).rejects.toThrow(`Insufficient account's reputation`);
      });
    });
  });

  describe("Token creation", () => {
    let web2AccountMock: IWeb2AccountDocument;
    beforeAll(async () => {
      web2AccountMock = await Web2Account.create(
        createTwitterAccountObject({
          providerAccountId: "999",
          user: { id: "999", username: "username" },
          isLinkedToAddress: false,
          basicReputation: BasicReputation.CONFIRMED,
        })
      );
    });

    it("should change isLinkedToAddress to true and create a new token", async () => {
      const userPublicKey = "xj93Xo97GEIhaO5mHcMNMfNnS5YReu/kexbGHIOtGXU=";
      const token = await linkAccounts({
        web2AccountId: web2AccountMock.id,
        chainId: getDefaultNetworkId(),
        address: addy,
        userSignature: "signature",
        userPublicKey,
      });

      const account = await Web2Account.findById(web2AccountMock.id);

      const savedToken = await Token.findById(token.id);

      if (!savedToken) throw new Error("Token was not saved");

      expect(account!.isLinkedToAddress).toBe(true);
      expect(savedToken.userAddress).toBe(addy);
      expect(typeof savedToken.decimalId).toBe("string");
      expect(encryptMessageWithSalt).toHaveBeenCalledWith(
        userPublicKey,
        '{"attestationMessage":"{\\"service\\":\\"InterRep\\",\\"decimalId\\":\\"1747858295241726277510434389086057765685193028078641675200900296144941574649\\",\\"userAddress\\":\\"0x622c62E3be972ABdF172DA466d425Df4C93470E4\\",\\"web2Provider\\":\\"twitter\\",\\"providerAccountId\\":\\"999\\"}","backendAttestationSignature":"0x58e10c262844d01fbc3c8fed5f067429c068c6b851e0a1a45505b8863b4852b523c00052ec0cfe024f4bc199917f9363183676441a8568015a5a93876c0019371b"}'
      );
      expect(savedToken.encryptedAttestation).toEqual("encryptedMessage");
    });

    it("should throw if there is an error in creating the attestation", async () => {
      expect(
        linkAccounts({
          web2AccountId: web2AccountMock.id,
          chainId: getDefaultNetworkId(),
          address: addy,
          userSignature: "signature",
          userPublicKey: "invalid pub key",
        })
      ).rejects.toThrowError("Error while creating attestation");
    });
  });
});
