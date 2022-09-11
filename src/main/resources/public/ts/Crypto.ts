import * as J from "./JavaIntf";
import { S } from "./Singletons";

/*
SYMMETRIC ENCRYPTION and PUBLIC KEY ENCRYPTION
---------------------
We will be using LocalDB.ts implementation to store the keys in the browser, but we will also support
allowing the user to cut-n-paste they Key JSON, so that if something goes wrong with the
browser storage the user will not loose their keys because they will be able
to reimport the JSON key text back in at any time, or install the keys in a different browser.

At no point in time does the users' Private Key ever leave their own browser storage.

TIP: (Not currenty used)
Original way I had for creating a hashe-based key from a password:

    let hashPromise = this.crypto.subtle.digest({ name: "SHA-256" }, this.convertStringToByteArray(password));
    hashPromise.then((hash: any) => {
    let keyPromise = this.crypto.subtle.importKey("raw", hash, { name: "AES-CBC" }, false, ["encrypt", "decrypt"]);
*/

export class Crypto {
    static readonly avail: boolean = !!(crypto?.subtle);

    // cache the keys here for faster access.
    privateEncKey: CryptoKey = null;
    publicEncKey: CryptoKey = null;
    privateSigKey: CryptoKey = null;
    publicSigKey: CryptoKey = null;

    static FORMAT_PEM: string = "pem";

    // asymetric ENCRYPTION keys (public/private)
    STORE_ASYMKEY = "asymkey";

    // symmetric ENCRYPTION key
    STORE_SYMKEY = "symkey";

    // signature sign/verify keys (public/private)
    STORE_SIGKEY = "sigkey";

    // 'Public Key' AES Encryption algo.
    ASYM_ALGO = "RSA-OAEP";

    SIG_ALGO = "RSASSA-PKCS1-v1_5";

    // Symmetric Algo. We use GCM mode of AES because it detects data corruptions during decryption
    SYM_ALGO = "AES-GCM";

    HASH_ALGO = "SHA-256";

    ASYM_IMPORT_ALGO = {
        name: "RSA-OAEP",
        hash: "SHA-256"
    };

    OP_ENC_DEC: KeyUsage[] = ["encrypt", "decrypt"];
    OP_SIGN_VERIFY: KeyUsage[] = ["sign", "verify"];
    OP_ENC: KeyUsage[] = ["encrypt"];
    OP_DEC: KeyUsage[] = ["decrypt"];

    vector: Uint8Array = null;

    logKeys: boolean = false;

    constructor() {
        /* WARNING: Crypto (or at least subtle) will not be available except on Secure Origin, which means a SSL (https)
        web address plus also localhost */

        if (!Crypto.avail) {
            console.log("WebCryptoAPI not available");
            return;
        }

        /*
        Note: This vector is merely required
        to be large enough and random enough, but is not required to be secret. 16 randomly chosen prime numbers.
        WARNING: If you change this you will NEVER be able to recover any data encrypted with it in effect, even with the correct password. So
        beware if you change this you've basically lost ALL your passwords. So just don't change it.

        todo-2: According to some crypto experts, this initialization vector should not be reused like this but instead stored
        along with the encryption key.
        */
        // iv = window.crypto.getRandomValues(new Uint8Array(16)); <--- I saw this in a reputable example. Try it out!
        this.vector = new Uint8Array([71, 73, 79, 83, 89, 37, 41, 47, 53, 67, 97, 103, 107, 109, 127, 131]);
    }

    /* Runs a full test of all encryption code.

       Assumes that Encryption.initKeys() has previously been called, which is
       safe to assume because we run it during app initialization.
    */
    encryptionTest = async (): Promise<string> => {
        this.runConversionTest();
        await this.runPublicKeyTest();
        await this.symetricEncryptionTest();
        await this.secureMessagingTest();
        console.log("All Encryption Tests: OK");
        return "";
    }

    signatureTest = async (): Promise<string> => {
        const myData = "Data to be Signed";
        const signature = await this.sign(null, myData);
        console.log("Signature: " + signature);
        const verified = await this.verify(null, signature, myData);
        console.log("signatureTest Encryption Tests: Verified=" + verified);
        return "";
    }

