import {execSync} from 'child_process';

export async function publish(packagePath: string) {
    const command = `sui client publish --path ${packagePath} --gas-budget 10000 --json`
    console.log("run:", command)
    const compiledModules = JSON.parse(
        execSync(command, {encoding: 'utf-8'})
    );
    const msafe_created = compiledModules.effects.created[0]
    console.log("msafe contract address:", msafe_created.reference.objectId);
}