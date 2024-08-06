import EventEmitter from 'events';
import { chains } from '@particle-network/chains';

import { ethers } from 'ethers';
import icon from '../icons/ethereum';
import { BaseConnector, type WalletMetadata } from './base';

export class EthereumConnector extends BaseConnector {
  #network = '0x1'; // Mainnet
  #event = new EventEmitter();

  constructor() {
    super();
    this.#event.setMaxListeners(100);
  }

  readonly metadata: WalletMetadata = {
    id: 'ethereum',
    type: 'eth',
    name: 'Ethereum Wallet',
    icon,
    downloadUrl: 'https://ethereum.org/en/wallets/find-wallet/',
  };

  isReady(): boolean {
    return typeof window !== 'undefined' && typeof (window as any).ethereum !== 'undefined';
  }

  async sendInscription(): Promise<{ txid: string }> {
    throw new Error('Unsupported');
  }

  async requestAccounts(): Promise<string[]> {
    if (!this.isReady()) {
      throw new Error(`${this.metadata.name} is not installed!`);
    }
    const accounts = await (window as any).ethereum.request({
      method: "eth_requestAccounts",
    });
    return accounts.map((item: string) => ethers.utils.getAddress(item));
  }

  async getAccounts(): Promise<string[]> {
    if (!this.isReady()) {
      throw new Error(`${this.metadata.name} is not installed!`);
    }
    const accounts = await (window as any).ethereum.request({
      method: "eth_accounts",
    });
    return accounts.map((item: string) => ethers.utils.getAddress(item));
  }

  async getPublicKey(): Promise<string> {
    throw new Error('Unsupported');
  }


  async signMessage(signStr: string): Promise<string> {
    if (!this.isReady()) {
      throw new Error(`${this.metadata.name} is not installed!`);
    }
    console.log('signMessage signStr',signStr);
    const addresses = await this.getAccounts();
    if (addresses.length === 0) {
      throw new Error(`${this.metadata.name} not connected!`);
    }
    console.log('signMessage');
    const provider = new ethers.providers.Web3Provider((window as any).ethereum)
    //console.log('signMessage provider',provider);
    const signer = await provider.getSigner();
    //console.log('signMessage signer',signer);
    
    const sig = await signer.signMessage(signStr);
    console.log('signMessage sig',sig);
    return sig;
    };


  on(event: string, handler: (data?: unknown) => void) {
    return this.#event.on(event, handler);
  }

  removeListener(event: string, handler: (data?: unknown) => void) {
    return this.#event.removeListener(event, handler);
  }

  getProvider() {
    if (this.isReady()) {
      return (window as any).ethereum;
    }
  }

  async getNetwork(): Promise<string> {
    if (!this.isReady()) {
      throw new Error(`${this.metadata.name} is not installed!`);
    }
    const chainId = await (window as any).ethereum.request({
      method: "eth_chainId",
    });
    console.log('getNetwork: ', parseInt(chainId));
    const network = chains.getEVMChainInfoById(parseInt(chainId));
    if (!network?.fullname) {
      throw new Error('Error getting Network');
    }
    return network?.fullname;
  }

  // chainId
  async switchNetwork(network: string): Promise<void> {
    try {
      await (window as any).ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: network}],
        });
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added.
      if (switchError.code === 4902) {
        try {
          const chain: any = chains.getEVMChainInfoById(parseInt(network));
          await (window as any).ethereum.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: chain.id,
                  chainName: chain.fullname,
                  rpcUrls: [chain.rpcUrl],
                  blockExplorerUrls: [chain.blockExplorerUrl],
                  iconUrls: [chain.icon, chain.nativeIcon],
                  nativeCurrency: chain.nativeCurrency
                },
              ],
            });
        } catch (e) {
          console.log('Error on addNetwork',e);
        }
      };
    } 
  }

  async sendBitcoin(toAddress: string, satoshis: number): Promise<string> {
    throw new Error('Unsupported');
  }

  async disconnect(): Promise<void> {
    await (window as any).ethereum.request({
      method: "wallet_revokePermissions",
      params: [
        {
          eth_accounts: {},
        },
      ],
    });
  }
}