    /* Returns hex string representing the signature data */
    sign = async (privateKey: CryptoKey, data: string): Promise<string> => {
        if (!Crypto.avail) return null;
        if (!privateKey) {
            privateKey = await this.getPrivateSigKey();
        }

        const sigBuf: ArrayBuffer = await crypto.subtle.sign(this.SIG_ALGO,
            privateKey,
            new TextEncoder().encode(data));

        return S.util.buf2hex(new Uint8Array(sigBuf));
    }

    verify = async (publicKey: CryptoKey, sigBuf: string, data: string): Promise<boolean> => {
        if (!Crypto.avail) return null;
        publicKey = publicKey || await this.getPublicSigKey();

        return await crypto.subtle.verify(this.SIG_ALGO,
            publicKey,
            S.util.hex2buf(sigBuf),
            new TextEncoder().encode(data));
    }

    secureMessagingTest = async () => {
        console.log("running secureMessagingTest...");
        const clearText = "This is cleartext";
        const skdp: SymKeyDataPackage = await this.encryptSharableString(null, clearText);
        const checkText = await this.decryptSharableString(null, skdp);
        S.util.assert(checkText === clearText, "verifying cleartext");
        console.log("secureMessagingTest: OK");
    }

    symetricEncryptionTest = async (): Promise<boolean> => {
        const clearText = "Encrypt this string.";

        // test symetric encryption
        const obj: any = await S.localDB.readObject(this.STORE_SYMKEY);
        if (obj) {
            // simple encrypt/decrypt
            const key: CryptoKey = obj.val;
            const encHex = await this.symEncryptString(key, clearText);
            const unencText = await this.symDecryptString(key, encHex);
            S.util.assert(clearText === unencText, "Symmetric decrypt");

            // test symetric key export/import
            const keyDat: JsonWebKey = await crypto.subtle.exportKey("jwk", key) as JsonWebKey;

            const key2: CryptoKey = await crypto.subtle.importKey("jwk", keyDat, this.SYM_ALGO /* as AlgorithmIdentifier */, true, this.OP_ENC_DEC as KeyUsage[]);

            const encHex2 = await this.symEncryptString(key2, clearText);
            const unencText2 = await this.symDecryptString(key2, encHex2);
            S.util.assert(clearText === unencText2, "Symetric decrypt, using imported key");
            console.log("sym enc test: OK");
            return true;
        }
        return false;
    }

    runPublicKeyTest = async (): Promise<boolean> => {
        const clearText = "Encrypt this string.";
        let ret: boolean = false;

        // test public key encryption
        const obj: any = await S.localDB.readObject(this.STORE_ASYMKEY);
        if (obj) {
            // results += "STORE_ASYMKEY: \n"+S.util.prettyPrint(obj)+"\n\n";

            // simple encrypt/decrypt
            const encHex = await this.asymEncryptString(obj.val.publicKey, clearText);
            const unencText = await this.asymDecryptString(obj.val.privateKey, encHex);
            S.util.assert(clearText === unencText, "Asym encryption");

            // Export keys to a string format
            const publicKeyStr = await crypto.subtle.exportKey("jwk", obj.val.publicKey);
            // console.log("EXPORTED PUBLIC KEY: " + S.util.toJson(publicKeyStr) + "\n");
            const privateKeyStr = await crypto.subtle.exportKey("jwk", obj.val.privateKey);
            // console.log("EXPORTED PRIVATE KEY: " + S.util.toJson(publicKeyStr) + "\n");

            const publicKey = await crypto.subtle.importKey("jwk", publicKeyStr, {
                name: this.ASYM_ALGO,
                hash: this.HASH_ALGO
            }, true, this.OP_ENC);

            const privateKey = await crypto.subtle.importKey("jwk", privateKeyStr, {
                name: this.ASYM_ALGO,
                hash: this.HASH_ALGO
            }, true, this.OP_DEC);

            const encHex2 = await this.asymEncryptString(publicKey, clearText);
            const unencText2 = await this.asymDecryptString(privateKey, encHex2);
            S.util.assert(clearText === unencText2, "Asym encrypt test using imported keys.");

            console.log("publicKeyTest: OK");
            ret = true;
        }
        return ret;
    }

    runConversionTest = () => {
        // First test conversion of clear-text string to hex texct, and back.
        const clearText = "Encrypt this string.";
        const clearTextBytes: Uint8Array = this.convertStringToByteArray(clearText);
        const hexOfClearText: string = S.util.buf2hex(clearTextBytes);
        const verifyClearTextBytes: Uint8Array = S.util.hex2buf(hexOfClearText);
        const verifyClearText: string = this.convertByteArrayToString(verifyClearTextBytes);
        S.util.assert(clearText === verifyClearText, "encryption encodings");
        console.log("runConversionTest OK.");
    }

