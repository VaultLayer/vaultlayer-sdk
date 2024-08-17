'use client';

import addIcon from '@/assets/add.svg';
import bitcoinIcon from '@/assets/bitcoin.png';
import infoIcon from '@/assets/info.svg';
import vaultLayerLogo from '@/assets/vaultlayer.svg';
import removeIcon from '@/assets/remove.svg';
import typedData from '@/config/typedData';
import { Button, Checkbox, Divider, Input, Select, SelectItem, useDisclosure } from '@nextui-org/react';
import {
  useAccounts,
  useConnectModal,
  useConnector,
  useVaultProvider,
  useBitcoinProvider,
  useEthereumProvider,
  useWalletProvider,
  type BaseConnector,
} from '@vaultlayer/sdk';

import { chains } from '@particle-network/chains';
import { useRequest } from 'ahooks';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { isAddress, isHex, type Hex } from 'viem';
import { VerifyModal } from '../verifyModal';
import type { BTCAddress } from '@vaultlayer/sdk/src/utils/bitcoinUtils';

type TxData = {
  to: string;
  value: string;
  data: string;
};

const personalSignMessage =
  'Hello VaultLayer!\n\nChain-Abstraction for 1-click Bitcoin DeFi.\n\nhttps://vaultlayer.xyz';

