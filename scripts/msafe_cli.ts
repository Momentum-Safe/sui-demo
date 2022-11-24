import {bcs, JsonRpcProvider, Network} from '@mysten/sui.js';
import {MsafeContract} from "./lib/msafe_contract";
import {program} from "commander";
import {publish} from "./publish";
import {faucet} from "./faucet";
import {createAccounts, saveAccounts, loadAccount} from "./lib/wallet";
import {PayloadType, PayloadTypeLiteral} from "./lib/payload";
import "./lib/payload";
import {log_tx} from "./lib/utils";

program
    .name('msafe-wallet')
    .description('CLI to interact with msafe contract')
    .version('0.0.1');


program.command('object')
    .description('get object')
    .argument('<id>', 'id of object')
    .option('-o --owns', 'get objects owned by this object')
    .action(async (id, options: any) => {
        const provider = new JsonRpcProvider(Network.LOCAL);
        if (options.owns) {
            const objs = await provider.getObjectsOwnedByObject(id);
            console.log(objs);
        } else {
            const obj = await provider.getObject(id);
            console.log(obj);
        }
    });

program.command('createAccounts')
    .description('Create accounts and save secret key to disk')
    .option('--keydir <path>', 'Path to directory to store secret keys', './.key')
    .option('-n --num <number>', 'Number of accounts to create', '1')
    .option('--skip-faucet', 'skip to faucet', false)
    .option('--network <NetworkType>', 'network to use, support LOCAL,DEVNET, omit use ($NETWORK || LOCAL)', process.env.NETWORK || Network.LOCAL)
    .action(async (options: any) => {
        const accounts = createAccounts(Number(options.num));
        await saveAccounts(accounts, options.keydir);
        if (options['skip-faucet']) return;
        const addresses = await Promise.all(accounts.map(account => account.getAddress()));
        const provider = new JsonRpcProvider(options.network.toUpperCase());
        await Promise.all(addresses.map(address => provider.requestSuiFromFaucet(address)));
    });

program.command('faucet')
    .description('Faucet to given address')
    .argument('<to>', 'to address')
    .action(async (to: string) => {
        await faucet(to);
    });

program.command('publish')
    .description('Publish msafe contract')
    .option('-p, --path <MovePackage>', 'Path to directory containing a Move package', './move')
    .action(async (options: any) => {
        await publish(options.path)
    });

const MsafeCmd = program.command('msafe')
    .description('Interact with msafe contract');

MsafeCmd.command('create')
    .description('Create a new msafe wallet')
    .option('--keydir <path>', 'Path to directory to store secret keys', './.key')
    .option('--account <address>', 'account to use, omit use $ACCOUNT', process.env.ACCOUNT as string)
    .option('--msafe <address>', 'msafe contract address, omit use $MSAFE', process.env.MSAFE as string)
    .option('--network <NetworkType>', 'network to use, support LOCAL,DEVNET, omit use ($NETWORK || LOCAL)', process.env.NETWORK || Network.LOCAL)
    .option('--name', 'alias name of new wallet')
    .argument('<owners>', "owners of msafe, separated with ','")
    .argument('<threshold>', "threshold of msafe")
    .action(async (owners: string, threshold, options) => {
        const provider = new JsonRpcProvider(options.network.toUpperCase());
        const signer = await loadAccount(options.keydir, options.account, provider);
        const msafeContract = new MsafeContract(options.msafe, 'msafe', signer);
        const addresses = owners.split(',').map(address => address.startsWith('0x') ? address : `0x${address}`);
        const txid: any = await msafeContract.create_msafe(addresses, threshold, options.name || 'msafe');
        log_tx(txid);
        const created = txid.EffectsCert.effects.effects.created[0];
        const MomentumObject = created.reference;
        console.log("msafe wallet id:", MomentumObject.objectId);
    });