    importKey = async (key: JsonWebKey, algos: any, extractable: boolean, keyUsages: KeyUsage[]): Promise<CryptoKey> => {
        if (!Crypto.avail) return null;
        return crypto.subtle.importKey("jwk", key, algos, extractable, keyUsages);
    }

    importKeyPair = async (keyPair: string): Promise<boolean> => {
        if (!Crypto.avail) return null;
        const keyPairObj: EncryptionKeyPair = JSON.parse(keyPair);

        const publicKey = await crypto.subtle.importKey("jwk", keyPairObj.publicKey, {
            name: this.ASYM_ALGO,
            hash: this.HASH_ALGO
        }, true, this.OP_ENC as KeyUsage[]);

        const privateKey = await crypto.subtle.importKey("jwk", keyPairObj.privateKey, {
            name: this.ASYM_ALGO,
            hash: this.HASH_ALGO
        }, true, this.OP_DEC as KeyUsage[]);

        if (publicKey && privateKey) {
            const newKeyPair: EncryptionKeyPair = new EncryptionKeyPair(publicKey, privateKey);
            await S.localDB.writeObject({ name: this.STORE_ASYMKEY, val: newKeyPair });
        }
        return true;
    }

    initKeys = async (forceUpdate: boolean = false, republish: boolean = false, showConfirm: boolean = false) => {
        if (!Crypto.avail) return;
        const asymEncKey = await this.initAsymetricKeys(forceUpdate, republish, showConfirm);
        await this.initSymetricKey(forceUpdate);
        const sigKey = await this.initSigKeys(forceUpdate, republish, showConfirm);

        if (republish && (asymEncKey || sigKey)) {
            const res = await S.rpcUtil.rpc<J.SavePublicKeyRequest, J.SavePublicKeyResponse>("savePublicKeys", {
                // todo-0: I'm not sure I want to keep these as escaped JSON or convert to hex
                asymEncKey,
                sigKey
            });

            if (showConfirm) {
                S.util.showMessage(res.message, "Published Public Keys");
            }
        }
    }

    getPrivateEncKey = async (): Promise<CryptoKey> => {
        if (this.privateEncKey) return this.privateEncKey;
        this.privateEncKey = await this.getPrivateKey(S.crypto.STORE_ASYMKEY);
        return this.privateEncKey;
    }

    getPublicEncKey = async (): Promise<CryptoKey> => {
        if (this.publicEncKey) return this.publicEncKey;
        this.publicEncKey = await this.getPublicKey(S.crypto.STORE_ASYMKEY);
        return this.publicEncKey;
    }

    getPrivateSigKey = async (): Promise<CryptoKey> => {
        if (this.privateSigKey) return this.privateSigKey;
        this.privateSigKey = await this.getPrivateKey(S.crypto.STORE_SIGKEY);
        return this.privateSigKey;
    }

    getPublicSigKey = async (): Promise<CryptoKey> => {
        if (this.publicSigKey) return this.publicSigKey;
        this.publicSigKey = await this.getPublicKey(S.crypto.STORE_SIGKEY);
        return this.publicSigKey;
    }

    getPrivateKey = async (storeName: string): Promise<CryptoKey> => {
        const val: any = await S.localDB.readObject(storeName);
        if (!val || !val.val) {
            console.error("Unable to get private key.");
            return null;
        }
        else {
            // console.log("getPrivateKey returning: " + S.util.prettyPrint(val.val.privateKey));
            return val.val.privateKey;
        }
    }

    getPublicKey = async (storeName: string): Promise<CryptoKey> => {
        const val: any = await S.localDB.readObject(storeName);
        if (!val || !val.val) {
            console.error("Unable to get public key.");
            return null;
        }
        else {
            // console.log("getPublicKey returning: " + S.util.prettyPrint(val.val.publicKey));
            return val.val.publicKey;
        }
    }

