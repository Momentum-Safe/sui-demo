# SUI MSAFE DEMO
Sui Msafe Demo is a contract-based multi-sign wallet designed to improve the security of assets.
It can be used to manage arbitrary coins and any other assets, such as NFT.
And it also supports modification of wallet permissions. 

## Installation
1. Install [sui] binary from release.
2. Install npm package: `yarn`

## Start local sui node with faucet
Run: `yarn faucet-node`

## Publish contract
1. Init sui client: `sui genesis`
2. Get default address: `sui client active-address`
3. Get coin from faucet: `yarn faucet $ACTIVE_ADDRESS`
4. Publish msafe code: `yarn msafe-cli publish`
5. Export msafe contract address: `export MSAFE=$ContractAddress`

## Msafe CLI
CLI tools to interact with msafe contract.
It can be used to create new multi-sign wallets, initiate multi-sign transactions, and modify wallet permissions.

Cmd: `yarn msafe-cli`

Usage: 
```shell
Usage: msafe-cli [options] [command]

CLI to interact with msafe contract

Options:
  -V, --version             output the version number
  -h, --help                display help for command

Commands:
  object [options] <id>     get object
  createAccounts [options]  Create accounts and save secret key to disk
  faucet <to>               Faucet to given address
  publish [options]         Publish msafe contract
  msafe                     Interact with msafe contract
  help [command]            display help for command
```

### Create accounts
Create accounts and save plain secret key to disk.

Example: `yarn msafe-cli --num 2`

Usage:
```shell
Usage: msafe-cli createAccounts [options]

Create accounts and save secret key to disk

Options:
  --keydir <path>          Path to directory to store secret keys (default: "./.key")
  -n --num <number>        Number of accounts to create (default: "1")
  --skip-faucet            skip to faucet (default: false)
  --network <NetworkType>  network to use, support LOCAL,DEVNET, omit use ($NETWORK || LOCAL) (default: "LOCAL")
  -h, --help               display help for command
```

### Create a new msafe wallet
Create a new msafe wallet.

Example: 
```shell
export ACCOUNT=1424b4ec3e8f0079c34fd9bf842ddcfa03be202e
export MSAFE=0x15e10a56917f016c0c9145b4a2f0bcfd58e2d9d7
yarn msafe-cli msafe create 1424b4ec3e8f0079c34fd9bf842ddcfa03be202e,5627f62c8cd7cc70df4cedd5d01a74d027358107 2
```

Usage:
```shell
Usage: msafe-cli msafe create [options] <owners> <threshold>

Create a new msafe wallet

Arguments:
  owners                   owners of msafe, separated with ','
  threshold                threshold of msafe

Options:
  --keydir <path>          Path to directory to store secret keys (default: "./.key")
  --account <address>      account to use, omit use $ACCOUNT (default: "1424b4ec3e8f0079c34fd9bf842ddcfa03be202e")
  --msafe <address>        msafe contract address, omit use $MSAFE (default: "0x15e10a56917f016c0c9145b4a2f0bcfd58e2d9d7")
  --network <NetworkType>  network to use, support LOCAL,DEVNET, omit use ($NETWORK || LOCAL) (default: "LOCAL")
  --name                   alias name of new wallet
  -h, --help               display help for command
```

### Deposit asset to a msafe wallet

Example: 
```shell
export ACCOUNT=1424b4ec3e8f0079c34fd9bf842ddcfa03be202e
export MSAFE=0x15e10a56917f016c0c9145b4a2f0bcfd58e2d9d7
export WALLET=0x4e63b35c2f71352b803e54e49d622dad39ae08d7
msafe deposit --asset_id 0xf37558745cce4cd4143557f31e3b2a35144ecf39
```

Usage:
```shell
Usage: msafe-cli msafe deposit [options]

Deposit asset to a msafe wallet

Options:
  --keydir <path>          Path to directory to store secret keys (default: "./.key")
  --account <address>      account to use, omit use $ACCOUNT (default: "1424b4ec3e8f0079c34fd9bf842ddcfa03be202e")
  --msafe <address>        msafe contract address, omit use $MSAFE (default: "0x15e10a56917f016c0c9145b4a2f0bcfd58e2d9d7")
  --network <NetworkType>  network to use, support LOCAL,DEVNET, omit use ($NETWORK || LOCAL) (default: "LOCAL")
  --asset_id <HexString>   objectId of asset to deposit
  --walletID <HexString>   id of msafe wallet, omit use $WALLET (default: "0x4e63b35c2f71352b803e54e49d622dad39ae08d7")
  -h, --help               display help for command
```

### Create a msafe transaction to withdraw asset

Example:
```shell
export ACCOUNT=1424b4ec3e8f0079c34fd9bf842ddcfa03be202e
export MSAFE=0x15e10a56917f016c0c9145b4a2f0bcfd58e2d9d7
export WALLET=0x4e63b35c2f71352b803e54e49d622dad39ae08d7
npx ts-node scripts/msafe_cli msafe withdraw_init --asset_id 0xf37558745cce4cd4143557f31e3b2a35144ecf39
```