MsafeCmd.command('deposit')
    .description('Deposit coin')
    .option('--keydir <path>', 'Path to directory to store secret keys', './.key')
    .option('--account <address>', 'account to use, omit use $ACCOUNT', process.env.ACCOUNT as string)
    .option('--msafe <address>', 'msafe contract address, omit use $MSAFE', process.env.MSAFE as string)
    .option('--network <NetworkType>', 'network to use, support LOCAL,DEVNET, omit use ($NETWORK || LOCAL)', process.env.NETWORK || Network.LOCAL)
    .requiredOption('--asset_id <HexString>', 'objectId of asset to deposit')
    .option('--walletID <HexString>', 'id of msafe wallet, omit use $WALLET', process.env.WALLET as string)
    .action(async (options) => {
        const provider = new JsonRpcProvider(options.network.toUpperCase());
        const signer = await loadAccount(options.keydir, options.account, provider);
        const msafeContract = new MsafeContract(options.msafe, 'msafe', signer);
        const asset = await provider.getObject(options.asset_id);
        const txid = await msafeContract.deposit(options.walletID, options.asset_id, (asset.details as any).data.type);
        log_tx(txid);
    });

MsafeCmd.command('withdraw_init')
    .description('create a msafe transaction to withdraw asset')
    .option('--keydir <path>', 'Path to directory to store secret keys', './.key')
    .option('--account <address>', 'account to use, omit use $ACCOUNT', process.env.ACCOUNT as string)
    .option('--msafe <address>', 'msafe contract address, omit use $MSAFE', process.env.MSAFE as string)
    .option('--network <NetworkType>', 'network to use, support LOCAL,DEVNET, omit use ($NETWORK || LOCAL)', process.env.NETWORK || Network.LOCAL)
    .option('--to <string>', 'which address transfer to, omit would transfer to transaction sender')
    .requiredOption('--asset_id <HexString>', 'objectId of asset to deposit')
    .option('--walletID <HexString>', 'id of msafe wallet, omit use $WALLET', process.env.WALLET as string)
    .action(async (options) => {
        const walletID = options.walletID;
        const provider = new JsonRpcProvider(options.network.toUpperCase());
        const signer = await loadAccount(options.keydir, options.account, provider);
        const msafeContract = new MsafeContract(options.msafe, 'msafe', signer);
        const to = options.to || options.account;
        const msafeObject = await MsafeContract.getMomentumInfo(walletID, provider);
        const nonce = msafeObject.fields.txn_book.fields.max_sequence_number;
        const payloadType = PayloadType.AssetWithdraw;
        const payload = '0x' + bcs.ser(PayloadTypeLiteral[payloadType], {
            to,
            asset_id: options.asset_id,
        }).toString('hex');
        const txid: any = await msafeContract.create_txn(walletID, nonce, payloadType, payload, 0);
        log_tx(txid);
        //const msafeTx = txid.EffectsCert.effects.effects.created[0];
        const nonceBuf = Buffer.alloc(8);
        nonceBuf.writeBigInt64LE(BigInt(nonce));
        const withdrawID = `0x${options.account}${nonceBuf.toString('hex')}`;
        console.log('withdrawID:', withdrawID)
    });

MsafeCmd.command('withdraw_confirm')
    .description('create a withdraw coin msafe transaction')
    .option('--keydir <path>', 'Path to directory to store secret keys', './.key')
    .option('--account <address>', 'account to use, omit use $ACCOUNT', process.env.ACCOUNT as string)
    .option('--msafe <address>', 'msafe contract address, omit use $MSAFE', process.env.MSAFE as string)
    .option('--network <NetworkType>', 'network to use, support LOCAL,DEVNET, omit use ($NETWORK || LOCAL)', process.env.NETWORK || Network.LOCAL)
    .requiredOption('--id <HexString>', 'id of withdraw transaction')
    //.option('-e --execute', 'auto execute the transaction if has enough confirms')
    .option('--walletID <HexString>', 'id of msafe wallet, omit use $WALLET', process.env.WALLET as string)
    .action(async (options) => {
        const provider = new JsonRpcProvider(options.network.toUpperCase());
        const signer = await loadAccount(options.keydir, options.account, provider);
        const msafeContract = new MsafeContract(options.msafe, 'msafe', signer);
        const txid = await msafeContract.confirm_txn(options.walletID, options.id);
        log_tx(txid);
    });