    initSymetricKey = async (forceUpdate: boolean = false) => {
        if (!Crypto.avail) return;
        const val: any = await S.localDB.readObject(this.STORE_SYMKEY);
        if (!val) {
            forceUpdate = true;
        }

        if (val && !forceUpdate) {
            if (this.logKeys) {
                const cryptoKey: CryptoKey = val.val;
                await crypto.subtle.exportKey("jwk", cryptoKey);
                // let symKeyStr = await crypto.subtle.exportKey(this.DEFAULT_KEY_FORMAT, cryptoKey);
                // console.log("symkey: " + S.util.toJson(symKeyStr));
            }
        }
        else {
            const key: CryptoKey = await this.genSymKey();
            await S.localDB.writeObject({ name: this.STORE_SYMKEY, val: key });
        }
    }

    /*
    Initialize keys for sign/verify.
    Note: a 'forceUpdate' always triggers the 'republish'
    */
    initSigKeys = async (forceUpdate: boolean = false, republish: boolean = false, showConfirm: boolean = false): Promise<string> => {
        if (!Crypto.avail) return null;
        let keyPair: CryptoKeyPair = null;
        let pubKeyStr: string = null;

        if (!forceUpdate) {
            /* Check to see if there is a key stored, and if not force it to be created
               val.val is the EncryptionKeyPair here.
            */
            const val: any = await S.localDB.readObject(this.STORE_SIGKEY);
            if (!val) {
                forceUpdate = true;
            }
        }

        if (forceUpdate) {
            // todo-0: need to vet these parameters, this just came from an example online.
            keyPair = await crypto.subtle.generateKey({
                name: this.SIG_ALGO,
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: { name: "SHA-256" }
            }, true, this.OP_SIGN_VERIFY);

            await S.localDB.writeObject({ name: this.STORE_SIGKEY, val: keyPair });

            const pubKeyDat = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
            pubKeyStr = JSON.stringify(pubKeyDat);
            // console.log("Exporting key string: " + pubKeyStr);
            republish = true;
        }

        if (republish) {
            if (!keyPair) {
                const val: any = await S.localDB.readObject(this.STORE_SIGKEY);
                keyPair = val.val;
            }

            if (!pubKeyStr) {
                const publicKeyDat = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
                pubKeyStr = JSON.stringify(publicKeyDat);
            }
        }
        return pubKeyStr;
    }

    /*
    Init keys for encryption.
    Note: a 'forceUpdate' always triggers the 'republish'
    */
    initAsymetricKeys = async (forceUpdate: boolean = false, republish: boolean = false, showConfirm: boolean = false): Promise<string> => {
        if (!Crypto.avail) return null;
        let keyPair: CryptoKeyPair = null;
        let pubKeyStr: string = null;

        if (!forceUpdate) {
            /* Check to see if there is a key stored, and if not force it to be created
               val.val is the EncryptionKeyPair here.
            */
            const val: any = await S.localDB.readObject(this.STORE_ASYMKEY);
            if (!val) {
                forceUpdate = true;
            }
        }

        if (forceUpdate) {
            keyPair = await crypto.subtle.generateKey({ //
                name: this.ASYM_ALGO, //
                modulusLength: 2048, //
                publicExponent: new Uint8Array([0x01, 0x00, 0x01]), //
                hash: { name: this.HASH_ALGO } //
            }, true, this.OP_ENC_DEC);

            await S.localDB.writeObject({ name: this.STORE_ASYMKEY, val: keyPair });

            const pubKeyDat = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
            pubKeyStr = JSON.stringify(pubKeyDat);
            // console.log("Exporting key string: " + pubKeyStr);
            republish = true;
        }

        if (republish) {
            if (!keyPair) {
                const val: any = await S.localDB.readObject(this.STORE_ASYMKEY);
                keyPair = val.val;
            }

            if (!pubKeyStr) {
                const publicKeyDat = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
                pubKeyStr = JSON.stringify(publicKeyDat);
            }
        }
        return pubKeyStr;
    }

    genSymKey = async (): Promise<CryptoKey> => {
        if (!Crypto.avail) return null;
        const key: CryptoKey = await window.crypto.subtle.generateKey({
            name: this.SYM_ALGO,
            length: 256
        }, true, this.OP_ENC_DEC);
        return key;
    }

