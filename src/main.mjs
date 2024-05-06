import { getInitialTestAccountsWallets } from '@aztec/accounts/testing';
import { ExtendedNote, Fr, Note, computeSecretHash, createPXEClient } from '@aztec/aztec.js';
import { getToken } from './contracts.mjs';

const { PXE_URL = 'http://localhost:8080' } = process.env;

async function main() {
    const pxe = createPXEClient(PXE_URL);
    await getChainId(pxe);
    await mintPublicFunds(pxe);
    await mintPrivateFunds(pxe);
}

async function getChainId(pxe) { 
    const { chainId } = await pxe.getNodeInfo();
    console.log(`Connected to chain ${chainId}`);
}

async function showPublicBalances(pxe) {
    const accounts = await pxe.getRegisteredAccounts();
    const token = await getToken(pxe);
  
    for (const account of accounts) {
      const balance = await token.methods.balance_of_public(account.address).simulate();
      console.log(`Balance of ${account.address}: ${balance}`);
    }
}

async function showPrivateBalances(pxe) {
    const accounts = await pxe.getRegisteredAccounts();
    const token = await getToken(pxe);
  
    for (const account of accounts) {
      const balance = await token.methods.balance_of_private(account.address).simulate();
      console.log(`Balance of ${account.address}: ${balance}`);
    }
}

async function mintPublicFunds(pxe) {
    const [owner] = await getInitialTestAccountsWallets(pxe);
    const token = await getToken(owner);

    console.log(`Minting 100 tokens for ${owner.getAddress()}`);

    const tx = token.methods.mint_public(owner.getAddress(), 100n).send();
    console.log(`Sent mint transaction ${await tx.getTxHash()}`);
    await showPublicBalances(pxe);

    console.log(`Awaiting transaction to be mined`);
    const receipt = await tx.wait();
    console.log(`Transaction has been mined on block ${receipt.blockNumber}`);
    await showPublicBalances(pxe);
}


async function mintPrivateFunds(pxe) {
    const [owner] = await getInitialTestAccountsWallets(pxe);
    const token = await getToken(owner);
  
    await showPrivateBalances(pxe);
  
    const mintAmount = 20n;
    const secret = Fr.random();
    const secretHash = await computeSecretHash(secret);
    const receipt = await token.methods.mint_private(mintAmount, secretHash).send().wait();
  
    const storageSlot = token.artifact.storageLayout['pending_shields'].slot;
    const noteTypeId = token.artifact.notes['TransparentNote'].id;
  
    const note = new Note([new Fr(mintAmount), secretHash]);
    const extendedNote = new ExtendedNote(
      note,
      owner.getAddress(),
      token.address,
      storageSlot,
      noteTypeId,
      receipt.txHash,
    );
    await pxe.addNote(extendedNote);
  
    await token.methods.redeem_shield(owner.getAddress(), mintAmount, secret).send().wait();
  
    await showPrivateBalances(pxe);
}

main().catch(err => {
  console.error(`Error in app: ${err}`);
  process.exit(1);
});