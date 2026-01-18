/**
 * Stance Encryption and Security
 *
 * AES-256 encryption for sensitive stance configurations,
 * key management, access tokens, and audit trail encryption.
 */
import type { Stance } from '../types/index.js';
export interface EncryptionConfig {
    algorithm: 'aes-256-gcm' | 'aes-256-cbc' | 'chacha20-poly1305';
    keyDerivation: 'pbkdf2' | 'argon2' | 'scrypt';
    iterations: number;
    saltLength: number;
    ivLength: number;
}
export interface EncryptedStance {
    id: string;
    ciphertext: string;
    iv: string;
    authTag?: string;
    salt: string;
    algorithm: string;
    version: number;
    createdAt: Date;
    expiresAt?: Date;
    metadata: EncryptionMetadata;
}
export interface EncryptionMetadata {
    keyId: string;
    obfuscated: boolean;
    auditEncrypted: boolean;
    compressionUsed: boolean;
}
export interface AccessToken {
    token: string;
    keyId: string;
    permissions: TokenPermission[];
    issuedAt: Date;
    expiresAt: Date;
    issuedTo: string;
    revoked: boolean;
}
export type TokenPermission = 'read' | 'write' | 'decrypt' | 'admin';
export interface KeyInfo {
    id: string;
    algorithm: string;
    createdAt: Date;
    expiresAt?: Date;
    rotatedFrom?: string;
    status: 'active' | 'rotated' | 'revoked';
}
export interface AuditRecord {
    id: string;
    action: AuditAction;
    timestamp: Date;
    userId: string;
    stanceId?: string;
    keyId?: string;
    encrypted: boolean;
    details?: string;
}
export type AuditAction = 'encrypt' | 'decrypt' | 'key-generate' | 'key-rotate' | 'key-revoke' | 'token-issue' | 'token-revoke' | 'access-attempt' | 'obfuscate';
export interface ObfuscationConfig {
    level: 'light' | 'medium' | 'heavy';
    preserveStructure: boolean;
    deterministicSeed?: number;
}
export declare class StanceEncryption {
    private config;
    private keys;
    private tokens;
    private auditLog;
    private activeKeyId;
    constructor(config?: Partial<EncryptionConfig>);
    generateKey(passphrase: string): Promise<KeyInfo>;
    private deriveKey;
    encrypt(stance: Stance, keyId?: string): Promise<EncryptedStance>;
    decrypt(encrypted: EncryptedStance, keyId?: string): Promise<Stance>;
    private simulateEncrypt;
    private simulateDecrypt;
    issueToken(keyId: string, permissions: TokenPermission[], userId: string, durationMs?: number): AccessToken;
    validateToken(tokenString: string): {
        valid: boolean;
        permissions: TokenPermission[];
    };
    revokeToken(tokenString: string): boolean;
    rotateKey(passphrase: string): Promise<KeyInfo>;
    revokeKey(keyId: string): boolean;
    obfuscate(stance: Stance, config?: Partial<ObfuscationConfig>): Stance;
    private seededRandom;
    encryptAuditLog(): string;
    private recordAudit;
    getAuditLog(): AuditRecord[];
    getKeyInfo(keyId: string): KeyInfo | undefined;
    listKeys(): KeyInfo[];
    private generateRandomBytes;
    private generateRandomString;
    private bytesToBase64;
    private base64ToBytes;
    exportEncrypted(stance: Stance, format?: 'json' | 'binary'): Promise<string | Uint8Array>;
    importEncrypted(data: string | Uint8Array): Promise<Stance>;
}
export declare function createStanceEncryption(config?: Partial<EncryptionConfig>): StanceEncryption;
//# sourceMappingURL=encryption.d.ts.map