    /**
     * Returns a string the user can save locally containing all encryption keys stored  in the browser.
     *
     * Export is in JWK format: https://tools.ietf.org/html/rfc7517
     */
    exportKeys = async (): Promise<string> => {
        if (!Crypto.avail) return null;
        let ret = "";

        let obj: any = await S.localDB.readObject(this.STORE_ASYMKEY);
        if (obj) {
            ret += "Encryption Keypair\n";
            ret += "====================\n"
            const keyPair: EncryptionKeyPair = obj.val;

            const pubDat = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
            // this.importKey(this.OP_ENCRYPT, "public", this.publicKeyJson);

            const privDat = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
            // this.importKey(this.OP_DECRYPT, "private", this.privateKeyJson);

            ret += "Key Pair (JWK Format):\n" + S.util.prettyPrint({ publicKey: pubDat, privateKey: privDat }) + "\n\n";

            // yes we export to spki for PEM (not a bug)
            const privDatSpki = await crypto.subtle.exportKey("spki", keyPair.publicKey);
            const pem = this.spkiToPEM(privDatSpki);
            ret += "Public Key (PEM Format):\n" + pem + "\n\n";
        }

        obj = await S.localDB.readObject(this.STORE_SIGKEY);
        if (obj) {
            ret += "Signature Keypair\n";
            ret += "====================\n"
            const keyPair: EncryptionKeyPair = obj.val;

            const pubDat = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
            // this.importKey(this.OP_ENCRYPT, "public", this.publicKeyJson);

            const privDat = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
            // this.importKey(this.OP_DECRYPT, "private", this.privateKeyJson);

            ret += "Key Pair (JWK Format):\n" + S.util.prettyPrint({ publicKey: pubDat, privateKey: privDat }) + "\n\n";

            // yes we export to spki for PEM (not a bug)
            const privDatSpki = await crypto.subtle.exportKey("spki", keyPair.publicKey);
            const pem = this.spkiToPEM(privDatSpki);
            ret += "Public Key (PEM Format):\n" + pem + "\n\n";
        }

        obj = await S.localDB.readObject(this.STORE_SYMKEY);
        if (obj) {
            ret += "Symmetric Key\n";
            ret += "====================\n"
            const key: CryptoKey = obj.val;
            const dat = await crypto.subtle.exportKey("jwk", key);
            const keyStr = S.util.prettyPrint(dat);
            ret += "Symmetric Key (JWK Format):\n" + keyStr + "\n\n";
        }
        return ret;
    }

    spkiToPEM(keydata: any): any {
        const keydataS = this.arrayBufferToString(keydata);
        const keydataB64 = window.btoa(keydataS);
        const keydataB64Pem = this.formatAsPem(keydataB64);
        return keydataB64Pem;
    }

    arrayBufferToString(buffer: any): any {
        let binary = "";
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return binary;
    }

    formatAsPem(str: any): any {
        let finalString = "-----BEGIN PUBLIC KEY-----\n";

        while (str.length > 0) {
            finalString += str.substring(0, 64) + "\n";
            str = str.substring(64);
        }

        finalString = finalString + "-----END PUBLIC KEY-----";
        return finalString;
    }

    asymEncryptString = async (key: CryptoKey, data: string): Promise<string> => {
        return this.encryptString(key, this.ASYM_ALGO, data);
    }

    /**
     * Does a simplel symmetric encryption of the data using the given key, and if the key
     * is not provided assumes the STORE_SYMKEY
     */
    symEncryptString = async (key: CryptoKey, data: string): Promise<string> => {
        if (!key) {
            const obj: any = await S.localDB.readObject(this.STORE_SYMKEY);
            if (obj) {
                key = obj.val;
            }
        }
        return this.encryptString(key, this.SYM_ALGO, data);
    }

    symEncryptStringWithCipherKey = async (cipherKey: string, data: string): Promise<string> => {
        const privateKey = await S.crypto.getPrivateEncKey();
        const symKeyJsonStr: string = await S.crypto.asymDecryptString(privateKey, cipherKey);
        const symKeyJsonObj: JsonWebKey = JSON.parse(symKeyJsonStr);
        const symKey = await S.crypto.importKey(symKeyJsonObj, S.crypto.SYM_ALGO, true, S.crypto.OP_ENC_DEC);
        return await S.crypto.symEncryptString(symKey, data);
    }

