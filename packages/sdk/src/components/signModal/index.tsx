import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { formatEther, hexToString, type Hex } from 'viem';
import { useConnectProvider } from '../../context';
import { useEthereumProvider } from '../../hooks';
import checkBox from '../../icons/check_box';
import checkBoxBlank from '../../icons/check_box_blank';
import close from '../../icons/close';
import copy from '../../icons/copy';
import { EventName } from '../../types/eventName';
import { EthMethod } from '../../types/ethMethod';
import { shortString } from '../../utils';
import events from '../../utils/eventUtils';
import txConfirm from '../../utils/txConfirmUtils';
import Button from '../button';
import CopyText from '../copyText';
import Modal from '../modal';
import styles from './sign.module.scss';

import { chains } from '@particle-network/chains';

interface RequestArguments {
  method: string;
  params?: any[];
}

const SignModal = ({ open, onClose, onOpen }: { open: boolean; onClose: () => void; onOpen: () => void }) => {
  const [notRemindChecked, setNotRemindChecked] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [disabled, setDisabled] = useState<boolean>(false);
  const [showNotRemind, setShowNotRemind] = useState<boolean>(true);
  const [nativeBalance, setNativeBalance] = useState<bigint>();

  // personal_sign or eth_signTypedData
  const [requestArguments, setRequestArguments] = useState<RequestArguments>();
  const [signPsbtArguments, setSignPsbtArguments] = useState<any>();
  const [switchNetworkArguments, setSwitchNetworkArguments] = useState<any>();

  const { chainId, smartVault, vaultEthWallet } = useEthereumProvider();

  useEffect(() => {
    if (!open) {
      setSignPsbtArguments(undefined);
      setRequestArguments(undefined);
      setLoading(false);
      setNativeBalance(undefined);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      const notRemind = txConfirm.isNotRemind();
      setShowNotRemind(!notRemind);
      if (!notRemind) {
        setNotRemindChecked(false);
      }
    }
  }, [open]);

  const chainInfo = useMemo(() => {
    if (chainId) {
      return chains.getEVMChainInfoById(chainId);
    }
  }, [chainId]);

  useEffect(() => {
    const onPsbtSign = (arg: any) => {
      setSignPsbtArguments(arg);
      console.log('signPsbtArguments:', arg);
      onOpen();
    };
    const onSwitchNetwork = (arg: any) => {
      setSwitchNetworkArguments(arg);
      console.log('switchNetworkArguments:', arg);
      onOpen();
    };
    const onPersonalSign = (arg: RequestArguments) => {
      setRequestArguments(arg);
      onOpen();
    };
    const onSignTypedData = (arg: RequestArguments) => {
      setRequestArguments(arg);
      onOpen();
    };
    events.on(EventName.psbtSign, onPsbtSign);
    events.on(EventName.switchNetwork, onSwitchNetwork);
    events.on(EventName.personalSign, onPersonalSign);
    events.on(EventName.signTypedData, onSignTypedData);
    return () => {
      events.off(EventName.psbtSign, onPsbtSign);
      events.on(EventName.switchNetwork, onSwitchNetwork);
      events.off(EventName.personalSign, onPersonalSign);
      events.off(EventName.signTypedData, onSignTypedData);
    };
  }, [onOpen]);

  const toggleNotRemind = () => {
    setNotRemindChecked(!notRemindChecked);
    txConfirm.setNotRemind(!notRemindChecked);
  };

  const closeModal = () => {
    let event;
    if (requestArguments?.method === EthMethod.personalSign) {
      event = EventName.personalSignResult;
    } else if (requestArguments?.method?.startsWith(EthMethod.signTypedData)) {
      event = EventName.signTypedDataResult;
    } else if (signPsbtArguments) {
      event = EventName.psbtSignResult;
    }

    if (event) {
      events.emit(event, {
        error: {
          code: 4001,
          message: 'The user rejected the request.',
        },
      });
    }

    onClose();
  };

  const confirmTx = useCallback(async () => {
    setLoading(true);
    if (requestArguments && requestArguments?.params) {
      try {
        const hash = await vaultEthWallet?.signMessage(requestArguments?.params[0]);
        events.emit(
          requestArguments.method == EthMethod.personalSign
            ? EventName.personalSignResult
            : EventName.signTypedDataResult,
          { result: hash }
        );
      } catch (error) {
        events.emit(
          requestArguments.method == EthMethod.personalSign
            ? EventName.personalSignResult
            : EventName.signTypedDataResult,
          {
            error,
          }
        );
      } finally {
        setLoading(false);
      }
    } else if (signPsbtArguments) {
      try {
        events.emit(EventName.psbtSignResult, { result: signPsbtArguments.pstb });
      } catch (error) {
        events.emit(EventName.psbtSignResult, {
          error,
        });
      } finally {
        setLoading(false);
      }
    } else if (switchNetworkArguments) {
      try {
        events.emit(EventName.switchNetworkResult, { result: switchNetworkArguments.network });
      } catch (error) {
        events.emit(EventName.switchNetworkResult, {
          error,
        });
      } finally {
        setLoading(false);
      }
    }

    onClose();
  }, [vaultEthWallet, requestArguments, signPsbtArguments, switchNetworkArguments, onClose]);

  const unsignedMessage = useMemo(() => {
    if (!requestArguments) {
      return undefined;
    }

    if (requestArguments.method === EthMethod.personalSign) {
      const message = requestArguments.params?.[0] || '0x';
      return hexToString(message);
    } else {
      const typedData = requestArguments.params?.[1];
      const obj = typeof typedData === 'string' ? JSON.parse(typedData) : typedData;
      return JSON.stringify(obj, null, 2);
    }
  }, [requestArguments]);

  return (
    <Modal open={open} onClose={onClose} isDismissable={false} contentClassName={styles.modalContent}>
      <>
        <img alt="" className={styles.closeBtn} src={close} onClick={closeModal} />

        {signPsbtArguments && <div className={styles.signTitle}>{'Sign Transaction'}</div>}
        {switchNetworkArguments && <div className={styles.signTitle}>{'Switch Network'}</div>}

        {requestArguments && (
          <div className={styles.signTitle}>
            {requestArguments.method == EthMethod.personalSign ? 'Sign Message' : 'Sign Typed Data'}
          </div>
        )}

        <div className={styles.chainInfo}>
          <img alt="" src={chainInfo?.icon} />
          {chainInfo?.fullname.replace('Mainnet', '')}
        </div>

        <div
          className={
            styles.detailsContent +
            (requestArguments || signPsbtArguments || switchNetworkArguments ? ` ${styles.fill}` : '')
          }
        >
          {signPsbtArguments && signPsbtArguments.details && (
            <div className={styles.unsignedMessage}>
              To: {signPsbtArguments?.details?.toAddress} <br />
              Value: {signPsbtArguments?.details?.satoshis} <br />
              Fee: {signPsbtArguments?.details?.fee} <br />
              Total: {signPsbtArguments?.details?.total} <br />
            </div>
          )}
          {switchNetworkArguments && switchNetworkArguments.network && (
            <div className={styles.unsignedMessage}>{switchNetworkArguments?.network}</div>
          )}
          {unsignedMessage && <div className={styles.unsignedMessage}>{unsignedMessage}</div>}
        </div>

        {signPsbtArguments && signPsbtArguments?.details && (
          <div className={styles.estimatedGas}>{`Estimated gas fee: ${formatEther(signPsbtArguments?.details?.fee)} ${
            chainInfo?.nativeCurrency.symbol
          }`}</div>
        )}

        <Button onClick={confirmTx} className={styles.signBtn} isLoading={loading} isDisabled={disabled}>
          {loading ? 'LOADING' : disabled ? 'INSUFFICIENT FEE' : 'CONFIRM'}
        </Button>

        {showNotRemind && (
          <div className={styles.notRemind} onClick={toggleNotRemind}>
            <img alt="" src={notRemindChecked ? checkBox : checkBoxBlank} />
            Do not remind me again
          </div>
        )}
      </>
    </Modal>
  );
};

export default SignModal;
