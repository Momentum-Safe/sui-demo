
import { Ed25519Keypair, JsonRpcProvider, RawSigner, Network } from '@mysten/sui.js';
import {MsafeContract} from "./call";
// connect to local RPC server
const provider = new JsonRpcProvider(Network.LOCAL);

const msafe_contract = process.env.MSAFE as string;

function createAccount():RawSigner {
    const keypair = new Ed25519Keypair();
    return new RawSigner(keypair, provider);
}

function createAccounts(count:number): RawSigner[] {
    return Array(count).fill(0).map(()=>createAccount());
}

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
    const owners_address = await Promise.all(owners.map(owner=>owner.getAddress().then(addr=>`0x${addr}`)));
    await Promise.all(owners_address.map(owner=>provider.requestSuiFromFaucet(owner)));

    console.log('\n====================================================1. create_mafe');
    const create_msafe_txid:any = await msafeContarct.connect(owners[0]).create_mafe(owners_address, owners_address.length, "hello");
    console.log(create_msafe_txid.EffectsCert.effects);
    const created = create_msafe_txid.EffectsCert.effects.effects.created[0];
    const MomentumObject = created.reference;
    console.log("msafe id:", MomentumObject);

    console.log('\n====================================================2. deposit coin to msafe');
    const balances = await provider.getCoinBalancesOwnedByAddress(address);
    const asset:any = balances.slice(-1)[0].details;
    const asset_type = asset.data.type;
    console.log("deposit asset:", asset);
    const deposit_txid:any = await msafeContarct.deposit(MomentumObject.objectId, asset.reference.objectId, asset_type);
    console.log(deposit_txid.EffectsCert.effects);


    console.log('\n====================================================3. create_txn to withdraw coin');
    const receiver = createAccount();
    const receiver_address = await receiver.getAddress().then(addr=>`0x${addr}`);
    const create_txn_txid:any = await msafeContarct.connect(owners[0]).create_txn(MomentumObject.objectId, 0, receiver_address, asset.reference.objectId, Number(new Date()));
    console.log(create_txn_txid.EffectsCert.effects);

    console.log('\n====================================================4. confirm_txn to withdraw coin');
    const nonceBuf = Buffer.alloc(8);
    nonceBuf.writeBigInt64LE(0n);
    const txid = `0x${owners_address[0]}${nonceBuf.toString('hex')}`;
    console.log('confirm txn:', txid);
    for(const owner of owners) {
        const confirmer = await owner.getAddress();
        console.log('confirm by:', confirmer);
        const confirm_txn_txid:any = await msafeContarct.connect(owner).confirm_txn(MomentumObject.objectId, txid);
        console.log(confirm_txn_txid.EffectsCert.effects);
    }

    console.log('\n====================================================5. execute txn to withdraw coin');
    const execute_txn_txid:any = await msafeContarct.execute_txn(MomentumObject.objectId, txid, asset_type);
    console.log(execute_txn_txid.EffectsCert.effects);

    const receiver_balance = await provider.getCoinBalancesOwnedByAddress(receiver_address);
    console.log('balance:', receiver_balance[0].details);
}
main()