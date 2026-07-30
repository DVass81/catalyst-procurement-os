import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

import {
  DecryptCommand,
  GenerateDataKeyCommand,
  KMSClient,
} from "@aws-sdk/client-kms";

export interface BankingEnvelope {
  schemaVersion: 1;
  algorithm: "AES-256-GCM";
  ciphertext: string;
  encryptedDataKey: string;
  initializationVector: string;
  authenticationTag: string;
  kmsKeyId: string;
  encryptionContext: {
    catalystTenant: string;
    catalystPurpose: "supplier-banking";
  };
}

interface KmsCommandClient {
  send(
    command: GenerateDataKeyCommand | DecryptCommand,
  ): Promise<{
    Plaintext?: Uint8Array;
    CiphertextBlob?: Uint8Array;
    KeyId?: string;
  }>;
}

function bankingContext(tenantId: string) {
  if (!/^[a-z0-9][a-z0-9-]{2,79}$/i.test(tenantId)) {
    throw new Error("BANKING_TENANT_INVALID");
  }
  return {
    catalystTenant: tenantId,
    catalystPurpose: "supplier-banking" as const,
  };
}

function additionalAuthenticatedData(context: BankingEnvelope["encryptionContext"]) {
  return Buffer.from(
    `${context.catalystTenant}|${context.catalystPurpose}|v1`,
    "utf8",
  );
}

function kmsClient(region: string) {
  return new KMSClient({ region }) as KmsCommandClient;
}

export async function encryptBankingField(input: {
  tenantId: string;
  plaintext: string | Uint8Array;
  kmsKeyId?: string;
  awsRegion?: string;
  client?: KmsCommandClient;
}): Promise<BankingEnvelope> {
  if (
    (typeof input.plaintext === "string" && !input.plaintext) ||
    (typeof input.plaintext !== "string" && input.plaintext.byteLength === 0)
  ) {
    throw new Error("BANKING_PLAINTEXT_REQUIRED");
  }
  const kmsKeyId = input.kmsKeyId ?? process.env.AWS_KMS_BANKING_KEY_ID;
  const awsRegion = input.awsRegion ?? process.env.AWS_REGION;
  if (!kmsKeyId || !awsRegion) throw new Error("BANKING_KMS_UNAVAILABLE");

  const context = bankingContext(input.tenantId);
  const client = input.client ?? kmsClient(awsRegion);
  const generated = await client.send(
    new GenerateDataKeyCommand({
      KeyId: kmsKeyId,
      KeySpec: "AES_256",
      EncryptionContext: context,
    }),
  );
  if (
    !generated.Plaintext ||
    generated.Plaintext.byteLength !== 32 ||
    !generated.CiphertextBlob ||
    !generated.KeyId
  ) {
    throw new Error("BANKING_DATA_KEY_GENERATION_FAILED");
  }

  const plaintextDataKey = Buffer.from(generated.Plaintext);
  try {
    const initializationVector = randomBytes(12);
    const cipher = createCipheriv(
      "aes-256-gcm",
      plaintextDataKey,
      initializationVector,
    );
    cipher.setAAD(additionalAuthenticatedData(context));
    const ciphertext = Buffer.concat([
      cipher.update(
        typeof input.plaintext === "string"
          ? Buffer.from(input.plaintext, "utf8")
          : input.plaintext,
      ),
      cipher.final(),
    ]);
    return {
      schemaVersion: 1,
      algorithm: "AES-256-GCM",
      ciphertext: ciphertext.toString("base64"),
      encryptedDataKey: Buffer.from(generated.CiphertextBlob).toString("base64"),
      initializationVector: initializationVector.toString("base64"),
      authenticationTag: cipher.getAuthTag().toString("base64"),
      kmsKeyId: generated.KeyId,
      encryptionContext: context,
    };
  } finally {
    plaintextDataKey.fill(0);
    generated.Plaintext.fill(0);
  }
}

export async function decryptBankingField(input: {
  tenantId: string;
  envelope: BankingEnvelope;
  awsRegion?: string;
  client?: KmsCommandClient;
}) {
  const context = bankingContext(input.tenantId);
  if (
    input.envelope.schemaVersion !== 1 ||
    input.envelope.algorithm !== "AES-256-GCM" ||
    input.envelope.encryptionContext.catalystTenant !== context.catalystTenant ||
    input.envelope.encryptionContext.catalystPurpose !==
      context.catalystPurpose
  ) {
    throw new Error("BANKING_ENVELOPE_CONTEXT_MISMATCH");
  }
  const awsRegion = input.awsRegion ?? process.env.AWS_REGION;
  if (!awsRegion) throw new Error("BANKING_KMS_UNAVAILABLE");
  const client = input.client ?? kmsClient(awsRegion);
  const decrypted = await client.send(
    new DecryptCommand({
      CiphertextBlob: Buffer.from(input.envelope.encryptedDataKey, "base64"),
      KeyId: input.envelope.kmsKeyId,
      EncryptionContext: context,
    }),
  );
  if (!decrypted.Plaintext || decrypted.Plaintext.byteLength !== 32) {
    throw new Error("BANKING_DATA_KEY_DECRYPTION_FAILED");
  }

  const plaintextDataKey = Buffer.from(decrypted.Plaintext);
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      plaintextDataKey,
      Buffer.from(input.envelope.initializationVector, "base64"),
    );
    decipher.setAAD(additionalAuthenticatedData(context));
    decipher.setAuthTag(
      Buffer.from(input.envelope.authenticationTag, "base64"),
    );
    return Buffer.concat([
      decipher.update(Buffer.from(input.envelope.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } finally {
    plaintextDataKey.fill(0);
    decrypted.Plaintext.fill(0);
  }
}