Usage:
```shell
Usage: msafe-cli msafe withdraw_init [options]

Create a msafe transaction to withdraw asset

Options:
  --keydir <path>          Path to directory to store secret keys (default: "./.key")
  --account <address>      account to use, omit use $ACCOUNT (default: "1424b4ec3e8f0079c34fd9bf842ddcfa03be202e")
  --msafe <address>        msafe contract address, omit use $MSAFE (default: "0x15e10a56917f016c0c9145b4a2f0bcfd58e2d9d7")
  --network <NetworkType>  network to use, support LOCAL,DEVNET, omit use ($NETWORK || LOCAL) (default: "LOCAL")
  --to <string>            which address transfer to, omit would transfer to transaction sender
  --asset_id <HexString>   objectId of asset to deposit
  --walletID <HexString>   id of msafe wallet, omit use $WALLET (default: "0x4e63b35c2f71352b803e54e49d622dad39ae08d7")
  -h, --help               display help for command
```

### Create a msafe transaction to change owners

Example:
```shell
export ACCOUNT=1424b4ec3e8f0079c34fd9bf842ddcfa03be202e
export MSAFE=0x15e10a56917f016c0c9145b4a2f0bcfd58e2d9d7
export WALLET=0x4e63b35c2f71352b803e54e49d622dad39ae08d7
npx ts-node scripts/msafe_cli msafe changeOwner_init 1424b4ec3e8f0079c34fd9bf842ddcfa03be202e,5627f62c8cd7cc70df4cedd5d01a74d027358107 1
```

Usage:
```shell
Usage: msafe-cli msafe changeOwner_init [options] <owners> <threshold>

Create a msafe transaction to change owners

Arguments:
  owners                   owners of msafe, separated with ','
  threshold                threshold of msafe

Options:
  --keydir <path>          Path to directory to store secret keys (default: "./.key")
  --account <address>      account to use, omit use $ACCOUNT (default: "1424b4ec3e8f0079c34fd9bf842ddcfa03be202e")
  --msafe <address>        msafe contract address, omit use $MSAFE (default: "0x15e10a56917f016c0c9145b4a2f0bcfd58e2d9d7")
  --network <NetworkType>  network to use, support LOCAL,DEVNET, omit use ($NETWORK || LOCAL) (default: "LOCAL")
  --walletID <HexString>   id of msafe wallet, omit use $WALLET (default: "0x4e63b35c2f71352b803e54e49d622dad39ae08d7")
  -h, --help               display help for command
```

### Confirm a msafe transaction

Example:
```shell
export MSAFE=0x15e10a56917f016c0c9145b4a2f0bcfd58e2d9d7
export WALLET=0x4e63b35c2f71352b803e54e49d622dad39ae08d7
npx ts-node scripts/msafe_cli msafe confirm --id 0x1424b4ec3e8f0079c34fd9bf842ddcfa03be202e0000000000000000 --account 5627f62c8cd7cc70df4cedd5d01a74d027358107
```

Usage:
```shell
Usage: msafe-cli msafe confirm [options]

Confirm a msafe transaction

Options:
  --keydir <path>          Path to directory to store secret keys (default: "./.key")
  --account <address>      account to use, omit use $ACCOUNT (default: "1424b4ec3e8f0079c34fd9bf842ddcfa03be202e")
  --msafe <address>        msafe contract address, omit use $MSAFE (default: "0x15e10a56917f016c0c9145b4a2f0bcfd58e2d9d7")
  --network <NetworkType>  network to use, support LOCAL,DEVNET, omit use ($NETWORK || LOCAL) (default: "LOCAL")
  --id <HexString>         id of msafe transaction
  --walletID <HexString>   id of msafe wallet, omit use $WALLET (default: "0x4e63b35c2f71352b803e54e49d622dad39ae08d7")
  -h, --help               display help for command
```

### Execute a msafe transaction

Example:
```shell
export MSAFE=0x15e10a56917f016c0c9145b4a2f0bcfd58e2d9d7
export WALLET=0x4e63b35c2f71352b803e54e49d622dad39ae08d7
npx ts-node scripts/msafe_cli msafe execute --id 0x1424b4ec3e8f0079c34fd9bf842ddcfa03be202e0000000000000000
```

Usage:
```shell
Usage: msafe-cli msafe execute [options]

Execute a msafe transaction

Options:
  --keydir <path>          Path to directory to store secret keys (default: "./.key")
  --account <address>      account to use, omit use $ACCOUNT (default: "1424b4ec3e8f0079c34fd9bf842ddcfa03be202e")
  --msafe <address>        msafe contract address, omit use $MSAFE (default: "0x15e10a56917f016c0c9145b4a2f0bcfd58e2d9d7")
  --network <NetworkType>  network to use, support LOCAL,DEVNET, omit use ($NETWORK || LOCAL) (default: "LOCAL")
  --id <HexString>         id of msafe transaction
  --walletID <HexString>   id of msafe wallet, omit use $WALLET (default: "0x4e63b35c2f71352b803e54e49d622dad39ae08d7")
  -h, --help               display help for command
```

## Integrate Test
Run `yarn ts scripts/integrate_test.ts`

[sui]: https://github.com/MystenLabs/sui/releases