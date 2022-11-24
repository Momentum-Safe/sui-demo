export type Object<T> = {
    type: string,
    fields: T,
}

export type address = string;
export type u8 = number;
export type u64 = string;
export type vector<T> = T[];
export type bytes = string;

export type VecSet<K> = Object<{
    contents: vector<K>,
}>

export type PriorityQueue<T> = Object<{
    entries: vector<Entry<T>>,
}>

export type Entry<T> = Object<{
    priority: u64, // higher value means higher priority and will be popped first
    value: T,
}>

export type ID = address

/// Globally unique IDs that define an object's ID in storage. Any Sui Object, that is a struct
/// with the `key` ability, must have `id: UID` as its first field.
/// These are globaly unique in the sense that no two values of type `UID` are ever equal, in
/// other words for any two values `id1: UID` and `id2: UID`, `id1` != `id2`.
/// This is a privileged type that can only be derived from a `TxContext`.
/// `UID` doesn't have the `drop` ability, so deleting a `UID` requires a call to `delete`.
export type UID = {
    id: ID,
}


export type Table<K, V> = Object<{
    /// the ID of this table
    id: UID,
    /// the number of key-value pairs in the table
    size: u64,
}>


/// Data structure stored for each momentum safe wallet, including:
///     1. momentum safe info (owners, public keys, threshold, e.t.c.)
///     2. TxnBook of pending transactions.
export type Momentum = Object<{
    id: UID,
    info: Info,
    txn_book: TxnBook,
}>

/// Basic information of multi-sig wallet.
/// Including owners, public keys, threshold, and wallet name (as metadata).
export type Info = Object<{
    // version of msafe
    version: u64,
    // vector of owners
    owners: VecSet<address>,
    // signing threshold
    threshold: u64,
    // metadata for wallet information
    metadata: bytes,
}>

/// Stores the pending transactions of a multi-sig wallet.
export type TxnBook = Object<{
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
}>

export type PayloadAssetWithdraw = Object<{
    to: address,
    asset_id: address,
}>

export type PayloadCoinWithdraw = {
    to: address,
    coin_type: bytes,
    amount: u64,
}

export type PayloadOwnerChange = {
    owners: vector<address>,
    threshold: u64,
}

export type Payload = Object<{
    type: u64,
    payload: bytes,
}>

/// Transaction includes all information needed for a certain transaction
/// to be executed by the momentum safe wallet, including payload, metadata,
/// and signatures.
/// Initially, transaction will have only 1 signature. The signatures are
/// added when other owners call addSignature. The transaction is ready to
/// be sent when number of signatures reaches threshold - 1.
export type Transaction = Object<{
    version: u64,
    creator: address,
    // Payload of the transaction to be executed by the momentum safe wallet.
    // Can be an arbitrary transaction payload.
    payload: Payload,
    expiration: u64,
    confirms: VecSet<address>,
}>