import icon from '../icons/bitget';
import { type WalletMetadata } from './base';
import { InjectedConnector } from './injected';

export class BitgetConnector extends InjectedConnector {
  readonly metadata: WalletMetadata = {
    id: 'bitget',
    type: 'uxto',
    name: 'Bitget Wallet',
    icon,
    downloadUrl: 'https://web3.bitget.com/en/wallet-download',
  };

  constructor() {
    super('bitkeep.unisat');
  }
}
