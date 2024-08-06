import icon from '../icons/bybit';
import { type WalletMetadata } from './base';
import { InjectedConnector } from './injected';

export class BybitConnector extends InjectedConnector {
  readonly metadata: WalletMetadata = {
    id: 'bybit',
    type: 'uxto',
    name: 'Bybit Wallet',
    icon,
    downloadUrl: 'https://www.bybit.com/download/',
  };

  constructor() {
    super('bybitWallet.bitcoin');
  }
}
