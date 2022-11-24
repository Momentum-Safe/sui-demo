import {JsonRpcProvider, Network} from '@mysten/sui.js';

export const DEFAULT_NETWORK = (process.env.NETWORK || Network.LOCAL).toUpperCase();
export const default_provider = new JsonRpcProvider(DEFAULT_NETWORK);