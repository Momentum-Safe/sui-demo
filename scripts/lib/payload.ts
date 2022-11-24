import {bcs} from "@mysten/sui.js";

export const enum PayloadType {
    None,
    AssetWithdraw,
    CoinWithdraw,
    OwnerChange
}

export const PayloadTypeLiteral = {
    [PayloadType.None]: '',
    [PayloadType.AssetWithdraw] : 'PayloadAssetWithdraw',
    [PayloadType.CoinWithdraw] : 'PayloadCoinWithdraw',
    [PayloadType.OwnerChange] : 'PayloadOwnerChange',
}

bcs.registerStructType(PayloadTypeLiteral[PayloadType.AssetWithdraw], {
    to: 'address',
    asset_id: 'address',
}).registerStructType(PayloadTypeLiteral[PayloadType.CoinWithdraw], {
    to: 'address',
    coin_type: 'vector<u8>',
    amount: 'u64',
}).registerStructType(PayloadTypeLiteral[PayloadType.OwnerChange], {
    owners: 'vector<address>',
    threshold: 'u64'
});

