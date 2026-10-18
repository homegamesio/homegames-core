'use strict';
const { createPrivateKey, createPublicKey, generateKeyPair, webcrypto } = require('node:crypto');
const { promisify } = require('node:util');
const { Pkcs10CertificateRequestGenerator, SubjectAlternativeNameExtension } = require('@peculiar/x509');

// Only the CSR leaves the host. Preserve the key during renewal, including
// legacy RSA/EC PEM encodings, so a working TLS pair can be replaced atomically.
async function createCsr({ commonName, altNames = [] }, existingKey) {
    const names = [...new Set([commonName, ...altNames])];
    if (names.some(name => typeof name !== 'string' || name.length > 253 ||
        !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(name))) throw new Error('Invalid certificate hostname');
    const key = existingKey ? createPrivateKey(existingKey) : (await promisify(generateKeyPair)('rsa', { modulusLength: 2048 })).privateKey;
    const jwk = key.export({ format: 'jwk' });
    let algorithm;
    if (jwk.kty === 'RSA' && key.asymmetricKeyDetails.modulusLength >= 2048) algorithm = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
    else if (jwk.kty === 'EC' && ['P-256', 'P-384', 'P-521'].includes(jwk.crv)) algorithm = {
        name: 'ECDSA', namedCurve: jwk.crv, hash: { 'P-256': 'SHA-256', 'P-384': 'SHA-384', 'P-521': 'SHA-512' }[jwk.crv],
    };
    else throw new Error('Unsupported certificate key');
    const [privateKey, publicKey] = await Promise.all([
        webcrypto.subtle.importKey('jwk', jwk, algorithm, false, ['sign']),
        webcrypto.subtle.importKey('jwk', createPublicKey(key).export({ format: 'jwk' }), algorithm, true, ['verify']),
    ]);
    const csr = await Pkcs10CertificateRequestGenerator.create({ name: `CN=${commonName}`, keys: { privateKey, publicKey },
        signingAlgorithm: algorithm, extensions: [new SubjectAlternativeNameExtension(names.map(value => ({ type: 'dns', value })))] }, webcrypto);
    return [Buffer.from(existingKey || key.export({ format: 'pem', type: 'pkcs8' })), Buffer.from(csr.toString('pem'))];
}
module.exports = { createCsr };
