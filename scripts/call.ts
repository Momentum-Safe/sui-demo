import { RawSigner } from '@mysten/sui.js';
// Generate a new Keypair
abstract class SuiContract {
    constructor(public readonly address:string, public readonly module:string, public readonly signer: RawSigner) {
    }

    abstract connect(signer: RawSigner): SuiContract;

    async call(method:string, typeArguments: string[], callArguments: any[]) {
        const moveCallTxn = await this.signer.executeMoveCall({
            packageObjectId: this.address,
            module: this.module,
            function: method,
            typeArguments,
            arguments: callArguments,
            gasBudget: 10000,
        });
        return moveCallTxn;
    }
}

export class MsafeContract extends SuiContract {
    connect(signer: RawSigner) {
        return new MsafeContract(this.address, this.module, signer);
    }

    async create_mafe(owners: string[], threshold: bigint|string|number, metadata: string) {
        return super.call('create_mafe', [] as string[], [owners, threshold.toString(), metadata]);
    }

    async deposit(msafe: string, asset: string, asset_type:string) {
        return super.call('deposit', [asset_type], [msafe, asset])
    }

    async deposit_coin(msafe: string, asset: string, coin_typeT:string) {
        return super.call('deposit_coin', [coin_typeT], [msafe, asset])
    }

    async create_txn(msafe: string, nonce: bigint|string|number, type: bigint|string|number, payload: string, expiration: number) {
        return super.call('create_txn', [], [msafe, nonce.toString(), type.toString(), payload, expiration]);
    }

    async confirm_txn(msafe: string, txid: string) {
        return super.call('confirm_txn', [], [msafe, txid]);
    }
    async execute_asset_txn(msafe: string, txid: string, asset_type:string) {
        return super.call('execute_asset_txn', [asset_type], [msafe, txid]);
    }
    async execute_coin_txn(msafe: string, txid: string, coin_typeT:string) {
        return super.call('execute_coin_txn', [coin_typeT], [msafe, txid]);
    }
    async execute_manage_txn(msafe: string, txid: string) {
        return super.call('execute_manage_txn', [], [msafe, txid]);
    }
}