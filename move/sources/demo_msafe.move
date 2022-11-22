module demo_msafe::msafe {
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::table::{Self, Table};
    use std::vector;
    use sui::bcs;
    use sui::vec_set::{Self, VecSet};
    use sui::coin::{Self, Coin};
    use demo_msafe::priority_queue::{Self, PriorityQueue};
    use std::type_name;
    use std::ascii;
    use sui::dynamic_object_field;

    const MAX_U64: u64 = 0xffffffffffffffff;

    /// Data structure stored for each momentum safe wallet, including:
    ///     1. momentum safe info (owners, public keys, threshold, e.t.c.)
    ///     2. TxnBook of pending transactions.
    struct Momentum has key {
        id: UID,
        info: Info,
        txn_book: TxnBook,
    }

    /// Basic information of multi-sig wallet.
    /// Including owners, public keys, threshold, and wallet name (as metadata).
    struct Info has store, copy, drop {
        // version of msafe
        version: u64,
        // vector of owners
        owners: VecSet<address>,
        // signing threshold
        threshold: u64,
        // metadata for wallet information
        metadata: vector<u8>,
    }

    /// Stores the pending transactions of a multi-sig wallet.
    struct TxnBook has store {
        // Minimum sequence_number in the txn_book.
        // The parameter is updated and used in stale transaction pruning.
        min_sequence_number: u64,
        // Maximum sequence_number in the txn_book.
        // This parameter is updated when adding new transaction,
        // and is used in stale transaction pruning.
        max_sequence_number: u64,
        txids: PriorityQueue<address>,
        // A map from transaction payload hash to the Transaction information.
        // Storing the detailed information about the pending transaction, where
        // the index transaction hashes can be obtained from `tx_hashes`.
        pendings: Table<vector<u8>, Transaction>,
    }

    struct PayloadAssetWithdraw has drop {
        to: address,
        asset_id: address,
    }

    struct PayloadCoinWithdraw has drop {
        to: address,
        coin_type: vector<u8>,
        amount: u64,
    }

    struct PayloadOwnerChange has drop {
        owners: vector<address>,
        threshold: u64,
    }

    const PAYLOAD_ASSET_WITHDRAW:u64 = 1;
    const PAYLOAD_COIN_WITHDRAW:u64 = 2;
    const PAYLOAD_OWNER_CHANGE:u64 = 3;
    struct Payload has store, copy, drop {
        type: u64,
        payload: vector<u8>,
    }

    /// Transaction includes all information needed for a certain transaction
    /// to be executed by the momentum safe wallet, including payload, metadata,
    /// and signatures.
    /// Initially, transaction will have only 1 signature. The signatures are
    /// added when other owners call addSignature. The transaction is ready to
    /// be sent when number of signatures reaches threshold - 1.
    struct Transaction has store, drop, copy {
        version: u64,
        creator: address,
        // Payload of the transaction to be executed by the momentum safe wallet.
        // Can be an arbitrary transaction payload.
        payload: Payload,
        expiration: u64,
        confirms: VecSet<address>,
    }

    fun deserialize_asset_withdraw(payload: vector<u8>): PayloadAssetWithdraw {
        let deserializer = bcs::new(payload);
        let payload = PayloadAssetWithdraw{
            to: bcs::peel_address(&mut deserializer),
            asset_id: bcs::peel_address(&mut deserializer),
        };
        assert!(vector::is_empty(&bcs::into_remainder_bytes(deserializer)), 0);
        payload
    }

    fun deserialize_coin_withdraw(payload: vector<u8>): PayloadCoinWithdraw {
        let deserializer = bcs::new(payload);
        let payload = PayloadCoinWithdraw{
            to: bcs::peel_address(&mut deserializer),
            coin_type: bcs::peel_vec_u8(&mut deserializer),
            amount: bcs::peel_u64(&mut deserializer),
        };
        assert!(vector::is_empty(&bcs::into_remainder_bytes(deserializer)), 0);
        payload
    }

    fun deserialize_owner_change(payload: vector<u8>): PayloadOwnerChange {
        let deserializer = bcs::new(payload);
        let payload = PayloadOwnerChange{
            owners: bcs::peel_vec_address(&mut deserializer),
            threshold: bcs::peel_u64(&mut deserializer),
        };
        assert!(vector::is_empty(&bcs::into_remainder_bytes(deserializer)), 0);
        payload
    }

    fun payload_sanity_check(payload: &Payload) {
        if(payload.type == PAYLOAD_ASSET_WITHDRAW) {
            deserialize_asset_withdraw(payload.payload);
        } else if (payload.type == PAYLOAD_COIN_WITHDRAW) {
            deserialize_coin_withdraw(payload.payload);
        } else if (payload.type == PAYLOAD_OWNER_CHANGE) {
            deserialize_owner_change(payload.payload);
        } else {
            abort 0
        }
    }

    fun to_vec_set<T: copy+drop>(vec: vector<T>): VecSet<T> {
        let vec_set = vec_set::empty<T>();
        let i = 0;
        while (i < vector::length(&vec)) {
            let elem = vector::borrow(&vec, i);
            vec_set::insert(&mut vec_set, *elem);
            i = i + 1;
        };
        vec_set
    }

    fun check_info(info: &Info) {
        assert!(vec_set::size(&info.owners) >= info.threshold && info.threshold > 0, 0);
    }

    public entry fun create_mafe(owners: vector<address>, threshold: u64, metadata: vector<u8>, ctx: &mut TxContext) {
        let info = Info {
            version: 0,
            owners: to_vec_set(owners),
            threshold,
            metadata
        };
        check_info(&info);
        assert!(vec_set::contains(&info.owners, &tx_context::sender(ctx)), 0);
        let msafe = Momentum {
            id: object::new(ctx),
            info,
            txn_book: TxnBook {
                min_sequence_number: 0,
                max_sequence_number: 0,
                txids: priority_queue::new(vector::empty()),
                pendings: table::new(ctx)
            }
        };
        transfer::share_object(msafe);
    }

    public entry fun create_txn(msafe: &mut Momentum, nonce: u64, type: u64, payload: vector<u8>, expiration: u64, ctx: &mut TxContext) {
        let txn_book = &mut msafe.txn_book;
        assert!(nonce >= txn_book.min_sequence_number, 10);
        if (nonce >= txn_book.max_sequence_number) {
            txn_book.max_sequence_number = txn_book.max_sequence_number + 1;
        };
        assert!(nonce < txn_book.max_sequence_number, 20);

        let creator = tx_context::sender(ctx);
        assert!(vec_set::contains(&msafe.info.owners, &creator), 30);
        let payload =  Payload{
            type,
            payload,
        };
        payload_sanity_check(&payload);
        let txn = Transaction {
            version: msafe.info.version,
            creator,
            payload,
            expiration,
            confirms: vec_set::singleton(creator)
        };
        let txid = to_txid(creator, nonce);
        if (table::contains(&txn_book.pendings, txid)) {
            let txn = table::remove(&mut txn_book.pendings, txid);
            assert!(creator == txn.creator, 40);
        };
        table::add(&mut txn_book.pendings, txid, txn);
        insert_txid(txn_book, creator, nonce);
    }

    public entry fun confirm_txn(msafe: &mut Momentum, txid: vector<u8>, ctx: &mut TxContext) {
        let txn_book = &mut msafe.txn_book;
        let confirmer = tx_context::sender(ctx);
        assert!(vec_set ::contains(&msafe.info.owners, &confirmer), 0);
        let txn = table::borrow_mut(&mut txn_book.pendings, txid);
        assert!(txn.version == msafe.info.version, 0);
        vec_set::insert(&mut txn.confirms, confirmer);
        /*
        if (executable(msafe, txid)) {
            execute_txn_internal<ASSET>(msafe, txid);
        }
        */
    }

    public entry fun cancel_confirm(msafe: &mut Momentum, txid: vector<u8>, ctx: &mut TxContext) {
        let txn_book = &mut msafe.txn_book;
        let confirmer = tx_context::sender(ctx);
        let txn = table::borrow_mut(&mut txn_book.pendings, txid);
        vec_set::remove(&mut txn.confirms, &confirmer);
    }

    public fun executable(msafe: &Momentum, txid: vector<u8>): bool {
        let txn = table::borrow(&msafe.txn_book.pendings, txid);
        if (txn.version != msafe.info.version) {
            return false
        };
        let confirms = vec_set::size(&txn.confirms);
        if (confirms < msafe.info.threshold) {
            return false
        };
        let (_, txn_sn) = from_txid(txid);
        txn_sn == msafe.txn_book.min_sequence_number
    }

    fun to_txid(creator: address, nonce: u64): vector<u8> {
        let txid = bcs::to_bytes(&creator);
        vector::append(&mut txid, bcs::to_bytes(&nonce));
        txid
    }

    fun from_txid(txid: vector<u8>): (address, u64) {
        let deserializer = bcs::new(txid);
        let creator = bcs::peel_address(&mut deserializer);
        let nonce = bcs::peel_u64(&mut deserializer);
        (creator, nonce)
    }

    fun insert_txid(txn_book: &mut TxnBook, creator: address, nonce: u64) {
        let priority = MAX_U64 - nonce;
        priority_queue::insert(&mut txn_book.txids, priority, creator);
    }

    fun forward_and_clean(txn_book: &mut TxnBook) {
        txn_book.min_sequence_number = txn_book.min_sequence_number + 1;
        let i = 0;
        while (i < 64) {
            if(priority_queue::is_empty(&txn_book.txids)) {
                break
            };
            let (priority, creator) = priority_queue::borrow_max(&txn_book.txids);
            let nonce = MAX_U64 - priority;
            if (nonce == txn_book.min_sequence_number) {
                break
            };
            let txid = to_txid(creator, nonce);
            priority_queue::pop_max(&mut txn_book.txids);
            if(table::contains(&txn_book.pendings, txid)) {
                table::remove(&mut txn_book.pendings, txid);
            };
            i = i + 1;
        };
    }

    fun execute_owner_change_internal(msafe: &mut Momentum, txid: vector<u8>) {
        let txn = table::remove(&mut msafe.txn_book.pendings, txid);
        let payload = deserialize_owner_change(txn.payload.payload);
        msafe.info.owners = to_vec_set(payload.owners);
        msafe.info.threshold = payload.threshold;
        msafe.info.version = msafe.info.version + 1;
        check_info(&msafe.info);
        forward_and_clean(&mut msafe.txn_book);
    }

    fun execute_asset_withdraw_internal<ASSET: key+store>(msafe: &mut Momentum, txid: vector<u8>) {
        let txn = table::remove(&mut msafe.txn_book.pendings, txid);

        let payload = deserialize_asset_withdraw(txn.payload.payload);
        let asset = withdraw<ASSET>(msafe, payload.asset_id);
        transfer::transfer(asset, payload.to);
        forward_and_clean(&mut msafe.txn_book);
    }

    fun execute_coin_withdraw_internal<T>(msafe: &mut Momentum, txid: vector<u8>, ctx: &mut TxContext) {
        let txn = table::remove(&mut msafe.txn_book.pendings, txid);
        let payload = deserialize_coin_withdraw(txn.payload.payload);
        let asset = withdraw_coin<T>(msafe, payload.amount, payload.coin_type, ctx);
        transfer::transfer(asset, payload.to);
        forward_and_clean(&mut msafe.txn_book);
    }

    /// execute transaction that withdraw arbitrary ASSET
    public entry fun execute_asset_txn<ASSET: key+store>(msafe: &mut Momentum, txid: vector<u8>) {
        assert!(executable(msafe, txid), 0);
        execute_asset_withdraw_internal<ASSET>(msafe, txid);
    }
    /// execute transaction that withdraw coin
    public entry fun execute_coin_txn<T>(msafe: &mut Momentum, txid: vector<u8>, ctx: &mut TxContext) {
        assert!(executable(msafe, txid), 0);
        execute_coin_withdraw_internal<T>(msafe, txid, ctx);
    }

    /// execute transaction that change owners and threshold of msafe
    public entry fun execute_manage_txn(msafe: &mut Momentum, txid: vector<u8>) {
        assert!(executable(msafe, txid), 0);
        execute_owner_change_internal(msafe, txid);
    }

    fun coin_key<T>():vector<u8> {
        let asset_type = type_name::get<Coin<T>>();
        *ascii::as_bytes(type_name::borrow_string(&asset_type))
    }

    /// if a coin exists in msafe, also return its balance
    public fun exist_coin<T>(msafe: &Momentum): (bool, u64) {
        let asset_key = coin_key<T>();
        if (dynamic_object_field::exists_with_type<vector<u8>, Coin<T>>(&msafe.id, asset_key)) {
            (false,0)
        }else {
            let asset_coin = dynamic_object_field::borrow<vector<u8>, Coin<T>>(&msafe.id, asset_key);
            (true, coin::value(asset_coin))
        }
    }
    /// deposit a coin to msafe
    public entry fun deposit_coin<T>(msafe: &mut Momentum, asset: Coin<T>) {
        let asset_key = coin_key<T>();
        if(!dynamic_object_field::exists_with_type<vector<u8>, Coin<T>>(&mut msafe.id, asset_key)) {
            dynamic_object_field::add<vector<u8>, Coin<T>>(&mut msafe.id, asset_key, asset);
        } else {
            let merge_to = dynamic_object_field::borrow_mut<vector<u8>, Coin<T>>(&mut msafe.id, asset_key);
            coin::join(merge_to, asset);
        }
    }
    /// withdraw a certain amount of a coin, the caller handls where the coin goes.
    fun withdraw_coin<T>(msafe: &mut Momentum, amount: u64, asset_id: vector<u8>, ctx: &mut TxContext): Coin<T> {
        let asset_key = coin_key<T>();
        let asset_coin = dynamic_object_field::borrow_mut<vector<u8>, Coin<T>>(&mut msafe.id, asset_key);
        assert!(asset_key == asset_id, 1000);
        coin::split(asset_coin, amount, ctx)
    }
    /// deposit a ASSET to msafe
    public entry fun deposit<ASSET: key+store>(msafe: &mut Momentum, asset: ASSET) {
        let asset_key = object::id(&asset);
        dynamic_object_field::add(&mut msafe.id, asset_key, asset);
    }

    /// withdraw a ASSET from msafe, the caller handles where the asset goes.
    fun withdraw<ASSET: key+store>(msafe: &mut Momentum, asset_id: address): ASSET {
        let asset_key = object::id_from_address(asset_id);
        dynamic_object_field::remove(&mut msafe.id, asset_key)
    }
    /// if a ASSET exists in msafe
    public fun exist<ASSET: key+store>(msafe: &Momentum, asset_id: address): bool {
        let asset_key = object::id_from_address(asset_id);
        dynamic_object_field::exists_with_type<ID, ASSET>(&msafe.id, asset_key)
    }

}