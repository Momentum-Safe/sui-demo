module demo_msafe::msafe {
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::table::{Self, Table};
    use std::vector;
    use sui::bcs;
    use sui::vec_set::{Self, VecSet};
    use sui::coin::{Self, Coin};
    use sui::priority_queue::{Self, PriorityQueue};
    use std::type_name;
    use std::ascii;
    use sui::dynamic_field;

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

    /// Transaction includes all information needed for a certain transaction
    /// to be executed by the momentum safe wallet, including payload, metadata,
    /// and signatures.
    /// Initially, transaction will have only 1 signature. The signatures are
    /// added when other owners call addSignature. The transaction is ready to
    /// be sent when number of signatures reaches threshold - 1.
    struct Transaction has store, drop, copy {
        creator: address,
        // Payload of the transaction to be executed by the momentum safe wallet.
        // Can be an arbitrary transaction payload.
        to: address,
        // Metadata stored on chain to serve as a transaction identifier or memo.
        asset_id: address,
        expiration: u64,
        confirms: VecSet<address>,
    }

    public entry fun create_mafe(owners: vector<address>, threshold: u64, metadata: vector<u8>, ctx: &mut TxContext) {
        assert!(vector::length(&owners) >= threshold && threshold > 0, 0);
        let owners_set = vec_set::empty<address>();
        let i = 0;
        while (i < vector::length(&owners)) {
            let owner = vector::borrow(&owners, i);
            vec_set::insert(&mut owners_set, *owner);
            i = i + 1;
        };
        assert!(vec_set::contains(&owners_set, &tx_context::sender(ctx)), 0);
        let msafe = Momentum {
            id: object::new(ctx),
            info: Info {
                owners: owners_set,
                threshold,
                metadata
            },
            txn_book: TxnBook {
                min_sequence_number: 0,
                max_sequence_number: 0,
                txids: priority_queue::new(vector::empty()),
                pendings: table::new(ctx)
            }
        };
        transfer::share_object(msafe);
    }

    public entry fun create_txn(msafe: &mut Momentum, nonce: u64, to: address, asset_id: address, expiration: u64, ctx: &mut TxContext) {
        let txn_book = &mut msafe.txn_book;
        assert!(nonce >= txn_book.min_sequence_number, 10);
        if (nonce >= txn_book.max_sequence_number) {
            txn_book.max_sequence_number = txn_book.max_sequence_number + 1;
        };
        assert!(nonce < txn_book.max_sequence_number, 20);

        let creator = tx_context::sender(ctx);
        assert!(vec_set::contains(&msafe.info.owners, &creator), 30);
        let txn = Transaction {
            creator,
            to,
            asset_id,
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

    fun remove_tx(txn_book: &mut TxnBook) {
        // avoid priority_queue empty.
        // priority_queue don't have a method to check it's length
        if (txn_book.min_sequence_number < 2) {
            return
        };
        let i = 0;
        while (i < 64) {
            i = i + 1;
            let (priority, creator) = priority_queue::pop_max(&mut txn_book.txids);
            let nonce = MAX_U64 - priority;
            if (nonce == txn_book.min_sequence_number - 1) {
                priority_queue::insert(&mut txn_book.txids, priority, creator);
                break
            };
            let txid = to_txid(creator, nonce);
            table::remove(&mut txn_book.pendings, txid);
        };
    }

    fun execute_txn_internal<ASSET: key+store>(msafe: &mut Momentum, txid: vector<u8>) {
        msafe.txn_book.min_sequence_number = msafe.txn_book.min_sequence_number + 1;
        let txn = table::remove(&mut msafe.txn_book.pendings, txid);
        let asset = withdraw<ASSET>(msafe, txn.asset_id);
        transfer::transfer(asset, txn.to);
        remove_tx(&mut msafe.txn_book);
    }

    public entry fun execute_txn<ASSET: key+store>(msafe: &mut Momentum, txid: vector<u8>) {
        assert!(executable(msafe, txid), 0);
        execute_txn_internal<ASSET>(msafe, txid);
    }

    fun coin_key<T>():vector<u8> {
        let asset_type = type_name::get<Coin<T>>();
        *ascii::as_bytes(type_name::borrow_string(&asset_type))
    }


    public fun exist_coin<T>(msafe: &Momentum): (bool, u64) {
        let asset_key = coin_key<T>();
        if (dynamic_field::exists_with_type<vector<u8>, Coin<T>>(&msafe.id, asset_key)) {
            (false,0)
        }else {
            let asset_coin = dynamic_field::borrow<vector<u8>, Coin<T>>(&msafe.id, asset_key);
            (true, coin::value(asset_coin))
        }
    }

    public entry fun deposit_coin<T>(msafe: &mut Momentum, asset: Coin<T>) {
        let asset_key = coin_key<T>();
        if(!dynamic_field::exists_with_type<vector<u8>, Coin<T>>(&mut msafe.id, asset_key)) {
            dynamic_field::add<vector<u8>, Coin<T>>(&mut msafe.id, asset_key, asset);
        } else {
            let merge_to = dynamic_field::borrow_mut<vector<u8>, Coin<T>>(&mut msafe.id, asset_key);
            coin::join(merge_to, asset);
        }
    }

    fun withdraw_coin<T>(msafe: &mut Momentum, amount: u64, ctx: &mut TxContext): Coin<T> {
        let asset_key = coin_key<T>();
        let asset_coin = dynamic_field::borrow_mut<vector<u8>, Coin<T>>(&mut msafe.id, asset_key);
        coin::split(asset_coin, amount, ctx)
    }

    public entry fun deposit<ASSET: key+store>(msafe: &mut Momentum, asset: ASSET) {
        let asset_key = object::id(&asset);
        dynamic_field::add(&mut msafe.id, asset_key, asset);
    }

    fun withdraw<ASSET: key+store>(msafe: &mut Momentum, asset_id: address): ASSET {
        let asset_key = object::id_from_address(asset_id);
        dynamic_field::remove(&mut msafe.id, asset_key)
    }

    public fun exist<ASSET: key+store>(msafe: &Momentum, asset_id: address): bool {
        let asset_key = object::id_from_address(asset_id);
        dynamic_field::exists_with_type<ID, ASSET>(&msafe.id, asset_key)
    }

    fun split_coins<T>(msafe: &mut Momentum, split_coin_id: address, split_amounts: vector<u64>, ctx: &mut TxContext) {
        let split_asset_key = object::id_from_address(split_coin_id);
        let split_asset = dynamic_field::remove<ID, Coin<T>>(&mut msafe.id, split_asset_key);
        let i = 0;
        while (i < vector::length(&split_amounts)) {
            let split_amount = vector::borrow(&split_amounts, i);
            let asset = coin::split(&mut split_asset, *split_amount, ctx);
            deposit(msafe, asset);
            i = i + 1;
        };
        if (coin::value(&split_asset) > 0) {
            deposit(msafe, split_asset);
        } else {
            coin::destroy_zero(split_asset);
        }
    }

    fun merge_coins<T>(msafe: &mut Momentum, coin_ids: vector<address>) {
        let retain_key = object::id_from_address(*vector::borrow(&coin_ids, 0));
        let retain_coin = dynamic_field::remove<ID, Coin<T>>(&mut msafe.id, retain_key);
        let i = 1;
        while (i < vector::length(&coin_ids)) {
            let asset_key = object::id_from_address(*vector::borrow(&coin_ids, i));
            let asset_coin = dynamic_field::remove<ID, Coin<T>>(&mut msafe.id, asset_key);
            coin::join(&mut retain_coin, asset_coin);
            i = i + 1;
        };
        deposit(msafe, retain_coin);
    }
}