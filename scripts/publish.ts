import {Base64DataBuffer, RawSigner} from '@mysten/sui.js';
import {execSync} from 'child_process';

export async function publish(signer: RawSigner, packagePath: string) {
    const compiledModules = JSON.parse(
        execSync(
            `sui move build --dump-bytecode-as-base64 --path ${packagePath}`,
            {encoding: 'utf-8'}
        )
    );
    const modulesInBytes = compiledModules.map((m:any) =>
        Array.from(new Base64DataBuffer(m).getData())
    );
    const publishTxn = await signer.publish({
        compiledModules: modulesInBytes,
        gasBudget: 10000,
    });
    console.log('publishTxn', publishTxn);
}
