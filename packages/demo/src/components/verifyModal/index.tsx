import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@nextui-org/react';
import { useEthereumProvider } from '@vaultlayer/sdk';

import { useRequest } from 'ahooks';
import { useCallback } from 'react';
import { toast } from 'react-toastify';
import { type Hex } from 'viem';

export const VerifyModal = ({
  isOpen,
  onOpenChange,
  signData,
}: {
  isOpen: boolean;
  onOpenChange: () => void;
  signData?: {
    signature: string;
    data: any;
  };
}) => {
  const { smartVault, vaultEthClient } = useEthereumProvider();
  /* TODO
  const verifyPersonalSign = useCallback(async () => {
    if (!vaultEthClient || !signData || !smartVault) {
      throw new Error('params error');
    }

    const result = await vaultEthClient.verifyMessage({
      address: smartVault?.ethAddress,
      message: signData.data,
      signature: signData.signature,
    });
    return result;
  }, [vaultEthClient, smartVault, signData]);

  const verifySignTypedData = useCallback(async () => {
    if (!vaultEthClient || !signData || !smartVault) {
      throw new Error('params error');
    }

    const result = await vaultEthClient.verifyTypedData({
      address: smartVault?.ethAddress,
      signature: signData.signature,
      ...signData.data,
    });
    return result;
  }, [vaultEthClient, smartVault, signData]);
*/
  const { run: onVerify, loading: verifyLoading } = useRequest(
    async () => {
      //TODO
      if (typeof signData?.data === 'string') {
        return true; //await verifyPersonalSign();
      } else {
        return false; //await verifySignTypedData();
      }
    },
    {
      manual: true,
      onSuccess: (result) => {
        if (result) {
          toast.success('Verification Successful');
        } else {
          toast.error('Verification Failed');
        }
      },
      onError: (error: any) => {
        toast.error(error.details || error.message || 'Verification Failed');
      },
      onFinally: () => {
        onOpenChange();
      },
    }
  );

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">Signature Verification</ModalHeader>
            <ModalBody>
              <div className="flex w-full flex-col">
                <span className="font-bold">Address: </span>
                <span className="whitespace-pre-wrap break-words">{smartVault?.ethAddress}</span>
              </div>

              <div className="flex w-full flex-col">
                <span className="font-bold">Signature: </span>
                <span className="whitespace-pre-wrap break-words">{signData?.signature}</span>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="light" onPress={onClose}>
                Close
              </Button>
              <Button color="primary" onClick={onVerify} isLoading={verifyLoading}>
                Verify
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
