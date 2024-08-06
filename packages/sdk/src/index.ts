export * from './connector';
export { ConnectProvider } from './context';
export * from './hooks';
export const getVersion = () => {
  return '__buildVersion';
};

if (typeof window !== 'undefined') {
  (window as any).__VAULTLAYER_SDK_VERSION = getVersion();
}
