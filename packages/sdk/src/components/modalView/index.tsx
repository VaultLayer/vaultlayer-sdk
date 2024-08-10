import React, { useState } from 'react';

import styles from './modalView.module.scss';
import wallet from '../../icons/vaultlayer';
import close from '../../icons/close';

const ModalView = () => {
  const [isIframeOpen, setIsIframeOpen] = useState(false);

  const handleOpenIframe = () => {
    setIsIframeOpen(prevValue => !prevValue);
  };

  return (
    <>
      {isIframeOpen && (
        <iframe
          className={styles['modal-view-iframe']}
          src="http://localhost:3000/portfolio"
          title="vaultlayer"
        />
      )}
      <div className={styles['modal-view-button']} onClick={handleOpenIframe}>
        <img src={isIframeOpen ? close : wallet} alt="wallet button" width={50}/>
      </div>
    </>
  );
};

export default ModalView;
