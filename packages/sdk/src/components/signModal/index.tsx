import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { formatEther, hexToString, type Hex } from 'viem';
import { useConnectProvider } from '../../context';
import { useVaultProvider } from '../../hooks';
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
  const [vaultSignArguments, setVaultSignArguments] = useState<any>();

  const { chainId, smartVault, vaultEthWallet } = useVaultProvider();

  useEffect(() => {
    if (!open) {
      setVaultSignArguments(undefined);
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
    const onVaultSign = (arg: any) => {
      setVaultSignArguments(arg);
      console.log('vaultSignArguments:', arg);
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
    events.on(EventName.vaultSign, onVaultSign);
    events.on(EventName.personalSign, onPersonalSign);
    events.on(EventName.signTypedData, onSignTypedData);
    return () => {
      events.off(EventName.vaultSign, onVaultSign);
      events.off(EventName.personalSign, onPersonalSign);
      events.off(EventName.signTypedData, onSignTypedData);
    };
  }, [onOpen]);

  /*
  useEffect(() => {
    if (open && publicClient && ethAccount && userOpBundle) {
      publicClient
        .getBalance({ address: ethAccount as Hex })
        .then((result) => setNativeBalance(result))
        .catch((error) => {
          console.log('🚀 ~ getBalance ~ error:', error);
          events.emit(EventName.sendUserOpResult, {
            error,
          });
          onClose();
        });
    }
  }, [open, publicClient, ethAccount, userOpBundle, onClose]);
*/
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
    } else if (vaultSignArguments) {
      event = EventName.vaultSignResult;
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
        const hash = await vaultEthWallet.signMessage(requestArguments?.params[0]);
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
    } else if (vaultSignArguments) {
      try {
        events.emit(EventName.vaultSignResult, { result: vaultSignArguments.pstb });
      } catch (error) {
        events.emit(EventName.vaultSignResult, {
          error,
        });
      } finally {
        setLoading(false);
      }
    }

    onClose();
  }, [requestArguments, vaultSignArguments, onClose]);

  /*
  useEffect(() => {
    if (userOpBundle && nativeBalance != null && deserializeResult) {
      const nativeChange = 0;
      if (userOpBundle.userOp.paymasterAndData.length > 2) {
        // 计算余额，需大于等于nativeChange
        setDisabled(nativeBalance < nativeChange);
      } else {
        // 计算余额，需大于等于gasFee+nativeChange
        setDisabled(nativeBalance < gasFee + nativeChange);
      }
    }
  }, [userOpBundle, gasFee, nativeBalance, deserializeResult]);
  */

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

        {vaultSignArguments && (
          <div className={styles.signTitle}>{vaultSignArguments.pstb ? 'Review Transaction' : 'Sign Transaction'}</div>
        )}

        {requestArguments && (
          <div className={styles.signTitle}>
            {requestArguments.method == EthMethod.personalSign ? 'Sign Message' : 'Sign Typed Data'}
          </div>
        )}

        <div className={styles.chainInfo}>
          <img alt="" src={chainInfo?.icon} />
          {chainInfo?.fullname.replace('Mainnet', '')}
        </div>

        {smartVault && smartVault.ethAddress && (
          <div className={styles.addressContainer}>
            <CopyText value={smartVault.ethAddress} style={{ textDecorationLine: 'none' }}>
              <div className={styles.addressInfo}>
                {shortString(smartVault.ethAddress)}
                <img alt="" src={copy} />
              </div>
            </CopyText>
          </div>
        )}

        <div className={styles.detailsContent + (requestArguments || vaultSignArguments ? ` ${styles.fill}` : '')}>
          {vaultSignArguments && vaultSignArguments.details && (
            <div className={styles.unsignedMessage}>
              To: {vaultSignArguments?.details?.toAddress} <br />
              Value: {vaultSignArguments?.details?.satoshis} <br />
              Fee: {vaultSignArguments?.details?.fee} <br />
              Total: {vaultSignArguments?.details?.total} <br />
            </div>
          )}
          {unsignedMessage && <div className={styles.unsignedMessage}>{unsignedMessage}</div>}
        </div>

        {vaultSignArguments && vaultSignArguments?.details?.fee && (
          <div className={styles.estimatedGas}>{`Estimated gas fee: ${formatEther(vaultSignArguments?.details?.fee)} ${
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
