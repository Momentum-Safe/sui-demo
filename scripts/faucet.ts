import {Provider} from "@mysten/sui.js";
import {default_provider} from "./lib/provider";

export async function faucet(to: string, provider: Provider = default_provider) {
    console.log("----faucet to", to);
    await provider.requestSuiFromFaucet(to);
    const coins = await provider.getCoinBalancesOwnedByAddress(to);
    console.log("coins:", coins.map(coin => coin.details));
}