MsafeCmd.command('withdraw_execute')
    .description('execute transaction to withdraw asset')
    .option('--keydir <path>', 'Path to directory to store secret keys', './.key')
    .option('--account <address>', 'account to use, omit use $ACCOUNT', process.env.ACCOUNT as string)
    .option('--msafe <address>', 'msafe contract address, omit use $MSAFE', process.env.MSAFE as string)
    .option('--network <NetworkType>', 'network to use, support LOCAL,DEVNET, omit use ($NETWORK || LOCAL)', process.env.NETWORK || Network.LOCAL)
    .requiredOption('--id <HexString>', 'id of withdraw transaction')
    .option('--walletID <HexString>', 'id of msafe wallet, omit use $WALLET', process.env.WALLET as string)
    .action(async (options) => {
        const walletID = options.walletID;
        const provider = new JsonRpcProvider(options.network.toUpperCase());
        const signer = await loadAccount(options.keydir, options.account, provider);
        const msafeContract = new MsafeContract(options.msafe, 'msafe', signer);
        const pendings = await MsafeContract.getPendingTransactions(walletID, provider)
        const {tx: withdrawTx} = pendings.find(({id}) => Buffer.from(options.id.slice(2), 'hex').equals(id))!;
        const payloadType = withdrawTx.fields.payload.fields.type;
        const payloadData = withdrawTx.fields.payload.fields.payload;
        const payload = bcs.de('PayloadAssetWithdraw', payloadData, 'base64');
        const asset_id = payload.asset_id;
        const asset = await provider.getObject(asset_id);
        const txid = await msafeContract.execute_asset_txn(walletID, options.id, (asset.details as any).data.type)
        log_tx(txid);
    });

MsafeCmd.command('wallet')
    .description('get msafe wallet details')
    .option('--msafe <address>', 'msafe contract address, omit use $MSAFE', process.env.MSAFE as string)
    .option('--network <NetworkType>', 'network to use, support LOCAL,DEVNET, omit use ($NETWORK || LOCAL)', process.env.NETWORK || Network.LOCAL)
    .option('--walletID <HexString>', 'id of msafe wallet, omit use $WALLET', process.env.WALLET as string)
    .action(async (options) => {
        const walletID = options.walletID;
        const provider = new JsonRpcProvider(options.network.toUpperCase());
        const walletInfo = await MsafeContract.getMomentumInfo(walletID, provider);
        console.log(JSON.stringify(walletInfo, undefined, 2));
    });

MsafeCmd.command('pendings')
    .description('get pending transactions')
    .option('--msafe <address>', 'msafe contract address, omit use $MSAFE', process.env.MSAFE as string)
    .option('--network <NetworkType>', 'network to use, support LOCAL,DEVNET, omit use ($NETWORK || LOCAL)', process.env.NETWORK || Network.LOCAL)
    .option('--walletID <HexString>', 'id of msafe wallet, omit use $WALLET', process.env.WALLET as string)
    .action(async (options) => {
        const walletID = options.walletID;
        const provider = new JsonRpcProvider(options.network.toUpperCase());
        const pendings = await MsafeContract.getPendingTransactions(walletID, provider);
        console.log("pending tx size:", pendings.length);
        for (const pending of pendings) {
            console.log('-'.repeat(64))
            console.log('txid:', Buffer.from(pending.id).toString('hex'));
            console.log('creator:', Buffer.from(pending.id.subarray(0, 20)).toString('hex'));
            console.log('nonce:', Buffer.from(pending.id.subarray(20)).readBigInt64LE());
            console.log('tx:', JSON.stringify(pending.tx, undefined, 2));
            const payloadType = PayloadTypeLiteral[Number(pending.tx.fields.payload.fields.type) as PayloadType];
            console.log('payload type:', payloadType)
            console.log('payload data:', bcs.de(payloadType, pending.tx.fields.payload.fields.payload, 'base64'));
        }
    });


program.parse();