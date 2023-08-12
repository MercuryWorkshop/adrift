/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADRIFT_DEV: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const Ultraviolet: any;
declare const __uv$config: any;