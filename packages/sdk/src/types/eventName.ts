export enum EventName {
  sendUserOp = 'sendUserOp',
  sendUserOpResult = 'sendUserOpResult',

  psbtSign = 'psbtSign',
  psbtSignResult = 'psbtSignResult',

  switchNetwork = 'switchNetwork',
  switchNetworkResult = 'switchNetworkResult',

  personalSign = 'personalSign',
  personalSignResult = 'personalSignResult',

  signTypedData = 'signTypedData',
  signTypedDataResult = 'signTypedDataResult',
}
