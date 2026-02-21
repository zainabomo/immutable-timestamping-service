import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;

// Test data constants
const TEST_HASH = Cl.bufferFromHex("abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab");
const TEST_HASH_2 = Cl.bufferFromHex("1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef");
const PERMISSION_VIEWER = Cl.stringAscii("viewer");
const PERMISSION_EDITOR = Cl.stringAscii("editor");
const PERMISSION_ADMIN = Cl.stringAscii("admin");
const INVALID_PERMISSION = Cl.stringAscii("invalid");

describe("Access Control Contract", () => {
  describe("Contract Initialization", () => {
    it("initializes with zero grants", () => {
      const { result } = simnet.callReadOnlyFn(
        "access-control",
        "get-total-grants",
        [],
        deployer
      );
      expect(result).toBeUint(0);
    });
  });

  describe("register-timestamp-owner", () => {
    it("successfully registers timestamp owner", () => {
      const { result } = simnet.callPublicFn(
        "access-control",
        "register-timestamp-owner",
        [TEST_HASH, Cl.principal(wallet1)],
        wallet1
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("stores owner correctly", () => {
      simnet.callPublicFn(
        "access-control",
        "register-timestamp-owner",
        [TEST_HASH, Cl.principal(wallet1)],
        wallet1
      );

      const { result } = simnet.callReadOnlyFn(
        "access-control",
        "get-timestamp-owner",
        [TEST_HASH],
        wallet1
      );
      expect(result).toBeSome(Cl.principal(wallet1));
    });

    it("verifies owner correctly", () => {
      simnet.callPublicFn(
        "access-control",
        "register-timestamp-owner",
        [TEST_HASH, Cl.principal(wallet1)],
        wallet1
      );

      const { result } = simnet.callReadOnlyFn(
        "access-control",
        "is-owner",
        [TEST_HASH, Cl.principal(wallet1)],
        wallet1
      );
      expect(result).toBeBool(true);
    });
  });

  describe("grant-access", () => {
    it("allows owner to grant viewer access", () => {
      simnet.callPublicFn(
        "access-control",
        "register-timestamp-owner",
        [TEST_HASH, Cl.principal(wallet1)],
        wallet1
      );

      const { result } = simnet.callPublicFn(
        "access-control",
        "grant-access",
        [TEST_HASH, Cl.principal(wallet2), PERMISSION_VIEWER],
        wallet1
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("allows owner to grant editor access", () => {
      simnet.callPublicFn(
        "access-control",
        "register-timestamp-owner",
        [TEST_HASH, Cl.principal(wallet1)],
        wallet1
      );

      const { result } = simnet.callPublicFn(
        "access-control",
        "grant-access",
        [TEST_HASH, Cl.principal(wallet2), PERMISSION_EDITOR],
        wallet1
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("allows owner to grant admin access", () => {
      simnet.callPublicFn(
        "access-control",
        "register-timestamp-owner",
        [TEST_HASH, Cl.principal(wallet1)],
        wallet1
      );

      const { result } = simnet.callPublicFn(
        "access-control",
        "grant-access",
        [TEST_HASH, Cl.principal(wallet2), PERMISSION_ADMIN],
        wallet1
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("stores permission correctly", () => {
      simnet.callPublicFn(
        "access-control",
        "register-timestamp-owner",
        [TEST_HASH, Cl.principal(wallet1)],
        wallet1
      );

      simnet.callPublicFn(
        "access-control",
        "grant-access",
        [TEST_HASH, Cl.principal(wallet2), PERMISSION_VIEWER],
        wallet1
      );

      const { result } = simnet.callReadOnlyFn(
        "access-control",
        "get-permission",
        [TEST_HASH, Cl.principal(wallet2)],
        wallet1
      );

      expect(result).toBeSome(
        Cl.tuple({
          permission: PERMISSION_VIEWER,
          "granted-by": Cl.principal(wallet1),
          "granted-at": Cl.uint(simnet.burnBlockHeight),
          "granted-block": Cl.uint(simnet.blockHeight - 1)
        })
      );
    });

    it("increments total grants counter", () => {
      simnet.callPublicFn(
        "access-control",
        "register-timestamp-owner",
        [TEST_HASH, Cl.principal(wallet1)],
        wallet1
      );

      simnet.callPublicFn(
        "access-control",
        "grant-access",
        [TEST_HASH, Cl.principal(wallet2), PERMISSION_VIEWER],
        wallet1
      );

      const { result } = simnet.callReadOnlyFn(
        "access-control",
        "get-total-grants",
        [],
        deployer
      );
      expect(result).toBeUint(1);
    });

    it("prevents non-owner from granting access", () => {
      simnet.callPublicFn(
        "access-control",
        "register-timestamp-owner",
        [TEST_HASH, Cl.principal(wallet1)],
        wallet1
      );

      const { result } = simnet.callPublicFn(
        "access-control",
        "grant-access",
        [TEST_HASH, Cl.principal(wallet3), PERMISSION_VIEWER],
        wallet2
      );
      expect(result).toBeErr(Cl.uint(200)); // ERR-UNAUTHORIZED
    });

    it("allows admin to grant access to others", () => {
      simnet.callPublicFn(
        "access-control",
        "register-timestamp-owner",
        [TEST_HASH, Cl.principal(wallet1)],
        wallet1
      );

      simnet.callPublicFn(
        "access-control",
        "grant-access",
        [TEST_HASH, Cl.principal(wallet2), PERMISSION_ADMIN],
        wallet1
      );

      const { result } = simnet.callPublicFn(
        "access-control",
        "grant-access",
        [TEST_HASH, Cl.principal(wallet3), PERMISSION_VIEWER],
        wallet2
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("prevents self-granting", () => {
      simnet.callPublicFn(
        "access-control",
        "register-timestamp-owner",
        [TEST_HASH, Cl.principal(wallet1)],
        wallet1
      );

      const { result } = simnet.callPublicFn(
        "access-control",
        "grant-access",
        [TEST_HASH, Cl.principal(wallet1), PERMISSION_ADMIN],
        wallet1
      );
      expect(result).toBeErr(Cl.uint(205)); // ERR-SELF-GRANT
    });

    it("fails for non-existent timestamp", () => {
      const { result } = simnet.callPublicFn(
        "access-control",
        "grant-access",
        [TEST_HASH, Cl.principal(wallet2), PERMISSION_VIEWER],
        wallet1
      );
      expect(result).toBeErr(Cl.uint(201)); // ERR-NOT-FOUND
    });

    it("fails with invalid permission", () => {
      simnet.callPublicFn(
        "access-control",
        "register-timestamp-owner",
        [TEST_HASH, Cl.principal(wallet1)],
        wallet1
      );

      const { result } = simnet.callPublicFn(
        "access-control",
        "grant-access",
        [TEST_HASH, Cl.principal(wallet2), INVALID_PERMISSION],
        wallet1
      );
      expect(result).toBeErr(Cl.uint(203)); // ERR-INVALID-PERMISSION
    });

    it("fails when already granted", () => {
      simnet.callPublicFn(
        "access-control",
        "register-timestamp-owner",
        [TEST_HASH, Cl.principal(wallet1)],
        wallet1
      );

      simnet.callPublicFn(
        "access-control",
        "grant-access",
        [TEST_HASH, Cl.principal(wallet2), PERMISSION_VIEWER],
        wallet1
      );

      const { result } = simnet.callPublicFn(
        "access-control",
        "grant-access",
        [TEST_HASH, Cl.principal(wallet2), PERMISSION_EDITOR],
        wallet1
      );
      expect(result).toBeErr(Cl.uint(202)); // ERR-ALREADY-GRANTED
    });

    it("updates user count tracking", () => {
      simnet.callPublicFn(
        "access-control",
        "register-timestamp-owner",
        [TEST_HASH, Cl.principal(wallet1)],
        wallet1
      );

      simnet.callPublicFn(
        "access-control",
        "grant-access",
        [TEST_HASH, Cl.principal(wallet2), PERMISSION_VIEWER],
        wallet1
      );

      const { result } = simnet.callReadOnlyFn(
        "access-control",
        "get-hash-user-count",
        [TEST_HASH],
        wallet1
      );
      expect(result).toBeUint(1);
    });
  });

  describe("revoke-access", () => {
    it("allows owner to revoke access", () => {
      simnet.callPublicFn(
        "access-control",
        "register-timestamp-owner",
        [TEST_HASH, Cl.principal(wallet1)],
        wallet1
      );

      simnet.callPublicFn(
        "access-control",
        "grant-access",
        [TEST_HASH, Cl.principal(wallet2), PERMISSION_VIEWER],
        wallet1
      );

      const { result } = simnet.callPublicFn(
        "access-control",
        "revoke-access",
        [TEST_HASH, Cl.principal(wallet2)],
        wallet1
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("removes permission after revocation", () => {
      simnet.callPublicFn(
        "access-control",
        "register-timestamp-owner",
        [TEST_HASH, Cl.principal(wallet1)],
        wallet1
      );

      simnet.callPublicFn(
        "access-control",
        "grant-access",
        [TEST_HASH, Cl.principal(wallet2), PERMISSION_VIEWER],
        wallet1
      );

      simnet.callPublicFn(
        "access-control",
        "revoke-access",
        [TEST_HASH, Cl.principal(wallet2)],
        wallet1
      );

      const { result } = simnet.callReadOnlyFn(
        "access-control",
        "get-permission",
        [TEST_HASH, Cl.principal(wallet2)],
        wallet1
      );
      expect(result).toBeNone();
    });

    it("allows admin to revoke access", () => {
      simnet.callPublicFn(
        "access-control",
        "register-timestamp-owner",
        [TEST_HASH, Cl.principal(wallet1)],
        wallet1
      );

      simnet.callPublicFn(
        "access-control",
        "grant-access",
        [TEST_HASH, Cl.principal(wallet2), PERMISSION_ADMIN],
        wallet1
      );

      simnet.callPublicFn(
        "access-control",
        "grant-access",
        [TEST_HASH, Cl.principal(wallet3), PERMISSION_VIEWER],
        wallet1
      );

      const { result } = simnet.callPublicFn(
        "access-control",
        "revoke-access",
        [TEST_HASH, Cl.principal(wallet3)],
        wallet2
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("prevents non-owner/admin from revoking", () => {
      simnet.callPublicFn(
        "access-control",
        "register-timestamp-owner",
        [TEST_HASH, Cl.principal(wallet1)],
        wallet1
      );

      simnet.callPublicFn(
        "access-control",
        "grant-access",
        [TEST_HASH, Cl.principal(wallet2), PERMISSION_VIEWER],
        wallet1
      );

      const { result } = simnet.callPublicFn(
        "access-control",
        "revoke-access",
        [TEST_HASH, Cl.principal(wallet2)],
        wallet3
      );
      expect(result).toBeErr(Cl.uint(200)); // ERR-UNAUTHORIZED
    });

    it("fails for non-existent permission", () => {
      simnet.callPublicFn(
        "access-control",
        "register-timestamp-owner",
        [TEST_HASH, Cl.principal(wallet1)],
        wallet1
      );

      const { result } = simnet.callPublicFn(
        "access-control",
        "revoke-access",
        [TEST_HASH, Cl.principal(wallet2)],
        wallet1
      );
      expect(result).toBeErr(Cl.uint(201)); // ERR-NOT-FOUND
    });
  });

  describe("update-permission", () => {
    it("allows owner to update permission level", () => {
      simnet.callPublicFn(
        "access-control",
        "register-timestamp-owner",
        [TEST_HASH, Cl.principal(wallet1)],
        wallet1
      );

      simnet.callPublicFn(
        "access-control",
        "grant-access",
        [TEST_HASH, Cl.principal(wallet2), PERMISSION_VIEWER],
        wallet1
      );

      const { result } = simnet.callPublicFn(
        "access-control",
        "update-permission",
        [TEST_HASH, Cl.principal(wallet2), PERMISSION_EDITOR],
        wallet1
      );
      expect(result).toBeOk(Cl.bool(true));
    });

    it("updates permission correctly", () => {
      simnet.callPublicFn(
        "access-control",
        "register-timestamp-owner",
        [TEST_HASH, Cl.principal(wallet1)],
        wallet1
      );

      simnet.callPublicFn(
        "access-control",
        "grant-access",
        [TEST_HASH, Cl.principal(wallet2), PERMISSION_VIEWER],
        wallet1
      );

      simnet.callPublicFn(
        "access-control",
        "update-permission",
        [TEST_HASH, Cl.principal(wallet2), PERMISSION_EDITOR],
        wallet1
      );

      const { result } = simnet.callReadOnlyFn(
        "access-control",
        "has-editor-permission",
        [TEST_HASH, Cl.principal(wallet2)],
        wallet1
      );
      expect(result).toBeBool(true);
    });

    it("prevents non-owner from updating permission", () => {
      simnet.callPublicFn(
        "access-control",
        "register-timestamp-owner",
        [TEST_HASH, Cl.principal(wallet1)],
        wallet1
      );

      simnet.callPublicFn(
        "access-control",
        "grant-access",
        [TEST_HASH, Cl.principal(wallet2), PERMISSION_VIEWER],
        wallet1
      );

      const { result } = simnet.callPublicFn(
        "access-control",
        "update-permission",
        [TEST_HASH, Cl.principal(wallet2), PERMISSION_EDITOR],
        wallet3
      );
      expect(result).toBeErr(Cl.uint(200)); // ERR-UNAUTHORIZED
    });

    it("fails with invalid new permission", () => {
      simnet.callPublicFn(
        "access-control",
        "register-timestamp-owner",
        [TEST_HASH, Cl.principal(wallet1)],
        wallet1
      );

      simnet.callPublicFn(
        "access-control",
        "grant-access",
        [TEST_HASH, Cl.principal(wallet2), PERMISSION_VIEWER],
        wallet1
      );

      const { result } = simnet.callPublicFn(
        "access-control",
        "update-permission",
        [TEST_HASH, Cl.principal(wallet2), INVALID_PERMISSION],
        wallet1
      );
      expect(result).toBeErr(Cl.uint(203)); // ERR-INVALID-PERMISSION
    });
  });

  describe("Permission checks", () => {
    it("correctly identifies viewer permissions", () => {
      simnet.callPublicFn(
        "access-control",
        "register-timestamp-owner",
        [TEST_HASH, Cl.principal(wallet1)],
        wallet1
      );

      simnet.callPublicFn(
        "access-control",
        "grant-access",
        [TEST_HASH, Cl.principal(wallet2), PERMISSION_VIEWER],
        wallet1
      );

      const { result } = simnet.callReadOnlyFn(
        "access-control",
        "has-viewer-permission",
        [TEST_HASH, Cl.principal(wallet2)],
        wallet1
      );
      expect(result).toBeBool(true);
    });

    it("viewer permission includes editor and admin", () => {
      simnet.callPublicFn(
        "access-control",
        "register-timestamp-owner",
        [TEST_HASH, Cl.principal(wallet1)],
        wallet1
      );

      simnet.callPublicFn(
        "access-control",
        "grant-access",
        [TEST_HASH, Cl.principal(wallet2), PERMISSION_ADMIN],
        wallet1
      );

      const viewerResult = simnet.callReadOnlyFn(
        "access-control",
        "has-viewer-permission",
        [TEST_HASH, Cl.principal(wallet2)],
        wallet1
      );
      expect(viewerResult.result).toBeBool(true);

      const editorResult = simnet.callReadOnlyFn(
        "access-control",
        "has-editor-permission",
        [TEST_HASH, Cl.principal(wallet2)],
        wallet1
      );
      expect(editorResult.result).toBeBool(true);

      const adminResult = simnet.callReadOnlyFn(
        "access-control",
        "has-admin-permission",
        [TEST_HASH, Cl.principal(wallet2)],
        wallet1
      );
      expect(adminResult.result).toBeBool(true);
    });

    it("editor permission does not include admin", () => {
      simnet.callPublicFn(
        "access-control",
        "register-timestamp-owner",
        [TEST_HASH, Cl.principal(wallet1)],
        wallet1
      );

      simnet.callPublicFn(
        "access-control",
        "grant-access",
        [TEST_HASH, Cl.principal(wallet2), PERMISSION_EDITOR],
        wallet1
      );

      const adminResult = simnet.callReadOnlyFn(
        "access-control",
        "has-admin-permission",
        [TEST_HASH, Cl.principal(wallet2)],
        wallet1
      );
      expect(adminResult.result).toBeBool(false);

      const editorResult = simnet.callReadOnlyFn(
        "access-control",
        "has-editor-permission",
        [TEST_HASH, Cl.principal(wallet2)],
        wallet1
      );
      expect(editorResult.result).toBeBool(true);
    });

    it("returns false for non-existent permission", () => {
      simnet.callPublicFn(
        "access-control",
        "register-timestamp-owner",
        [TEST_HASH, Cl.principal(wallet1)],
        wallet1
      );

      const { result } = simnet.callReadOnlyFn(
        "access-control",
        "has-viewer-permission",
        [TEST_HASH, Cl.principal(wallet2)],
        wallet1
      );
      expect(result).toBeBool(false);
    });
  });

  describe("Tracking functions", () => {
    it("tracks hash-user count", () => {
      simnet.callPublicFn(
        "access-control",
        "register-timestamp-owner",
        [TEST_HASH, Cl.principal(wallet1)],
        wallet1
      );

      simnet.callPublicFn(
        "access-control",
        "grant-access",
        [TEST_HASH, Cl.principal(wallet2), PERMISSION_VIEWER],
        wallet1
      );

      simnet.callPublicFn(
        "access-control",
        "grant-access",
        [TEST_HASH, Cl.principal(wallet3), PERMISSION_EDITOR],
        wallet1
      );

      const { result } = simnet.callReadOnlyFn(
        "access-control",
        "get-hash-user-count",
        [TEST_HASH],
        wallet1
      );
      expect(result).toBeUint(2);
    });

    it("retrieves user by index", () => {
      simnet.callPublicFn(
        "access-control",
        "register-timestamp-owner",
        [TEST_HASH, Cl.principal(wallet1)],
        wallet1
      );

      simnet.callPublicFn(
        "access-control",
        "grant-access",
        [TEST_HASH, Cl.principal(wallet2), PERMISSION_VIEWER],
        wallet1
      );

      const { result } = simnet.callReadOnlyFn(
        "access-control",
        "get-hash-user-by-index",
        [TEST_HASH, Cl.uint(0)],
        wallet1
      );
      expect(result).toBeSome(Cl.principal(wallet2));
    });

    it("tracks user-hash count", () => {
      simnet.callPublicFn(
        "access-control",
        "register-timestamp-owner",
        [TEST_HASH, Cl.principal(wallet1)],
        wallet1
      );

      simnet.callPublicFn(
        "access-control",
        "register-timestamp-owner",
        [TEST_HASH_2, Cl.principal(wallet1)],
        wallet1
      );

      simnet.callPublicFn(
        "access-control",
        "grant-access",
        [TEST_HASH, Cl.principal(wallet2), PERMISSION_VIEWER],
        wallet1
      );

      simnet.callPublicFn(
        "access-control",
        "grant-access",
        [TEST_HASH_2, Cl.principal(wallet2), PERMISSION_VIEWER],
        wallet1
      );

      const { result } = simnet.callReadOnlyFn(
        "access-control",
        "get-user-hash-count",
        [Cl.principal(wallet2)],
        wallet1
      );
      expect(result).toBeUint(2);
    });

    it("retrieves hash by user index", () => {
      simnet.callPublicFn(
        "access-control",
        "register-timestamp-owner",
        [TEST_HASH, Cl.principal(wallet1)],
        wallet1
      );

      simnet.callPublicFn(
        "access-control",
        "grant-access",
        [TEST_HASH, Cl.principal(wallet2), PERMISSION_VIEWER],
        wallet1
      );

      const { result } = simnet.callReadOnlyFn(
        "access-control",
        "get-user-hash-by-index",
        [Cl.principal(wallet2), Cl.uint(0)],
        wallet1
      );
      expect(result).toBeSome(TEST_HASH);
    });
  });
});