export default function Home() {
  const { openConnectModal, disconnect } = useConnectModal();
  // Connected wallet accounts:
  const { accounts, connector, getNetwork, switchNetwork, getPublicKey, signMessage, sendBitcoin } =
    useWalletProvider();
  // Smart Vault accounts:
  const { smartVault } = useVaultProvider();
  const ethProvider = useEthereumProvider();
  const btcProvider = useBitcoinProvider();
  const [gasless, setGasless] = useState<boolean>(false);
  const [forceHideModal, setForceHideModal] = useState<boolean>(false);
  const [inscriptionReceiverAddress, setInscriptionReceiverAddress] = useState<string>();
  const [inscriptionId, setInscriptionId] = useState<string>();
  const [message, setMessage] = useState<string>('Hello, VaultLayer!');
  const [address, setAddress] = useState<string>();
  const [satoshis, setSatoshis] = useState<string>('1');
  const { connectors, connect } = useConnector();
  const [directConnectors, setDirectConnectors] = useState<BaseConnector[]>();
  const [txDatas, setTxDatas] = useState<TxData[]>([
    {
      to: '',
      value: '0x0',
      data: '0x',
    },
  ]);

  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [signData, setSignData] = useState<{
    signature: string;
    data: any;
  }>();

  const { isOpen: infoIsOpen, onOpen: infoOnOpen, onOpenChange: infoOnOpenChange } = useDisclosure();

  const onGetNetwork = async () => {
    try {
      const network = await getNetwork();
      toast.success(network);
    } catch (error: any) {
      console.log('🚀 ~ onGetNetwork ~ error:', error);
      toast.error(error.message || 'get network error');
    }
  };

  const onSwitchNetwork = async () => {
    try {
      const network = await getNetwork();
      const changeTo = network === 'livenet' ? 'testnet' : 'livenet';
      await switchNetwork(changeTo);
      toast.success(`Change To ${changeTo}`);
    } catch (error: any) {
      console.log('🚀 ~ onSwitchNetwork ~ error:', error);
      toast.error(error.message || 'switch chain error');
    }
  };

  const onGetPubkey = async () => {
    try {
      const pubKey = await getPublicKey();
      console.log('🚀 ~ onGetPubkey ~ pubKey:', pubKey);
      toast.success(pubKey);
    } catch (error: any) {
      toast.error(error.message || 'get pubkey error');
    }
  };

  const onSignMessage = async () => {
    if (!message) {
      return;
    }
    try {
      const sig = await signMessage(message);
      toast.success(sig);
    } catch (error: any) {
      toast.error(error.message || 'sign message error');
    }
  };

  const onSendBitcoin = async () => {
    if (!address) {
      toast.error('Please enter the address');
      return;
    }
    if (!satoshis) {
      toast.error('Please enter the amount');
      return;
    }
    try {
      const txId = await sendBitcoin(address, Number(satoshis));
      toast.success(txId);
    } catch (error: any) {
      toast.error(error.message || 'send bitcoin error');
      console.log('🚀 ~ onSendBitcoin ~ error:', error);
    }
  };

  const onSendInscription = async () => {
    if (!inscriptionReceiverAddress) {
      toast.error('Please enter the receiver address');
      return;
    }
    if (!inscriptionId) {
      toast.error('Please enter the inscription id');
      return;
    }
    /*if (!provider) {
      toast.error('Please connect wallet');
      return;
    }*/
    try {
      const result = { txid: '' }; //await sendInscription(inscriptionReceiverAddress, inscriptionId);
      const txId = result.txid;
      console.log('send inscription success, txid:', txId);
      toast.success(`send success \n${txId}`);
    } catch (error: any) {
      toast.error(error.message || 'send inscription error');
      console.log('🚀 ~ onSendInscription ~ error:', error);
    }
  };

  const onSwitchChain = async (e: any) => {
    const chainId = Number(e.target.value);
    if (chainId) {
      try {
        const hexChainId = '0x' + chainId.toString(16);
        await switchNetwork(hexChainId);
      } catch (error: any) {
        toast.error(error.message || 'switch chain error');
        console.log('🚀 ~ onSwitchChain ~ error:', error);
      }
    }
  };

  const onGetVaultNetwork = async () => {
    try {
      const network = await btcProvider.getNetwork();
      toast.success(network);
    } catch (error: any) {
      console.log('🚀 ~ onGetVaultNetwork ~ error:', error);
      toast.error(error.message || 'get vaultBtcNetwork error');
    }
  };

  const onSwitchVaultNetwork = async () => {
    try {
      const network = await btcProvider.getNetwork();
      const changeTo = network === 'livenet' ? 'testnet' : 'livenet';
      await btcProvider.switchNetwork(changeTo);
      toast.success(`Change To ${changeTo}`);
    } catch (error: any) {
      console.log('🚀 ~ onSwitchNetwork ~ error:', error);
      toast.error(error.message || 'switch chain error');
    }
  };

  const onSendVaultBitcoin = async () => {
    if (!address) {
      toast.error('Please enter the address');
      return;
    }
    if (!satoshis) {
      toast.error('Please enter the amount');
      return;
    }
    try {
      const txId = await btcProvider.sendBitcoin(btcProvider.btcAccounts[0].address, address, Number(satoshis), {
        fee: 'slow',
        bitcoinRpc: 'mempool',
      });
      toast.success(txId);
    } catch (error: any) {
      toast.error(error.message || 'send bitcoin error');
      console.log('🚀 ~ onSendBitcoin ~ error:', error);
    }
  };

  const { run: onSendUserOp, loading: sendUserOpLoading } = useRequest(
    async () => {
      if (txDatas.some((tx) => !isAddress(tx.to) || !isHex(tx.data) || !isHex(tx.value))) {
        throw new Error('Params Error, To is EVM address, Data and Value are hex string.');
      }
      const feeQuotes = { verifyingPaymasterGasless: '', verifyingPaymasterNative: '' }; // await getFeeQuotes(txDatas);
      const hash = ''; // await sendUserOp({ userOp, userOpHash }, forceHideModal);
      return hash;
    },
    {
      manual: true,
      onSuccess: (hash) => {
        toast.success('Send Success!', {
          onClick: () => {
            const chain = chains.getEVMChainInfoById(ethProvider.chainId ?? 0);
            if (chain) {
              window.open(`${chain.blockExplorerUrl}/tx/${hash}`, '_blank');
            }
          },
        });
      },
      onError: (error: any) => {
        console.log('🚀 ~ onSendUserOp ~ error:', error);
        toast.error(error.data?.extraMessage?.message || error.details || error.message || 'send user operation error');
      },
    }
  );

  const { run: onPersonalSign, loading: personalSignLoading } = useRequest(
    async () => {
      /*const result = await walletClient.signMessage({
        account: smartVault.ethAddress as Hex,
        message: personalSignMessage,
      });*/
      const result = '';
      return result;
    },
    {
      manual: true,
      onSuccess: (signature) => {
        setSignData({
          signature,
          data: personalSignMessage,
        });
        onOpen();
        toast.success('personal sign success');
      },
      onError: (error: any) => {
        toast.error(error.details || error.message || 'personal sign error');
      },
    }
  );

  const { run: onSignTypedData, loading: signTypedDataLoading } = useRequest(
    async () => {
      /*const result = await walletClient.signTypedData({
        account: smartVault.ethAddress as Hex,
        ...typedData,
      } as any);*/
      const result = '';
      return result;
    },
    {
      manual: true,
      onSuccess: (signature) => {
        setSignData({
          signature,
          data: typedData,
        });
        onOpen();
        toast.success('sign typedData success');
      },
      onError: (error: any) => {
        toast.error(error.details || error.message || 'sign typedData error');
      },
    }
  );

  useEffect(() => {
    setDirectConnectors(connectors.filter((item) => item.isReady()));
  }, [connectors]);

  useEffect(() => {
    setDirectConnectors(connectors.filter((item) => item.isReady()));
  }, [connectors]);

  const addTxData = () => {
    if (txDatas.length < 5) {
      setTxDatas([
        ...txDatas,
        {
          to: '',
          value: '0x0',
          data: '0x',
        },
      ]);
    }
  };

  const removeTxData = () => {
    if (txDatas.length > 1) {
      setTxDatas(txDatas.slice(0, txDatas.length - 1));
    }
  };

  const onToChanged = (to: string, index: number) => {
    txDatas[index].to = to;
    setTxDatas([...txDatas]);
  };

  const onValueChanged = (value: string, index: number) => {
    txDatas[index].value = value;
    setTxDatas([...txDatas]);
  };

  const onDataChanged = (data: string, index: number) => {
    txDatas[index].data = data;
    setTxDatas([...txDatas]);
  };

  return (
    <div className=" container mx-auto flex h-full flex-col items-center gap-6 overflow-auto py-10">
      <Image src={vaultLayerLogo} alt="" className="" width={100} height={100}></Image>
      <div className="flex items-center gap-3 text-2xl font-bold">VaultLayer SDK</div>

      <div className=" -skew-x-6">Chain-Abstraction for 1-click Bitcoin DeFi</div>

      <div className="absolute right-4 top-4">
        {accounts.length === 0 && (
          <Button color="primary" onClick={openConnectModal}>
            Connect
          </Button>
        )}
        {accounts.length !== 0 && (
          <Button color="primary" onClick={disconnect}>
            Disconnect
          </Button>
        )}
      </div>
      <Divider></Divider>

      <div className="dark:bg-slate-800 mt-12 flex h-auto w-[40rem] max-w-full flex-col gap-4 rounded-lg p-4 shadow-md">
        {accounts.length === 0 && directConnectors && (
          <>
            <div className="mt-6 flex gap-8">
              <div className="mb-4 text-2xl font-bold">Available Wallets to Connect:</div>
              {directConnectors.map((connector) => {
                return (
                  <Image
                    key={connector.metadata.id}
                    src={connector.metadata.icon}
                    alt={connector.metadata.name}
                    width={50}
                    height={50}
                    className="cursor-pointer rounded-lg"
                    onClick={() => connect(connector.metadata.id)}
                  ></Image>
                );
              })}
            </div>
          </>
        )}

        {accounts.length > 0 && connector && (
          <>
            <Image
              key={connector.metadata.id}
              src={connector.metadata.icon}
              alt={connector.metadata.name}
              width={50}
              height={50}
              className="cursor-pointer rounded-lg"
              onClick={() => connect(connector.metadata.id)}
            ></Image>
            <div className="mb-4 text-2xl font-bold">Connected Wallet: {connector.metadata.name}</div>

            <div className="overflow-hidden text-ellipsis whitespace-nowrap">Type: {connector.metadata.type}</div>
            <div className="overflow-hidden text-ellipsis whitespace-nowrap">Addresses: {accounts.join(', ')}</div>

            {connector.metadata.type === 'uxto' && (
              <>
                <Button color="primary" onClick={onGetNetwork}>
                  Get Network
                </Button>

                <Button color="primary" onClick={onSwitchNetwork}>
                  Change Network
                </Button>

                <Button color="primary" onClick={onGetPubkey}>
                  Get Pubkey
                </Button>

                <Divider />
                <Input label="Message" value={message} onValueChange={setMessage}></Input>
                <Button color="primary" onClick={onSignMessage}>
                  Sign Message
                </Button>

                <Divider />
                <Input label="Address" value={address} onValueChange={setAddress}></Input>
                <Input label="Satoshis" value={satoshis} onValueChange={setSatoshis} inputMode="numeric"></Input>
                <Button color="primary" onClick={onSendBitcoin}>
                  Send Bitcoin
                </Button>
              </>
            )}
            {connector.metadata.type === 'eth' && (
              <>
                <Button color="primary" onClick={onGetNetwork}>
                  Get Network
                </Button>

                <Select label="Switch Chain" size="sm" onChange={onSwitchChain} isRequired>
                  {[200901, 200810, 3636, 2442, 1123, 223, 5000, 5003, 2648, 111, 60808, 137, 89682]?.map?.(
                    (chainId) => {
                      const chain = chains.getEVMChainInfoById(chainId)!;
                      return (
                        <SelectItem key={chain.id} value={chain.id}>
                          {chain.fullname}
                        </SelectItem>
                      );
                    }
                  )}
                </Select>

                <Input label="Message" value={message} onValueChange={setMessage}></Input>
                <Button color="primary" onClick={onSignMessage}>
                  Sign Message
                </Button>
              </>
            )}
          </>
        )}
      </div>

      <div className="dark:bg-slate-800 mt-12 flex h-auto w-[40rem] max-w-full flex-col gap-4 rounded-lg p-4 shadow-md">
        <Image src={bitcoinIcon} alt="" className="inline h-10 w-10 rounded-full"></Image>
        <div className="mb-4 text-2xl font-bold">Smart Vault: Bitcoin</div>

        <div className="overflow-hidden text-ellipsis whitespace-nowrap">BTC Addresses:</div>

        {btcProvider.btcAccounts.map((btcAddress: BTCAddress, index: number) => {
          return (
            <div key={index}>
              <div className="overflow-hidden text-ellipsis whitespace-nowrap">Network: {btcAddress.network}</div>
              <div className="overflow-hidden text-ellipsis whitespace-nowrap">Address: {btcAddress.address}</div>
              <div className="overflow-hidden text-ellipsis whitespace-nowrap">PubKey: {btcAddress.publicKey}</div>
              <div className="overflow-hidden text-ellipsis whitespace-nowrap">Type: {btcAddress.type}</div>
              <div className="overflow-hidden text-ellipsis whitespace-nowrap">Purpose: {btcAddress.purpose}</div>
              <Divider className="my-4"></Divider>
            </div>
          );
        })}

        <Button color="primary" onClick={onGetVaultNetwork}>
          Get Network
        </Button>

        <Button color="primary" onClick={onSwitchVaultNetwork}>
          Change Network
        </Button>

        <Divider />

        <Divider />
        <Input label="Address" value={address} onValueChange={setAddress}></Input>
        <Input label="Satoshis" value={satoshis} onValueChange={setSatoshis} inputMode="numeric"></Input>
        <Button color="primary" onClick={onSendVaultBitcoin}>
          Send Bitcoin
        </Button>

        {accounts.length !== 0 && (
          <div className="flex flex-col gap-4">
            <Divider></Divider>
            <Input
              label="Receiver Address"
              value={inscriptionReceiverAddress}
              onValueChange={setInscriptionReceiverAddress}
            ></Input>
            <Input label="Inscription ID" value={inscriptionId} onValueChange={setInscriptionId}></Input>
            <Button color="primary" onClick={onSendInscription}>
              Send Inscription
            </Button>
          </div>
        )}
      </div>

      <div className="dark:bg-slate-800 relative mb-20 mt-20 flex h-auto w-[40rem] max-w-full flex-col gap-4 rounded-lg p-4 shadow-md">
        <div className="mb-4 text-2xl font-bold">Smart Vault: Ethereum</div>
        {smartVault && (
          <Image src={infoIcon} alt="" className="absolute right-4 mt-1 cursor-pointer" onClick={infoOnOpen}></Image>
        )}

        <div className="overflow-hidden text-ellipsis whitespace-nowrap">Address: {smartVault?.ethAddress}</div>
        <div className="overflow-hidden text-ellipsis whitespace-nowrap">ChainId: {ethProvider.chainId}</div>
        <Select
          label="Switch Chain"
          size="sm"
          selectedKeys={ethProvider.chainId ? [ethProvider.chainId?.toString()] : []}
          onChange={onSwitchChain}
          isRequired
        >
          {[200901, 200810, 3636, 2442, 1123, 223, 5000, 5003, 2648, 111, 60808, 137, 89682]?.map?.((chainId) => {
            const chain = chains.getEVMChainInfoById(chainId)!;
            return (
              <SelectItem key={chain.id} value={chain.id}>
                {chain.fullname}
              </SelectItem>
            );
          })}
        </Select>

        <Button
          color="primary"
          onClick={onPersonalSign}
          isLoading={personalSignLoading}
          className="px-10"
          isDisabled={smartVault == null}
        >
          Personal Sign
        </Button>

        <Button
          color="primary"
          onClick={onSignTypedData}
          isLoading={signTypedDataLoading}
          className="px-10"
          isDisabled={smartVault == null}
        >
          Sign Typed Data
        </Button>

        <Divider className="my-4"></Divider>

        <div className="flex justify-between font-medium">
          Send User Operation
          <div className="flex gap-4">
            <Image
              src={removeIcon}
              alt=""
              className="cursor-pointer data-[tx-amount='1']:hidden"
              data-tx-amount={txDatas.length}
              onClick={removeTxData}
            ></Image>
            <Image
              src={addIcon}
              alt=""
              className="cursor-pointer data-[tx-amount='5']:hidden"
              data-tx-amount={txDatas.length}
              onClick={addTxData}
            ></Image>
          </div>
        </div>

        {txDatas.map((tx, index) => (
          <div className="mt-2 flex w-full flex-col gap-2" key={index}>
            <Input label="To" value={tx.to} onValueChange={(value) => onToChanged(value, index)}></Input>
            <Input label="Value" value={tx.value} onValueChange={(value) => onValueChanged(value, index)}></Input>
            <Input label="Data" value={tx.data} onValueChange={(value) => onDataChanged(value, index)}></Input>
            <Divider></Divider>
          </div>
        ))}

        <div className="flex w-full justify-end gap-4">
          {/* <Checkbox isSelected={forceHideModal} onValueChange={setForceHideModal}>
            Force Hide Confirm Modal
          </Checkbox> */}

          <Checkbox isSelected={gasless} onValueChange={setGasless}>
            Gasless
          </Checkbox>
        </div>
        <Button
          color="primary"
          onClick={onSendUserOp}
          isLoading={sendUserOpLoading}
          className="px-10"
          isDisabled={smartVault == null}
        >
          Send
        </Button>
      </div>
      <VerifyModal isOpen={isOpen} onOpenChange={onOpenChange} signData={signData}></VerifyModal>
    </div>
  );
}
