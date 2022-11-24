export const log_tx = (tx: any) => {
    console.log(tx.EffectsCert.effects.effects.status, tx.EffectsCert.effects.transactionEffectsDigest);
    //if(tx.EffectsCert.effects.effects.status.status != 'success') throw "transaction failed!";
}
