import icon from '../icons/wizz';
import { type WalletMetadata } from './base';
import { InjectedConnector } from './injected';

export class WizzConnector extends InjectedConnector {
  readonly metadata: WalletMetadata = {
    id: 'wizz',
    type: 'utxo',
    name: 'Wizz Wallet',
    icon,
    downloadUrl: 'https://wizzwallet.io',
  };

  constructor() {
    super('wizz');
  }
}