    /**
     * This is the primary way of encrypting data that uses a randomly generated symmetric key to
     * do the encryption and then encrypts that symmetric key itself using the Public Key provided, or
     * public key of current user.
     *
     * This is a very standard approach in the crypto world, and it allows the owner of the associated
     * keypair (i.e. private key) to be able to share the data securely with arbitrary other users by simply publishing
     * this symmetric key (to the actual data) to individuals by encrypting said symmetric key with that
     * user's public key.
     *
     * Of course, this means the process is that when a user wants to read data shared to them they just use
     * their private key to decrypt the symmetric key to the data, and use that key to get the data.
     *
     * This function returns an object that contains two properties: ciphertext, cipherkey, which is the encrypted data
     * and the encrypted "JWK" formatted key to the data, respectively
     *
     * 'publicKey' argument should be the public key of the person doing the encryption (the person doing the encryption)
     * and if null, it's automatically retrieved from the localDB
     */
    encryptSharableString = async (publicKey: CryptoKey, data: string): Promise<SymKeyDataPackage> => {
        publicKey = publicKey || await this.getPublicEncKey();

        // generate random symmetric key
        const key: CryptoKey = await this.genSymKey();
        // console.log("Cleartext Sym Key: " + S.util.prettyPrint(key));

        // get JWK formatted key
        const jwk = await crypto.subtle.exportKey("jwk", key);

        // get JSON string of jwk
        const jwkJson = S.util.prettyPrint(jwk);

        // const pubKeyJson = await crypto.subtle.exportKey("jwk", publicKey);
        // console.log("Initial KEY encrypted with owner publicKey: " + S.util.prettyPrint(pubKeyJson));

        // encrypt the symetric key
        const cipherKey = await this.asymEncryptString(publicKey, jwkJson);

        // encrypt the data with the symetric key
        const cipherText = await this.symEncryptString(key, data);

        const ret: SymKeyDataPackage = { cipherText, cipherKey };
        return ret;
    }

    /* Inverse of  encryptSharableString() function */
    decryptSharableString = async (privateKey: CryptoKey, skpd: SymKeyDataPackage): Promise<string> => {
        let ret: string = null;

        // get hash of the encrypted data
        const cipherHash: string = S.util.hashOfString(skpd.cipherText);

        // if we have already decrypted this data return the result.
        if (S.quanta.decryptCache.get(cipherHash)) {
            // console.log("decryption cache hit!");
            return S.quanta.decryptCache.get(cipherHash);
        }

        try {
            // console.log("decrypting [" + skpd.cipherText + "] with cipherKey: " + skpd.cipherKey);
            privateKey = privateKey || await this.getPrivateEncKey();

            if (!privateKey) {
                console.log("unable to get privateKey");
                return null;
            }

            // const privKeyJson = await crypto.subtle.exportKey("jwk", privateKey);
            // console.log("calling asymDecryptString to get key: userPrivateKey=" + S.util.prettyPrint(privKeyJson));

            // Decrypt the symmetric key using our private key
            const symKeyJsonStr: string = await this.asymDecryptString(privateKey, skpd.cipherKey);

            const symKeyJsonObj: JsonWebKey = JSON.parse(symKeyJsonStr);
            const symKey = await crypto.subtle.importKey("jwk", symKeyJsonObj, this.SYM_ALGO, true, this.OP_ENC_DEC);
            ret = await this.symDecryptString(symKey, skpd.cipherText);
            // console.log("            output: [" + ret + "]");
            S.quanta.decryptCache.set(cipherHash, ret);
            return ret;
        }
        catch (ex) {
            // todo-2: this was happening when 'importKey' failed for admin user, but I think admin user may not store keys? Need to just
            // retest encryption
            S.util.logAndReThrow("decryptSharableString failed", ex);
            return null;
        }
    }

    /* Encrypts 'data' string and returns a hex representation of the ciphertext */
    encryptString = async (key: CryptoKey, algo: string, data: string): Promise<string> => {
        const result: ArrayBuffer = await crypto.subtle.encrypt({ name: algo, iv: this.vector }, //
            key, this.convertStringToByteArray(data));

        const encData = new Uint8Array(result);
        const encHex: string = S.util.buf2hex(encData);
        return encHex;
    }

    asymDecryptString = async (key: CryptoKey, encHex: string): Promise<string> => {
        return this.decryptString(key, this.ASYM_ALGO, encHex);
    }

    symDecryptString = async (key: CryptoKey, encHex: string): Promise<string> => {
        if (!key) {
            const obj: any = await S.localDB.readObject(this.STORE_SYMKEY);
            if (obj) {
                key = obj.val;
            }
        }
        return this.decryptString(key, this.SYM_ALGO, encHex);
    }

