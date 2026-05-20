type QrMode = 'Numeric' | 'Alphanumeric' | 'Byte' | 'Kanji';

type QrInstance = {
  addData(data: string, mode?: QrMode): void;
  make(): void;
  createDataURL(cellSize?: number, margin?: number): string;
};

declare function qrcode(typeNumber: number, errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H'): QrInstance;

export default qrcode;
