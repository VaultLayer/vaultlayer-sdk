export interface UTXO {
  txid: string | Uint8Array;
  vout: number;
  value: number;
  nonWitnessUtxo?: Uint8Array;
  witnessUtxo?: {
    script: Uint8Array;
    value: number;
  };
  redeemScript?: Uint8Array;
  witnessScript?: Uint8Array;
  isTaproot?: boolean;
}
export interface Target {
  address?: string;
  script?: Uint8Array;
  value?: number;
}
export interface SelectedUTXO {
  inputs?: UTXO[];
  outputs?: Target[];
  fee: number;
}
export default function coinSelect(
  utxos: UTXO[],
  outputs: Target[],
  feeRate: number,
  changeAddr?: string
): SelectedUTXO;
