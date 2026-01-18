/**
 * Stance Encryption and Security
 *
 * AES-256 encryption for sensitive stance configurations,
 * key management, access tokens, and audit trail encryption.
 */
export class StanceEncryption {
    config;
    keys = new Map();
    tokens = new Map();
    auditLog = [];
    activeKeyId = null;
    constructor(config) {
        this.config = {
            algorithm: 'aes-256-gcm',
            keyDerivation: 'pbkdf2',
            iterations: 100000,
            saltLength: 32,
            ivLength: 16,
            ...config
        };
    }
    async generateKey(passphrase) {
        const salt = this.generateRandomBytes(this.config.saltLength);
        const key = await this.deriveKey(passphrase, salt);
        const keyId = `key-${Date.now()}-${this.generateRandomString(6)}`;
        const keyInfo = {
            id: keyId,
            algorithm: this.config.algorithm,
            createdAt: new Date(),
            status: 'active'
        };
        this.keys.set(keyId, { key, info: keyInfo });
        this.activeKeyId = keyId;
        this.recordAudit('key-generate', 'system', undefined, keyId);
        return keyInfo;
    }
    async deriveKey(passphrase, salt) {
        // Simulated key derivation (in production, use Web Crypto API or crypto module)
        const encoder = new TextEncoder();
        const data = encoder.encode(passphrase);
        let key = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
            key[i] = (data[i % data.length] ^ salt[i % salt.length]) & 0xff;
        }
        // Multiple iterations for key stretching
        for (let iter = 0; iter < Math.min(this.config.iterations, 1000); iter++) {
            const newKey = new Uint8Array(32);
            for (let i = 0; i < 32; i++) {
                newKey[i] = (key[i] ^ key[(i + 1) % 32] ^ (iter & 0xff)) & 0xff;
            }
            key = newKey;
        }
        return key;
    }
    async encrypt(stance, keyId) {
        const useKeyId = keyId || this.activeKeyId;
        if (!useKeyId) {
            throw new Error('No encryption key available');
        }
        const keyData = this.keys.get(useKeyId);
        if (!keyData || keyData.info.status !== 'active') {
            throw new Error('Key not found or not active');
        }
        const plaintext = JSON.stringify(stance);
        const iv = this.generateRandomBytes(this.config.ivLength);
        const salt = this.generateRandomBytes(this.config.saltLength);
        // Simulated encryption (in production, use Web Crypto API)
        const ciphertext = this.simulateEncrypt(plaintext, keyData.key, iv);
        const encrypted = {
            id: `enc-${Date.now()}-${this.generateRandomString(6)}`,
            ciphertext: this.bytesToBase64(ciphertext),
            iv: this.bytesToBase64(iv),
            authTag: this.generateRandomString(32),
            salt: this.bytesToBase64(salt),
            algorithm: this.config.algorithm,
            version: 1,
            createdAt: new Date(),
            metadata: {
                keyId: useKeyId,
                obfuscated: false,
                auditEncrypted: false,
                compressionUsed: false
            }
        };
        this.recordAudit('encrypt', 'system', encrypted.id, useKeyId);
        return encrypted;
    }
    async decrypt(encrypted, keyId) {
        const useKeyId = keyId || encrypted.metadata.keyId;
        const keyData = this.keys.get(useKeyId);
        if (!keyData) {
            throw new Error('Decryption key not found');
        }
        const iv = this.base64ToBytes(encrypted.iv);
        const ciphertext = this.base64ToBytes(encrypted.ciphertext);
        // Simulated decryption (in production, use Web Crypto API)
        const plaintext = this.simulateDecrypt(ciphertext, keyData.key, iv);
        this.recordAudit('decrypt', 'system', encrypted.id, useKeyId);
        return JSON.parse(plaintext);
    }
    simulateEncrypt(plaintext, key, iv) {
        const encoder = new TextEncoder();
        const data = encoder.encode(plaintext);
        const result = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) {
            result[i] = (data[i] ^ key[i % key.length] ^ iv[i % iv.length]) & 0xff;
        }
        return result;
    }
    simulateDecrypt(ciphertext, key, iv) {
        const result = new Uint8Array(ciphertext.length);
        for (let i = 0; i < ciphertext.length; i++) {
            result[i] = (ciphertext[i] ^ key[i % key.length] ^ iv[i % iv.length]) & 0xff;
        }
        const decoder = new TextDecoder();
        return decoder.decode(result);
    }
    issueToken(keyId, permissions, userId, durationMs = 3600000) {
        const token = {
            token: this.generateRandomString(64),
            keyId,
            permissions,
            issuedAt: new Date(),
            expiresAt: new Date(Date.now() + durationMs),
            issuedTo: userId,
            revoked: false
        };
        this.tokens.set(token.token, token);
        this.recordAudit('token-issue', userId, undefined, keyId);
        return token;
    }
    validateToken(tokenString) {
        const token = this.tokens.get(tokenString);
        if (!token) {
            return { valid: false, permissions: [] };
        }
        if (token.revoked) {
            return { valid: false, permissions: [] };
        }
        if (token.expiresAt < new Date()) {
            return { valid: false, permissions: [] };
        }
        return { valid: true, permissions: token.permissions };
    }
    revokeToken(tokenString) {
        const token = this.tokens.get(tokenString);
        if (!token)
            return false;
        token.revoked = true;
        this.recordAudit('token-revoke', token.issuedTo, undefined, token.keyId);
        return true;
    }
    async rotateKey(passphrase) {
        const oldKeyId = this.activeKeyId;
        // Generate new key
        const newKeyInfo = await this.generateKey(passphrase);
        // Mark old key as rotated
        if (oldKeyId) {
            const oldKeyData = this.keys.get(oldKeyId);
            if (oldKeyData) {
                oldKeyData.info.status = 'rotated';
                newKeyInfo.rotatedFrom = oldKeyId;
            }
        }
        this.recordAudit('key-rotate', 'system', undefined, newKeyInfo.id);
        return newKeyInfo;
    }
    revokeKey(keyId) {
        const keyData = this.keys.get(keyId);
        if (!keyData)
            return false;
        keyData.info.status = 'revoked';
        this.recordAudit('key-revoke', 'system', undefined, keyId);
        // Revoke all tokens using this key
        for (const [_, token] of this.tokens) {
            if (token.keyId === keyId) {
                token.revoked = true;
            }
        }
        return true;
    }
    obfuscate(stance, config) {
        const obfConfig = {
            level: 'medium',
            preserveStructure: true,
            ...config
        };
        const obfuscated = JSON.parse(JSON.stringify(stance));
        // Obfuscate values based on level
        const noise = obfConfig.level === 'light' ? 5 : obfConfig.level === 'medium' ? 10 : 20;
        const seed = obfConfig.deterministicSeed ?? Date.now();
        const valueKeys = Object.keys(obfuscated.values);
        for (const key of valueKeys) {
            const randomOffset = this.seededRandom(seed + key.charCodeAt(0)) * noise * 2 - noise;
            obfuscated.values[key] = Math.max(0, Math.min(100, obfuscated.values[key] + randomOffset));
        }
        // Obfuscate sentience levels
        obfuscated.sentience.awarenessLevel += (this.seededRandom(seed + 1) * noise * 2 - noise);
        obfuscated.sentience.autonomyLevel += (this.seededRandom(seed + 2) * noise * 2 - noise);
        obfuscated.sentience.identityStrength += (this.seededRandom(seed + 3) * noise * 2 - noise);
        // Clamp values
        obfuscated.sentience.awarenessLevel = Math.max(0, Math.min(100, obfuscated.sentience.awarenessLevel));
        obfuscated.sentience.autonomyLevel = Math.max(0, Math.min(100, obfuscated.sentience.autonomyLevel));
        obfuscated.sentience.identityStrength = Math.max(0, Math.min(100, obfuscated.sentience.identityStrength));
        this.recordAudit('obfuscate', 'system');
        return obfuscated;
    }
    seededRandom(seed) {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }
    encryptAuditLog() {
        if (!this.activeKeyId) {
            throw new Error('No encryption key available');
        }
        const keyData = this.keys.get(this.activeKeyId);
        const plaintext = JSON.stringify(this.auditLog);
        const iv = this.generateRandomBytes(this.config.ivLength);
        const ciphertext = this.simulateEncrypt(plaintext, keyData.key, iv);
        return JSON.stringify({
            ciphertext: this.bytesToBase64(ciphertext),
            iv: this.bytesToBase64(iv),
            keyId: this.activeKeyId
        });
    }
    recordAudit(action, userId, stanceId, keyId) {
        this.auditLog.push({
            id: `audit-${Date.now()}-${this.generateRandomString(6)}`,
            action,
            timestamp: new Date(),
            userId,
            stanceId,
            keyId,
            encrypted: false
        });
        // Limit audit log size
        if (this.auditLog.length > 10000) {
            this.auditLog = this.auditLog.slice(-5000);
        }
    }
    getAuditLog() {
        return [...this.auditLog];
    }
    getKeyInfo(keyId) {
        return this.keys.get(keyId)?.info;
    }
    listKeys() {
        return Array.from(this.keys.values()).map(k => k.info);
    }
    generateRandomBytes(length) {
        const bytes = new Uint8Array(length);
        for (let i = 0; i < length; i++) {
            bytes[i] = Math.floor(Math.random() * 256);
        }
        return bytes;
    }
    generateRandomString(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    bytesToBase64(bytes) {
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
    base64ToBytes(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }
    exportEncrypted(stance, format = 'json') {
        return this.encrypt(stance).then(encrypted => {
            if (format === 'json') {
                return JSON.stringify(encrypted, null, 2);
            }
            else {
                return new TextEncoder().encode(JSON.stringify(encrypted));
            }
        });
    }
    async importEncrypted(data) {
        const jsonStr = typeof data === 'string' ? data : new TextDecoder().decode(data);
        const encrypted = JSON.parse(jsonStr);
        return this.decrypt(encrypted);
    }
}
export function createStanceEncryption(config) {
    return new StanceEncryption(config);
}
//# sourceMappingURL=encryption.js.map