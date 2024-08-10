import React, { useEffect, useState } from 'react';
import { type BaseConnector } from '../../connector/base';
import { useConnectProvider } from '../../context';
import { useConnector } from '../../hooks';
import back from '../../icons/back';
import close from '../../icons/close';
import retryIcon from '../../icons/retry';
import vaultIcon from '../../icons/vaultlayer';
import Button from '../button';
import Modal from '../modal';
import styles from './connect.module.scss';

const ConnectModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [backVisible, setBackVisible] = useState(false);
  const [retryVisible, setRetryVisible] = useState(false);
  const [walletReady, setWalletReady] = useState(true);
  const [connectorReady, setConnectorReady] = useState(false);
  const [selectConnector, setSelectConnector] = useState<BaseConnector>();
  const { closeConnectModal, smartVault } = useConnectProvider();
  const { connect, connectors } = useConnector();

  useEffect(() => {
    if (smartVault) {
      console.log('smartVault ready');
      closeConnectModal();
    }
  }, [smartVault]);

  useEffect(() => {
    if (!open) {
      setBackVisible(false);
      setRetryVisible(false);
      setWalletReady(true);
      setSelectConnector(undefined);
      setConnectorReady(false);
    }
  }, [open]);

  const onConnect = async (connector: BaseConnector) => {
    setBackVisible(true);
    setSelectConnector(connector);
    if (connector.isReady()) {
      try {
        await connect(connector.metadata.id);
        setConnectorReady(true);        
      } catch (error: any) {
        console.error('onConnect error', error);
        if (error.code === 4001) {
          setRetryVisible(true);
        }
      }
    } else {
      setWalletReady(false);
    }
  };

  const onBack = () => {
    setBackVisible(false);
    setRetryVisible(false);
    setConnectorReady(false);
    setWalletReady(true);
    setSelectConnector(undefined);
  };

  const onRetry = () => {
    setRetryVisible(false);
    if (selectConnector) {
      onConnect(selectConnector);
    }
  };

  return (
    <Modal open={open} onClose={onClose} isDismissable={false} contentClassName={styles.connectModal}>
      <div className={styles.title}>{selectConnector?.metadata.name || 'Wallet to open Smart Vault'}</div>
      <img className={styles.closeBtn} src={close} onClick={onClose}></img>
      {backVisible && <img className={styles.backBtn} src={back} onClick={onBack} alt={''}/>}

      {!backVisible &&
        connectors.map((connector) => {
          return (
            <div className={styles.walletItem} key={connector.metadata.id} onClick={() => onConnect(connector)}>
              <img className={styles.walletIcon} src={connector.metadata.icon} alt={''}/>
              <div className={styles.walletName}>{connector.metadata.name}</div>
            </div>
          );
        })}

      {backVisible && selectConnector && !connectorReady && (
        <div className={styles.connecting}>
          <div className={styles.connectingIconContainer}>
            <img className={styles.connectingIcon} src={selectConnector.metadata.icon} alt={''}/>
            {retryVisible && (
              <div className={styles.retryContainer} onClick={onRetry}>
                <img className={styles.retryIcon} src={retryIcon} alt={''}/>
              </div>
            )}
          </div>

          {walletReady ? (
            <>
              <div className={styles.connection}>{retryVisible ? 'Request Cancelled' : 'Requesting Connection'}</div>
              <div className={styles.acceptRequest}>
                {retryVisible
                  ? 'You cancelled the request.\nClick above to try again.'
                  : 'Accept the request through your wallet to connect to this app.'}
              </div>
            </>
          ) : (
            <>
              <div className={styles.connection}>Wallet Not Installed.</div>
              <Button
                className={styles.btnDownload}
                onClick={() => {
                  window.open(selectConnector?.metadata.downloadUrl, '_blank');
                }}
              >
                Get
              </Button>
            </>
          )}
        </div>
      )}

{backVisible && connectorReady && (
        <div className={styles.connecting}>
          <div className={styles.connectingIconContainer}>
            <img className={styles.connectingIcon} src={vaultIcon} alt={''}/>
            {retryVisible && (
              <div className={styles.retryContainer} onClick={onRetry}>
                <img className={styles.retryIcon} src={retryIcon} alt={''}/>
              </div>
            )}
          </div>
            
              <div className={styles.connection}>{retryVisible ? 'Request Cancelled' : 'Sign-in to Smart Vault'}</div>
              <div className={styles.acceptRequest}>
                {retryVisible
                  ? 'You cancelled the request.\nClick above to try again.'
                  : 'Accept the request through your wallet to sign-in to Smart Vault.'}
              </div>
            
        </div>
      )}
    </Modal>
  );
};

export default ConnectModal;
