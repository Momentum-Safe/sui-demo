# SUI MSAFE DEMO

## Installation
1. install [sui] binary from release.
2. install npm package: `yarn`

## Start Sui node
`yarn faucet-node`

## Publish contract
1. get default address: `sui client active-address`
2. get coin from faucet: `yarn faucet $ACTIVE_ADDRESS`
3. publish code: `sui client publish --gas-budget 10000 -p ./move`
4. record contract object ID in `Created Objects`
5. `export MSAFE=$ContractID`

## Test Msafe
`yarn ts scripts/msafe.ts`

[sui]: https://github.com/MystenLabs/sui/releases