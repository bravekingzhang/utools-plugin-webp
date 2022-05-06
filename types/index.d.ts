declare namespace Webp {
  export interface FIleItem {
    name: string;
    path: string;
    size: number;
  }
  export interface Progress {
    progress: number;
    type: 'upload' | 'compress' | 'download';
  }
  export interface Response {
    input: Response.Input;
    output: Response.Output;
  }

  export interface List extends FIleItem {
    progress: number;
    surplus: number;
    error: string;
    webpCompress: import('@/preload/webp').WebpCompress;
  }
}

declare namespace Response {
  export interface Input {
    size: number;
    type: string;
  }
  export interface Output {
    height: number;
    ratio: number;
    size: number;
    type: string;
    url: string;
    width: number;
  }
}

declare interface Window {
  tempPath: string;
  utils: typeof import('@/preload/utils');
  webp: typeof import('@/preload/webp');
  fs: typeof import('fs');
  path: typeof import('path');
  APP: any;
}
