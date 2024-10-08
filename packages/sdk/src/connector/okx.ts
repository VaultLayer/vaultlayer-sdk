import icon from '../icons/okx';
import { type WalletMetadata } from './base';
import { InjectedConnector } from './injected';

export class OKXConnector extends InjectedConnector {
  readonly metadata: WalletMetadata = {
    id: 'okx',
    type: 'uxto',
    name: 'OKX Wallet',
    icon,
    downloadUrl: 'https://www.okx.com/download',
  };
  constructor() {
    super('okxwallet.bitcoin');
  }
}
