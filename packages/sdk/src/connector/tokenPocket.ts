import icon from '../icons/tokenpocket';
import { type WalletMetadata } from './base';
import { InjectedConnector } from './injected';

export class TokenPocketConnector extends InjectedConnector {
  readonly metadata: WalletMetadata = {
    id: 'tokenpocket',
    type: 'uxto',
    name: 'TokenPocket',
    icon,
    downloadUrl: 'https://www.tokenpocket.pro/en/download/app',
  };

  constructor() {
    super('tokenpocket.bitcoin');
  }
}
