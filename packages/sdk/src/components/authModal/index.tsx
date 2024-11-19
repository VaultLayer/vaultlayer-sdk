import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useConnectProvider } from '../../context';
import { EventName } from '../../types/eventName';
import events from '../../utils/eventUtils';
import close from '../../icons/close';
import vaultIcon from '../../icons/vaultlayer';
import Modal from '../modal';
import styles from './sign.module.scss';

const AuthModal = ({ open, onClose, onOpen }: { open: boolean; onClose: () => void; onOpen: () => void }) => {
  const [authArguments, setAuthArguments] = useState<any>();
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const { smartVault, authMethod } = useConnectProvider();

  useEffect(() => {
    if (smartVault) {
      console.log('smartVault ready');
      setLoading(false);
      try {
        events.emit(EventName.authResult, { result: true });
      } catch (error) {
        events.emit(EventName.authResult, {
          error,
        });
      }
      onClose();
    }
  }, [smartVault]);

  useEffect(() => {
    if (authMethod) {
      console.log('authMethod ready');
      setLoading(true);
    }
  }, [authMethod]);

  useEffect(() => {
    const onStartAuth = (arg: any) => {
      setAuthArguments(arg);
      console.log('setAuthArguments:', arg);
      onOpen();
    };
    const onAuthResult = (arg: any) => {
      console.log('setErrorMessage:', arg);
      setErrorMessage(JSON.stringify(arg));
    };
    events.on(EventName.startAuth, onStartAuth);
    events.on(EventName.authResult, onAuthResult);
    return () => {
      events.off(EventName.startAuth, onOpen);
    };
  }, [onOpen]);

  const closeModal = () => {
    events.emit(EventName.authResult, {
      error: {
        code: 4001,
        message: 'The user rejected the request.',
      },
    });

    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} isDismissable={false} contentClassName={styles.modalContent}>
      <div className={styles.title}>Sign-in to SmartVault</div>
      <img className={styles.closeBtn} src={close} onClick={closeModal}></img>
      {authArguments && (
        <div className={styles.connecting}>
          <div className={styles.connectingIconContainer}>
            <img className={styles.connectingIcon} width={'60px'} src={vaultIcon} alt={''} />
          </div>

          <div className={styles.connection}>
            {authArguments.lsvId ? 'Authenticating with LSV Id' : 'Authenticating with Wallet'}
          </div>
          {authArguments.address && (
            <div className={styles.unsignedMessage}>
              Address: {`${authArguments.address.slice(0, 5)}...${authArguments.address.slice(-4)}`} <br />
            </div>
          )}
          {authArguments.lsvId && (
            <div className={styles.unsignedMessage}>
              LSV ID: {`${authArguments.lsvId.slice(0, 6)}...${authArguments.lsvId.slice(-4)}`} <br />
            </div>
          )}

          {!loading ? (
            <div className={styles.acceptRequest}>Approve the signature on your wallet to sign-in</div>
          ) : (
            <div className={styles.acceptRequest}>Loading...</div>
          )}
          {errorMessage && <div className={styles.acceptRequest}>ERROR: {errorMessage}</div>}
        </div>
      )}
    </Modal>
  );
};

export default AuthModal;
