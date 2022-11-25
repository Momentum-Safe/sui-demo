import {bcs, JsonRpcProvider, Provider, RawSigner} from "@mysten/sui.js";
import {SuiContract} from "./contract";
import {decodeStr} from "@mysten/bcs";
import {Momentum, Transaction} from "./objects";
import {PayloadType, PayloadTypeLiteral} from "./payload";
import "./payload";

export class MsafeContract extends SuiContract {
    connect(signer: RawSigner) {
        return new MsafeContract(this.address, this.module, signer);
    }

    async create_msafe(owners: string[], threshold: bigint | string | number, metadata: string) {
        return super.call('create_msafe', [] as string[], [owners, threshold.toString(), metadata]);
    }

    async deposit(msafe: string, asset: string, asset_type: string) {
        return super.call('deposit', [asset_type], [msafe, asset])
    }

    async deposit_coin(msafe: string, asset: string, coin_typeT: string) {
        return super.call('deposit_coin', [coin_typeT], [msafe, asset])
    }

    async create_txn(msafe: string, nonce: bigint | string | number, payloadType: PayloadType, payload: any, expiration: number) {
        const payloadHex = '0x' + bcs.ser(PayloadTypeLiteral[payloadType], payload).toString('hex');
        return super.call('create_txn', [], [msafe, nonce.toString(), payloadType, payloadHex, expiration]);
    }

    async confirm_txn(msafe: string, txid: string) {
        return super.call('confirm_txn', [], [msafe, txid]);
    }

    async execute_asset_txn(msafe: string, txid: string, asset_type: string) {
        return super.call('execute_asset_txn', [asset_type], [msafe, txid]);
    }

    async execute_coin_txn(msafe: string, txid: string, coin_typeT: string) {
        return super.call('execute_coin_txn', [coin_typeT], [msafe, txid]);
    }

    async execute_manage_txn(msafe: string, txid: string) {
        return super.call('execute_manage_txn', [], [msafe, txid]);
    }

    static async getMomentumInfo(walletID: string, provider: JsonRpcProvider): Promise<Momentum> {
        const walletInfo: any = await provider.getObject(walletID);
        return walletInfo.details.data;
    }

    static async getPendingTransactions(walletID: string, provider: JsonRpcProvider) {
        const msafeObject = await this.getMomentumInfo(walletID, provider);
        const tableID = msafeObject.fields.txn_book.fields.pendings.fields.id.id;
        const objects = await provider.getObjectsOwnedByObject(tableID);
        const ownedObjects = await provider.getObjectBatch(objects.map(object => object.objectId));
        return ownedObjects.map(object => {
            const id = decodeStr((object.details as any).data.fields.name, 'base64');
            return {id, tx: (object.details as any).data.fields.value as Transaction}
        }).filter(({tx}) => tx != null);
    }

    static toMsafeTxID(creator: string, nonce: bigint | string | number):string {
        const nonceBuf = Buffer.alloc(8);
        nonceBuf.writeBigInt64LE(BigInt(nonce));
        const prefix = creator.startsWith('0x')?'':'0x';
        return `${prefix}${creator}${nonceBuf.toString('hex')}`;
    }

    static decodePayload(type: PayloadType, payloadData: string) {
        return bcs.de(PayloadTypeLiteral[type], payloadData, 'base64');
    }
}