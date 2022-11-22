import {bcs, Ed25519Keypair, JsonRpcProvider, RawSigner, Network} from '@mysten/sui.js';
import {MsafeContract} from "./call";
// connect to local RPC server
const provider = new JsonRpcProvider(Network.LOCAL);

const msafe_contract = process.env.MSAFE as string;

function createAccount(): RawSigner {
    const keypair = new Ed25519Keypair();
    return new RawSigner(keypair, provider);
}

function createAccounts(count: number): RawSigner[] {
    return Array(count).fill(0).map(() => createAccount());
}

const enum PayloadType {
    None,
    AssetWithdraw,
    CoinWithdraw,
    OwnerChange
}

bcs.registerStructType('PayloadAssetWithdraw', {
    to: 'address',
    asset_id: 'address',
}).registerStructType('PayloadCoinWithdraw', {
    to: 'address',
    coin_type: 'vector<u8>',
    amount: 'u64',
}).registerStructType('PayloadOwnerChange', {
    owners: 'vector<address>',
    threshold: 'u64'
});

async function main() {
    console.log("----use msafe:", msafe_contract);
    const signer = createAccount();
    const owners = createAccounts(4);
    const address = await signer.getAddress();
    console.log("address:", address);

    console.log("requestSuiFromFaucet:", address);
    // get tokens from the local faucet server
    await provider.requestSuiFromFaucet(address);
    const msafeContarct = new MsafeContract(msafe_contract, 'msafe', signer);
    const owners_address = await Promise.all(owners.map(owner => owner.getAddress().then(addr => `0x${addr}`)));
    await Promise.all(owners_address.map(owner => provider.requestSuiFromFaucet(owner)));

    const log_tx = (tx: any) => {
        console.log(tx.EffectsCert.effects.effects.status, tx.EffectsCert.effects.transactionEffectsDigest);
        //if(tx.EffectsCert.effects.effects.status.status != 'success') throw "transaction failed!";
    }
    console.log('\n====================================================1. create_mafe');
    const create_msafe_txid: any = await msafeContarct.connect(owners[0]).create_mafe(owners_address, owners_address.length, "hello");
    log_tx(create_msafe_txid);
    const created = create_msafe_txid.EffectsCert.effects.effects.created[0];
    const MomentumObject = created.reference;
    console.log("msafe id:", MomentumObject);

    console.log('\n====================================================2. deposit asset to msafe');
    const balances = await provider.getCoinBalancesOwnedByAddress(address);
    const asset: any = balances.slice(-1)[0].details;
    const asset_type = asset.data.type;
    console.log("deposit asset:", asset);
    const deposit_txid: any = await msafeContarct.deposit(MomentumObject.objectId, asset.reference.objectId, asset_type);
    log_tx(deposit_txid);


    console.log('\n====================================================3. create_txn to withdraw asset');
    const receiver = createAccount();
    const receiver_address = await receiver.getAddress().then(addr => `0x${addr}`);
    const asset_payload = bcs.ser('PayloadAssetWithdraw', {
        to: receiver_address,
        asset_id: asset.reference.objectId,
    }).toString('hex');
    const create_txn_txid: any = await msafeContarct.connect(owners[0]).create_txn(MomentumObject.objectId, 0, PayloadType.AssetWithdraw, `0x${asset_payload}`, Number(new Date()));
    log_tx(create_txn_txid);

    const doConfirms = async (creator: string, nonce: bigint) => {
        const nonceBuf = Buffer.alloc(8);
        nonceBuf.writeBigInt64LE(nonce);
        const txid = `0x${creator}${nonceBuf.toString('hex')}`;
        console.log('confirm txn:', txid);
        for (const owner of owners) {
            const confirmer = await owner.getAddress();
            console.log('confirm by:', confirmer);
            const confirm_txn_txid: any = await msafeContarct.connect(owner).confirm_txn(MomentumObject.objectId, txid);
            log_tx(confirm_txn_txid);
        }
        ;
        return txid;
    }
    console.log('\n====================================================4. confirm_txn to withdraw asset');
    const txid = await doConfirms(owners_address[0], 0n);

    console.log('\n====================================================5. execute txn to withdraw asset');
    const execute_txn_txid: any = await msafeContarct.execute_asset_txn(MomentumObject.objectId, txid, asset_type);
    log_tx(execute_txn_txid);

    const receiver_balance = await provider.getCoinBalancesOwnedByAddress(receiver_address);
    console.log('balance:', receiver_balance[0].details);


    console.log('\n====================================================6. deposit coin to msafe');
    const asset_coin_1: any = balances.slice(-2)[0].details;
    const asset_coin_2: any = balances.slice(-3)[0].details;
    const coin_typeT = asset_coin_1.data.type.slice(16, -1);
    console.log("deposit asset1:", asset_coin_1);
    console.log("deposit asset2:", asset_coin_2);
    const deposit_coin_txid_1: any = await msafeContarct.connect(signer).deposit_coin(MomentumObject.objectId, asset_coin_1.reference.objectId, coin_typeT);
    const deposit_coin_txid_2: any = await msafeContarct.connect(signer).deposit_coin(MomentumObject.objectId, asset_coin_2.reference.objectId, coin_typeT);
    log_tx(deposit_coin_txid_1);
    log_tx(deposit_coin_txid_2);


    console.log('\n====================================================7. create_txn to withdraw coin');

    const fullCoinType = '0000000000000000000000000000000000000002::coin::Coin<0000000000000000000000000000000000000002::sui::SUI>';
    const coin_payload = bcs.ser('PayloadCoinWithdraw', {
        to: receiver_address,
        coin_type: Buffer.from(fullCoinType),
        amount: 1000,
    }).toString('hex');
    const create_coin_txn_txid: any = await msafeContarct.connect(owners[0]).create_txn(MomentumObject.objectId, 1, PayloadType.CoinWithdraw, `0x${coin_payload}`, Number(new Date()));
    log_tx(create_coin_txn_txid);

    console.log('\n====================================================8. confirm_txn to withdraw coin');
    const coin_txid = await doConfirms(owners_address[0], 1n);

    console.log('\n====================================================9. execute txn to withdraw coin');
    const execute_coin_txn_txid: any = await msafeContarct.execute_coin_txn(MomentumObject.objectId, coin_txid, coin_typeT);
    log_tx(execute_coin_txn_txid);

    const receiver_balances = await provider.getCoinBalancesOwnedByAddress(receiver_address);
    console.log('balance:', receiver_balances.map(balance => balance.details));


    console.log('\n====================================================10. create_txn to change owners');
    const owner_change_payload = bcs.ser('PayloadOwnerChange', {
        owners: owners_address.slice(1),
        threshold: owners_address.length -1,
    }).toString('hex');
    const owner_chang_txn_txid: any = await msafeContarct.connect(owners[0]).create_txn(MomentumObject.objectId, 2, PayloadType.OwnerChange, `0x${owner_change_payload}`, Number(new Date()));
    log_tx(owner_chang_txn_txid);


    console.log('\n====================================================11. confirm_txn to change owners');
    const owner_change_txid = await doConfirms(owners_address[0], 2n);

    console.log('\n====================================================12. execute txn to change owners');
    const owner_change_txn_txid: any = await msafeContarct.execute_manage_txn(MomentumObject.objectId, owner_change_txid);
    log_tx(owner_change_txn_txid);

}

main()