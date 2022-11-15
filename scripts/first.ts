
import { Ed25519Keypair, JsonRpcProvider, RawSigner, Network } from '@mysten/sui.js';
// Generate a new Ed25519 Keypair
const keypair = new Ed25519Keypair();
// connect to local RPC server
const provider = new JsonRpcProvider(Network.LOCAL);

async function main() {
    console.log("----main")
    const signer = new RawSigner(keypair, provider);
    const address = await signer.getAddress();
    console.log("address:", address);


    console.log("requestSuiFromFaucet:", address);
    // get tokens from the local faucet server
    await provider.requestSuiFromFaucet(address);
    console.log("transfer:", address);
    const transferTxn = await signer.transferObject({
        objectId: '0x5015b016ab570df14c87649eda918e09e5cc61e0',
        gasBudget: 1000,
        recipient: '0xd84058cb73bdeabe123b56632713dcd65e1a6c92',
    });
    console.log('transferTxn', transferTxn);
}
main()