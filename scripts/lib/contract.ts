import {RawSigner} from '@mysten/sui.js';

// Generate a new Keypair
export abstract class SuiContract {
    constructor(public readonly address: string, public readonly module: string, public readonly signer: RawSigner) {
    }

    abstract connect(signer: RawSigner): SuiContract;

    async call(method: string, typeArguments: string[], callArguments: any[]) {
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