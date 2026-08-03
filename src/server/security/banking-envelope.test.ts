import { randomBytes } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  decryptBankingField,
  encryptBankingField,
} from "@/server/security/banking-envelope";

describe("tenant-bound banking envelope encryption", () => {
  it("round-trips with a unique data key and tenant-bound encryption context", async () => {
    const dataKey = randomBytes(32);
    const client = {
      send: vi.fn(async (command: { constructor: { name: string } }) => {
        if (command.constructor.name === "GenerateDataKeyCommand") {
          return {
            Plaintext: Uint8Array.from(dataKey),
            CiphertextBlob: Uint8Array.from(Buffer.from("wrapped-data-key")),
            KeyId: "arn:aws:kms:us-east-1:111122223333:key/test",
          };
        }
        return { Plaintext: Uint8Array.from(dataKey) };
      }),
    };

    const envelope = await encryptBankingField({
      tenantId: "tenant-one",
      plaintext: "routing=021000021;account=123456789",
      kmsKeyId: "alias/catalyst-pilot-banking",
      awsRegion: "us-east-1",
      client,
    });
    expect(envelope.ciphertext).not.toContain("123456789");
    expect(envelope.encryptionContext).toEqual({
      catalystTenant: "tenant-one",
      catalystPurpose: "supplier-banking",
    });
    await expect(
      decryptBankingField({
        tenantId: "tenant-one",
        envelope,
        awsRegion: "us-east-1",
        client,
      }),
    ).resolves.toBe("routing=021000021;account=123456789");
  });

  it("refuses cross-tenant decryption before contacting KMS", async () => {
    const client = { send: vi.fn() };
    await expect(
      decryptBankingField({
        tenantId: "tenant-two",
        envelope: {
          schemaVersion: 1,
          algorithm: "AES-256-GCM",
          ciphertext: "AA==",
          encryptedDataKey: "AA==",
          initializationVector: "AA==",
          authenticationTag: "AA==",
          kmsKeyId: "alias/catalyst",
          encryptionContext: {
            catalystTenant: "tenant-one",
            catalystPurpose: "supplier-banking",
          },
        },
        awsRegion: "us-east-1",
        client,
      }),
    ).rejects.toThrow("BANKING_ENVELOPE_CONTEXT_MISMATCH");
    expect(client.send).not.toHaveBeenCalled();
  });
});
