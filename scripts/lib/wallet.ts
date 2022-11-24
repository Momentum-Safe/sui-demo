import {Ed25519Keypair, Provider, RawSigner} from "@mysten/sui.js";
import fs from "fs";
import path from "path";
import {default_provider} from "./provider";


export async function saveAccounts(accounts: RawSigner[], pathDir: string) {
    if (!fs.existsSync(pathDir)) fs.mkdirSync(pathDir);
    for (const account of accounts) {
        const address = await account.getAddress();
        const file = path.join(pathDir, address);
        fs.writeFileSync(file, (account as any).keypair.keypair.secretKey);
    }
}

export async function loadAccount(pathDir: string, address: string, privider: Provider = default_provider) {
    const accounts = loadAccounts(pathDir, privider);
    for (const account of accounts) {
        if (address == await account.getAddress()) {
            return account;
        }
    }
    throw `${address} not found in ${pathDir}`;
}

export function loadAccounts(pathDir: string, provider: Provider = default_provider): RawSigner[] {
    const files = fs.readdirSync(pathDir);
    const secretKeys = files.map(file => fs.readFileSync(path.join(pathDir, file)));
    const keypairs = secretKeys.map(secretKey => Ed25519Keypair.fromSecretKey(secretKey));
    return keypairs.map(keypair => new RawSigner(keypair, provider))
}

export function createAccount(provider: Provider = default_provider): RawSigner {
    const keypair = new Ed25519Keypair();
    return new RawSigner(keypair, provider);
}

export function createAccounts(count: number, provider: Provider = default_provider): RawSigner[] {
    return Array(count).fill(0).map(() => createAccount(provider));
}