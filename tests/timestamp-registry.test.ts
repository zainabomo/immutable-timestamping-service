import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

// Test data constants
const TEST_HASH = Cl.bufferFromHex("abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab");
const TEST_HASH_2 = Cl.bufferFromHex("1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef");
const ZERO_HASH = Cl.bufferFromHex("0000000000000000000000000000000000000000000000000000000000000000");
const METADATA_HASH = Cl.bufferFromHex("fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321");
const PROOF_URI = Cl.stringAscii("ipfs://QmTest123456789");
const PROOF_URI_2 = Cl.stringAscii("ipfs://QmNewProof987654");
const EMPTY_URI = Cl.stringAscii("");

describe("Timestamp Registry Contract", () => {
  describe("Contract Initialization", () => {
    it("initializes with zero timestamps", () => {
      const { result } = simnet.callReadOnlyFn(
        "timestamp-registry",
        "get-total-timestamps",
        [],
        deployer
      );
      expect(result).toBeUint(0);
    });
  });

  describe("register-timestamp", () => {
    it("successfully registers a new timestamp", () => {
      const { result } = simnet.callPublicFn(
        "timestamp-registry",
        "register-timestamp",
        [TEST_HASH, METADATA_HASH, PROOF_URI],
        wallet1
      );
      expect(result).toBeOk(Cl.uint(simnet.blockHeight));
    });

    it("increments total timestamps counter", () => {
      simnet.callPublicFn(
        "timestamp-registry",
        "register-timestamp",
        [TEST_HASH, METADATA_HASH, PROOF_URI],
        wallet1
      );

      const { result } = simnet.callReadOnlyFn(
        "timestamp-registry",
        "get-total-timestamps",
        [],
        deployer
      );
      expect(result).toBeUint(1);
    });

    it("stores timestamp record correctly", () => {
      simnet.callPublicFn(
        "timestamp-registry",
        "register-timestamp",
        [TEST_HASH, METADATA_HASH, PROOF_URI],
        wallet1
      );

      const { result } = simnet.callReadOnlyFn(
        "timestamp-registry",
        "get-timestamp",
        [TEST_HASH],
        wallet1
      );

      expect(result).toBeSome(
        Cl.tuple({
          owner: Cl.principal(wallet1),
          timestamp: Cl.uint(simnet.burnBlockHeight),
          "block-height": Cl.uint(simnet.blockHeight),
          "tx-id": Cl.bufferFromHex("0000000000000000000000000000000000000000000000000000000000000000"),
          "metadata-hash": METADATA_HASH,
          "proof-uri": PROOF_URI,
          "is-active": Cl.bool(true)
        })
      );
    });

    it("fails when registering duplicate hash", () => {
      simnet.callPublicFn(
        "timestamp-registry",
        "register-timestamp",
        [TEST_HASH, METADATA_HASH, PROOF_URI],
        wallet1
      );

      const { result } = simnet.callPublicFn(
        "timestamp-registry",
        "register-timestamp",
        [TEST_HASH, METADATA_HASH, PROOF_URI],
        wallet1
      );

      expect(result).toBeErr(Cl.uint(101)); // ERR-ALREADY-EXISTS
    });

    it("fails with invalid hash (all zeros)", () => {
      const { result } = simnet.callPublicFn(
        "timestamp-registry",
        "register-timestamp",
        [ZERO_HASH, METADATA_HASH, PROOF_URI],
        wallet1
      );
      expect(result).toBeErr(Cl.uint(103)); // ERR-INVALID-HASH
    });

    it("fails with invalid metadata hash", () => {
      const { result } = simnet.callPublicFn(
        "timestamp-registry",
        "register-timestamp",
        [TEST_HASH, ZERO_HASH, PROOF_URI],
        wallet1
      );
      expect(result).toBeErr(Cl.uint(105)); // ERR-INVALID-METADATA
    });

    it("fails with empty URI", () => {
      const { result } = simnet.callPublicFn(
        "timestamp-registry",
        "register-timestamp",
        [TEST_HASH, METADATA_HASH, EMPTY_URI],
        wallet1
      );
      expect(result).toBeErr(Cl.uint(104)); // ERR-INVALID-URI
    });

    it("allows different users to register different hashes", () => {
      const result1 = simnet.callPublicFn(
        "timestamp-registry",
        "register-timestamp",
        [TEST_HASH, METADATA_HASH, PROOF_URI],
        wallet1
      );
      expect(result1.result).toBeOk(Cl.uint(simnet.blockHeight));

      const result2 = simnet.callPublicFn(
        "timestamp-registry",
        "register-timestamp",
        [TEST_HASH_2, METADATA_HASH, PROOF_URI],
        wallet2
      );
      expect(result2.result).toBeOk(Cl.uint(simnet.blockHeight));
    });

    it("tracks owner timestamp count", () => {
      simnet.callPublicFn(
        "timestamp-registry",
        "register-timestamp",
        [TEST_HASH, METADATA_HASH, PROOF_URI],
        wallet1
      );

      const { result } = simnet.callReadOnlyFn(
        "timestamp-registry",
        "get-owner-timestamp-count",
        [Cl.principal(wallet1)],
        wallet1
      );
      expect(result).toBeUint(1);
    });
  });

  describe("verify-timestamp", () => {
    it("successfully verifies existing timestamp", () => {
      simnet.callPublicFn(
        "timestamp-registry",
        "register-timestamp",
        [TEST_HASH, METADATA_HASH, PROOF_URI],
        wallet1
      );

      const { result } = simnet.callPublicFn(
        "timestamp-registry",
        "verify-timestamp",
        [TEST_HASH],
        wallet2
      );

      expect(result).toBeOk(
        Cl.some(
          Cl.tuple({
            owner: Cl.principal(wallet1),
            timestamp: Cl.uint(simnet.burnBlockHeight),
            "block-height": Cl.uint(simnet.blockHeight - 1),
            "tx-id": Cl.bufferFromHex("0000000000000000000000000000000000000000000000000000000000000000"),
            "metadata-hash": METADATA_HASH,
            "proof-uri": PROOF_URI,
            "is-active": Cl.bool(true)
          })
        )
      );
    });

    it("caches verification result", () => {
      simnet.callPublicFn(
        "timestamp-registry",
        "register-timestamp",
        [TEST_HASH, METADATA_HASH, PROOF_URI],
        wallet1
      );

      simnet.callPublicFn(
        "timestamp-registry",
        "verify-timestamp",
        [TEST_HASH],
        wallet2
      );

      const { result } = simnet.callReadOnlyFn(
        "timestamp-registry",
        "get-verification-cache",
        [TEST_HASH],
        wallet2
      );

      expect(result).toBeSome(
        Cl.tuple({
          verified: Cl.bool(true),
          "verification-time": Cl.uint(simnet.burnBlockHeight),
          verifier: Cl.principal(wallet2)
        })
      );
    });

    it("fails for non-existent timestamp", () => {
      const { result } = simnet.callPublicFn(
        "timestamp-registry",
        "verify-timestamp",
        [TEST_HASH],
        wallet1
      );
      expect(result).toBeErr(Cl.uint(102)); // ERR-NOT-FOUND
    });

    it("fails with invalid hash", () => {
      const { result } = simnet.callPublicFn(
        "timestamp-registry",
        "verify-timestamp",
        [ZERO_HASH],
        wallet1
      );
      expect(result).toBeErr(Cl.uint(103)); // ERR-INVALID-HASH
    });
  });

  describe("update-proof-uri", () => {
    it("allows owner to update proof URI", () => {
      simnet.callPublicFn(
        "timestamp-registry",
        "register-timestamp",
        [TEST_HASH, METADATA_HASH, PROOF_URI],
        wallet1
      );

      const { result } = simnet.callPublicFn(
        "timestamp-registry",
        "update-proof-uri",
        [TEST_HASH, PROOF_URI_2],
        wallet1
      );

      expect(result).toBeOk(Cl.bool(true));

      const timestamp = simnet.callReadOnlyFn(
        "timestamp-registry",
        "get-timestamp",
        [TEST_HASH],
        wallet1
      );

      const timestampData = timestamp.result as any;
      expect(timestampData.value.data["proof-uri"]).toStrictEqual(PROOF_URI_2);
    });

    it("prevents non-owner from updating URI", () => {
      simnet.callPublicFn(
        "timestamp-registry",
        "register-timestamp",
        [TEST_HASH, METADATA_HASH, PROOF_URI],
        wallet1
      );

      const { result } = simnet.callPublicFn(
        "timestamp-registry",
        "update-proof-uri",
        [TEST_HASH, PROOF_URI_2],
        wallet2
      );

      expect(result).toBeErr(Cl.uint(100)); // ERR-UNAUTHORIZED
    });

    it("fails for non-existent timestamp", () => {
      const { result } = simnet.callPublicFn(
        "timestamp-registry",
        "update-proof-uri",
        [TEST_HASH, PROOF_URI_2],
        wallet1
      );
      expect(result).toBeErr(Cl.uint(102)); // ERR-NOT-FOUND
    });

    it("fails with empty URI", () => {
      simnet.callPublicFn(
        "timestamp-registry",
        "register-timestamp",
        [TEST_HASH, METADATA_HASH, PROOF_URI],
        wallet1
      );

      const { result } = simnet.callPublicFn(
        "timestamp-registry",
        "update-proof-uri",
        [TEST_HASH, EMPTY_URI],
        wallet1
      );
      expect(result).toBeErr(Cl.uint(104)); // ERR-INVALID-URI
    });
  });

  describe("deactivate-timestamp", () => {
    it("allows owner to deactivate timestamp", () => {
      simnet.callPublicFn(
        "timestamp-registry",
        "register-timestamp",
        [TEST_HASH, METADATA_HASH, PROOF_URI],
        wallet1
      );

      const { result } = simnet.callPublicFn(
        "timestamp-registry",
        "deactivate-timestamp",
        [TEST_HASH],
        wallet1
      );

      expect(result).toBeOk(Cl.bool(true));
    });

    it("marks timestamp as inactive", () => {
      simnet.callPublicFn(
        "timestamp-registry",
        "register-timestamp",
        [TEST_HASH, METADATA_HASH, PROOF_URI],
        wallet1
      );

      simnet.callPublicFn(
        "timestamp-registry",
        "deactivate-timestamp",
        [TEST_HASH],
        wallet1
      );

      const { result } = simnet.callReadOnlyFn(
        "timestamp-registry",
        "is-timestamp-active",
        [TEST_HASH],
        wallet1
      );

      expect(result).toBeBool(false);
    });

    it("prevents non-owner from deactivating", () => {
      simnet.callPublicFn(
        "timestamp-registry",
        "register-timestamp",
        [TEST_HASH, METADATA_HASH, PROOF_URI],
        wallet1
      );

      const { result } = simnet.callPublicFn(
        "timestamp-registry",
        "deactivate-timestamp",
        [TEST_HASH],
        wallet2
      );

      expect(result).toBeErr(Cl.uint(100)); // ERR-UNAUTHORIZED
    });
  });

  describe("Read-only functions", () => {
    it("get-timestamp returns none for non-existent hash", () => {
      const { result } = simnet.callReadOnlyFn(
        "timestamp-registry",
        "get-timestamp",
        [TEST_HASH],
        wallet1
      );
      expect(result).toBeNone();
    });

    it("is-timestamp-active returns false for non-existent hash", () => {
      const { result } = simnet.callReadOnlyFn(
        "timestamp-registry",
        "is-timestamp-active",
        [TEST_HASH],
        wallet1
      );
      expect(result).toBeBool(false);
    });

    it("get-timestamp-metadata returns correct data", () => {
      simnet.callPublicFn(
        "timestamp-registry",
        "register-timestamp",
        [TEST_HASH, METADATA_HASH, PROOF_URI],
        wallet1
      );

      const { result } = simnet.callReadOnlyFn(
        "timestamp-registry",
        "get-timestamp-metadata",
        [TEST_HASH],
        wallet1
      );

      expect(result).toBeSome(
        Cl.tuple({
          owner: Cl.principal(wallet1),
          timestamp: Cl.uint(simnet.burnBlockHeight),
          "block-height": Cl.uint(simnet.blockHeight - 1),
          "is-active": Cl.bool(true)
        })
      );
    });

    it("get-owner-timestamp-by-index returns correct hash", () => {
      simnet.callPublicFn(
        "timestamp-registry",
        "register-timestamp",
        [TEST_HASH, METADATA_HASH, PROOF_URI],
        wallet1
      );

      const { result } = simnet.callReadOnlyFn(
        "timestamp-registry",
        "get-owner-timestamp-by-index",
        [Cl.principal(wallet1), Cl.uint(0)],
        wallet1
      );

      expect(result).toBeSome(TEST_HASH);
    });
  });
});
