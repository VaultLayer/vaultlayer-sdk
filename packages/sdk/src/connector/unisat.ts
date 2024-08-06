import icon from '../icons/unisat';
import { type WalletMetadata } from './base';
import { InjectedConnector } from './injected';

export class UnisatConnector extends InjectedConnector {
  readonly metadata: WalletMetadata = {
    id: 'unisat',
    type: 'uxto',
    name: 'Unisat Wallet',
    icon,
    downloadUrl: 'https://unisat.io',
  };

  constructor() {
    super('unisat');
  }
}
