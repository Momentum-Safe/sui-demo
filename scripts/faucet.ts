
import { JsonRpcProvider, Network } from '@mysten/sui.js';

const provider = new JsonRpcProvider(Network.LOCAL);

async function main() {
    const [,,to] = process.argv;
    console.log("----faucet to", to);
    await provider.requestSuiFromFaucet(to);
    const coins = await provider.getCoinBalancesOwnedByAddress(to);
    console.log("coins:", coins.map(coin=>coin.details));
}
main()