    /* Takes the input as a hex string, and decrypts it into the original non-hex string */
    decryptString = async (key: CryptoKey, algo: string, encHex: string): Promise<string> => {
        try {
            const encArray: Uint8Array = S.util.hex2buf(encHex);
            const result: ArrayBuffer = await crypto.subtle.decrypt({ name: algo, iv: this.vector }, //
                key, encArray);
            const resArray = new Uint8Array(result);
            const resStr: string = this.convertByteArrayToString(resArray);
            return resStr;
        }
        catch (ex) {
            S.util.logAndReThrow("decrypt FAILED.", ex);
            return null;
        }
    }

    // NOTE: TextEncoder() and TextDecoder() don't support this yet, so we have these two
    // functions.
    // This can work?? in browser?
    // const messageData = new TextEncoder().encode(message);
    convertStringToByteArray = (str: string): Uint8Array => {
        const bytes = new Uint8Array(str.length);
        for (let i = 0; i < str.length; i++) {
            bytes[i] = str.charCodeAt(i);
        }
        return bytes;
    }

    convertByteArrayToString = (buffer: Uint8Array): string => {
        let str = "";
        for (let i = 0; i < buffer.byteLength; i++) {
            str += String.fromCharCode(buffer[i]);
        }
        return str;
    }

    signNode = async (node: J.NodeInfo): Promise<void> => {
        if (!Crypto.avail) return null;
        let path: string = node.path;
        // convert any 'pending (p)' path to a final verion of the path (no '/p/')
        if (path.startsWith("/r/p/")) {
            path = "/r/" + path.substring(5);
        }

        // wip: Need a warning that moving a node removes it's digital signature, and
        // for now we can just blow away signatures when a node move happens, and make it a future feature
        let signData: string = path + "-" + node.ownerId;
        if (node.content) {
            signData += "-" + node.content;
        }

        // we need to concat the path+content
        try {
            const sig: string = await S.crypto.sign(null, signData);
            // console.log("signData: [" + signData + "] sig: " + sig);

            S.props.setPropVal(J.NodeProp.CRYPTO_SIG, node, sig);
        }
        catch (e) {
            S.util.logAndReThrow("Failed to sign data.", e);
        }
        return null;
    }

    // called after each "renderNode". A temporary hack to update admin signatures.
    renderNodeCryptoHook = (res: J.RenderNodeResponse) => {
        if (!Crypto.avail) return;
        if (res?.node) {
            this.autoSignNodes([res.node, ...(res.node.children || [])])
        }
    }

    autoSignNodes = async (children: J.NodeInfo[]) => {
        if (!Crypto.avail) return;
        const sigs: J.NodeSig[] = [];

        for (const child of children) {
            // todo-0: for now only auto-signing admin owned nodes
            if (child.owner !== J.PrincipalName.ADMIN) {
                continue;
            }
            let sig = S.props.getPropStr(J.NodeProp.CRYPTO_SIG, child);
            if (!sig) {
                await this.signNode(child);

                // get the sig that signNode will have just now put on the node.
                sig = S.props.getPropStr(J.NodeProp.CRYPTO_SIG, child);
                if (sig) {
                    // console.log("AutoSigning node: " + child.id + " sig: " + sig);
                    sigs.push({ nodeId: child.id, sig });
                }
            }
        }

        if (sigs.length > 0) {
            await S.rpcUtil.rpc<J.SaveNodeSigsRequest, J.SaveNodeSigsResponse>("saveNodeSigs", {
                sigs
            });
            S.util.showPageMessage("Set " + sigs.length + " signatures!");
        }
    }

    // ab2str = (buf: ArrayBuffer) => {
    //     return String.fromCharCode.apply(null, new Uint16Array(buf));
    // }

    // str2ab = (str) => {
    //     var buf = new ArrayBuffer(str.length * 2); // 2 bytes for each char
    //     var bufView = new Uint16Array(buf);
    //     for (var i = 0, strLen = str.length; i < strLen; i++) {
    //         bufView[i] = str.charCodeAt(i);
    //     }
    //     return buf;
    // }
}

export interface SymKeyDataPackage {
    cipherText: string;
    cipherKey: string;
    symKey?: CryptoKey;
}

export class EncryptionKeyPair {
    constructor(public publicKey: any, public privateKey: any) {
    }
}